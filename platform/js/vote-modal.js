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
  let isVoting = false; // 중복 투표 방지 가드

  // ── 모달 열기 ──────────────────────────────────────────
  async function openVoteModal(postId) {
    currentPostId = postId;
    userVote = null;
    voteA = 0;
    voteB = 0;
    isVoting = false; // 모달 재오픈 시 가드 초기화

    // 초기 상태 리셋
    overlay.classList.remove('hidden');
    overlay.removeAttribute('data-voted');
    panelA.classList.remove('vm-selected');
    panelB.classList.remove('vm-selected');
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

    // 내 기존 투표 확인
    if (currentUser) {
      const { data: myVote } = await db
        .from('votes')
        .select('choice')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      userVote = myVote?.choice ?? null;
    }

    // UI 렌더
    catBadge.innerHTML = `<span class="badge badge-${escapeHtml(post.category)}" style="position:static">${escapeHtml(post.category)}</span>`;
    titleEl.textContent = post.title;
    optAEl.textContent  = post.option_a || 'A';
    optBEl.textContent  = post.option_b || 'B';
    fullLink.href       = `post.html?id=${postId}`;

    // 이미 투표했으면 결과 표시
    if (userVote) {
      applyVoteUI(userVote, false);
      await showResult();
    }
  }

  // ── 투표 처리 ──────────────────────────────────────────
  async function handleVote(choice) {
    if (isVoting) return;
    isVoting = true;
    if (!currentUser) {
      isVoting = false;
      const next = encodeURIComponent(location.href);
      location.href = `login.html?next=${next}`;
      return;
    }

    // 같은 선택 재클릭 → 취소
    if (userVote === choice) {
      const { error } = await db.from('votes').delete()
        .eq('post_id', currentPostId).eq('user_id', currentUser.id);
      if (error) { console.error(error); isVoting = false; return; }
      if (choice === 'A') voteA = Math.max(0, voteA - 1);
      else                voteB = Math.max(0, voteB - 1);
      userVote = null;
      panelA.classList.remove('vm-selected');
      panelB.classList.remove('vm-selected');
      resultEl.style.display = 'none';
      hintEl.style.display   = '';
      overlay.removeAttribute('data-voted');
      isVoting = false;
      return;
    }

    // 다른 선택으로 변경
    if (userVote !== null) {
      const { error } = await db.from('votes').update({ choice })
        .eq('post_id', currentPostId).eq('user_id', currentUser.id);
      if (error) { console.error(error); isVoting = false; return; }
      if (choice === 'A') { voteA++; voteB = Math.max(0, voteB - 1); }
      else                 { voteB++; voteA = Math.max(0, voteA - 1); }
    } else {
      // 신규 투표
      const { error } = await db.from('votes').insert({
        post_id: currentPostId, user_id: currentUser.id, choice
      });
      if (error) { console.error(error); isVoting = false; return; }
      if (choice === 'A') voteA++;
      else                voteB++;
    }

    userVote = choice;
    applyVoteUI(choice, true);
    await showResult();
    isVoting = false;
  }

  function applyVoteUI(choice, animate) {
    panelA.classList.toggle('vm-selected', choice === 'A');
    panelB.classList.toggle('vm-selected', choice === 'B');
    overlay.dataset.voted = choice;
    hintEl.style.display  = 'none';

    if (animate) {
      const panel = choice === 'A' ? panelA : panelB;
      panel.style.animation = 'none';
      void panel.offsetWidth;
      panel.style.animation = '';
    }
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
      });
    });

    cntA.textContent = `🔵 ${pA.toFixed(1)}% (${voteA}표)`;
    cntB.textContent = `🟠 ${pB.toFixed(1)}% (${voteB}표)`;

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
    authorEl.textContent = `— ${escapeHtml(best.profiles?.username ?? '익명')} · ❤️ ${likeCount}`;
  }

  // ── 모달 닫기 ──────────────────────────────────────────
  function closeModal() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentPostId = null;
  }

  // ── 이벤트 리스너 ──────────────────────────────────────
  closeBtn.addEventListener('click', closeModal);

  // 오버레이 배경 클릭 시 닫기
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // ESC 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  // 패널 클릭
  panelA.addEventListener('click', () => handleVote('A'));
  panelB.addEventListener('click', () => handleVote('B'));

  // 키보드 접근성
  [panelA, panelB].forEach(panel => {
    panel.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleVote(panel.dataset.choice);
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

  // ── 인기 여부 판단 (home.js에서 사용) ─────────────────
  window.isHotPost = function (viewCount, likeCount) {
    return viewCount >= HOT_VIEWS || likeCount >= HOT_LIKES;
  };
})();
