// post.js — post detail, vote, comments

let currentUser = null;
let post = null;
let isLiked = false;
let likeId = null;

let voteCountA = 0;
let voteCountB = 0;
let userVote = null; // null | 'A' | 'B'
let isVoting = false;
let voteTimestamp = null; // 최초 투표 시각 (1분 무료 변경 버퍼용)

// 밸런스게임 댓글 상태
let myComment = null;              // 내 기존 댓글 (id, content, side)
let myPersuasionLikeId = null;     // 내 설득됨 좋아요 ID
let myPersuasionCommentId = null;  // 내가 설득됨을 준 comment_id
let canPersuasionLike = false;     // "설득됐어요" 선택 후 true

// ── 만료 D-day 배지 ───────────────────────────────────────────────
function renderExpiryBadge() {
  const el = document.getElementById('expiryBadge');
  if (!el || !post?.expires_at) return;
  const msLeft = new Date(post.expires_at) - Date.now();
  if (msLeft <= 0) {
    el.innerHTML = `<span class="expiry-badge expiry-ended">종료</span>`;
  } else {
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    if (daysLeft === 0) {
      el.innerHTML = `<span class="expiry-badge expiry-today">D-day</span>`;
    } else {
      el.innerHTML = `<span class="expiry-badge expiry-active">D-${daysLeft}</span>`;
    }
  }
}

// ── 정산 결과 배너 ─────────────────────────────────────────────────
async function loadAndRenderResult() {
  if (!post?.expires_at) return;
  if (new Date(post.expires_at) > new Date()) return; // 아직 진행 중

  const { data: result } = await db
    .from('post_results')
    .select('winning_side,votes_a,votes_b,proximity,creator_reward,credits_paid')
    .eq('post_id', postId)
    .maybeSingle();

  const banner = document.getElementById('resultBanner');
  if (!banner) return;

  if (!result) {
    banner.innerHTML = `<div class="result-banner result-pending">집계 중입니다...</div>`;
    banner.style.display = '';
    return;
  }

  if (!result.credits_paid) {
    banner.innerHTML = `<div class="result-banner result-pending">크레딧 배분 중입니다...</div>`;
    banner.style.display = '';
    return;
  }

  let winLabel;
  if (result.winning_side === 'A') {
    winLabel = escapeHtml(post.option_a || 'A');
  } else if (result.winning_side === 'B') {
    winLabel = escapeHtml(post.option_b || 'B');
  } else {
    winLabel = '동률';
  }

  const pctA = result.votes_a + result.votes_b > 0
    ? Math.round(result.votes_a / (result.votes_a + result.votes_b) * 100)
    : 50;
  const pctB = 100 - pctA;

  banner.innerHTML = `
    <div class="result-banner">
      <div class="result-winner">
        <span class="result-winner-label">최종 승리</span>
        <span class="result-winner-name">${winLabel}</span>
      </div>
      <div class="result-stats">
        <span>${pctA}% vs ${pctB}%</span>
        <span>근접도 ${Math.round(result.proximity * 100)}%</span>
        <span>제작자 +${result.creator_reward} 크레딧</span>
      </div>
    </div>`;
  banner.style.display = '';
}

// ── 블라인드 모드 유틸 ────────────────────────────────────────────
function isBlindMode() {
  if (!post?.expires_at) return false;
  const msLeft = new Date(post.expires_at) - Date.now();
  return msLeft > 0 && msLeft < 60 * 60 * 1000; // 0 < 남은시간 < 1시간
}

// 블라인드 + ab_flipped 시 표시 매핑 반환
function getDisplayMapping() {
  const blind = isBlindMode();
  if (blind && post?.ab_flipped) {
    return { displayA: post.option_b, displayB: post.option_a, flipped: true };
  }
  return { displayA: post?.option_a, displayB: post?.option_b, flipped: false };
}

// 화면상 A/B → DB A/B 변환 (ab_flipped 적용 시)
function resolveDbChoice(displayChoice) {
  const { flipped } = getDisplayMapping();
  if (!flipped) return displayChoice;
  return displayChoice === 'A' ? 'B' : 'A';
}

// DB A/B → 화면 A/B 변환
function resolveDisplayChoice(dbChoice) {
  const { flipped } = getDisplayMapping();
  if (!flipped) return dbChoice;
  return dbChoice === 'A' ? 'B' : 'A';
}

const postId = new URLSearchParams(location.search).get('id');

