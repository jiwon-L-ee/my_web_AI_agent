// home.js — card grid, category filter, sort

const PAGE_SIZE = 20;
let currentCategory = '';
let currentSort = 'view_count';
let currentSortAsc = false;
let currentPage = 0;
let totalCount = 0;
let currentUser = null;
let communitySearchQuery = ''; // 커뮤니티 검색어
let _communitySearchTimer = null; // 디바운스 타이머

const grid        = document.getElementById('cardGrid');
const sortBtns    = document.querySelectorAll('.sort-btn');
const paginationEl = document.getElementById('pagination');
const heroSection  = document.getElementById('heroSection');
const heroBattle   = document.getElementById('heroBattle');
const debatesHeader = document.getElementById('debatesHeader');
const debatesBarList = document.getElementById('debatesBarList');
const sortBarEl    = document.getElementById('sortBar');
const quizPreviewHeader    = document.getElementById('quizPreviewHeader');
const quizPreviewList      = document.getElementById('quizPreviewList');
const quizDivider          = document.getElementById('quizDivider');
const communityPreviewHeader = document.getElementById('communityPreviewHeader');
const communityPreviewList   = document.getElementById('communityPreviewList');
const communityDivider       = document.getElementById('communityDivider');
const communityListEl        = document.getElementById('communityList');
const urgentDivider          = document.getElementById('urgentDivider');
const urgentHeader           = document.getElementById('urgentHeader');
const urgentGameList         = document.getElementById('urgentGameList');
const closedDivider          = document.getElementById('closedDivider');
const closedHeader           = document.getElementById('closedHeader');
const closedDebatesList      = document.getElementById('closedDebatesList');
const debateSubTabs          = document.getElementById('debateSubTabs');
const communityWriteArea     = document.getElementById('communityWriteArea');

let currentDebateTab = 'active'; // 'active' | 'closed'
let closedSort = 'expires_at';  // 마감됨 탭 정렬 기준 ('expires_at' = 최신순, 'view_count' = 인기순)

async function loadPosts(reset = true) {
  // 토론 탭이 아닌 경우 서브탭 숨김
  if (currentCategory !== '토론' && debateSubTabs) debateSubTabs.style.display = 'none';

  if (currentCategory === '밸런스게임') {
    await loadBalanceGameHome();
    return;
  }
  // 토론 탭 = 밸런스게임 바형 리스트 (히어로 없이)
  if (currentCategory === '토론') {
    await loadDebateBarPage(reset);
    return;
  }
  // 커뮤니티 탭 = 리스트형
  if (currentCategory === '커뮤니티') {
    await loadCommunityListPage(reset);
    return;
  }

  // 일반 카테고리 — 기존 카드 그리드 방식
  if (heroSection)    heroSection.style.display    = 'none';
  if (debatesHeader)  debatesHeader.style.display  = 'none';
  if (debatesBarList) debatesBarList.innerHTML      = '';
  if (urgentDivider)   urgentDivider.style.display   = 'none';
  if (urgentHeader)    urgentHeader.style.display    = 'none';
  if (urgentGameList)  urgentGameList.innerHTML      = '';
  if (quizDivider)          quizDivider.style.display          = 'none';
  if (quizPreviewHeader)    quizPreviewHeader.style.display    = 'none';
  if (quizPreviewList)      quizPreviewList.innerHTML          = '';
  if (communityDivider)     communityDivider.style.display     = 'none';
  if (communityPreviewHeader) communityPreviewHeader.style.display = 'none';
  if (communityPreviewList)   communityPreviewList.innerHTML       = '';
  if (communityListEl)        communityListEl.style.display        = 'none';
  if (communityWriteArea)     communityWriteArea.style.display     = 'none';
  if (sortBarEl)      sortBarEl.style.display       = '';
  grid.style.display = '';

  if (reset) currentPage = 0;
  grid.innerHTML = `<div style="grid-column:1/-1"><div class="spinner-wrap"><div class="spinner"></div></div></div>`;

  const from = currentPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db
    .from('posts')
    .select(
      'id,title,category,quiz_type,thumbnail_url,view_count,created_at,option_a,option_b,expires_at,' +
      'profiles(username,avatar_url,is_admin),likes(count),comments(count),votes(count)',
      { count: 'exact' }
    )
    .order(currentSort, { ascending: currentSortAsc })
    .range(from, to);

  if (currentCategory === '퀴즈') {
    query = query.in('category', ['퀴즈', '테스트']);
  } else if (currentCategory) {
    query = query.eq('category', currentCategory);
  }

  const { data, error, count } = await query;

  if (error) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">데이터를 불러오지 못했습니다.</div>`;
    console.error(error);
    return;
  }

  totalCount = count ?? 0;
  renderCards(data ?? []);
  renderPagination();
  startHomeExpiryTimers();
}

// ═══════════════════════════════════════════════════════════
// ── 밸런스게임 홈 — 히어로 + 바형 리스트 ──
// ═══════════════════════════════════════════════════════════

// ── 토론 탭: 밸런스게임 바형 리스트 전체 (히어로 없음, 페이지네이션 있음) ──
async function loadDebateBarPage(reset = true) {
  if (reset) currentPage = 0;
  currentDebateTab = 'active';

  if (heroSection)    heroSection.style.display    = 'none';
  if (debatesHeader)  debatesHeader.style.display  = 'none';
  if (urgentDivider)   urgentDivider.style.display   = 'none';
  if (urgentHeader)    urgentHeader.style.display    = 'none';
  if (urgentGameList)  urgentGameList.style.display  = 'none';
  if (closedDivider)   closedDivider.style.display   = 'none';
  if (closedHeader)    closedHeader.style.display    = 'none';
  if (closedDebatesList) { closedDebatesList.style.display = 'none'; closedDebatesList.innerHTML = ''; }
  if (communityWriteArea)  communityWriteArea.style.display = 'none';
  // 서브탭 표시 및 '진행 중' 활성화
  if (debateSubTabs) {
    debateSubTabs.style.display = '';
    debateSubTabs.querySelectorAll('.debate-sub-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.dtab === 'active');
    });
  }
  // 정렬 버튼 active 상태를 진행 중 기준(currentSort)으로 복원
  sortBtns.forEach(b => b.classList.toggle('active', b.dataset.sort === currentSort));
  if (quizDivider)          quizDivider.style.display          = 'none';
  if (quizPreviewHeader)    quizPreviewHeader.style.display    = 'none';
  if (quizPreviewList)      quizPreviewList.innerHTML          = '';
  if (communityDivider)     communityDivider.style.display     = 'none';
  if (communityPreviewHeader) communityPreviewHeader.style.display = 'none';
  if (communityPreviewList)   communityPreviewList.innerHTML       = '';
  if (communityListEl)        communityListEl.style.display        = 'none';
  if (communityWriteArea)     communityWriteArea.style.display     = 'none';
  if (sortBarEl)      sortBarEl.style.display       = '';
  grid.style.display = 'none';
  grid.innerHTML     = '';

  if (debatesBarList) {
    debatesBarList.style.display = '';
    debatesBarList.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  }

  const from = currentPage * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;
  const nowIso = new Date().toISOString();

  // 진행 중인 토론만 (미만료 + expires_at 없는 게시물)
  const { data: posts, error, count } = await db
    .from('posts')
    .select('id,title,option_a,option_b,view_count,expires_at,ab_flipped,comments(count)', { count: 'exact' })
    .eq('category', '밸런스게임')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order(currentSort, { ascending: currentSortAsc })
    .range(from, to);

  if (error || !posts?.length) {
    if (debatesBarList) debatesBarList.innerHTML = `<div class="empty" style="padding:60px 20px"><p>아직 뜨거운 논쟁이 없습니다.</p></div>`;
    totalCount = 0;
    renderPagination();
    return;
  }

  totalCount = count ?? 0;
  const postIds = posts.map(p => p.id);

  const [votesRes, commentsRes] = await Promise.all([
    db.from('votes').select('post_id,choice').in('post_id', postIds).limit(5000),
    db.from('comments')
      .select('post_id,content,side,comment_likes(count)')
      .in('post_id', postIds)
      .not('side', 'is', null)
      .limit(500),
  ]);

  const votesByPost = {};
  (votesRes.data ?? []).forEach(v => {
    if (v.choice !== 'A' && v.choice !== 'B') return;
    if (!votesByPost[v.post_id]) votesByPost[v.post_id] = { A: 0, B: 0 };
    votesByPost[v.post_id][v.choice]++;
  });

  const bestByPost = {};
  (commentsRes.data ?? []).forEach(c => {
    const likes = c.comment_likes?.[0]?.count ?? 0;
    if (!bestByPost[c.post_id]) bestByPost[c.post_id] = {};
    const prev = bestByPost[c.post_id][c.side];
    if (!prev || likes > prev.likes) {
      bestByPost[c.post_id][c.side] = { content: c.content, likes };
    }
  });

  // 투표 선택 조회 (로그인: user_id / 게스트: guest_id + localStorage 보완)
  let myVotes = {};
  if (currentUser) {
    const { data: myVoteData } = await db
      .from('votes')
      .select('post_id,choice')
      .eq('user_id', currentUser.id)
      .in('post_id', postIds);
    (myVoteData ?? []).forEach(v => { myVotes[v.post_id] = v.choice; });
  } else {
    const { data: myVoteData } = await db
      .from('votes')
      .select('post_id,choice')
      .eq('guest_id', getGuestId())
      .in('post_id', postIds);
    (myVoteData ?? []).forEach(v => { myVotes[v.post_id] = v.choice; });
    try {
      const stored = JSON.parse(localStorage.getItem('matbul-guest-votes') || '{}');
      postIds.forEach(id => { if (stored[id] && !myVotes[id]) myVotes[id] = stored[id]; });
    } catch (_) {}
  }

  renderDebateBarList(posts, votesByPost, bestByPost, myVotes);
  renderPagination();
  startHomeExpiryTimers();
}

