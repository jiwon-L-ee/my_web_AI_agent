// vote-modal.js — 밸런스게임/OX퀴즈 투표 모달

(function () {
  const HOT_VIEWS = 100;
  const HOT_LIKES = 15;

  // ── 모달 요소 ──────────────────────────────────────────
  const overlay   = document.getElementById('voteModal');
  const closeBtn  = document.getElementById('vmClose');
  const titleEl   = document.getElementById('vmTitle');
  const catBadge  = document.getElementById('vmCatBadge');
  const optAEl    = document.getElementById('vmOptA');
  const optBEl    = document.getElementById('vmOptB');
  const panelA    = document.getElementById('vmPanelA');
  const panelB    = document.getElementById('vmPanelB');
  const hintEl    = document.getElementById('vmHint');
  const resultEl  = document.getElementById('vmResult');
  const barA      = document.getElementById('vmBarA');
  const barB      = document.getElementById('vmBarB');
  const cntA      = document.getElementById('vmCountA');
  const cntB      = document.getElementById('vmCountB');
  const bestAEl   = document.getElementById('vmBestA');
  const bestBEl   = document.getElementById('vmBestB');
  const bestAAuth = document.getElementById('vmBestAAuthor');
  const bestBAuth = document.getElementById('vmBestBAuthor');
  const fullLink  = document.getElementById('vmFullLink');

  // 없으면 index.html이 아닌 페이지 — 종료
  if (!overlay) return;

  let currentPostId = null;
  let voteA = 0;
  let voteB = 0;
  let userVote = null;
  let currentUser = null;

  // ── 모달 열기 ──────────────────────────────────────────
  async function openVoteModal(postId) {
    currentPostId = postId;
    userVote = null;
    voteA = 0;
    voteB = 0;

    // 초기 상태 리셋
    overlay.classList.remove('hidden');
    overlay.removeAttribute('data-voted');
    panelA.classList.remove('vm-selected', 'vm-winner', 'vm-loser');
    panelB.classList.remove('vm-selected', 'vm-winner', 'vm-loser');
    const vsCenter = overlay.querySelector('.vm-center-vs');
    if (vsCenter) { vsCenter.style.width = ''; vsCenter.style.opacity = ''; }
    const vsCircle = overlay.querySelector('.vm-vs-circle');
    if (vsCircle) vsCircle.style.opacity = '';
    resultEl.style.display = 'none';
    hintEl.style.display   = '';
    titleEl.textContent    = '불러오는 중...';
    optAEl.textContent     = '';
    optBEl.textContent     = '';
    document.body.style.overflow = 'hidden';

    currentUser = await getUser();

    // 게시물 + 투표 데이터 병렬 로드
    const [postRes, countARes, countBRes] = await Promise.all([
      db.from('posts').select('id,title,category,option_a,option_b').eq('id', postId).single(),
      db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('choice', 'A'),
      db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('choice', 'B'),
    ]);

    const post = postRes.data;
    if (!post) { closeModal(); return; }

    voteA = countARes.count ?? 0;
    voteB = countBRes.count ?? 0;

    // 내 기존 투표 확인 (로그인: user_id, 비로그인: guest_id)
    {
      let q = db.from('votes').select('choice').eq('post_id', postId);
      if (currentUser) q = q.eq('user_id', currentUser.id);
      else q = q.eq('guest_id', getGuestId());
      const { data: myVote } = await q.maybeSingle();
      userVote = myVote?.choice ?? null;
    }

    // UI 렌더
    catBadge.innerHTML = `<span class="badge badge-${escapeHtml(post.category)}" style="position:static">${escapeHtml(post.category)}</span>`;
    titleEl.textContent = post.title;
    optAEl.textContent  = post.option_a || 'A';
    optBEl.textContent  = post.option_b || 'B';

    if (userVote) {
      // 이미 투표함 → 결과 표시
      applyVoteUI(userVote);
      await showResult();
    } else {
      // 미투표 → 안내 문구 표시 (패널 클릭 시 post.html로 이동)
      if (hintEl) hintEl.textContent = '댓글을 읽고 투표해보세요. 양쪽 의견을 들어본 후 더 나은 선택을 할 수 있습니다.';
    }
  }

  // ── 투표 없음 — 패널 클릭 시 post.html로 이동 ─────────
  function goToPost() {
    if (!currentPostId) return;
    const dest = `post.html?id=${currentPostId}&from=home`;
    closeModal();
    location.href = dest;
  }

  function applyVoteUI(choice) {
    panelA.classList.toggle('vm-selected', choice === 'A');
    panelB.classList.toggle('vm-selected', choice === 'B');
    overlay.dataset.voted = choice;
    hintEl.style.display  = 'none';
  }

  // ── 결과 + 베스트 주장 ─────────────────────────────────
  async function showResult() {
    resultEl.style.display = '';

    const total = voteA + voteB;
    const pA = total > 0 ? (voteA / total) * 100 : 50;
    const pB = total > 0 ? (voteB / total) * 100 : 50;

    // 애니메이션: 0 → 실제값
    barA.style.width = '0%';
    barB.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        barA.style.width = pA.toFixed(1) + '%';
        barB.style.width = pB.toFixed(1) + '%';

        // VS 서클 → 얇은 구분선으로 축소
        const vsCenter = overlay.querySelector('.vm-center-vs');
        if (vsCenter) vsCenter.style.width = '3px';
        const vsCircle = overlay.querySelector('.vm-vs-circle');
        if (vsCircle) vsCircle.style.opacity = '0';

        // 승자/패자 시각화 (5% 이상 차이 날 때만)
        panelA.classList.remove('vm-winner', 'vm-loser');
        panelB.classList.remove('vm-winner', 'vm-loser');
        if (total > 2 && Math.abs(pA - pB) > 5) {
          if (pA > pB) {
            panelA.classList.add('vm-winner');
            panelB.classList.add('vm-loser');
          } else {
            panelB.classList.add('vm-winner');
            panelA.classList.add('vm-loser');
          }
        }
      });
    });

    cntA.innerHTML = `<span class="vm-dot vm-dot-a"></span><span class="vm-pct-a">${pA.toFixed(1)}%</span><span class="vm-cnt-votes">(${voteA}표)</span>`;
    cntB.innerHTML = `<span class="vm-dot vm-dot-b"></span><span class="vm-pct-b">${pB.toFixed(1)}%</span><span class="vm-cnt-votes">(${voteB}표)</span>`;

    // 베스트 주장 (각 진영 좋아요 최다 댓글)
    await loadBestComments();
  }

  async function loadBestComments() {
    const [resA, resB] = await Promise.all([
      db.from('comments')
        .select('id,content,profiles(username),comment_likes(count)')
        .eq('post_id', currentPostId)
        .eq('side', 'A')
        .limit(10),
      db.from('comments')
        .select('id,content,profiles(username),comment_likes(count)')
        .eq('post_id', currentPostId)
        .eq('side', 'B')
        .limit(10),
    ]);

    renderBest(resA.data, bestAEl, bestAAuth);
    renderBest(resB.data, bestBEl, bestBAuth);
  }

  function renderBest(comments, textEl, authorEl) {
    if (!comments || !comments.length) {
      textEl.innerHTML = '<span class="vm-best-card-empty">아직 주장이 없습니다</span>';
      authorEl.textContent = '';
      return;
    }
    // 좋아요 수 기준 정렬
    const sorted = [...comments].sort(
      (a, b) => (b.comment_likes?.[0]?.count ?? 0) - (a.comment_likes?.[0]?.count ?? 0)
    );
    const best = sorted[0];
    const likeCount = best.comment_likes?.[0]?.count ?? 0;
    textEl.innerHTML = `<div class="vm-best-card-text">${escapeHtml(best.content)}</div>`;
    authorEl.textContent = `— ${escapeHtml(best.profiles?.username ?? '익명')} · ♥ ${likeCount}`;
  }

  // ── 모달 닫기 ──────────────────────────────────────────
  function closeModal() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentPostId = null;
  }

  // ── 이벤트 리스너 ──────────────────────────────────────
  closeBtn.addEventListener('click', closeModal);

  // 전체 댓글 보기 — 모달 먼저 닫고 이동 (히스토리 스택 정리)
  fullLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentPostId) return;
    const dest = `post.html?id=${currentPostId}&from=home`;
    closeModal();
    location.href = dest;
  });

  // 오버레이 배경 클릭 시 닫기
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // ESC 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  // 패널 클릭 — 미투표 시 post.html로 이동, 투표 완료 시 무시(결과만 표시)
  panelA.addEventListener('click', () => { if (!userVote) goToPost(); });
  panelB.addEventListener('click', () => { if (!userVote) goToPost(); });

  // 키보드 접근성
  [panelA, panelB].forEach(panel => {
    panel.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!userVote) goToPost();
      }
    });
  });

  // 카드 그리드 이벤트 위임 — balance 카드 클릭
  const grid = document.getElementById('cardGrid');
  if (grid) {
    grid.addEventListener('click', e => {
      const card = e.target.closest('.card-balance');
      if (!card || !card.dataset.id) return;
      e.preventDefault();
      openVoteModal(card.dataset.id);
    });
  }

  // 외부에서 호출 가능하도록 노출
  window.openVoteModal = openVoteModal;

  // ── 열기 3단계 판단 (home.js에서 사용) ───────────────
  // 0: 일반  1: 열기(shimmer)  2: 연기  3: 불
  window.getHeatLevel = function (viewCount, likeCount) {
    if (viewCount >= 500 || likeCount >= 50) return 3;
    if (viewCount >= 100 || likeCount >= 15) return 2;
    if (viewCount >= 30  || likeCount >= 5)  return 1;
    return 0;
  };
  window.isHotPost = function (viewCount, likeCount) {
    return window.getHeatLevel(viewCount, likeCount) >= 2;
  };
})();