async function init() {
  if (!postId) { location.href = 'index.html'; return; }

  currentUser = await getUser();
  initAuth();

  // 홈 투표 모달에서 진입 시 뒤로가기 버튼 표시
  if (new URLSearchParams(location.search).get('from') === 'home') {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.style.display = '';
      backBtn.addEventListener('click', () => history.back());
    }
  }

  await loadPost();
  await incrementView();
  if (currentUser) await checkLike();
  loadComments();
}

async function loadPost() {
  const { data, error } = await db
    .from('posts')
    .select('*,profiles(id,username,avatar_url),likes(count),comments(count)')
    .eq('id', postId)
    .single();

  if (error || !data) {
    document.getElementById('postLoading').style.display = 'none';
    document.getElementById('postContent').innerHTML = '<p style="text-align:center;padding:60px;color:var(--text-muted)">게시물을 찾을 수 없습니다.</p>';
    document.getElementById('postContent').style.display = '';
    return;
  }

  post = data;
  await renderPost(post);
}

async function renderPost(p) {
  const likeCount = p.likes?.[0]?.count ?? 0;
  const commentCount = p.comments?.[0]?.count ?? 0;
  const author = p.profiles;

  document.title = `${p.title} | 맞불`;

  document.getElementById('postBadge').innerHTML = `<span class="badge badge-${escapeHtml(p.category)}" style="position:static">${escapeHtml(p.category)}</span>`;
  document.getElementById('postTitle').textContent = p.title;

  const avatarEl = document.getElementById('authorAvatar');
  if (author?.avatar_url) {
    avatarEl.src = author.avatar_url;
    avatarEl.alt = `${escapeHtml(author.username ?? '유저')} 아바타`;
    avatarEl.style.display = '';
  } else {
    avatarEl.style.display = 'none';
    document.getElementById('authorAvatarPlaceholder').textContent = (author?.username ?? '?')[0];
    document.getElementById('authorAvatarPlaceholder').style.display = 'flex';
  }

  document.getElementById('authorName').textContent = author?.username ?? '익명';
  document.getElementById('postTime').textContent = relativeTime(p.created_at);
  document.getElementById('viewCount').textContent = p.view_count;
  document.getElementById('likeCount').textContent = likeCount;
  document.getElementById('commentCount').textContent = commentCount;

  document.getElementById('authorLink').href = `profile.html?id=${author?.id}`;

  if (p.description) {
    document.getElementById('postDescription').textContent = p.description;
    document.getElementById('postDescription').style.display = '';
  }

  if (currentUser && currentUser.id === p.user_id) {
    document.getElementById('deleteBtn').style.display = '';
    document.getElementById('deleteBtn').addEventListener('click', deletePost);
  }

  document.getElementById('postContent').style.display = '';
  document.getElementById('postLoading').style.display = 'none';

  const likeBtn = document.getElementById('likeBtn');
  likeBtn.addEventListener('click', toggleLike);

  const isVote = p.category === '밸런스게임';
  const isQuiz = p.category === '퀴즈';
  const isTest = p.category === '테스트';

  document.getElementById('voteSection').style.display  = isVote ? '' : 'none';
  document.getElementById('quizSection').style.display  = isQuiz ? '' : 'none';
  document.getElementById('testSection').style.display  = isTest ? '' : 'none';

  if (isVote) {
    renderExpiryBadge();
    await loadVotes(postId);
    renderVoteUI(p);
    await loadAndRenderResult();
    setupPersuasionModal();
    setupVoteChangeModal();
    if (currentUser) {
      await loadMyComment();
      await loadPersuasionLike();
    }
    updateCommentForm();
  }

  if (isQuiz) {
    document.getElementById('quizPlayBtn').href = `quiz.html?id=${postId}`;
    const { count } = await db.from('quiz_questions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    const metaEl = document.getElementById('quizPlayMeta');
    if (count) metaEl.textContent = `총 ${count}문제`;
    const typeLabels = { ox:'O/X 퀴즈', multiple:'객관식', short:'단답형', subjective:'주관식' };
    const label = document.getElementById('quizPlayLabel');
    if (p.quiz_type && typeLabels[p.quiz_type]) label.textContent = typeLabels[p.quiz_type];
  }

  if (isTest) {
    document.getElementById('testPlayBtn').href = `test.html?id=${postId}`;
  }
}

async function incrementView() {
  await db.rpc('increment_view_count', { post_id: postId });
}

async function checkLike() {
  const { data } = await db.from('likes').select('id').eq('user_id', currentUser.id).eq('post_id', postId).maybeSingle();
  isLiked = !!data;
  likeId = data?.id ?? null;
  updateLikeBtn();
}

function updateLikeBtn() {
  const btn = document.getElementById('likeBtn');
  btn.classList.toggle('liked', isLiked);
  const count = document.getElementById('likeCount')?.textContent ?? 0;
  const heartSvg = isLiked
    ? `<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/></svg>`;
  btn.innerHTML = `${heartSvg} <span id="likeCount">${count}</span>`;
}

async function toggleLike() {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  const countEl = document.getElementById('likeCount');
  const count = parseInt(countEl?.textContent ?? '0');

  if (isLiked) {
    await db.from('likes').delete().eq('id', likeId);
    isLiked = false;
    likeId = null;
    if (countEl) countEl.textContent = Math.max(0, count - 1);
  } else {
    const { data } = await db.from('likes').insert({ user_id: currentUser.id, post_id: postId }).select('id').single();
    isLiked = true;
    likeId = data?.id ?? null;
    if (countEl) countEl.textContent = count + 1;
  }
  updateLikeBtn();
}

async function deletePost() {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await db.from('posts').delete().eq('id', postId).eq('user_id', currentUser.id);
  location.href = 'index.html';
}

// ── Vote ──────────────────────────────────────────────────────────
async function loadVotes(pid) {
  const countAQuery = db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', pid).eq('choice', 'A');
  const countBQuery = db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', pid).eq('choice', 'B');

  const [resA, resB] = await Promise.all([countAQuery, countBQuery]);
  voteCountA = resA.count ?? 0;
  voteCountB = resB.count ?? 0;

  {
    let q = db.from('votes').select('choice').eq('post_id', pid);
    if (currentUser) q = q.eq('user_id', currentUser.id);
    else q = q.eq('guest_id', getGuestId());
    const { data } = await q.maybeSingle();
    userVote = data?.choice ?? null;
  }
}

function renderVoteUI(p) {
  const { displayA, displayB } = getDisplayMapping();
  document.getElementById('voteChoiceA').textContent = displayA || 'A';
  document.getElementById('voteChoiceB').textContent = displayB || 'B';

  // 블라인드 모드 안내
  const blindBanner = document.getElementById('blindModeBanner');
  if (blindBanner) blindBanner.style.display = isBlindMode() ? '' : 'none';

  updateVoteBar();

  document.getElementById('voteSection').addEventListener('click', e => {
    const btn = e.target.closest('.vote-btn');
    if (!btn) return;
    const displayChoice = btn.dataset.choice;
    const dbChoice = resolveDbChoice(displayChoice);
    toggleVote(dbChoice, displayChoice);
  });
}

// dbChoice: DB에 저장될 실제 A/B 값 (ab_flipped 역변환 완료)
async function toggleVote(dbChoice, displayChoice) {
  if (isVoting) return;
  isVoting = true;

  const isGuest = !currentUser;
  const guestId = isGuest ? getGuestId() : null;

  try {
    if (userVote === dbChoice) {
      // 같은 선택 재클릭 → 1분 이내면 취소 허용 (1분 이후엔 취소 불가)
      if (voteTimestamp && Date.now() - voteTimestamp < 60_000) {
        let q = db.from('votes').delete().eq('post_id', postId);
        if (isGuest) q = q.eq('guest_id', guestId);
        else q = q.eq('user_id', currentUser.id);
        const { error } = await q;
        if (error) { console.error(error); return; }
        if (dbChoice === 'A') voteCountA = Math.max(0, voteCountA - 1);
        else voteCountB = Math.max(0, voteCountB - 1);
        userVote = null;
        voteTimestamp = null;
      }
      // 1분 이후엔 재클릭 무시 (아무 동작 안 함)
    } else if (userVote !== null) {
      // 진영 변경 시도 → 1분 이내: 무료 변경 / 이후: 크레딧+설득됨 모달
      if (voteTimestamp && Date.now() - voteTimestamp < 60_000) {
        // 1분 이내 무료 변경
        await applyVoteChange(dbChoice, isGuest, guestId, null);
        showPersuasionModal(); // 1분 버퍼 안내
      } else {
        // 1분 이후: 로그인 필요 + 설득됨+크레딧 모달 표시
        if (!currentUser) {
          location.href = 'login.html?next=' + encodeURIComponent(location.href);
          return;
        }
        isVoting = false; // 모달 열기 전 가드 해제
        showVoteChangeModal(dbChoice);
        return;
      }
    } else {
      // 신규 투표 → INSERT
      const insertData = { post_id: postId, choice: dbChoice };
      if (isGuest) insertData.guest_id = guestId;
      else insertData.user_id = currentUser.id;
      const { error } = await db.from('votes').insert(insertData);
      if (error) { console.error(error); return; }
      if (dbChoice === 'A') voteCountA++;
      else voteCountB++;
      userVote = dbChoice;
      voteTimestamp = Date.now();
    }
    updateVoteBar();
    updateCommentForm();
  } finally {
    isVoting = false;
  }
}

// 실제 투표 변경 적용 (무료 변경 or 크레딧 차감 후 호출)
async function applyVoteChange(dbChoice, isGuest, guestId, persuasionCommentId) {
  const prevVote = userVote;
  let q = db.from('votes').update({ choice: dbChoice }).eq('post_id', postId);
  if (isGuest) q = q.eq('guest_id', guestId);
  else q = q.eq('user_id', currentUser.id);
  const { error } = await q;
  if (error) { console.error(error); return; }

  if (dbChoice === 'A') { voteCountA++; voteCountB = Math.max(0, voteCountB - 1); }
  else { voteCountB++; voteCountA = Math.max(0, voteCountA - 1); }
  userVote = dbChoice;

  // persuasion 상태 초기화 + 기존 댓글 삭제
  canPersuasionLike = false;
  myPersuasionLikeId = null;
  myPersuasionCommentId = null;
  if (myComment) await deleteMyComment();

  // 설득됨 댓글이 있으면 persuasion_likes에 기록
  if (persuasionCommentId && currentUser) {
    const { data: plData } = await db.from('persuasion_likes')
      .upsert(
        { user_id: currentUser.id, post_id: postId, comment_id: persuasionCommentId },
        { onConflict: 'user_id,post_id' }
      )
      .select('id')
      .single();
    myPersuasionLikeId = plData?.id ?? null;
    myPersuasionCommentId = persuasionCommentId;
    canPersuasionLike = true;

    // vote_changes 이력 기록
    await db.from('vote_changes').insert({
      user_id: currentUser.id,
      post_id: postId,
      from_choice: prevVote,
      to_choice: dbChoice,
      comment_id: persuasionCommentId,
      credits_spent: 5,
    });
  }

  loadComments();
}

// ── 투표 변경 모달 (설득됨 선택 + 크레딧 차감) ───────────────────
async function showVoteChangeModal(targetDbChoice) {
  const modal = document.getElementById('voteChangeModal');
  if (!modal) return;

  // 상대 진영 댓글 로드 (DB 기준 userVote와 반대 진영)
  const opposingSide = userVote === 'A' ? 'B' : 'A';
  const { data: opposingComments } = await db
    .from('comments')
    .select('id,content,profiles(username)')
    .eq('post_id', postId)
    .eq('side', opposingSide)
    .order('created_at', { ascending: false })
    .limit(20);

  // 크레딧 잔액
  const { data: balData } = await db.from('credit_balances')
    .select('balance')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  const balance = Number(balData?.balance ?? 0);

  // 모달 내용 렌더
  const { displayA, displayB, flipped } = getDisplayMapping();
  // 표시 기준 opposing side
  const displayOpposingSide = flipped
    ? (opposingSide === 'A' ? 'B' : 'A')
    : opposingSide;
  const opposingLabel = displayOpposingSide === 'A'
    ? (displayA || 'A진영')
    : (displayB || 'B진영');

  const commentListHtml = opposingComments?.length
    ? opposingComments.map(c => `
        <label class="vc-comment-option">
          <input type="radio" name="persuasionComment" value="${c.id}">
          <span class="vc-comment-text">${escapeHtml(c.content)}</span>
          <span class="vc-comment-author">— ${escapeHtml(c.profiles?.username ?? '익명')}</span>
        </label>`).join('')
    : `<p class="vc-no-comments">아직 상대 진영 댓글이 없습니다 — 변경 불가</p>`;

  const hasComments = !!(opposingComments?.length);
  const enoughCredits = balance >= 5;
  const canChange = hasComments && enoughCredits;

  document.getElementById('voteChangeOpposingLabel').textContent = `${opposingLabel} 댓글`;
  document.getElementById('voteChangeCommentList').innerHTML = commentListHtml;
  document.getElementById('voteChangeCreditInfo').textContent =
    `변경 비용: 5 크레딧 (잔액: ${Math.floor(balance)})`;

  const confirmBtn = document.getElementById('voteChangeConfirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = !canChange;
    confirmBtn.textContent = canChange ? '변경하기 (-5 크레딧)' : (enoughCredits ? '댓글 없음' : '크레딧 부족');
    // data에 targetDbChoice 저장
    confirmBtn.dataset.targetChoice = targetDbChoice;
  }

  modal.style.display = '';
}

function setupVoteChangeModal() {
  const modal = document.getElementById('voteChangeModal');
  if (!modal) return;

  document.getElementById('voteChangeCancelBtn')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('voteChangeConfirmBtn')?.addEventListener('click', async () => {
    const selected = modal.querySelector('input[name="persuasionComment"]:checked');
    if (!selected) {
      alert('설득된 댓글을 선택해주세요.');
      return;
    }
    const confirmBtn = document.getElementById('voteChangeConfirmBtn');
    confirmBtn.disabled = true;
    const targetDbChoice = confirmBtn.dataset.targetChoice;
    const persuasionCommentId = selected.value;

    // 크레딧 차감 (RPC 사용)
    const { error: creditErr } = await db.rpc('spend_credits', { p_amount: 5, p_reason: 'vote_change', p_post_id: postId });
    if (creditErr) {
      alert('크레딧 차감에 실패했습니다.');
      confirmBtn.disabled = false;
      return;
    }

    modal.style.display = 'none';

    isVoting = true;
    await applyVoteChange(targetDbChoice, false, null, persuasionCommentId);
    isVoting = false;
    updateVoteBar();
    updateCommentForm();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

function updateVoteBar() {
  const total = voteCountA + voteCountB;
  const pctA = total > 0 ? (voteCountA / total) * 100 : 50;
  const pctB = total > 0 ? (voteCountB / total) * 100 : 50;
  const blind = isBlindMode();

  // 블라인드 모드: % 숨김
  const voteBarA = document.getElementById('voteBarA');
  const voteBarB = document.getElementById('voteBarB');
  if (voteBarA) voteBarA.style.width = blind ? '50%' : pctA + '%';
  if (voteBarB) voteBarB.style.width = blind ? '50%' : pctB + '%';

  const cntAEl = document.getElementById('voteCountA');
  const cntBEl = document.getElementById('voteCountB');
  if (cntAEl) cntAEl.textContent = blind ? '??' : voteCountA + '표';
  if (cntBEl) cntBEl.textContent = blind ? '??' : voteCountB + '표';

  // 활성 버튼: DB 기준 userVote → 화면 기준으로 변환
  const displayVote = userVote ? resolveDisplayChoice(userVote) : null;
  document.querySelector('.vote-btn-a')?.classList.toggle('active', displayVote === 'A');
  document.querySelector('.vote-btn-b')?.classList.toggle('active', displayVote === 'B');

  // 배경 분할 + 불꽃 세기 동적 반영 (홈 hero-battle과 동일 공식)
  const voteBattle = document.querySelector('.vote-battle');
  if (voteBattle && total > 0) {
    voteBattle.style.setProperty('--vb-pct-a', pctA.toFixed(1) + '%');

    const applyFlame = (side, pct) => {
      const opacity = (0.25 + (pct / 100) * 0.75).toFixed(2);
      const sat     = Math.round(60 + pct * 1.4) + '%';
      const bright  = (0.6  + (pct / 100) * 0.5).toFixed(2);
      const scale   = (0.65 + (pct / 100) * 0.5).toFixed(2);
      voteBattle.style.setProperty('--flame-' + side + '-opacity', opacity);
      voteBattle.style.setProperty('--flame-' + side + '-sat',     sat);
      voteBattle.style.setProperty('--flame-' + side + '-bright',  bright);
      voteBattle.style.setProperty('--flame-' + side + '-scale',   scale);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyFlame('a', pctA);
        applyFlame('b', pctB);
      });
    });
  }
}

// ── 설득됨 모달 ────────────────────────────────────────────────────
function showPersuasionModal() {
  const modal = document.getElementById('persuasionModal');
  if (modal) modal.style.display = '';
}

function setupPersuasionModal() {
  const modal = document.getElementById('persuasionModal');
  if (!modal) return;

  // 1분 이내 무료 변경 확인 버튼
  document.getElementById('persuasionSelf')?.addEventListener('click', () => {
    modal.style.display = 'none';
    loadComments();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ── 내 댓글 로드 (밸런스게임 1댓글 제한) ──────────────────────────
async function loadMyComment() {
  if (!currentUser) return;
  const { data } = await db.from('comments')
    .select('id,content,side')
    .eq('post_id', postId)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  myComment = data ?? null;
}

// ── 내 설득됨 좋아요 로드 ─────────────────────────────────────────
async function loadPersuasionLike() {
  if (!currentUser) return;
  const { data } = await db.from('persuasion_likes')
    .select('id,comment_id')
    .eq('post_id', postId)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  myPersuasionLikeId = data?.id ?? null;
  myPersuasionCommentId = data?.comment_id ?? null;
  if (data) canPersuasionLike = true;
}

// ── 내 댓글 삭제 (투표 변경 시 기존 진영 댓글 제거) ────────────
async function deleteMyComment() {
  if (!myComment || !currentUser) return;
  const { error } = await db.from('comments')
    .delete()
    .eq('id', myComment.id)
    .eq('user_id', currentUser.id);
  if (!error) {
    myComment = null;
    updateCommentForm();
    loadComments();
  }
}

// ── 댓글 폼 업데이트 (밸런스게임: 투표 전 안내, 기존 댓글 prefill) ──
function updateCommentForm() {
  if (post?.category !== '밸런스게임') return;
  const textarea = document.getElementById('commentInput');
  const submitBtn = document.getElementById('commentSubmitBtn');
  const sideTag = document.getElementById('commentSideTag');
  const formInner = document.getElementById('commentFormInner');
  if (!textarea) return;

  if (!userVote) {
    textarea.placeholder = '먼저 투표해주세요';
    textarea.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (sideTag) sideTag.style.display = 'none';
    if (formInner) formInner.className = 'comment-form';
  } else {
    textarea.disabled = false;
    if (submitBtn) submitBtn.disabled = false;

    // 진영 태그 표시
    if (sideTag) {
      const choiceLabel = post.option_a && post.option_b
        ? (userVote === 'A' ? post.option_a : post.option_b)
        : (userVote === 'A' ? 'A' : 'B');
      sideTag.textContent = userVote === 'A' ? `A진영 · ${choiceLabel}` : `B진영 · ${choiceLabel}`;
      sideTag.className = `comment-side-tag comment-side-tag-${userVote.toLowerCase()}`;
      sideTag.style.display = '';
    }
    if (formInner) formInner.className = `comment-form comment-form-${userVote.toLowerCase()}`;

    if (myComment) {
      if (!textarea.value) textarea.value = myComment.content;
      textarea.placeholder = '내 주장을 수정할 수 있어요';
      if (submitBtn) submitBtn.textContent = '수정';
    } else {
      textarea.placeholder = '내 주장을 입력하세요 (Enter로 제출, Shift+Enter로 줄바꿈)';
      if (submitBtn) submitBtn.textContent = '작성';
    }
  }
}

// ── 설득됨 좋아요 토글 ────────────────────────────────────────────
async function togglePersuasionLike(commentId) {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  if (myPersuasionCommentId === commentId) {
    // 취소
    const { error } = await db.from('persuasion_likes')
      .delete()
      .eq('id', myPersuasionLikeId);
    if (error) { console.error(error); return; }
    myPersuasionLikeId = null;
    myPersuasionCommentId = null;
  } else {
    // 신규 or 변경 (upsert)
    const { data, error } = await db.from('persuasion_likes')
      .upsert(
        { user_id: currentUser.id, post_id: postId, comment_id: commentId },
        { onConflict: 'user_id,post_id' }
      )
      .select('id')
      .single();
    if (error) { console.error(error); return; }
    myPersuasionLikeId = data?.id ?? null;
    myPersuasionCommentId = commentId;
  }
  // 댓글 전체를 다시 로드해 카운트 최신화 (버튼도 사라지고 카운트만 남음)
  await loadComments();
}

// ── 댓글 아이템 렌더 ──────────────────────────────────────────────
function renderCommentItem(c, myLikedCommentIds, isVotePost) {
  const author = c.profiles;
  const isOwn  = currentUser?.id === c.user_id;
  const likeCount = c.comment_likes?.[0]?.count ?? 0;
  const liked  = myLikedCommentIds.has(c.id);

  // 블라인드 모드 + ab_flipped 시 A↔B 진영 레이블 반전
  let displaySide = c.side;
  if (isVotePost && c.side && isBlindMode() && post?.ab_flipped) {
    displaySide = c.side === 'A' ? 'B' : 'A';
  }

  const sideBadge = isVotePost && displaySide
    ? `<span class="side-badge side-badge-${escapeHtml(displaySide.toLowerCase())}">${displaySide === 'A' ? '🔵 A진영' : '🟠 B진영'}</span>`
    : '';

  // 설득됨 버튼: 진영 변경 후 아직 선택 안 한 경우에만 표시. 클릭 후 사라짐.
  // c.side (DB 원본) 기준으로 상대 진영 판단 (ab_flipped 영향 없음)
  const showPersuasion = currentUser && !isOwn && isVotePost && c.side
    && c.side !== userVote
    && canPersuasionLike
    && myPersuasionCommentId === null;

  const persuasionBtn = showPersuasion
    ? `<button class="persuasion-btn" data-comment-id="${c.id}" aria-label="설득됨">
        🫡 설득됐어요
       </button>`
    : '';

  // 설득됨 카운트: 비공개 원칙 — UI에 숫자 표시 금지
  const persuasionCountHtml = '';

  const profileHref = c.user_id ? `profile.html?id=${escapeHtml(c.user_id)}` : null;

  const avatarHtml = author?.avatar_url
    ? `<img class="comment-avatar" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username ?? '유저')} 아바타">`
    : `<div class="comment-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--surface2);font-size:0.75rem;font-weight:700;">${escapeHtml((author?.username ?? '?')[0])}</div>`;

  return `
    <div class="comment-item" data-id="${c.id}">
      ${profileHref
        ? `<a href="${profileHref}" class="comment-avatar-link">${avatarHtml}</a>`
        : avatarHtml
      }
      <div class="comment-body">
        <div class="comment-meta">
          ${profileHref
            ? `<a class="comment-author comment-author-link" href="${profileHref}">${escapeHtml(author?.username ?? '익명')}</a>`
            : `<span class="comment-author">${escapeHtml(author?.username ?? '익명')}</span>`
          }
          ${sideBadge}
          <span class="comment-time">${relativeTime(c.created_at)}</span>
          ${isOwn ? `<button class="btn-del-comment" data-comment-id="${c.id}" aria-label="댓글 삭제">삭제</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
          <button class="comment-like-btn${liked ? ' liked' : ''}" data-comment-id="${c.id}" aria-label="댓글 좋아요">
            ${liked ? '❤️' : '🤍'} <span class="clk-count">${likeCount}</span>
          </button>
          ${persuasionCountHtml}
          ${persuasionBtn}
        </div>
      </div>
    </div>`;
}

// ── Comments ──────────────────────────────────────────────────────
async function loadComments() {
  const { data, error } = await db
    .from('comments')
    .select('*,profiles(username,avatar_url),comment_likes(count)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('commentList');
  if (error || !data?.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;text-align:center;padding:20px 0">아직 댓글이 없습니다.</p>';
    return;
  }

  const commentIds = data.map(c => c.id);

  // 내 댓글 좋아요 목록 조회 (persuasion 카운트는 비공개 — 조회 제거)
  const myLikesRes = currentUser
    ? await db.from('comment_likes').select('comment_id').eq('user_id', currentUser.id).in('comment_id', commentIds)
    : { data: [] };

  const myLikedCommentIds = new Set();
  (myLikesRes.data ?? []).forEach(l => myLikedCommentIds.add(l.comment_id));

  const isVotePost = post?.category === '밸런스게임';

  if (isVotePost) {
    // 진영별 좌우 분리 (DB 원본 side 기준으로 분류)
    const commentsA = data.filter(c => c.side === 'A');
    const commentsB = data.filter(c => c.side === 'B');
    const neutral   = data.filter(c => !c.side);

    // 블라인드 + ab_flipped 시 컬럼 헤더 반전
    const blind = isBlindMode() && post?.ab_flipped;
    const headerA = blind ? '🟠 B진영' : '🔵 A진영';
    const headerB = blind ? '🔵 A진영' : '🟠 B진영';

    const renderCol = (items) => items.length
      ? items.map(c => renderCommentItem(c, myLikedCommentIds, true)).join('')
      : `<div class="comment-col-empty">아직 주장이 없습니다</div>`;

    list.innerHTML = `
      <div class="comment-arena">
        <div class="comment-col comment-col-a">
          <div class="comment-col-header">${headerA} <span style="font-weight:400;opacity:.7">${commentsA.length}</span></div>
          ${renderCol(commentsA)}
        </div>
        <div class="comment-col comment-col-b">
          <div class="comment-col-header">${headerB} <span style="font-weight:400;opacity:.7">${commentsB.length}</span></div>
          ${renderCol(commentsB)}
        </div>
      </div>
      ${neutral.length ? `
        <div class="comment-neutral-section">
          <div class="comment-neutral-label">중립 댓글</div>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${neutral.map(c => renderCommentItem(c, myLikedCommentIds, false)).join('')}
          </div>
        </div>` : ''}`;
  } else {
    list.innerHTML = data.map(c => renderCommentItem(c, myLikedCommentIds, false)).join('');
  }
}

// 이벤트 위임 — 댓글 영역
document.getElementById('commentList')?.addEventListener('click', async e => {
  const likeBtn = e.target.closest('.comment-like-btn');
  if (likeBtn) { await toggleCommentLike(likeBtn); return; }

  const persuasionBtn = e.target.closest('.persuasion-btn[data-comment-id]');
  if (persuasionBtn) { await togglePersuasionLike(persuasionBtn.dataset.commentId); return; }
});

// 이벤트 위임 — 댓글 삭제
document.getElementById('commentList')?.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-del-comment');
  if (!btn) return;
  const id = btn.dataset.commentId;
  if (!id || !confirm('댓글을 삭제하시겠습니까?')) return;
  const { error } = await db.from('comments').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('삭제에 실패했습니다.'); return; }
  if (myComment?.id === id) myComment = null;
  loadComments();
  updateCommentForm();
});

async function toggleCommentLike(btn) {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }
  const commentId = btn.dataset.commentId;
  if (!commentId) return;

  const isLiked  = btn.classList.contains('liked');
  const countEl  = btn.querySelector('.clk-count');
  const count    = parseInt(countEl?.textContent ?? '0');

  if (isLiked) {
    const { error } = await db.from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', currentUser.id);
    if (error) { console.error(error); return; }
    btn.classList.remove('liked');
    btn.innerHTML = `🤍 <span class="clk-count">${Math.max(0, count - 1)}</span>`;
  } else {
    const { error } = await db.from('comment_likes')
      .insert({ comment_id: commentId, user_id: currentUser.id });
    if (error) { console.error(error); return; }
    btn.classList.add('liked');
    btn.innerHTML = `❤️ <span class="clk-count">${count + 1}</span>`;
  }
  btn.dataset.commentId = commentId;
}

async function submitComment() {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }
  const textarea = document.getElementById('commentInput');
  const content = textarea.value.trim();
  if (!content) return;

  const btn = document.getElementById('commentSubmitBtn');
  btn.disabled = true;

  const side = (post?.category === '밸런스게임' && userVote) ? userVote : null;

  if (post?.category === '밸런스게임' && myComment) {
    // 기존 댓글 수정 (1댓글 제한)
    const { error } = await db.from('comments')
      .update({ content, side })
      .eq('id', myComment.id)
      .eq('user_id', currentUser.id);
    if (error) {
      alert('댓글 수정에 실패했습니다. 다시 시도해주세요.');
    } else {
      myComment = { ...myComment, content, side };
      textarea.value = '';
      await loadComments();
    }
  } else {
    // 신규 작성
    const insertData = { user_id: currentUser.id, post_id: postId, content };
    if (side) insertData.side = side;

    const { data, error } = await db.from('comments').insert(insertData).select('id,content,side').single();
    if (error) {
      alert('댓글 작성에 실패했습니다. 다시 시도해주세요.');
    } else {
      if (data) myComment = data;
      textarea.value = '';
      await loadComments();
    }
  }

  btn.disabled = false;
}

// 이벤트 위임 — 댓글 작성 폼
document.getElementById('commentFormArea')?.addEventListener('click', e => {
  if (e.target.id === 'commentSubmitBtn') submitComment();
});
document.getElementById('commentFormArea')?.addEventListener('keydown', e => {
  if (e.target.id === 'commentInput' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitComment();
  }
});

init();