// ── 마감됨 탭 진입 (서브탭 '마감됨' 클릭 시 호출) ───────────────────────────
async function loadClosedDebatesTab() {
  currentDebateTab = 'closed';
  currentPage = 0;

  // sortBar 표시 및 마감됨 정렬 상태로 버튼 동기화
  if (sortBarEl) {
    sortBarEl.style.display = '';
    sortBtns.forEach(b => b.classList.toggle('active', b.dataset.sort === closedSort));
  }
  // 진행 중 리스트 숨기고 스피너 표시
  if (debatesBarList) { debatesBarList.innerHTML = ''; debatesBarList.style.display = 'none'; }
  if (paginationEl)   paginationEl.innerHTML = '';
  // 서브탭 '마감됨' 활성화
  if (debateSubTabs) {
    debateSubTabs.querySelectorAll('.debate-sub-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.dtab === 'closed');
    });
  }
  // 마감된 토론 로드
  if (closedDebatesList) {
    closedDebatesList.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
    closedDebatesList.style.display = '';
  }
  await loadClosedDebates();
}

// ── 마감된 토론 목록 (토론 탭 마감됨 섹션) ──────────────────────────────────
async function loadClosedDebates() {
  if (!closedDebatesList) return;
  const nowIso = new Date().toISOString();

  const { data: posts } = await db
    .from('posts')
    .select('id,title,option_a,option_b,view_count,expires_at,ab_flipped,comments(count)')
    .eq('category', '밸런스게임')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso)
    .order(closedSort, { ascending: currentSortAsc })
    .limit(20);

  if (!posts?.length) {
    closedDebatesList.innerHTML = `<div class="empty" style="padding:60px 20px;text-align:center;color:var(--text-muted)">마감된 토론이 없습니다.</div>`;
    return;
  }
  closedDebatesList.style.display = '';

  const postIds = posts.map(p => p.id);
  const [votesRes, resultsRes] = await Promise.all([
    db.from('votes').select('post_id,choice').in('post_id', postIds).limit(5000),
    db.from('post_results').select('post_id,winning_side,votes_a,votes_b,credits_paid').in('post_id', postIds),
  ]);

  const votesByPost = {};
  (votesRes.data ?? []).forEach(v => {
    if (v.choice !== 'A' && v.choice !== 'B') return;
    if (!votesByPost[v.post_id]) votesByPost[v.post_id] = { A: 0, B: 0 };
    votesByPost[v.post_id][v.choice]++;
  });

  const resultByPost = {};
  (resultsRes.data ?? []).forEach(r => { resultByPost[r.post_id] = r; });

  closedDebatesList.innerHTML = posts.map(post => {
    const votes   = votesByPost[post.id] || { A: 0, B: 0 };
    const result  = resultByPost[post.id];
    const total   = votes.A + votes.B;
    const pctA    = total > 0 ? Math.round(votes.A / total * 100) : 50;
    const pctB    = 100 - pctA;
    const cmtCnt  = post.comments?.[0]?.count ?? 0;
    const viewCnt = post.view_count ?? 0;
    const optA    = escapeHtml(post.option_a || 'A');
    const optB    = escapeHtml(post.option_b || 'B');

    let winnerHtml = '';
    if (result?.winning_side === 'A') {
      winnerHtml = `<span class="closed-winner closed-winner-a">A 승 (${optA})</span>`;
    } else if (result?.winning_side === 'B') {
      winnerHtml = `<span class="closed-winner closed-winner-b">B 승 (${optB})</span>`;
    } else if (result) {
      winnerHtml = `<span class="closed-winner closed-winner-tie">동률</span>`;
    }

    return `
      <a href="post.html?id=${escapeHtml(post.id)}" class="dbi-item closed-dbi-item">
        <div class="dbi-inner">
          <div class="dbi-title-row">
            <span class="dbi-title">${escapeHtml(post.title)}</span>
            ${winnerHtml}
          </div>
          <div class="dbi-options">
            <span class="dbi-opt dbi-opt-a">${optA}</span>
            <span class="dbi-opt-sep">vs</span>
            <span class="dbi-opt dbi-opt-b">${optB}</span>
          </div>
          <div class="dbi-bar-wrap">
            <div class="dbi-bar-a" style="width:${pctA}%;opacity:0.6"></div>
            <div class="dbi-bar-b" style="width:${pctB}%;opacity:0.6"></div>
          </div>
          <div class="dbi-pcts">
            <span class="dbi-pct-a">${pctA}%</span>
            <span class="dbi-pct-sep">vs</span>
            <span class="dbi-pct-b">${pctB}%</span>
          </div>
          <div class="dbi-stats-row">
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"><path d="M6 0C3.5 0 1 2 0 4c1 2 3.5 4 6 4s5-2 6-4C11 2 8.5 0 6 0zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/><circle cx="6" cy="4" r="1.3"/></svg>
              ${fmtNum(viewCnt)}
            </span>
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="4.5" cy="3.5" r="2"/><path d="M0 10c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="9" cy="3" r="1.5"/><path d="M9 7c1.5 0 3 1 3 3" stroke-linecap="round"/></svg>
              ${fmtNum(total)}
            </span>
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M11 1H1a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h3l2 2.5 2-2.5h3a.5.5 0 0 0 .5-.5v-6A.5.5 0 0 0 11 1z"/></svg>
              ${fmtNum(cmtCnt)}
            </span>
            <span class="dbi-stat" style="opacity:0.5">마감</span>
          </div>
        </div>
        <span class="dbi-arrow" aria-hidden="true">›</span>
      </a>`;
  }).join('');
}

// ── 마감 임박 밸런스게임 (토론 탭 마감임박 탭 전용) ────────────────────────────
async function loadUrgentBalanceGames() {
  if (!urgentGameList) return;
  const nowIso   = new Date().toISOString();
  const in24hIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  urgentGameList.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  urgentGameList.style.display = '';

  const { data: posts } = await db
    .from('posts')
    .select('id,title,option_a,option_b,expires_at')
    .eq('category', '밸런스게임')
    .gt('expires_at', nowIso)
    .lt('expires_at', in24hIso)
    .order('expires_at', { ascending: true })
    .limit(50);

  if (!posts?.length) {
    urgentGameList.innerHTML = `<div class="empty" style="padding:60px 20px"><p>마감 임박 논쟁이 없습니다.</p></div>`;
    return;
  }

  urgentGameList.innerHTML = posts.map(post => `
    <div class="urgent-game-item" data-id="${post.id}" role="button" tabindex="0"
         aria-label="${escapeHtml(post.title)} — 마감 임박">
      <div class="ugi-timer">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="6" cy="6" r="5"/><path d="M6 3.5v2.8l1.8 1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span data-expires="${escapeHtml(post.expires_at)}"></span>
      </div>
      <div class="ugi-title">${escapeHtml(post.title)}</div>
      <div class="ugi-options">
        <span class="ugi-opt-a">${escapeHtml(post.option_a || 'A')}</span>
        <span class="ugi-vs">vs</span>
        <span class="ugi-opt-b">${escapeHtml(post.option_b || 'B')}</span>
      </div>
    </div>
  `).join('');
}

