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
let isExpiredPost = false; // 만료된 밸런스게임 여부

// 밸런스게임 댓글 상태
let myComment = null;              // 내 기존 댓글 (id, content, side)
let myPersuasionLikeId = null;     // 내 설득됨 좋아요 ID
let myPersuasionCommentId = null;  // 내가 설득됨을 준 comment_id
let canPersuasionLike = false;     // "설득됐어요" 선택 후 true

// 댓글 수정 상태 (모든 카테고리 공통)
let editingCommentId = null;       // 현재 수정 중인 댓글 ID (null = 신규 작성)

// [BALANCE:VOTE_CHANGE_COST] 투표 변경 비용: 5 크레딧 → docs/balance.md 참고
const VOTE_CHANGE_COST = 5;
// [BALANCE:REBUTTAL_COST] 반박 덧글 비용: 2 크레딧 → docs/balance.md 참고
const REBUTTAL_COST = 2;

// ── 게스트 투표 localStorage 헬퍼 ──────────────────────────────────
// 비로그인 사용자의 투표 결과를 localStorage에 캐시해 페이지 이동 후에도 복원
function guestVoteSave(pid, choice) {
  try {
    const key = 'matbul-guest-votes';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    if (choice === null) delete stored[pid];
    else stored[pid] = choice;
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (_) {}
}
function guestVoteLoad(pid) {
  try {
    const stored = JSON.parse(localStorage.getItem('matbul-guest-votes') || '{}');
    return stored[pid] ?? null;
  } catch (_) { return null; }
}

// ── 날짜 파싱: Supabase 타임스탬프 → ms ──────────────────────────
// Supabase: "YYYY-MM-DD HH:MM:SS.ssssss+00" → ISO 8601 변환
function parseDateMs(str) {
  if (!str) return NaN;
  const iso = str.replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1').replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(iso);
  return isNaN(ms) ? Date.parse(str) : ms;
}

// ── 남은 시간 포맷 유틸 ───────────────────────────────────────────
// 반환: { text, cls }  (expiry-* 클래스 + 표시 텍스트)
function formatExpiryText(msLeft) {
  if (msLeft <= 0) return { text: '종료', cls: 'expiry-ended' };
  if (msLeft < 60 * 60 * 1000) {          // 1시간 미만 → 분:초
    const m = Math.floor(msLeft / 60_000);
    const s = Math.floor((msLeft % 60_000) / 1000);
    return { text: `${m}분 ${String(s).padStart(2,'0')}초`, cls: 'expiry-urgent' };
  }
  if (msLeft < 24 * 60 * 60 * 1000) {    // 24시간 미만 → X시간 Y분
    const h = Math.floor(msLeft / 3_600_000);
    const m = Math.floor((msLeft % 3_600_000) / 60_000);
    return { text: `${h}시간 ${m}분`, cls: 'expiry-today' };
  }
  const d = Math.ceil(msLeft / (24 * 3_600_000));   // 이상 → D-N
  return { text: `D-${d}`, cls: 'expiry-active' };
}

// ── 만료 배지 렌더링 (1초/1분 타이머에서 호출) ────────────────────
function renderExpiryBadge() {
  const el = document.getElementById('expiryBadge');
  if (!el || !post?.expires_at) return;
  const msLeft = parseDateMs(post.expires_at) - Date.now();
  const { text, cls } = formatExpiryText(msLeft);
  el.innerHTML = `<span class="expiry-badge ${cls}">${text}</span>`;
}

// ── 남은 시간 실시간 타이머 ───────────────────────────────────────
let _expiryTimer = null;
function startExpiryTimer() {
  if (!post?.expires_at) return;
  renderExpiryBadge(); // 즉시 1회 렌더
  const msLeft = parseDateMs(post.expires_at) - Date.now();
  if (msLeft <= 0) return;
  // 1시간 미만이면 1초 간격, 이상이면 1분 간격
  const interval = msLeft < 60 * 60 * 1000 ? 1_000 : 60_000;
  _expiryTimer = setInterval(() => {
    renderExpiryBadge();
    const left = parseDateMs(post.expires_at) - Date.now();
    if (left <= 0) { clearInterval(_expiryTimer); return; }
    // 1시간 미만 진입 시 간격을 1초로 재설정
    if (left < 60 * 60 * 1000 && interval !== 1_000) {
      clearInterval(_expiryTimer);
      _expiryTimer = setInterval(() => {
        renderExpiryBadge();
        if (parseDateMs(post.expires_at) - Date.now() <= 0) clearInterval(_expiryTimer);
      }, 1_000);
    }
  }, interval);
}

// ── 정산 결과 배너 ─────────────────────────────────────────────────
async function loadAndRenderResult() {
  if (!post?.expires_at) return;
  if (parseDateMs(post.expires_at) > Date.now()) return; // 아직 진행 중

  const banner = document.getElementById('resultBanner');
  if (!banner) return;

  const PR_SELECT = 'winning_side,votes_a,votes_b,proximity,logged_in_voters,creator_reward,credits_paid';

  let { data: result } = await db
    .from('post_results')
    .select(PR_SELECT)
    .eq('post_id', postId)
    .maybeSingle();

  // 미정산 게임 → Edge Function 호출 후 재조회
  if (!result) {
    try {
      await fetch(
        'https://mwsfzxhblboskdlffsxi.supabase.co/functions/v1/settle-balance-games',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: postId }),
        }
      );
      const { data: settled } = await db
        .from('post_results')
        .select(PR_SELECT)
        .eq('post_id', postId)
        .maybeSingle();
      result = settled;
    } catch (e) {
      console.warn('정산 요청 실패:', e);
    }
  }

  // post_results 없으면 현재 votes 집계로 임시 표시
  const totalA = result?.votes_a ?? voteCountA;
  const totalB = result?.votes_b ?? voteCountB;
  const total  = totalA + totalB;
  const pctA   = total > 0 ? Math.round(totalA / total * 100) : 50;
  const pctB   = 100 - pctA;

  // 승자 결정 (post_results 있으면 우선, 없으면 투표수 기준)
  let winningSide;
  if (result?.winning_side) {
    winningSide = result.winning_side;
  } else if (totalA > totalB) {
    winningSide = 'A';
  } else if (totalB > totalA) {
    winningSide = 'B';
  } else {
    winningSide = 'tie';
  }

  let winLabel;
  if (winningSide === 'A') {
    winLabel = escapeHtml(post.option_a || 'A');
  } else if (winningSide === 'B') {
    winLabel = escapeHtml(post.option_b || 'B');
  } else {
    winLabel = '동률';
  }

  // 접전도 텍스트 (유저가 이해하기 쉬운 말로)
  let proximityText = '';
  if (result?.proximity != null) {
    const prox = result.proximity;
    if (prox >= 0.9)      proximityText = '초박빙 승부였어요!';
    else if (prox >= 0.7) proximityText = '꽤 팽팽했어요';
    else if (prox >= 0.5) proximityText = '어느 정도 격차가 있었어요';
    else                  proximityText = '압도적인 결과였어요';
  }

  // 제작자 보상
  let rbCreatorHtml = '';
  if (result?.credits_paid) {
    const creatorAmt = Math.round(Number(result.creator_reward ?? 0));
    if (creatorAmt > 0) {
      rbCreatorHtml = `<div class="rb-reward rb-reward-creator">제작자 보상 <strong>+${creatorAmt} 크레딧</strong></div>`;
    }
  }

  // 내 보상
  let rbMyHtml = '';
  if (currentUser && result?.credits_paid) {
    const { data: myCredits } = await db
      .from('credits')
      .select('amount,reason')
      .eq('user_id', currentUser.id)
      .eq('post_id', postId);
    const winnerEarned = (myCredits ?? [])
      .filter(c => c.reason === 'vote_win' && Number(c.amount) > 0)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    if (winnerEarned > 0) {
      rbMyHtml = `<div class="rb-reward rb-reward-win">내 승리 보상 <strong>+${Math.round(winnerEarned)} 크레딧</strong></div>`;
    }
  }

  const winnerCls = winningSide === 'A' ? 'rb-winner-a' : winningSide === 'B' ? 'rb-winner-b' : 'rb-winner-tie';
  const winnerTitle = winningSide === 'tie' ? '동률' : `${winLabel} 승리`;

  banner.innerHTML = `
    <div class="result-banner">
      <div class="rb-top">
        <span class="rb-closed-label">토론 종료</span>
        <span class="rb-winner-badge ${winnerCls}">${winnerTitle}</span>
      </div>
      <div class="rb-names">
        <span class="rb-name-a">${escapeHtml(post.option_a || 'A')}</span>
        <span class="rb-name-b">${escapeHtml(post.option_b || 'B')}</span>
      </div>
      <div class="rb-bar">
        <div class="rb-bar-a" style="width:${pctA}%"></div>
        <div class="rb-bar-b" style="width:${pctB}%"></div>
      </div>
      <div class="rb-pcts">
        <div class="rb-pct-left">${pctA}% <span class="rb-cnt">(${totalA}표)</span></div>
        <div class="rb-pct-right">${pctB}% <span class="rb-cnt">(${totalB}표)</span></div>
      </div>
      <div class="rb-footer">
        <span>총 ${total}표 참여</span>
        ${proximityText ? `<span class="rb-dot">·</span><span>${proximityText}</span>` : ''}
      </div>
      ${rbMyHtml}${rbCreatorHtml}
    </div>`;
  banner.style.display = '';
}

