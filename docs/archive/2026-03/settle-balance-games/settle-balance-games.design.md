# Design: settle-balance-games

> 작성일: 2026-03-22 | Plan 참조: `docs/01-plan/features/settle-balance-games.plan.md`

---

## 1. 전체 구조

```
[Supabase Cron] ──매시간──→ [Edge Function: settle-balance-games]
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              만료 게임 탐지    정산 계산         결과 기록
              (posts 조회)   (proximity, C)   (post_results)
                                    │
                            credits bulk INSERT
                            (service_role key)
```

```
[post.html 로드] → post.js
  ├─ expires_at 확인
  │    ├─ 진행중: D-day 배지 렌더
  │    └─ 만료: post_results 조회
  │              ├─ credits_paid=true: 결과 배너 렌더
  │              └─ credits_paid=false: "집계 중..." 표시
  └─ isBlindMode(): 마감 1시간 전 처리 (기구현)
```

---

## 2. Edge Function 설계

### 2-1. 파일 구조

```
supabase/functions/settle-balance-games/
  └── index.ts          — 메인 함수
```

### 2-2. 환경 변수

| 변수 | 값 | 용도 |
|------|-----|------|
| `SUPABASE_URL` | 자동 주입 | DB 접속 |
| `SUPABASE_SERVICE_ROLE_KEY` | 자동 주입 | RLS 우회 (credits INSERT) |

### 2-3. 전체 코드 설계