// ── 퀴즈 프리뷰 (홈 전용) ──────────────────────────────────
async function loadQuizPreview() {
  const { data } = await db
    .from('posts')
    .select('id,title,category,thumbnail_url,view_count,likes(count),comments(count)')
    .in('category', ['퀴즈', '테스트'])
    .order('view_count', { ascending: false })
    .limit(6);

  if (!data?.length) return;
  if (quizDivider)       quizDivider.style.display       = '';
  if (quizPreviewHeader) quizPreviewHeader.style.display = '';
  if (quizPreviewList) {
    quizPreviewList.classList.add('quiz-preview-grid');
    quizPreviewList.innerHTML = data.map(renderPreviewItem).join('');
  }
}

// ── 커뮤니티 프리뷰 (홈 전용) ─────────────────────────────
async function loadCommunityPreview() {
  const { data } = await db
    .from('posts')
    .select('id,title,description,thumbnail_url,view_count,created_at,user_id,profiles(username,avatar_url,is_admin),comments(count),likes(count)')
    .eq('category', '커뮤니티')
    .order('created_at', { ascending: false })
    .limit(4);

  if (!data?.length) return;
  if (communityDivider)       communityDivider.style.display       = '';
  if (communityPreviewHeader) communityPreviewHeader.style.display = '';
  if (communityPreviewList) {
    communityPreviewList.classList.add('community-list');
    communityPreviewList.innerHTML = data.map(renderCommunityListItem).join('');
  }
}