// ── 블라인드 모드 유틸 ────────────────────────────────────────────
function isBlindMode() {
  if (!post?.expires_at) return false;
  const msLeft = parseDateMs(post.expires_at) - Date.now();
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

  const authorLink = document.getElementById('authorLink');
  if (author?.id) {
    authorLink.href = `profile.html?id=${escapeHtml(author.id)}`;
  } else {
    authorLink.removeAttribute('href');
    authorLink.style.pointerEvents = 'none';
    authorLink.style.cursor = 'default';
  }

  if (p.description) {
    const descEl = document.getElementById('postDescription');
    const contentImages = Array.isArray(p.content_images) ? p.content_images : [];
    if (contentImages.length && p.description.includes('[img:')) {
      // 텍스트와 이미지 플레이스홀더가 섞인 경우 — 이미지 포함 렌더링
      const parts = p.description.split(/(\[img:\d+\])/g);
      descEl.innerHTML = parts.map(part => {
        const m = part.match(/^\[img:(\d+)\]$/);
        if (m) {
          const url = contentImages[parseInt(m[1], 10)];
          return url
            ? `<div class="post-content-img"><img src="${escapeHtml(url)}" alt="첨부 이미지" loading="lazy"></div>`
            : '';
        }
        if (!part) return '';
        return `<div class="post-content-text">${escapeHtml(part).replace(/\n/g, '<br>')}</div>`;
      }).join('');
    } else {
      // 텍스트 전용 (또는 구버전 게시물) — 기존 방식
      descEl.textContent = p.description;
      // 구버전: 이미지가 있지만 플레이스홀더 없는 경우 아래에 추가
      if (contentImages.length) {
        contentImages.forEach(url => {
          const div = document.createElement('div');
          div.className = 'post-content-img';
          const img = document.createElement('img');
          img.src     = url;
          img.alt     = '첨부 이미지';
          img.loading = 'lazy';
          div.appendChild(img);
          descEl.appendChild(div);
        });
      }
    }
    descEl.style.display = '';
  }

  const isVote = p.category === '밸런스게임';
  const isQuiz = p.category === '퀴즈';
  const isTest = p.category === '테스트';

  // isExpiredPost를 삭제버튼 체크 전에 먼저 결정
  if (isVote) {
    isExpiredPost = !!(p.expires_at && parseDateMs(p.expires_at) <= Date.now());
  }

  // 만료된 밸런스게임은 작성자도 삭제 불가
  if (currentUser && currentUser.id === p.user_id && !(isExpiredPost && isVote)) {
    document.getElementById('deleteBtn').style.display = '';
    document.getElementById('deleteBtn').addEventListener('click', deletePost);
  }

  // 커뮤니티 글: 작성자에게 수정 버튼 표시
  if (currentUser && currentUser.id === p.user_id && p.category === '커뮤니티') {
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
      editBtn.style.display = '';
      editBtn.addEventListener('click', () => {
        location.href = `community-edit.html?id=${postId}`;
      });
    }
  }

  // 수정됨 배지
  if (p.edited_at) {
    const badge = document.getElementById('editedBadge');
    if (badge) badge.style.display = '';
  }

  document.getElementById('postContent').style.display = '';
  document.getElementById('postLoading').style.display = 'none';

  const likeBtn = document.getElementById('likeBtn');
  likeBtn.addEventListener('click', toggleLike);

  document.getElementById('voteSection').style.display  = isVote ? '' : 'none';
  document.getElementById('quizSection').style.display  = isQuiz ? '' : 'none';
  document.getElementById('testSection').style.display  = isTest ? '' : 'none';

  if (isVote) {
    const isExpired = isExpiredPost;
    startExpiryTimer();
    await loadVotes(postId);
    renderVoteUI(p);
    await loadAndRenderResult();
    if (isExpired) {
      // 마감된 토론: 투표 버튼 비활성화
      document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'default';
      });
      // 마감 안내 레이블 변경
      const label = document.querySelector('.vote-section-label');
      if (label) label.textContent = '마감된 토론';
    } else {
      setupPersuasionModal();
      setupVoteChangeModal();
    }
    if (currentUser) {
      await loadMyComment();
      await loadPersuasionLike();
    }
    if (isExpired) {
      // 마감된 토론: 댓글 폼 비활성화
      const commentFormArea = document.getElementById('commentFormArea');
      if (commentFormArea) {
        commentFormArea.innerHTML = `<p class="vote-caution" style="text-align:center;margin:12px 0">이 토론은 마감되어 댓글을 작성할 수 없습니다.</p>`;
      }
    } else {
      updateCommentForm();
    }
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
  if (isExpiredPost && post?.category === '밸런스게임') return; // 만료된 밸런스게임 삭제 차단
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const { error } = await db.from('posts').delete().eq('id', postId).eq('user_id', currentUser.id);
  if (error) { alert('삭제에 실패했습니다. 다시 시도해주세요.'); return; }
  location.href = 'index.html?cat=커뮤니티';
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

    // 비로그인: DB 쿼리 실패 시 localStorage 백업에서 복원
    if (!currentUser && !userVote) {
      userVote = guestVoteLoad(pid);
    }
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
  if (isExpiredPost) return; // 만료된 토론 투표 차단
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
        if (isGuest) guestVoteSave(postId, null); // 취소 시 localStorage 삭제
      }
      // 1분 이후엔 재클릭 무시 (아무 동작 안 함)
    } else if (userVote !== null) {
      // 진영 변경 시도 → 무료 변경 허용 시간 이내: 무료 / 이후: 크레딧+설득됨 모달
      // [BALANCE:FREE_VOTE_WINDOW] 무료 변경 허용 시간: 60,000ms (1분) → docs/balance.md 참고
      if (voteTimestamp && Date.now() - voteTimestamp < 60_000) {
        // 1분 이내 무료 변경
        if (myComment && !confirm('투표를 바꾸면 작성한 댓글이 삭제됩니다. 계속하시겠습니까?')) {
          return;
        }
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
      if (isGuest) guestVoteSave(postId, dbChoice); // 신규 투표 localStorage 저장
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
  if (isGuest) guestVoteSave(postId, dbChoice); // 진영 변경 localStorage 동기화

  if (dbChoice === 'A') { voteCountA++; voteCountB = Math.max(0, voteCountB - 1); }
  else { voteCountB++; voteCountA = Math.max(0, voteCountA - 1); }
  userVote = dbChoice;

  // persuasion 상태 초기화 + 기존 댓글 삭제 (투표 변경 시 comment_likes·persuasion_likes도 CASCADE 삭제됨)
  canPersuasionLike = false;
  myPersuasionLikeId = null;
  myPersuasionCommentId = null;
  if (myComment) {
    await db.from('comments')
      .delete()
      .eq('id', myComment.id)
      .eq('user_id', currentUser.id);
    myComment = null;
  }

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
      credits_spent: 5, // [BALANCE:VOTE_CHANGE_COST] 투표 변경 비용: 5 크레딧 → docs/balance.md 참고
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
  const enoughCredits = balance >= VOTE_CHANGE_COST;
  const canChange = hasComments && enoughCredits;

  document.getElementById('voteChangeOpposingLabel').textContent = `${opposingLabel} 댓글`;
  document.getElementById('voteChangeCommentList').innerHTML = commentListHtml;
  document.getElementById('voteChangeCreditInfo').innerHTML =
    `변경 비용: ${VOTE_CHANGE_COST} 크레딧 (잔액: ${Math.floor(balance)})` +
    (myComment ? ` · <span style="color:#f97316;font-weight:600">⚠ 기존 댓글이 삭제됩니다</span>` : '');

  const confirmBtn = document.getElementById('voteChangeConfirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = !canChange;
    confirmBtn.textContent = canChange ? `변경하기 (-${VOTE_CHANGE_COST} 크레딧)` : (enoughCredits ? '댓글 없음' : '크레딧 부족');
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
    const { error: creditErr } = await db.rpc('spend_credits', { p_amount: VOTE_CHANGE_COST, p_reason: 'vote_change', p_post_id: postId });
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

  // "내 선택" 표시 — 비로그인 포함 투표한 모든 사용자에게 표시
  const mvi = document.getElementById('myVoteIndicator');
  if (mvi) {
    if (displayVote) {
      const choiceLabel = displayVote === 'A'
        ? (post?.option_a || 'A')
        : (post?.option_b || 'B');
      mvi.innerHTML = `<span class="mvi-label">내 선택: </span><span class="mvi-choice">${displayVote}진영 · ${escapeHtml(choiceLabel)}</span>`;
      mvi.style.display = '';
    } else {
      mvi.style.display = 'none';
    }
  }

  // 배경 분할 + 불꽃 세기 동적 반영 (블라인드 모드: 50/50 고정)
  const voteBattle = document.querySelector('.vote-battle');
  if (voteBattle && total > 0) {
    const vbA = blind ? 50 : pctA;
    const vbB = blind ? 50 : pctB;
    voteBattle.style.setProperty('--vb-pct-a', vbA.toFixed(1) + '%');

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
        applyFlame('a', vbA);
        applyFlame('b', vbB);
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
function renderCommentItem(c, myLikedCommentIds, isVotePost, repliesByParent = {}) {
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

  // 반박 버튼: 로그인 + 상대 진영 루트댓글 + 미만료 게시물
  const showRebuttal = currentUser
    && isVotePost
    && c.side
    && userVote
    && c.side !== userVote
    && !isExpiredPost;
  const rebuttalBtn = showRebuttal
    ? `<button class="btn-rebuttal" data-comment-id="${c.id}" data-reply-id="${c.id}" aria-label="반박하기">반박</button>`
    : '';

  // 덧글 목록 — 첫 번째만 노출, 나머지는 "답글 더보기"로 접기
  const myReplies = repliesByParent[c.id] ?? [];
  let repliesHtml = '';
  if (myReplies.length > 0) {
    const firstReply = renderReplyItem(myReplies[0], myLikedCommentIds);
    const extra = myReplies.slice(1);
    const extraHtml = extra.length
      ? `<div class="replies-extra" style="display:none">${extra.map(r => renderReplyItem(r, myLikedCommentIds)).join('')}</div>
         <button class="btn-replies-more" data-extra-count="${extra.length}">답글 더보기 (${extra.length}개) <span class="replies-more-arrow">∨</span></button>`
      : '';
    repliesHtml = `<div class="comment-replies">${firstReply}${extraHtml}</div>`;
  }

  // 반박 폼 자리 (초기 비어있음 — showRebuttalForm()이 innerHTML 채움)
  const rebuttalFormWrap = showRebuttal
    ? `<div class="rebuttal-form-wrap" data-parent-id="${c.id}" data-reply-id="${c.id}"></div>`
    : '';

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
          ${c.edited_at ? `<span class="comment-edited">(수정됨)</span>` : ''}
          ${isOwn ? `<button class="btn-edit-comment" data-comment-id="${c.id}" aria-label="댓글 수정">수정</button><button class="btn-del-comment" data-comment-id="${c.id}" aria-label="댓글 삭제">삭제</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
          <button class="comment-like-btn${liked ? ' liked' : ''}" data-comment-id="${c.id}" aria-label="댓글 좋아요">
            ${liked ? '❤️' : '🤍'} <span class="clk-count">${likeCount}</span>
          </button>
          ${persuasionCountHtml}
          ${persuasionBtn}
          ${rebuttalBtn}
        </div>
        ${rebuttalFormWrap}
        ${repliesHtml}
      </div>
    </div>`;
}

// ── 덧글(반박) 아이템 렌더 ────────────────────────────────────────
function renderReplyItem(r, myLikedCommentIds) {
  const author = r.profiles;
  const isOwn  = currentUser?.id === r.user_id;
  const likeCount = r.comment_likes?.[0]?.count ?? 0;
  const liked  = myLikedCommentIds.has(r.id);

  const profileHref = r.user_id ? `profile.html?id=${escapeHtml(r.user_id)}` : null;
  const avatarHtml = author?.avatar_url
    ? `<img class="comment-avatar comment-avatar-sm" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username ?? '유저')} 아바타">`
    : `<div class="comment-avatar comment-avatar-sm" style="display:flex;align-items:center;justify-content:center;background:var(--surface2);font-size:0.65rem;font-weight:700;">${escapeHtml((author?.username ?? '?')[0])}</div>`;

  const sideBadge = r.side
    ? `<span class="side-badge side-badge-${escapeHtml(r.side.toLowerCase())}">${r.side === 'A' ? '🔵 A진영' : '🟠 B진영'}</span>`
    : '';

  // 반박 버튼: 상대 진영 덧글에만 표시. parent_id(루트댓글)로 폼 열기 → 1단 depth 유지
  // 반박 버튼: 상대 진영 덧글에만 표시 — 버튼/폼이 각 덧글에 내장되므로 부모 조건 불필요
  const showReplyRebuttal = currentUser
    && post?.category === '밸런스게임'
    && r.side && userVote
    && r.side !== userVote
    && !isExpiredPost;
  const replyRebuttalBtn = showReplyRebuttal
    ? `<button class="btn-rebuttal" data-comment-id="${escapeHtml(r.parent_id)}" data-reply-id="${escapeHtml(r.id)}" data-mention="${escapeHtml(author?.username ?? '')}" aria-label="반박하기">반박</button>`
    : '';
  // 덧글 자체에 내장된 반박 폼 (data-reply-id로 루트 폼과 구분, parent-id는 submitRebuttal에서 사용)
  const replyFormWrap = showReplyRebuttal
    ? `<div class="rebuttal-form-wrap" data-parent-id="${escapeHtml(r.parent_id)}" data-reply-id="${escapeHtml(r.id)}"></div>`
    : '';

  return `
    <div class="comment-item comment-reply" data-id="${r.id}" data-parent-id="${r.parent_id}">
      ${profileHref
        ? `<a href="${profileHref}" class="comment-avatar-link">${avatarHtml}</a>`
        : avatarHtml}
      <div class="comment-body">
        <div class="comment-meta">
          ${profileHref
            ? `<a class="comment-author comment-author-link" href="${profileHref}">${escapeHtml(author?.username ?? '익명')}</a>`
            : `<span class="comment-author">${escapeHtml(author?.username ?? '익명')}</span>`}
          ${sideBadge}
          <span class="comment-time">${relativeTime(r.created_at)}</span>
          ${isOwn ? `<button class="btn-del-comment" data-comment-id="${r.id}" aria-label="덧글 삭제">삭제</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(r.content)}</div>
        <div style="margin-top:6px;display:flex;align-items:center;gap:4px">
          <button class="comment-like-btn${liked ? ' liked' : ''}" data-comment-id="${r.id}" aria-label="덧글 좋아요">
            ${liked ? '❤️' : '🤍'} <span class="clk-count">${likeCount}</span>
          </button>
          ${replyRebuttalBtn}
        </div>
        ${replyFormWrap}
      </div>
    </div>`;
}

// ── Comments ──────────────────────────────────────────────────────
async function loadComments() {
  const { data, error } = await db
    .from('comments')
    .select('*,profiles(username,avatar_url),comment_likes(count),persuasion_likes(count)')
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true });

  // 좋아요 + 설득됨 합산 내림차순 정렬
  const sortByScore = (arr) => arr.slice().sort((a, b) => {
    const scoreA = (a.comment_likes?.[0]?.count ?? 0) + (a.persuasion_likes?.[0]?.count ?? 0);
    const scoreB = (b.comment_likes?.[0]?.count ?? 0) + (b.persuasion_likes?.[0]?.count ?? 0);
    return scoreB - scoreA;
  });

  const list = document.getElementById('commentList');
  if (error || !data?.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;text-align:center;padding:20px 0">아직 댓글이 없습니다.</p>';
    return;
  }

  const commentIds = data.map(c => c.id);

  // 덧글(대댓글) 2차 쿼리 + parent_id별 그룹핑
  const repliesRes = commentIds.length
    ? await db.from('comments')
        .select('*,profiles(username,avatar_url),comment_likes(count)')
        .in('parent_id', commentIds)
        .order('created_at', { ascending: true })
    : { data: [] };
  const repliesByParent = {};
  (repliesRes.data ?? []).forEach(r => {
    if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
    repliesByParent[r.parent_id].push(r);
  });

  // 좋아요 집계 대상: 루트댓글 + 덧글 전체
  const allCommentIds = [...commentIds, ...(repliesRes.data ?? []).map(r => r.id)];

  // 내 댓글 좋아요 목록 조회 (persuasion 카운트는 비공개 — 조회 제거)
  const myLikesRes = currentUser
    ? await db.from('comment_likes').select('comment_id').eq('user_id', currentUser.id).in('comment_id', allCommentIds)
    : { data: [] };

  const myLikedCommentIds = new Set();
  (myLikesRes.data ?? []).forEach(l => myLikedCommentIds.add(l.comment_id));

  const isVotePost = post?.category === '밸런스게임';

  if (isVotePost) {
    // 진영별 좌우 분리 후 각 그룹 내 점수 내림차순 정렬
    const commentsA = sortByScore(data.filter(c => c.side === 'A'));
    const commentsB = sortByScore(data.filter(c => c.side === 'B'));
    const neutral   = sortByScore(data.filter(c => !c.side));

    // 블라인드 + ab_flipped 시 컬럼 헤더 반전
    const blind = isBlindMode() && post?.ab_flipped;
    const headerA = blind ? '🟠 B진영' : '🔵 A진영';
    const headerB = blind ? '🔵 A진영' : '🟠 B진영';

    const renderCol = (items) => items.length
      ? items.map(c => renderCommentItem(c, myLikedCommentIds, true, repliesByParent)).join('')
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
            ${neutral.map(c => renderCommentItem(c, myLikedCommentIds, false, repliesByParent)).join('')}
          </div>
        </div>` : ''}`;
  } else {
    list.innerHTML = sortByScore(data).map(c => renderCommentItem(c, myLikedCommentIds, false, repliesByParent)).join('');
  }
}

// 이벤트 위임 — 댓글 영역
document.getElementById('commentList')?.addEventListener('click', async e => {
  const likeBtn = e.target.closest('.comment-like-btn');
  if (likeBtn) { await toggleCommentLike(likeBtn); return; }

  const persuasionBtn = e.target.closest('.persuasion-btn[data-comment-id]');
  if (persuasionBtn) { await togglePersuasionLike(persuasionBtn.dataset.commentId); return; }

  // 답글 더보기 토글
  const moreBtn = e.target.closest('.btn-replies-more');
  if (moreBtn) {
    const extra = moreBtn.previousElementSibling;
    if (!extra || !extra.classList.contains('replies-extra')) return;
    const isExpanded = extra.style.display !== 'none';
    extra.style.display = isExpanded ? 'none' : '';
    const arrow = moreBtn.querySelector('.replies-more-arrow');
    if (isExpanded) {
      const count = parseInt(moreBtn.dataset.extraCount, 10);
      moreBtn.firstChild.textContent = `답글 더보기 (${count}개) `;
      if (arrow) arrow.textContent = '∨';
    } else {
      moreBtn.firstChild.textContent = '답글 접기 ';
      if (arrow) arrow.textContent = '∧';
    }
    return;
  }

  // 반박 버튼 (루트댓글 / 덧글 공통 — data-reply-id로 폼 고유 식별)
  const rebuttalBtn = e.target.closest('.btn-rebuttal');
  if (rebuttalBtn) {
    showRebuttalForm(rebuttalBtn.dataset.commentId, rebuttalBtn.dataset.mention ?? '', rebuttalBtn.dataset.replyId);
    return;
  }

  // 반박 제출
  const rebuttalSubmitBtn = e.target.closest('.rebuttal-submit-btn');
  if (rebuttalSubmitBtn) {
    const formWrap = rebuttalSubmitBtn.closest('.rebuttal-form-wrap');
    if (formWrap) await submitRebuttal(formWrap);
    return;
  }

  // 반박 취소
  const rebuttalCancelBtn = e.target.closest('.rebuttal-cancel-btn');
  if (rebuttalCancelBtn) {
    const formWrap = rebuttalCancelBtn.closest('.rebuttal-form-wrap');
    if (formWrap) formWrap.innerHTML = '';
    return;
  }

  const editBtn = e.target.closest('.btn-edit-comment');
  if (editBtn) {
    const commentItem = editBtn.closest('.comment-item');
    const commentTextEl = commentItem?.querySelector('.comment-text');
    const textarea = document.getElementById('commentInput');
    if (textarea && commentTextEl) {
      editingCommentId = editBtn.dataset.commentId;
      textarea.value = commentTextEl.textContent; // textContent = 브라우저 디코딩된 원본
      const submitBtn = document.getElementById('commentSubmitBtn');
      if (submitBtn) submitBtn.textContent = '수정';
      document.getElementById('commentFormArea')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textarea.focus();
    }
    return;
  }
});

// 이벤트 위임 — 반박 폼 Enter 제출
document.getElementById('commentList')?.addEventListener('keydown', e => {
  if (e.target.classList.contains('rebuttal-input') && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const formWrap = e.target.closest('.rebuttal-form-wrap');
    if (formWrap) submitRebuttal(formWrap);
  }
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
  if (editingCommentId === id) {
    editingCommentId = null;
    const submitBtn = document.getElementById('commentSubmitBtn');
    if (submitBtn) submitBtn.textContent = myComment ? '수정' : '작성';
    const textarea = document.getElementById('commentInput');
    if (textarea) textarea.value = '';
  }
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
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/></svg> <span class="clk-count">${Math.max(0, count - 1)}</span>`;
  } else {
    const { error } = await db.from('comment_likes')
      .insert({ comment_id: commentId, user_id: currentUser.id });
    if (error) { console.error(error); return; }
    btn.classList.add('liked');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/></svg> <span class="clk-count">${count + 1}</span>`;
  }
  btn.dataset.commentId = commentId;
}

async function submitComment() {
  if (isExpiredPost) return; // 만료된 토론 댓글 차단
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
    // 밸런스게임 댓글 수정 (1댓글 제한) — 수정 시 좋아요·설득됨 초기화
    const { error } = await db.from('comments')
      .update({ content, side, edited_at: new Date().toISOString() })
      .eq('id', myComment.id)
      .eq('user_id', currentUser.id);
    if (error) {
      alert('댓글 수정에 실패했습니다. 다시 시도해주세요.');
    } else {
      const prevId = myComment.id;
      const delCommentLikes = db.from('comment_likes').delete().eq('comment_id', prevId);
      const delPersuasion   = db.from('persuasion_likes').delete().eq('comment_id', prevId);
      await Promise.all([delCommentLikes, delPersuasion]);
      myPersuasionLikeId = null;
      myPersuasionCommentId = null;
      editingCommentId = null;
      myComment = { ...myComment, content, side };
      textarea.value = '';
      await loadComments();
    }
  } else if (editingCommentId) {
    // 일반 댓글 수정 (커뮤니티 등) — 수정 시 좋아요·설득됨 초기화
    const { error } = await db.from('comments')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', editingCommentId)
      .eq('user_id', currentUser.id);
    if (error) {
      alert('댓글 수정에 실패했습니다. 다시 시도해주세요.');
    } else {
      const prevId = editingCommentId;
      const delCommentLikes = db.from('comment_likes').delete().eq('comment_id', prevId);
      const delPersuasion   = db.from('persuasion_likes').delete().eq('comment_id', prevId);
      await Promise.all([delCommentLikes, delPersuasion]);
      editingCommentId = null;
      btn.textContent = '작성';
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

// ── 반박 폼 토글 ──────────────────────────────────────────────────
function showRebuttalForm(parentCommentId, mention = '', replyId) {
  // data-reply-id로 폼 고유 식별 (루트댓글·덧글 모두 reply-id 보유)
  const formWrap = document.querySelector(`.rebuttal-form-wrap[data-reply-id="${replyId}"]`);
  if (!formWrap) return;

  // 이미 열려있으면 닫기 (토글)
  if (formWrap.innerHTML) {
    formWrap.innerHTML = '';
    return;
  }

  // 다른 열린 폼 닫기 (한 번에 하나만)
  document.querySelectorAll('.rebuttal-form-wrap').forEach(el => { el.innerHTML = ''; });

  formWrap.innerHTML = `
    <div class="rebuttal-form">
      <textarea class="rebuttal-input" placeholder="반박 내용을 입력하세요 (Enter 제출, Shift+Enter 줄바꿈)" rows="2"></textarea>
      <div class="rebuttal-form-actions">
        <button class="rebuttal-submit-btn">작성 (크레딧 ${REBUTTAL_COST} 소모)</button>
        <button class="rebuttal-cancel-btn">취소</button>
      </div>
    </div>`;

  const input = formWrap.querySelector('.rebuttal-input');
  if (input) {
    if (mention) {
      input.value = `@${mention} `;
      input.setSelectionRange(input.value.length, input.value.length);
    }
    input.focus();
  }
}

// ── 반박 덧글 제출 ────────────────────────────────────────────────
// formWrap: 반박 폼 DOM 요소 (data-parent-id = 루트댓글 ID)
async function submitRebuttal(formWrap) {
  if (isExpiredPost) return;
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  const parentCommentId = formWrap.dataset.parentId;
  if (!parentCommentId) return;
  const textarea = formWrap.querySelector('.rebuttal-input');
  const content = textarea?.value.trim();
  if (!content) return;

  // 잔액 확인
  const { data: balanceData } = await db
    .from('credit_balances')
    .select('balance')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  const balance = Number(balanceData?.balance ?? 0);
  if (balance < REBUTTAL_COST) {
    alert(`크레딧이 부족합니다. 현재 잔액: ${balance}크레딧 (반박에는 ${REBUTTAL_COST}크레딧 필요)`);
    return;
  }

  const submitBtn = formWrap.querySelector('.rebuttal-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  const { error: insertErr } = await db.from('comments').insert({
    user_id: currentUser.id,
    post_id: postId,
    content,
    side: userVote ?? null,
    parent_id: parentCommentId,
  });

  if (insertErr) {
    alert('반박 작성에 실패했습니다.');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // 크레딧 차감
  await db.rpc('spend_credits', {
    p_amount: REBUTTAL_COST,
    p_reason: 'rebuttal_comment',
    p_post_id: postId,
  });

  // 반박 알림 발송 (실패해도 반박 제출에는 영향 없음)
  try {
    const { data: parentComment } = await db.from('comments')
      .select('user_id')
      .eq('id', parentCommentId)
      .single();
    if (parentComment?.user_id) {
      await db.rpc('notify_rebuttal', {
        p_target_user_id: parentComment.user_id,
        p_post_id: postId,
        p_comment_id: parentCommentId,
      });
    }
  } catch (_) {}

  formWrap.innerHTML = '';
  await loadComments();
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