```typescript
// supabase/functions/settle-balance-games/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 50;  // 타임아웃 방지
const K = 1.0;          // 크레딧 계수 (조정 가능)

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. 만료됐지만 미정산 게임 조회
  const { data: posts } = await supabase
    .from('posts')
    .select('id, user_id, category')
    .eq('category', '밸런스게임')
    .lte('expires_at', new Date().toISOString())
    .not('id', 'in',
      supabase.from('post_results').select('post_id')
    )
    .limit(BATCH_SIZE);

  if (!posts?.length) {
    return new Response(JSON.stringify({ settled: 0 }), { status: 200 });
  }

  let settled = 0;
  for (const post of posts) {
    try {
      await settlePost(supabase, post, K);
      settled++;
    } catch (e) {
      console.error(`settle failed for ${post.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ settled }), { status: 200 });
});
```

### 2-4. settlePost 함수 상세

```typescript
async function settlePost(supabase, post, K) {

  // ── Step 1: 투표 집계 ──────────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, choice')
    .eq('post_id', post.id);

  const allVotes    = votes ?? [];
  const votesA      = allVotes.filter(v => v.choice === 'A').length;
  const votesB      = allVotes.filter(v => v.choice === 'B').length;
  const totalVotes  = votesA + votesB;

  // 로그인 투표자만 C 계산에 사용 (guest_id만 있는 경우 제외)
  const loggedIn    = allVotes.filter(v => v.user_id);
  const loggedInA   = loggedIn.filter(v => v.choice === 'A');
  const loggedInB   = loggedIn.filter(v => v.choice === 'B');

  // ── Step 2: 근접도 + C 계산 ────────────────────────────────────
  const pctA = totalVotes > 0 ? (votesA / totalVotes) * 100 : 50;
  const proximity = 1 - Math.abs(pctA - 50) / 50;
  const C = Math.round(proximity * loggedIn.length * K);

  // ── Step 3: 승리 진영 결정 ─────────────────────────────────────
  const winningSide =
    votesA > votesB ? 'A' :
    votesB > votesA ? 'B' : 'tie';

  // ── Step 4: post_results INSERT (정산 시작 기록) ───────────────
  // 멱등성: 이미 있으면 스킵 (race condition 방지)
  const { error: prErr } = await supabase
    .from('post_results')
    .insert({
      post_id: post.id,
      winning_side: winningSide,
      votes_a: votesA,
      votes_b: votesB,
      logged_in_voters: loggedIn.length,
      proximity,
      creator_reward: C,
      credits_paid: false,
      resolved_at: new Date().toISOString(),
    })
    .select()
    .single();

  // 이미 정산된 경우 (중복 실행) 스킵
  if (prErr?.code === '23505') return;  // unique violation

  // ── Step 5: 로그인 투표자 없으면 credits_paid만 true로 종료 ────
  if (loggedIn.length === 0 || C === 0) {
    await supabase
      .from('post_results')
      .update({ credits_paid: true })
      .eq('post_id', post.id);
    return;
  }

  // ── Step 6: credits INSERT ─────────────────────────────────────
  const creditRows = [];

  if (winningSide === 'tie') {
    // 동률: 로그인 참여자 전원 균등 분배
    const perPerson = parseFloat((C / loggedIn.length).toFixed(2));
    loggedIn.forEach(v => {
      creditRows.push({
        user_id: v.user_id, amount: perPerson,
        reason: 'vote_win', post_id: post.id
      });
    });
  } else {
    // 승리팀: 기여도 비례 분배
    const winners = winningSide === 'A' ? loggedInA : loggedInB;
    const winnerIds = [...new Set(winners.map(v => v.user_id))];

    // 설득됨 포인트 (persuasion_likes에서 선택된 댓글 작성자 집계)
    const { data: persuasionRows } = await supabase
      .from('persuasion_likes')
      .select('comment_id, comments!inner(user_id)')
      .eq('post_id', post.id)
      .in('comments.user_id', winnerIds);

    const persuasionMap = {};
    (persuasionRows ?? []).forEach(r => {
      const uid = r.comments.user_id;
      persuasionMap[uid] = (persuasionMap[uid] ?? 0) + 1;
    });

    // 댓글 좋아요 합계
    const { data: likeRows } = await supabase
      .from('comment_likes')
      .select('comments!inner(user_id, post_id)')
      .eq('comments.post_id', post.id)
      .in('comments.user_id', winnerIds);

    const likeMap = {};
    (likeRows ?? []).forEach(r => {
      const uid = r.comments.user_id;
      likeMap[uid] = (likeMap[uid] ?? 0) + 1;
    });

    // 기여점수 계산
    const scores = winnerIds.map(uid => ({
      user_id: uid,
      score: (persuasionMap[uid] ?? 0) * 3 + (likeMap[uid] ?? 0) * 1
    }));
    const totalScore = scores.reduce((s, r) => s + r.score, 0);

    scores.forEach(({ user_id, score }) => {
      const amount = totalScore > 0
        ? parseFloat((C * score / totalScore).toFixed(2))
        : parseFloat((C / winnerIds.length).toFixed(2));
      if (amount > 0) {
        creditRows.push({ user_id, amount, reason: 'vote_win', post_id: post.id });
      }
    });
  }

  // 제작자 보상 (탈퇴하지 않은 경우만)
  if (post.user_id && C > 0) {
    creditRows.push({
      user_id: post.user_id, amount: C,
      reason: 'creator_reward', post_id: post.id
    });
  }

  // bulk INSERT
  if (creditRows.length > 0) {
    await supabase.from('credits').insert(creditRows);
  }

  // ── Step 7: credits_paid = true 마킹 ──────────────────────────
  await supabase
    .from('post_results')
    .update({ credits_paid: true })
    .eq('post_id', post.id);
}
```

---

## 3. Cron 설정

### 방법 A: Supabase Dashboard (권장)

```
Dashboard → Edge Functions → settle-balance-games → Schedule
Cron: 0 * * * *   (매 시간 정각)
```

### 방법 B: pg_cron (SQL)

```sql
-- pg_cron 확장 활성화 필요 (Dashboard → Database → Extensions)
SELECT cron.schedule(
  'settle-balance-games',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://mwsfzxhblboskdlffsxi.supabase.co/functions/v1/settle-balance-games',
      headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
    );
  $$
);
```

> 권장: Dashboard Schedule (pg_cron보다 관리 편의성 높음)

---

## 4. post.js 설계 (UI 연동)

### 4-1. D-day 배지

```javascript
// renderPost() 내 isVote 블록에 추가
function renderExpiryBadge(expiresAt) {
  if (!expiresAt) return '';
  const msLeft = new Date(expiresAt) - Date.now();
  if (msLeft <= 0) return `<span class="expiry-badge expiry-ended">종료</span>`;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  if (daysLeft === 0) return `<span class="expiry-badge expiry-today">D-day</span>`;
  return `<span class="expiry-badge expiry-active">D-${daysLeft}</span>`;
}
```

**삽입 위치**: `#voteSection` 상단 제목 옆

### 4-2. 정산 결과 배너