// ── 커뮤니티 탭: 리스트형 전체 목록 ──────────────────────────
async function loadCommunityListPage(reset = true) {
  if (heroSection)    heroSection.style.display    = 'none';
  if (debatesHeader)  debatesHeader.style.display  = 'none';
  if (debatesBarList) debatesBarList.innerHTML      = '';
  if (urgentDivider)   urgentDivider.style.display   = 'none';
  if (urgentHeader)    urgentHeader.style.display    = 'none';
  if (urgentGameList)  urgentGameList.innerHTML      = '';
  if (closedDivider)   closedDivider.style.display   = 'none';
  if (closedHeader)    closedHeader.style.display    = 'none';
  if (closedDebatesList) { closedDebatesList.style.display = 'none'; closedDebatesList.innerHTML = ''; }
  if (quizDivider)          quizDivider.style.display          = 'none';
  if (quizPreviewHeader)    quizPreviewHeader.style.display    = 'none';
  if (quizPreviewList)      quizPreviewList.innerHTML          = '';
  if (communityDivider)     communityDivider.style.display     = 'none';
  if (communityPreviewHeader) communityPreviewHeader.style.display = 'none';
  if (communityPreviewList)   communityPreviewList.innerHTML       = '';
  if (sortBarEl)      sortBarEl.style.display = 'none';
  grid.style.display  = 'none';
  grid.innerHTML      = '';

  // 글쓰기 영역 표시 및 이벤트 초기화
  if (communityWriteArea) {
    communityWriteArea.style.display = '';
    setupCommunityWriteForm();
    _setupCommunitySearch();
  }

  if (communityListEl) {
    communityListEl.style.display = '';
    communityListEl.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
  }


  if (reset) currentPage = 0;
  const from = currentPage * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  const COMMUNITY_SELECT = 'id,title,description,thumbnail_url,view_count,created_at,user_id,is_notice,' +
    'profiles(username,avatar_url,is_admin),comments(count),likes(count)';

  // 공지 먼저 별도 조회 — 페이지네이션 무관, 항상 상단 고정
  const { data: noticeData } = await db
    .from('posts')
    .select(COMMUNITY_SELECT)
    .eq('category', '커뮤니티')
    .eq('is_notice', true)
    .order('created_at', { ascending: false });

  let query = db
    .from('posts')
    .select(COMMUNITY_SELECT, { count: 'exact' })
    .eq('category', '커뮤니티')
    .eq('is_notice', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (communitySearchQuery.trim()) {
    const escaped = communitySearchQuery.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.ilike('title', `%${escaped}%`);
  }

  const { data, error, count } = await query;

  const notices = noticeData ?? [];
  const hasContent = notices.length > 0 || (data && data.length > 0);

  if (error || !hasContent) {
    const msg = communitySearchQuery.trim()
      ? `"${escapeHtml(communitySearchQuery.trim())}" 검색 결과가 없습니다.`
      : '아직 게시물이 없습니다.';
    if (communityListEl) communityListEl.innerHTML = `<div class="empty" style="padding:60px 20px;text-align:center;color:var(--text-muted)">${msg}</div>`;
    totalCount = 0;
    renderPagination();
    return;
  }

  totalCount = count ?? 0;
  const noticeHtml = notices.length > 0
    ? `<div class="community-notice-header">공지사항</div>` + notices.map(renderCommunityListItem).join('')
    : '';
  if (communityListEl) communityListEl.innerHTML = noticeHtml + (data ?? []).map(renderCommunityListItem).join('');
  renderPagination();
}

// ── 커뮤니티 검색 이벤트 (한 번만 등록) ──────────────────────
let _communitySearchSetup = false;
function _setupCommunitySearch() {
  if (_communitySearchSetup) return;
  _communitySearchSetup = true;

  const input  = document.getElementById('communitySearchInput');
  const toggle = document.getElementById('communitySearchToggle');
  const wrap   = document.getElementById('communitySearchWrap');
  if (!input || !toggle || !wrap) return;

  input.value = communitySearchQuery;
  if (communitySearchQuery) wrap.classList.add('open');

  function _close() {
    input.value = '';
    if (communitySearchQuery) {
      communitySearchQuery = '';
      loadCommunityListPage(true);
    }
    wrap.classList.remove('open');
  }

  toggle.addEventListener('click', () => {
    const isOpen = wrap.classList.toggle('open');
    if (isOpen) {
      input.focus();
    } else {
      _close();
    }
  });

  document.addEventListener('click', (e) => {
    if (currentCategory !== '커뮤니티') return;
    if (!wrap.contains(e.target) && !input.value) {
      wrap.classList.remove('open');
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(_communitySearchTimer);
    _communitySearchTimer = setTimeout(() => {
      if (currentCategory !== '커뮤니티') return;
      communitySearchQuery = input.value;
      loadCommunityListPage(true);
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      _close();
      input.blur();
    }
  });
}

function renderCommunityListItem(post) {
  const cmtCnt   = post.comments?.[0]?.count ?? 0;
  const likeCnt  = post.likes?.[0]?.count ?? 0;
  const author   = post.profiles;
  const name     = author?.username ?? '익명';
  // [img:N] 플레이스홀더 제거 후 미리보기 텍스트 생성
  const preview  = (post.description ?? '').replace(/\[img:\d+\]/g, '').replace(/\n+/g, ' ').trim().slice(0, 100);
  const time     = relativeTime(post.created_at);
  const thumbUrl = post.thumbnail_url;
  const cmtHtml = cmtCnt > 0
    ? `<span class="cli-comments"><svg width="11" height="11" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M11 1H1a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h3l2 2.5 2-2.5h3a.5.5 0 0 0 .5-.5v-6A.5.5 0 0 0 11 1z"/></svg>${fmtNum(cmtCnt)}</span>`
    : '';
  const likeHtml = likeCnt > 0
    ? `<span class="cli-likes"><svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/></svg>${fmtNum(likeCnt)}</span>`
    : '';
  const noticeBadge = post.is_notice
    ? `<span class="cli-notice-badge">공지</span>`
    : '';
  return `
    <a href="post.html?id=${escapeHtml(post.id)}" class="community-list-item${thumbUrl ? ' cli-has-thumb' : ''}${post.is_notice ? ' cli-notice' : ''}">
      <div class="cli-body">
        <div class="cli-title-row">
          ${noticeBadge}
          <div class="cli-title">${escapeHtml(post.title)}</div>
        </div>
        ${preview ? `<div class="cli-preview">${escapeHtml(preview)}</div>` : ''}
        <div class="cli-meta">
          ${likeHtml}
          ${cmtHtml}
          <span class="cli-time">${escapeHtml(time)}</span>
          <span class="cli-author">${escapeHtml(name)}</span>
        </div>
      </div>
      ${thumbUrl ? `<div class="cli-thumb"><img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy"></div>` : ''}
    </a>`;
}

// ── 커뮤니티 인라인 글쓰기 ─────────────────────────────────────────────────
let _cwaEventsBound = false;

function setupCommunityWriteForm() {
  if (_cwaEventsBound) return;
  _cwaEventsBound = true;

  const trigger = document.getElementById('communityWriteTrigger');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    if (!currentUser) {
      location.href = `login.html?next=${encodeURIComponent('community-create.html')}`;
      return;
    }
    location.href = 'community-create.html';
  });
}

const PREVIEW_ICONS = {
  'OX퀴즈': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="10" stroke="currentColor" stroke-width="1.4" opacity="0.3"/>
    <text x="5.5" y="15" font-size="9" font-weight="700" fill="#71d8f7" font-family="monospace">O</text>
    <line x1="13" y1="8" x2="19" y2="14" stroke="#ffc947" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="19" y1="8" x2="13" y2="14" stroke="#ffc947" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  '퀴즈': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.3" opacity="0.3"/>
    <line x1="7" y1="8" x2="15" y2="8" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
    <line x1="7" y1="14" x2="11" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  '테스트': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="9.5" stroke="currentColor" stroke-width="1.2" opacity="0.2"/>
    <circle cx="11" cy="11" r="6"   stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
    <circle cx="11" cy="11" r="2.5" fill="var(--accent)"/>
    <line x1="11" y1="1.5" x2="11" y2="4"  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
    <line x1="11" y1="18" x2="11" y2="20.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
    <line x1="1.5" y1="11" x2="4"  y2="11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
    <line x1="18"  y1="11" x2="20.5" y2="11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  '커뮤니티': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="7"  cy="9"  r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
    <circle cx="15" cy="9"  r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
    <circle cx="11" cy="15" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
    <line x1="7"  y1="9"  x2="15" y2="9"  stroke="currentColor" stroke-width="1" opacity="0.4"/>
    <line x1="7"  y1="9"  x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/>
    <line x1="15" y1="9"  x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/>
  </svg>`,
  '정보': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="9.5" stroke="currentColor" stroke-width="1.3" opacity="0.4"/>
    <circle cx="11" cy="7.5" r="1.2" fill="currentColor" opacity="0.7"/>
    <line x1="11" y1="10.5" x2="11" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  '밸런스게임': `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <line x1="11" y1="4" x2="11" y2="19" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/>
    <line x1="6" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/>
    <path d="M3 13 L6 7 L9 13 Q6 17 3 13Z" stroke="#71d8f7" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
    <path d="M13 13 L16 7 L19 13 Q16 17 13 13Z" stroke="#ffc947" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  </svg>`,
};


function renderPreviewItem(post) {
  const icon = PREVIEW_ICONS[post.category] ?? PREVIEW_ICONS['퀴즈'];
  const thumb = post.thumbnail_url
    ? `<img src="${escapeHtml(post.thumbnail_url)}" alt="" loading="lazy">`
    : `<span class="qpc-thumb-icon">${icon}</span>`;
  return `<a class="quiz-preview-card" href="post.html?id=${escapeHtml(post.id)}">
    <div class="qpc-thumb">${thumb}</div>
    <div class="qpc-body">
      <span class="qpc-badge badge badge-${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
      <div class="qpc-title">${escapeHtml(post.title)}</div>
      <div class="qpc-meta">${(post.view_count || 0).toLocaleString()} 조회</div>
    </div>
  </a>`;
}

async function loadBalanceGameHome() {
  if (sortBarEl)      sortBarEl.style.display      = 'none';
  if (debatesHeader)  debatesHeader.style.display   = 'none';
  if (debatesBarList) debatesBarList.innerHTML       = '';
  if (urgentDivider)   urgentDivider.style.display   = 'none';
  if (urgentHeader)    urgentHeader.style.display    = 'none';
  if (urgentGameList) { urgentGameList.style.display = 'none'; urgentGameList.innerHTML = ''; }
  if (closedDivider)   closedDivider.style.display   = 'none';
  if (closedHeader)    closedHeader.style.display    = 'none';
  if (closedDebatesList) { closedDebatesList.style.display = 'none'; closedDebatesList.innerHTML = ''; }
  if (quizDivider)          quizDivider.style.display          = 'none';
  if (quizPreviewHeader)    quizPreviewHeader.style.display    = 'none';
  if (quizPreviewList)      quizPreviewList.innerHTML          = '';
  if (communityDivider)     communityDivider.style.display     = 'none';
  if (communityPreviewHeader) communityPreviewHeader.style.display = 'none';
  if (communityPreviewList)   communityPreviewList.innerHTML       = '';
  if (communityListEl)        communityListEl.style.display        = 'none';
  if (communityWriteArea)     communityWriteArea.style.display     = 'none';
  grid.style.display = 'none';
  grid.innerHTML     = '';
  if (paginationEl) paginationEl.innerHTML = '';

  const heroStatsRow = document.getElementById('heroStatsRow');
  if (heroStatsRow) heroStatsRow.style.display = 'none';

  // 히어로 영역 로딩 표시
  if (heroSection) heroSection.style.display = '';

  const homeNowIso = new Date().toISOString();
  const { data: posts, error } = await db
    .from('posts')
    .select(
      'id,title,description,option_a,option_b,' +
      'view_count,expires_at,ab_flipped,profiles(username),comments(count),votes(count)'
    )
    .eq('category', '밸런스게임')
    .or(`expires_at.is.null,expires_at.gt.${homeNowIso}`)
    .order('view_count', { ascending: false })
    .limit(20);  // 후보군을 넓게 확보 후 hot 스코어로 재정렬

  if (error || !posts?.length) {
    if (heroSection) {
      heroSection.innerHTML = `<div class="empty" style="padding:60px 20px"><p>아직 뜨거운 논쟁이 없습니다.</p></div>`;
    }
    return;
  }

  const postIds = posts.map(p => p.id);
  const oneHourAgoIso = new Date(Date.now() - 3600 * 1000).toISOString();

  // 투표 + 베스트 댓글 + 최근 1시간 투표 병렬 로드
  const [votesRes, commentsRes, recentVotesRes] = await Promise.all([
    db.from('votes').select('post_id,choice').in('post_id', postIds).limit(5000),
    db.from('comments')
      .select('post_id,content,side,comment_likes(count)')
      .in('post_id', postIds)
      .not('side', 'is', null)
      .limit(500),
    db.from('votes').select('post_id').in('post_id', postIds).gt('created_at', oneHourAgoIso),
  ]);

  // 포스트별 A/B 투표 집계
  const votesByPost = {};
  (votesRes.data ?? []).forEach(v => {
    if (v.choice !== 'A' && v.choice !== 'B') return;
    if (!votesByPost[v.post_id]) votesByPost[v.post_id] = { A: 0, B: 0 };
    votesByPost[v.post_id][v.choice]++;
  });

  // 포스트별 진영별 좋아요 최다 댓글
  const bestByPost = {};
  (commentsRes.data ?? []).forEach(c => {
    const likes = c.comment_likes?.[0]?.count ?? 0;
    if (!bestByPost[c.post_id]) bestByPost[c.post_id] = {};
    const prev = bestByPost[c.post_id][c.side];
    if (!prev || likes > prev.likes) {
      bestByPost[c.post_id][c.side] = { content: c.content, likes };
    }
  });

  // 최근 1시간 투표수 집계
  const recentVoteCount = {};
  (recentVotesRes.data ?? []).forEach(v => {
    recentVoteCount[v.post_id] = (recentVoteCount[v.post_id] || 0) + 1;
  });

  // Hot 정렬: 최근 1시간 투표수 우선 → 총 조회수 보조
  posts.sort((a, b) => {
    const ra = recentVoteCount[a.id] || 0;
    const rb = recentVoteCount[b.id] || 0;
    if (rb !== ra) return rb - ra;
    return (b.view_count || 0) - (a.view_count || 0);
  });

  // Hot 상위 6개만 표시
  const hotPosts = posts.slice(0, 6);
  const hotPostIds = hotPosts.map(p => p.id);

  // 투표 선택 조회 (로그인: user_id / 게스트: guest_id + localStorage 보완)
  let myVotesHome = {};
  if (currentUser) {
    const { data: myVoteData } = await db
      .from('votes')
      .select('post_id,choice')
      .eq('user_id', currentUser.id)
      .in('post_id', hotPostIds);
    (myVoteData ?? []).forEach(v => { myVotesHome[v.post_id] = v.choice; });
  } else {
    const { data: myVoteData } = await db
      .from('votes')
      .select('post_id,choice')
      .eq('guest_id', getGuestId())
      .in('post_id', hotPostIds);
    (myVoteData ?? []).forEach(v => { myVotesHome[v.post_id] = v.choice; });
    try {
      const stored = JSON.parse(localStorage.getItem('matbul-guest-votes') || '{}');
      hotPostIds.forEach(id => { if (stored[id] && !myVotesHome[id]) myVotesHome[id] = stored[id]; });
    } catch (_) {}
  }

  const [topPost, ...restPosts] = hotPosts;
  renderHero(topPost, votesByPost[topPost.id] || { A: 0, B: 0 }, bestByPost[topPost.id] || {});

  if (restPosts.length) {
    renderDebateBarList(restPosts, votesByPost, bestByPost, myVotesHome);
    if (debatesHeader) debatesHeader.style.display = '';
  }

  // 퀴즈 · 커뮤니티 프리뷰 병렬 로드
  await Promise.all([loadQuizPreview(), loadCommunityPreview()]);
  startHomeExpiryTimers();
}

function renderHero(post, votes, best) {
  const total = votes.A + votes.B;
  const pctA  = total > 0 ? +(votes.A / total * 100).toFixed(1) : 50;
  const pctB  = +(100 - pctA).toFixed(1);
  const blind = isPostBlind(post);

  // 데이터 채우기 (textContent → XSS 안전)
  const heroSubtitleEl = document.getElementById('heroSubtitle');
  if (heroSubtitleEl) heroSubtitleEl.textContent = post.title || '';

  const q = id => document.getElementById(id);

  if (q('heroOptA')) q('heroOptA').textContent = post.option_a || 'A';
  if (q('heroOptB')) q('heroOptB').textContent = post.option_b || 'B';
  if (q('heroPctA')) q('heroPctA').textContent = blind ? '??' : pctA + '%';
  if (q('heroPctB')) q('heroPctB').textContent = blind ? '??' : pctB + '%';
  if (q('heroVoterCnt')) q('heroVoterCnt').textContent = fmtNum(total);

  // 하단 stats 패널
  if (q('hsrPctA')) q('hsrPctA').textContent = blind ? '찬성 ??' : '찬성 ' + pctA + '%';
  if (q('hsrPctB')) q('hsrPctB').textContent = blind ? '반대 ??' : '반대 ' + pctB + '%';

  const bestAContent = best.A?.content || '';
  const bestBContent = best.B?.content || '';
  if (q('heroBestA')) q('heroBestA').textContent = bestAContent || '아직 댓글이 없습니다';
  if (q('heroBestB')) q('heroBestB').textContent = bestBContent || '아직 댓글이 없습니다';
  if (q('heroBestALikes') && best.A) q('heroBestALikes').textContent = '좋아요 ' + fmtNum(best.A.likes);
  if (q('heroBestBLikes') && best.B) q('heroBestBLikes').textContent = '좋아요 ' + fmtNum(best.B.likes);

  // 히어로 타이머 chip
  const heroChip = document.getElementById('heroExpiryChip');
  if (heroChip && post.expires_at) {
    heroChip.dataset.expires = post.expires_at;
  } else if (heroChip) {
    heroChip.removeAttribute('data-expires');
    heroChip.textContent = '';
    heroChip.className = '';
  }

  // 히어로 배틀 데이터
  if (heroBattle) heroBattle.dataset.id = post.id;

  // ── 배경 분할 (블라인드 모드: 50/50 고정) ──
  if (heroBattle) {
    const vbA = blind ? 50 : pctA;
    const vbB = blind ? 50 : pctB;
    if (total > 0) {
      heroBattle.style.setProperty('--divide', vbA + '%');
      heroBattle.style.setProperty('--pct-a', vbA);
      heroBattle.style.setProperty('--pct-b', vbB);
    }

    // ── 불꽃 세기: 블라인드 시 균등, 일반 시 투표율 반영 ──
    const applyFlame = (side, pct) => {
      const opacity = (0.25 + (pct / 100) * 0.75).toFixed(2);
      const sat     = Math.round(60 + pct * 1.4) + '%';
      const bright  = (0.6 + (pct / 100) * 0.5).toFixed(2);
      const scale   = (0.65 + (pct / 100) * 0.5).toFixed(2);
      heroBattle.style.setProperty('--flame-' + side + '-opacity', opacity);
      heroBattle.style.setProperty('--flame-' + side + '-sat',     sat);
      heroBattle.style.setProperty('--flame-' + side + '-bright',  bright);
      heroBattle.style.setProperty('--flame-' + side + '-scale',   scale);
    };

    if (total > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyFlame('a', vbA);
          applyFlame('b', vbB);
        });
      });
    }
  }

  // stats row 표시
  const heroStatsRow = document.getElementById('heroStatsRow');
  if (heroStatsRow) heroStatsRow.style.display = '';
}

