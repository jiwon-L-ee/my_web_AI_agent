// settle-balance-games Edge Function
// Cron: 매 시간 만료된 밸런스게임을 탐지하여 크레딧을 정산합니다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 50;
const K = 1.0; // 크레딧 계수 (경제 균형 보며 조정)

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 만료됐지만 아직 post_results에 없는 게임 조회
  const { data: settledIds } = await supabase
    .from('post_results')
    .select('post_id');

  const excludeIds = (settledIds ?? []).map((r: { post_id: string }) => r.post_id);

  let query = supabase
    .from('posts')
    .select('id, user_id')
    .eq('category', '밸런스게임')
    .lte('expires_at', new Date().toISOString())
    .limit(BATCH_SIZE);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.map((id: string) => `"${id}"`).join(',')})`);
  }

  const { data: posts, error } = await query;

  if (error) {
    console.error('posts query error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!posts?.length) {
    return new Response(JSON.stringify({ settled: 0, message: '정산할 게임 없음' }), { status: 200 });
  }

  let settled = 0;
  const errors: string[] = [];

  for (const post of posts) {
    try {
      await settlePost(supabase, post);
      settled++;
    } catch (e) {
      const msg = `[${post.id}] ${e instanceof Error ? e.message : String(e)}`;
      console.error('settle error:', msg);
      errors.push(msg);
    }
  }

  return new Response(
    JSON.stringify({ settled, errors: errors.length ? errors : undefined }),
    { status: 200 }
  );
});

async function settlePost(
  supabase: ReturnType<typeof createClient>,
  post: { id: string; user_id: string | null }
) {
  // ── 1. 투표 집계 ─────────────────────────────────────────────────
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('user_id, choice')
    .eq('post_id', post.id);

  if (votesErr) throw votesErr;

  const allVotes   = votes ?? [];
  const votesA     = allVotes.filter((v: { choice: string }) => v.choice === 'A').length;
  const votesB     = allVotes.filter((v: { choice: string }) => v.choice === 'B').length;
  const totalVotes = votesA + votesB;

  // 로그인 투표자만 C 계산에 사용 (guest_id 전용 투표 제외)
  const loggedIn  = allVotes.filter((v: { user_id: string | null }) => v.user_id);
  const loggedInA = loggedIn.filter((v: { choice: string }) => v.choice === 'A');
  const loggedInB = loggedIn.filter((v: { choice: string }) => v.choice === 'B');

  // ── 2. 근접도 + C 계산 ──────────────────────────────────────────
  const pctA      = totalVotes > 0 ? (votesA / totalVotes) * 100 : 50;
  const proximity = parseFloat((1 - Math.abs(pctA - 50) / 50).toFixed(4));
  const C         = Math.round(proximity * loggedIn.length * K);

  // ── 3. 승리 진영 결정 ───────────────────────────────────────────
  const winningSide =
    votesA > votesB ? 'A' :
    votesB > votesA ? 'B' : 'tie';

  // ── 4. post_results INSERT (정산 시작 마킹) ─────────────────────
  const { error: prErr } = await supabase
    .from('post_results')
    .insert({
      post_id:          post.id,
      winning_side:     winningSide,
      votes_a:          votesA,
      votes_b:          votesB,
      logged_in_voters: loggedIn.length,
      proximity,
      creator_reward:   C,
      credits_paid:     false,
      resolved_at:      new Date().toISOString(),
    });

  // 23505 = unique_violation → 이미 정산됨, 스킵
  if (prErr) {
    if (prErr.code === '23505') return;
    throw prErr;
  }

  // ── 5. 투표자 없거나 C = 0 → credits_paid만 true로 종료 ─────────
  if (loggedIn.length === 0 || C === 0) {
    await supabase
      .from('post_results')
      .update({ credits_paid: true })
      .eq('post_id', post.id);
    return;
  }

  // ── 6. credits 계산 ──────────────────────────────────────────────
  const creditRows: Array<{
    user_id: string;
    amount: number;
    reason: string;
    post_id: string;
  }> = [];

  if (winningSide === 'tie') {
    // 동률: 로그인 참여자 전원 균등 분배
    const perPerson = parseFloat((C / loggedIn.length).toFixed(2));
    for (const v of loggedIn) {
      if (v.user_id) {
        creditRows.push({ user_id: v.user_id, amount: perPerson, reason: 'vote_win', post_id: post.id });
      }
    }
  } else {
    // 승리팀 기여도 비례 분배
    const winners   = winningSide === 'A' ? loggedInA : loggedInB;
    const winnerIds = [...new Set(winners.map((v: { user_id: string }) => v.user_id))];

    if (winnerIds.length === 0) {
      // 승리팀 로그인 투표자 없으면 종료
      await supabase.from('post_results').update({ credits_paid: true }).eq('post_id', post.id);
      return;
    }

    // 설득됨 포인트: persuasion_likes에서 선택된 댓글의 작성자 집계
    const { data: persuasionRows } = await supabase
      .from('persuasion_likes')
      .select('comment_id, comments!inner(user_id, post_id)')
      .eq('comments.post_id', post.id);

    const persuasionMap: Record<string, number> = {};
    for (const r of (persuasionRows ?? [])) {
      const uid = (r as { comments: { user_id: string } }).comments.user_id;
      if (winnerIds.includes(uid)) {
        persuasionMap[uid] = (persuasionMap[uid] ?? 0) + 1;
      }
    }

    // 댓글 좋아요 합계: 승리팀 댓글에 받은 좋아요
    const { data: likeRows } = await supabase
      .from('comment_likes')
      .select('comments!inner(user_id, post_id)')
      .eq('comments.post_id', post.id);

    const likeMap: Record<string, number> = {};
    for (const r of (likeRows ?? [])) {
      const uid = (r as { comments: { user_id: string } }).comments.user_id;
      if (winnerIds.includes(uid)) {
        likeMap[uid] = (likeMap[uid] ?? 0) + 1;
      }
    }

    // 기여점수: (설득됨×3) + (좋아요×1)
    const scores = winnerIds.map((uid: string) => ({
      user_id: uid,
      score: (persuasionMap[uid] ?? 0) * 3 + (likeMap[uid] ?? 0) * 1,
    }));
    const totalScore = scores.reduce((s, r) => s + r.score, 0);

    for (const { user_id, score } of scores) {
      const amount = totalScore > 0
        ? parseFloat((C * score / totalScore).toFixed(2))
        : parseFloat((C / winnerIds.length).toFixed(2));
      if (amount > 0) {
        creditRows.push({ user_id, amount, reason: 'vote_win', post_id: post.id });
      }
    }
  }

  // 제작자 보상 (탈퇴하지 않은 경우만)
  if (post.user_id && C > 0) {
    creditRows.push({ user_id: post.user_id, amount: C, reason: 'creator_reward', post_id: post.id });
  }

  // ── 7. credits bulk INSERT ───────────────────────────────────────
  if (creditRows.length > 0) {
    const { error: credErr } = await supabase.from('credits').insert(creditRows);
    if (credErr) throw credErr;
  }

  // ── 8. credits_paid = true 마킹 ─────────────────────────────────
  await supabase
    .from('post_results')
    .update({ credits_paid: true })
    .eq('post_id', post.id);
}