```javascript
async function loadPostResult(postId) {
  const { data } = await db
    .from('post_results')
    .select('winning_side,votes_a,votes_b,proximity,creator_reward,credits_paid')
    .eq('post_id', postId)
    .maybeSingle();
  return data;
}

function renderResultBanner(result, post) {
  if (!result) return;                              // 정산 없음 (만료 전)
  const banner = document.getElementById('resultBanner');
  if (!banner) return;

  if (!result.credits_paid) {
    banner.innerHTML = `<div class="result-banner result-pending">집계 중입니다...</div>`;
    banner.style.display = '';
    return;
  }

  const winLabel = result.winning_side === 'A'
    ? escapeHtml(post.option_a || 'A')
    : result.winning_side === 'B'
    ? escapeHtml(post.option_b || 'B')
    : '동률';

  banner.innerHTML = `
    <div class="result-banner">
      <div class="result-winner">
        <span class="result-winner-label">승리</span>
        <span class="result-winner-name">${winLabel}</span>
      </div>
      <div class="result-stats">
        <span>근접도 ${(result.proximity * 100).toFixed(0)}%</span>
        <span>제작자 +${result.creator_reward} 크레딧</span>
      </div>
    </div>`;
  banner.style.display = '';
}
```

**호출 시점**: `renderPost()` 내 isVote 블록, `expires_at <= now()` 조건 시

### 4-3. 수정 파일 목록

| 파일 | 수정 내용 |
|------|---------|
| `platform/js/post.js` | `renderExpiryBadge()`, `loadPostResult()`, `renderResultBanner()` 추가 |
| `platform/post.html` | `#resultBanner` div, `.expiry-badge` HTML 추가 |
| `platform/css/style.css` | `.expiry-badge`, `.result-banner` 스타일 추가 |

---

## 5. HTML 구조 (post.html)

```html
<!-- #voteSection 내부 상단 -->
<div id="expiryBadgeWrap"></div>

<!-- #voteSection 하단 (투표 바 아래) -->
<div id="resultBanner" style="display:none"></div>
```

---

## 6. CSS 설계

```css
/* 만료 D-day 배지 */
.expiry-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 8px;
  vertical-align: middle;
}
.expiry-active { background: rgba(113,216,247,0.15); color: #71d8f7; border: 1px solid rgba(113,216,247,0.3); }
.expiry-today  { background: rgba(255,159,67,0.15);  color: #ff9f43; border: 1px solid rgba(255,159,67,0.3); }
.expiry-ended  { background: rgba(180,180,180,0.15); color: #aaa;    border: 1px solid rgba(180,180,180,0.2); }

/* 정산 결과 배너 */
.result-banner {
  margin-top: 16px;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(113,216,247,0.08), rgba(255,201,71,0.08));
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.result-pending { color: var(--text-muted); font-size: 0.85rem; justify-content: center; }
.result-winner  { display: flex; align-items: center; gap: 8px; }
.result-winner-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.result-winner-name  { font-size: 1rem; font-weight: 700; color: var(--text); }
.result-stats   { display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-muted); }
```

---

## 7. 멱등성 및 에러 처리

| 시나리오 | 처리 |
|---------|------|
| Cron 중복 실행 | `post_results` INSERT 시 `23505`(unique violation) 감지 → 스킵 |
| credits_paid=false인 게임 재실행 | `post_results`가 이미 있으면 credits INSERT는 여전히 실패 위험 → 단순 재실행 방지로 충분 |
| 로그인 투표자 0명 | C=0 → credits 미지급, post_results만 기록 |
| 제작자 탈퇴 | `post.user_id = null` → `creator_reward` 행 스킵 |
| Edge Function 타임아웃 | `BATCH_SIZE = 50` 제한 → 다음 Cron에서 나머지 처리 |

---

## 8. 구현 순서 (Do Phase)

1. `supabase/functions/settle-balance-games/index.ts` 작성
2. `supabase functions deploy settle-balance-games` 배포
3. Cron 트리거 설정 (Dashboard)
4. 로컬 테스트: `supabase functions serve` + 수동 invoke
5. `platform/post.html` — `#expiryBadgeWrap`, `#resultBanner` 추가
6. `platform/js/post.js` — `renderExpiryBadge`, `loadPostResult`, `renderResultBanner` 구현
7. `platform/css/style.css` — 배지/배너 스타일 추가
8. 만료 게임 생성 후 E2E 테스트