function isPostBlind(post) {
  if (!post?.expires_at) return false;
  const msLeft = new Date(post.expires_at) - Date.now();
  return msLeft > 0 && msLeft < 60 * 60 * 1000;
}

// ── 날짜 파싱: Supabase 타임스탬프 → ms ──────────────────────────
// Supabase: "YYYY-MM-DD HH:MM:SS.ssssss+00" → ISO 8601 변환
function parseDateMs(str) {
  if (!str) return NaN;
  // "2026-03-29 06:16:01.738059+00" → "2026-03-29T06:16:01.738+00:00"
  const iso = str.replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1').replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(iso);
  if (!isNaN(ms)) return ms;
  // 폴백: 원본 문자열 그대로 시도
  return Date.parse(str);
}

// ── 홈 타이머 (1분 간격, 1시간 미만 진입 시 1초로 전환) ──────────
let _homeTimerId = null;
function startHomeExpiryTimers() {
  if (_homeTimerId) { clearInterval(_homeTimerId); _homeTimerId = null; }

  function tick() {
    let anyUrgent = false;
    document.querySelectorAll('[data-expires]').forEach(el => {
      const expiresMs = parseDateMs(el.dataset.expires);
      const msLeft = expiresMs - Date.now();
      let text, colorCls;
      if (isNaN(msLeft) || msLeft <= 0) {
        text = '종료'; colorCls = 'tl-ended';
      } else if (msLeft < 60 * 60 * 1000) {
        const m = Math.floor(msLeft / 60_000);
        const s = Math.floor((msLeft % 60_000) / 1000);
        text = `${m}분 ${String(s).padStart(2, '0')}초`;
        colorCls = 'tl-urgent';
        anyUrgent = true;
      } else if (msLeft < 24 * 60 * 60 * 1000) {
        const h = Math.floor(msLeft / 3_600_000);
        const m = Math.floor((msLeft % 3_600_000) / 60_000);
        text = `${h}시간 ${m}분`;
        colorCls = 'tl-urgent';
        anyUrgent = true;
      } else {
        const d = Math.ceil(msLeft / (24 * 3_600_000));
        text = `D-${d}`;
        colorCls = 'tl-active';
      }
      el.textContent = text;
      el.classList.remove('tl-active', 'tl-today', 'tl-urgent', 'tl-ended');
      // #heroExpiryChip은 ID CSS로 처리 (time-left-chip 클래스 불필요)
      if (el.id !== 'heroExpiryChip') {
        el.classList.add('time-left-chip', colorCls);
      } else {
        el.classList.add(colorCls);
      }
    });
    return anyUrgent;
  }

  const urgent = tick(); // 즉시 1회 실행
  let _urgentMode = urgent;
  _homeTimerId = setInterval(() => {
    const hasUrgent = tick();
    if (hasUrgent && !_urgentMode) {
      // 60s → 1s 전환
      _urgentMode = true;
      clearInterval(_homeTimerId);
      _homeTimerId = setInterval(() => {
        const stillUrgent = tick();
        if (!stillUrgent) {
          // 1s → 60s 복귀 (긴급 항목 모두 만료)
          _urgentMode = false;
          clearInterval(_homeTimerId);
          _homeTimerId = setInterval(() => { tick(); }, 60_000);
        }
      }, 1_000);
    }
  }, urgent ? 1_000 : 60_000);
}

function renderDebateBarList(posts, votesByPost, bestByPost, myVotes = {}) {
  if (!debatesBarList) return;
  debatesBarList.innerHTML = posts.map(post => {
    const votes   = votesByPost[post.id] || { A: 0, B: 0 };
    const total   = votes.A + votes.B;
    const pctA    = total > 0 ? Math.round(votes.A / total * 100) : 50;
    const pctB    = 100 - pctA;
    const cmtCnt  = post.comments?.[0]?.count ?? 0;
    const viewCnt = post.view_count ?? 0;
    const best    = bestByPost?.[post.id] || {};
    const bestA   = best.A?.content || '';
    const bestB   = best.B?.content || '';
    const myChoice = myVotes[post.id];
    const myVoteTag = myChoice
      ? `<span class="dbi-my-choice dbi-my-choice-${myChoice.toLowerCase()}">✓ ${escapeHtml(myChoice === 'A' ? post.option_a || 'A' : post.option_b || 'B')}</span>`
      : '';

    const blind = isPostBlind(post);
    const barAStyle = blind ? 'width:50%' : `width:${pctA}%`;
    const barBStyle = blind ? 'width:50%' : `width:${pctB}%`;
    const pctAText  = blind ? '??%' : `${pctA}%`;
    const pctBText  = blind ? '??%' : `${pctB}%`;
    const blindBadge = blind ? `<span class="dbi-blind-badge">블라인드</span>` : '';
    const timeStatHtml = post.expires_at
      ? `<span class="dbi-stat dbi-stat-time">
           <span data-expires="${escapeHtml(post.expires_at)}"></span>
         </span>`
      : '';

    return `
      <div class="debate-bar-item${myChoice ? ' voted-' + myChoice.toLowerCase() : ''}" data-id="${post.id}" role="button" tabindex="0"
           aria-label="${escapeHtml(post.title)} 투표하기">
        ${myChoice ? `<div class="dbi-voted-stamp dbi-voted-stamp-${myChoice.toLowerCase()}">✓</div>` : ''}
        <div class="dbi-body">
          <div class="dbi-title-row">
            <div class="dbi-title">${escapeHtml(post.title)}${blindBadge}</div>
            ${myVoteTag}
          </div>
          <div class="dbi-top-row">
            <span class="dbi-opt-a">${escapeHtml(post.option_a || 'A')}</span>
            <span class="dbi-vs-badge">vs</span>
            <span class="dbi-opt-b">${escapeHtml(post.option_b || 'B')}</span>
          </div>
          <div class="dbi-bar-wrap">
            <div class="dbi-bar-a" style="${barAStyle}"></div>
            <div class="dbi-bar-b" style="${barBStyle}"></div>
          </div>
          <div class="dbi-pcts">
            <span class="dbi-pct-a">${pctAText}</span>
            <span class="dbi-pct-sep">vs</span>
            <span class="dbi-pct-b">${pctBText}</span>
          </div>
          ${bestA || bestB ? `
          <div class="dbi-best-row">
            ${bestA ? `<div class="dbi-best dbi-best-a"><span class="dbi-best-icon">A</span><span class="dbi-best-text">${escapeHtml(bestA)}</span></div>` : '<div></div>'}
            ${bestB ? `<div class="dbi-best dbi-best-b"><span class="dbi-best-icon">B</span><span class="dbi-best-text">${escapeHtml(bestB)}</span></div>` : '<div></div>'}
          </div>` : ''}
          <div class="dbi-stats-row">
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"><path d="M6 0C3.5 0 1 2 0 4c1 2 3.5 4 6 4s5-2 6-4C11 2 8.5 0 6 0zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/><circle cx="6" cy="4" r="1.3"/></svg>
              ${fmtNum(viewCnt)}
            </span>
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="4.5" cy="3.5" r="2"/><path d="M0 10c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="9" cy="3" r="1.5"/><path d="M9 7c1.5 0 3 1 3 3" stroke-linecap="round"/></svg>
              ${fmtNum(total)}
            </span>
            <span class="dbi-stat">
              <svg width="12" height="12" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M11 1H1a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h3l2 2.5 2-2.5h3a.5.5 0 0 0 .5-.5v-6A.5.5 0 0 0 11 1z"/></svg>
              ${fmtNum(cmtCnt)}
            </span>
            ${timeStatHtml}
          </div>
        </div>
        <span class="dbi-arrow" aria-hidden="true">›</span>
      </div>`;
  }).join('');
}

function renderCards(posts) {
  if (!posts.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1" class="empty">
        <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="20" cy="20" r="12"/><line x1="30" y1="30" x2="43" y2="43"/></svg></div>
        <p>아직 게시물이 없습니다.</p>
      </div>`;
    return;
  }

  const balancePostIds = [];

  grid.innerHTML = posts.map(post => {
    const likeCount    = post.likes?.[0]?.count ?? 0;
    const commentCount = post.comments?.[0]?.count ?? 0;
    const voteCount    = post.votes?.[0]?.count ?? 0;
    const author       = post.profiles;
    const heatLevel    = window.getHeatLevel ? window.getHeatLevel(post.view_count, likeCount) : 0;
    const isHot        = heatLevel >= 2;
    const hotClass     = isHot ? ' card-hot' : '';

    if (post.category === '밸런스게임') {
      balancePostIds.push(post.id);
      return renderBalanceCard(post, voteCount, heatLevel);
    }
    return renderDefaultCard(post, likeCount, commentCount, author, hotClass);
  }).join('');

  if (balancePostIds.length) {
    loadBestComments(balancePostIds);
  }

  // 파티클 초기화 (DOM 반영 후)
  setTimeout(initCardParticles, 60);
}

// ── 밸런스게임 배너 카드 ──────────────────────────────────
function renderBalanceCard(post, voteCount, heatLevel) {
  const optA      = escapeHtml(post.option_a || 'A');
  const optB      = escapeHtml(post.option_b || 'B');
  const heatClass = heatLevel > 0 ? ` card-heat-${heatLevel}` : '';

  const heatTag = heatLevel >= 3
    ? '<span class="card-heat-tag"><b class="hi h3"></b>전쟁 중</span>'
    : heatLevel >= 2
    ? '<span class="card-heat-tag"><b class="hi h2"></b>뜨거운 논쟁</span>'
    : heatLevel >= 1
    ? '<span class="card-heat-tag"><b class="hi h1"></b>달아오르는 중</span>'
    : '';

  return `
    <div class="card card-balance${heatClass}" data-id="${post.id}"
         role="button" tabindex="0" aria-label="${escapeHtml(post.title)} 투표하기">
      <div class="card-balance-inner">
        <div class="card-balance-top-bar">
          <div class="card-balance-top-bar-a"></div>
          <div class="card-balance-top-bar-b"></div>
        </div>
        <div class="card-balance-arena">
          ${heatLevel >= 1 ? `<canvas class="card-spark-canvas" data-heat="${heatLevel}"></canvas>` : ''}
          <div class="card-balance-side card-balance-a">
            <div class="card-pct-label">A 진영</div>
            <div class="card-pct card-pct-a"></div>
            <div class="card-balance-option">${optA}</div>
            <div class="card-balance-claim" data-side="A"></div>
          </div>
          <div class="card-balance-vs">VS</div>
          <div class="card-balance-side card-balance-b">
            <div class="card-pct-label">B 진영</div>
            <div class="card-pct card-pct-b"></div>
            <div class="card-balance-option">${optB}</div>
            <div class="card-balance-claim" data-side="B"></div>
          </div>
        </div>
        <div class="card-balance-meta">
          <span class="card-balance-title">${escapeHtml(post.title)}</span>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${heatTag}
            <span class="card-balance-voters"><svg class="ic-battle" viewBox="0 0 12 12" fill="none" aria-hidden="true"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="1" y1="3.5" x2="3.5" y2="1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8.5" y1="11" x2="11" y2="8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><strong>${fmtNum(voteCount)}</strong>명 참전</span>
          </div>
        </div>
        ${post.expires_at ? `<div class="card-time-left"><span data-expires="${escapeHtml(post.expires_at)}"></span></div>` : ''}
      </div>
    </div>`;
}

// ── 투표율 + 진영별 베스트 주장 비동기 로드 ──────────────
async function loadBestComments(postIds) {
  if (!postIds.length) return;

  // 병렬: 투표 데이터 + 진영별 댓글
  const [votesRes, commentsRes] = await Promise.all([
    db.from('votes')
      .select('post_id,choice')
      .in('post_id', postIds)
      .limit(2000),
    db.from('comments')
      .select('post_id,content,side,comment_likes(count)')
      .in('post_id', postIds)
      .not('side', 'is', null)
      .limit(400),
  ]);

  // 포스트별 A/B 투표 수 집계
  const votesByPost = {};
  (votesRes.data ?? []).forEach(v => {
    if (v.choice !== 'A' && v.choice !== 'B') return;
    if (!votesByPost[v.post_id]) votesByPost[v.post_id] = { A: 0, B: 0 };
    votesByPost[v.post_id][v.choice]++;
  });

  // 포스트별 진영별 좋아요 최다 댓글 찾기
  const bestByPost = {};
  (commentsRes.data ?? []).forEach(c => {
    const likes = c.comment_likes?.[0]?.count ?? 0;
    if (!bestByPost[c.post_id]) bestByPost[c.post_id] = {};
    const prev = bestByPost[c.post_id][c.side];
    if (!prev || likes > prev.likes) {
      bestByPost[c.post_id][c.side] = { content: c.content, likes };
    }
  });

  postIds.forEach(id => {
    const card = grid.querySelector(`.card-balance[data-id="${id}"]`);
    if (!card) return;

    // 투표율 반영: CSS 커스텀 프로퍼티 + 분리선 이동
    const votes = votesByPost[id] || { A: 0, B: 0 };
    const total = votes.A + votes.B;
    if (total > 0) {
      const pctA = Math.round((votes.A / total) * 100);
      const pctB = 100 - pctA;
      card.style.setProperty('--pct-a', pctA);
      card.style.setProperty('--pct-b', pctB);
      card.style.setProperty('--divide', pctA + '%');

      const labelA = card.querySelector('.card-pct-a');
      const labelB = card.querySelector('.card-pct-b');
      if (labelA) { labelA.textContent = pctA + '%'; labelA.classList.add('loaded'); }
      if (labelB) { labelB.textContent = pctB + '%'; labelB.classList.add('loaded'); }
    }

    // 진영별 베스트 주장 주입 (textContent → XSS 안전)
    ['A', 'B'].forEach(side => {
      const el = card.querySelector(`.card-balance-claim[data-side="${side}"]`);
      if (!el) return;
      const best = bestByPost[id]?.[side];
      if (best) el.textContent = best.content;
    });
  });
}

// ── 퀴즈 유형 인라인 뱃지 (썸네일 아래) ──────────────────────
const QUIZ_TYPE_LABELS = {
  ox:         'O/X 퀴즈',
  multiple:   '객관식',
  short:      '단답형',
  subjective: '주관식',
};

function buildQuizTypeBadge(post) {
  if (post.category !== '퀴즈' || !post.quiz_type) return '';
  const label = QUIZ_TYPE_LABELS[post.quiz_type] ?? post.quiz_type;
  return `<div class="card-quiz-type card-quiz-type-${escapeHtml(post.quiz_type)}">${escapeHtml(label)}</div>`;
}

// ── 일반 카드 (퀴즈 / 테스트 / 커뮤니티 / 정보) ─────────────
function renderDefaultCard(post, likeCount, commentCount, author, hotClass) {
  const thumb = post.thumbnail_url;
  const isHot = hotClass !== '';
  return `
    <a href="post.html?id=${post.id}" class="card${hotClass}">
      <div class="card-thumb-wrap">
        ${thumb
          ? `<img class="card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy">`
          : `<div class="card-thumb-placeholder">${PREVIEW_ICONS[post.category] ?? PREVIEW_ICONS['커뮤니티']}</div>`
        }
        <span class="badge badge-${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
        ${isHot ? '<span class="card-hot-tag" style="position:absolute;bottom:8px;right:8px"><b class="hi h3"></b>인기</span>' : ''}
      </div>
      <div class="card-body">
        ${buildQuizTypeBadge(post)}
        <div class="card-title">${escapeHtml(post.title)}</div>
        <div class="card-meta">
          <div class="card-author${post.user_id && !author?.is_admin ? ' card-author-link' : ''}"${post.user_id && !author?.is_admin ? ` data-profile-id="${escapeHtml(post.user_id)}" role="button" tabindex="0" title="프로필 보기"` : ''}>
            ${author?.avatar_url
              ? `<img class="card-author-avatar" src="${escapeHtml(author.avatar_url)}" alt="">`
              : `<span class="card-author-avatar" style="display:inline-flex;align-items:center;justify-content:center;background:var(--surface2);font-size:0.7rem;">${escapeHtml((author?.username ?? '?')[0])}</span>`
            }
            <span>${escapeHtml(author?.username ?? '익명')}</span>
          </div>
          <div class="card-stats">
            <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"><path d="M6 0C3.5 0 1 2 0 4c1 2 3.5 4 6 4s5-2 6-4C11 2 8.5 0 6 0zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/><circle cx="6" cy="4" r="1.3"/></svg>${fmtNum(post.view_count)}</span>
            <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5C6 9.5 1 6 1 3.5A2.5 2.5 0 0 1 6 3a2.5 2.5 0 0 1 5 .5C11 6 6 9.5 6 9.5z"/></svg>${fmtNum(likeCount)}</span>
            <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M11 1H1a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h3l2 2.5 2-2.5h3a.5.5 0 0 0 .5-.5v-6A.5.5 0 0 0 11 1z"/></svg>${fmtNum(commentCount)}</span>
          </div>
        </div>
      </div>
    </a>`;
}

// ── 카드 작성자 클릭 → 프로필 이동 ──────────────────────────
grid.addEventListener('click', e => {
  const authorEl = e.target.closest('.card-author[data-profile-id]');
  if (!authorEl) return;
  e.preventDefault();
  location.href = `profile.html?id=${authorEl.dataset.profileId}`;
});

grid.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const authorEl = e.target.closest('.card-author[data-profile-id]');
  if (authorEl) {
    e.preventDefault();
    location.href = `profile.html?id=${authorEl.dataset.profileId}`;
    return;
  }
  const card = e.target.closest('.card-balance');
  if (!card || !card.dataset.id) return;
  e.preventDefault();
  location.href = `post.html?id=${card.dataset.id}`;
});


// ── 히어로 배틀 클릭/키보드 ──────────────────────────────
if (heroBattle) {
  heroBattle.addEventListener('click', e => {
    if (!heroBattle.dataset.id) return;
    location.href = `post.html?id=${heroBattle.dataset.id}`;
  });
  heroBattle.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!heroBattle.dataset.id) return;
    location.href = `post.html?id=${heroBattle.dataset.id}`;
  });
}

// ── 히어로 투표 버튼 (A/B) ───────────────────────────────
const heroVoteBtnA = document.getElementById('heroVoteBtnA');
const heroVoteBtnB = document.getElementById('heroVoteBtnB');
if (heroVoteBtnA) {
  heroVoteBtnA.addEventListener('click', e => {
    e.stopPropagation();
    if (heroBattle?.dataset.id) location.href = `post.html?id=${heroBattle.dataset.id}`;
  });
}
if (heroVoteBtnB) {
  heroVoteBtnB.addEventListener('click', e => {
    e.stopPropagation();
    if (heroBattle?.dataset.id) location.href = `post.html?id=${heroBattle.dataset.id}`;
  });
}

// ── 마감 임박 리스트 이벤트 위임 ─────────────────────────
if (urgentGameList) {
  urgentGameList.addEventListener('click', e => {
    const item = e.target.closest('.urgent-game-item');
    if (!item || !item.dataset.id) return;
    location.href = `post.html?id=${item.dataset.id}`;
  });
  urgentGameList.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.urgent-game-item');
    if (!item || !item.dataset.id) return;
    e.preventDefault();
    location.href = `post.html?id=${item.dataset.id}`;
  });
}

// ── 토론 서브탭 (진행 중 / 마감됨) 이벤트 ───────────────
if (debateSubTabs) {
  debateSubTabs.addEventListener('click', e => {
    const tab = e.target.closest('.debate-sub-tab');
    if (!tab) return;
    const dtab = tab.dataset.dtab;
    if (dtab === currentDebateTab) return;
    if (dtab === 'closed') {
      loadClosedDebatesTab();
    } else {
      loadDebateBarPage();
    }
  });
}

// ── 바형 리스트 이벤트 위임 ──────────────────────────────
if (debatesBarList) {
  debatesBarList.addEventListener('click', e => {
    const item = e.target.closest('.debate-bar-item');
    if (!item || !item.dataset.id) return;
    location.href = `post.html?id=${item.dataset.id}`;
  });
  debatesBarList.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.debate-bar-item');
    if (!item || !item.dataset.id) return;
    e.preventDefault();
    location.href = `post.html?id=${item.dataset.id}`;
  });
}

function renderPagination() {
  if (!paginationEl) return;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  if (pageCount <= 1) { paginationEl.innerHTML = ''; return; }

  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push(`<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i + 1}</button>`);
  }
  paginationEl.innerHTML = pages.join('');
  paginationEl.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      loadPosts(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// Category from URL
function readUrlParams() {
  const params = new URLSearchParams(location.search);
  currentCategory = params.get('cat') ?? '밸런스게임';

  // nav-link (새 중앙 네브) + 기존 cat-btn 모두 업데이트
  document.querySelectorAll('.nav-link[data-cat], .cat-btn[data-cat]').forEach(btn => {
    const cat = btn.dataset.cat ?? '';
    btn.classList.toggle('active', cat === currentCategory);
  });

  // 밸런스게임 홈 vs 다른 카테고리 레이아웃 전환
  const isHome = currentCategory === '밸런스게임';
  if (sortBarEl)   sortBarEl.style.display   = isHome ? 'none' : '';
  if (heroSection) heroSection.style.display  = 'none'; // 데이터 로드 후 표시
}

// Sort buttons
sortBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sortBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (currentDebateTab === 'closed') {
      closedSort = btn.dataset.sort;
      loadClosedDebates();
    } else {
      currentSort = btn.dataset.sort;
      loadPosts();
    }
  });
});

// Sort direction toggle
const sortDirBtn = document.getElementById('sortDirBtn');
if (sortDirBtn) {
  sortDirBtn.addEventListener('click', () => {
    currentSortAsc = !currentSortAsc;
    sortDirBtn.classList.toggle('asc', currentSortAsc);
    if (currentDebateTab === 'closed') {
      loadClosedDebates();
    } else {
      loadPosts();
    }
  });
}

// 모바일 카테고리 셀렉트 연동
const catSelectMobile = document.getElementById('catSelectMobile');
if (catSelectMobile) {
  catSelectMobile.addEventListener('change', () => {
    const cat = catSelectMobile.value;
    location.href = cat ? `index.html?cat=${encodeURIComponent(cat)}` : 'index.html';
  });
}

// Init
readUrlParams();
if (catSelectMobile) catSelectMobile.value = currentCategory;
initAuth();
(async () => {
  currentUser = await getUser();
  loadPosts();
})();

// ═══════════════════════════════════════════════════════════
// ── Canvas 파티클 시스템 — 열기 단계별 연기/불꽃 ──
// ═══════════════════════════════════════════════════════════

const cardParticleMap = new Map(); // canvas → { particles }
let particleRafId = null;

class CardParticle {
  constructor(canvas, heat) {
    this.canvas = canvas;
    this.heat = heat;
    this.reset(true);
  }

  reset(init = false) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 스폰 위치: 카드 하단 40~100% 구간 (SVG 불꽃 레이어와 겹침)
    this.x  = w * 0.05 + Math.random() * w * 0.9;
    this.y  = init
      ? h * (0.2 + Math.random() * 0.8)  // 초기 분산
      : h * (0.6 + Math.random() * 0.4); // 이후 하단 스폰

    // 속도 — heat가 높을수록 빠르고 넓게
    const speed = this.heat === 3 ? 0.6 + Math.random() * 1.6
                : this.heat === 2 ? 0.3 + Math.random() * 0.9
                :                   0.15 + Math.random() * 0.45;
    this.vx = (Math.random() - 0.5) * (this.heat === 3 ? 1.0 : 0.4);
    this.vy = -speed;

    // 수명
    this.life  = init ? Math.random() : 1;
    this.decay = this.heat === 3 ? 0.010 + Math.random() * 0.014
               : this.heat === 2 ? 0.006 + Math.random() * 0.009
               :                   0.003 + Math.random() * 0.005;

    // 크기
    this.size = this.heat === 3 ? 1.0 + Math.random() * 2.2
              : this.heat === 2 ? 1.5 + Math.random() * 2.8
              :                   2.2 + Math.random() * 3.5;

    // 유형 결정: 불씨 vs 연기
    // heat3: 70% 불씨, heat2: 30% 불씨, heat1: 0% 불씨 (연기만)
    const emberChance = this.heat === 3 ? 0.70 : this.heat === 2 ? 0.30 : 0;
    this.isEmber = Math.random() < emberChance;

    // 색조 (불씨: 10~45 주황/빨강/노랑, 연기: n/a)
    this.hue = 10 + Math.random() * 35;
  }

  update() {
    this.x += this.vx + (Math.random() - 0.5) * 0.25;
    this.y += this.vy;
    this.vy *= 0.992; // 부드럽게 감속
    this.life -= this.decay;
    if (this.life <= 0 || this.y < -this.size * 3) this.reset();
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.min(this.life, 1);
    const r = this.size;

    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.8);

    if (this.isEmber) {
      // 불씨: 밝은 코어 → 오렌지/빨강 → 투명
      g.addColorStop(0,   `hsla(${this.hue},     100%, 88%, ${alpha * 0.95})`);
      g.addColorStop(0.35,`hsla(${this.hue + 10}, 95%, 60%, ${alpha * 0.65})`);
      g.addColorStop(0.7, `hsla(${this.hue + 20}, 85%, 35%, ${alpha * 0.28})`);
      g.addColorStop(1,   `hsla(${this.hue + 25}, 75%, 20%, 0)`);
    } else {
      // 연기: blue-gray, 크고 흐릿함
      const s = alpha * 0.18;
      g.addColorStop(0,   `rgba(175, 185, 200, ${s * 1.4})`);
      g.addColorStop(0.5, `rgba(155, 165, 182, ${s})`);
      g.addColorStop(1,   `rgba(140, 150, 168, 0)`);
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function initCardParticles() {
  // 기존 파티클 정지 후 초기화
  if (particleRafId) {
    cancelAnimationFrame(particleRafId);
    particleRafId = null;
  }
  cardParticleMap.clear();

  document.querySelectorAll('.card-spark-canvas').forEach(canvas => {
    const heat = parseInt(canvas.dataset.heat) || 0;
    if (heat < 1) return;

    // 캔버스 실제 렌더 크기 설정
    canvas.width  = canvas.offsetWidth  || 480;
    canvas.height = canvas.offsetHeight || 200;

    // heat별 파티클 수
    const count = heat === 3 ? 38 : heat === 2 ? 16 : 6;
    const particles = Array.from({ length: count }, () => new CardParticle(canvas, heat));
    cardParticleMap.set(canvas, { particles });
  });

  if (cardParticleMap.size > 0) tickCardParticles();
}

function tickCardParticles() {
  cardParticleMap.forEach(({ particles }, canvas) => {
    // 카드가 DOM에서 제거되면 정리
    if (!document.body.contains(canvas)) {
      cardParticleMap.delete(canvas);
      return;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(ctx); });
  });

  particleRafId = requestAnimationFrame(tickCardParticles);
}
