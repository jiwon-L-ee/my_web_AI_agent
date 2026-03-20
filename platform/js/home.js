// home.js — card grid, category filter, sort

const PAGE_SIZE = 20;
let currentCategory = '';
let currentSort = 'created_at';
let currentPage = 0;
let totalCount = 0;

const grid = document.getElementById('cardGrid');
const sortBtns = document.querySelectorAll('.sort-btn');
const paginationEl = document.getElementById('pagination');

async function loadPosts(reset = true) {
  if (reset) currentPage = 0;

  grid.innerHTML = `<div style="grid-column:1/-1"><div class="spinner-wrap"><div class="spinner"></div></div></div>`;

  const from = currentPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db
    .from('posts')
    .select(
      'id,title,category,thumbnail_url,view_count,created_at,option_a,option_b,' +
      'profiles(username,avatar_url),likes(count),comments(count),votes(count)',
      { count: 'exact' }
    )
    .order(currentSort, { ascending: false })
    .range(from, to);

  if (currentCategory) query = query.eq('category', currentCategory);

  const { data, error, count } = await query;

  if (error) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">데이터를 불러오지 못했습니다.</div>`;
    console.error(error);
    return;
  }

  totalCount = count ?? 0;
  renderCards(data ?? []);
  renderPagination();
}

function renderCards(posts) {
  if (!posts.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1" class="empty">
        <div class="empty-icon">🔍</div>
        <p>아직 게시물이 없습니다.</p>
      </div>`;
    return;
  }

  grid.innerHTML = posts.map(post => {
    const likeCount  = post.likes?.[0]?.count ?? 0;
    const commentCount = post.comments?.[0]?.count ?? 0;
    const voteCount  = post.votes?.[0]?.count ?? 0;
    const author     = post.profiles;
    const isHot      = window.isHotPost ? window.isHotPost(post.view_count, likeCount) : false;
    const hotClass   = isHot ? ' card-hot' : '';

    if (post.category === '밸런스게임') {
      return renderBalanceCard(post, voteCount, hotClass);
    }
    return renderDefaultCard(post, likeCount, commentCount, author, hotClass);
  }).join('');
}

// ── 밸런스게임 배너 카드 ──────────────────────────────────
function renderBalanceCard(post, voteCount, hotClass) {
  const isHot = hotClass !== '';
  const optA = escapeHtml(post.option_a || 'A');
  const optB = escapeHtml(post.option_b || 'B');

  const hotTag = isHot ? '<span class="card-hot-tag">🔥 인기</span>' : '';

  return `
    <div class="card card-balance${hotClass}" data-id="${post.id}" role="button" tabindex="0" aria-label="${escapeHtml(post.title)} 투표하기">
      <div class="card-balance-inner">
        <div class="card-balance-meta">
          <span class="card-balance-title">${escapeHtml(post.title)}</span>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${hotTag}
            <span class="card-balance-voters">👥 ${fmtNum(voteCount)}명 참여</span>
          </div>
        </div>
        <div class="card-balance-arena">
          <div class="card-balance-side card-balance-a">
            <div class="card-balance-option">${optA}</div>
            <div class="card-balance-pct">🔵 A 진영</div>
          </div>
          <div class="card-balance-vs">VS</div>
          <div class="card-balance-side card-balance-b">
            <div class="card-balance-option">${optB}</div>
            <div class="card-balance-pct">🟠 B 진영</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── 일반 카드 (OX퀴즈 / 테스트) ─────────────────────────
function renderDefaultCard(post, likeCount, commentCount, author, hotClass) {
  const thumb = post.thumbnail_url;
  const isHot = hotClass !== '';
  return `
    <a href="post.html?id=${post.id}" class="card${hotClass}">
      <div class="card-thumb-wrap">
        ${thumb
          ? `<img class="card-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy">`
          : `<div class="card-thumb-placeholder">🧠</div>`
        }
        <span class="badge badge-${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
        ${isHot ? '<span class="card-hot-tag" style="position:absolute;bottom:8px;right:8px">🔥 인기</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(post.title)}</div>
        <div class="card-meta">
          <div class="card-author">
            ${author?.avatar_url
              ? `<img class="card-author-avatar" src="${escapeHtml(author.avatar_url)}" alt="">`
              : `<span class="card-author-avatar" style="display:inline-flex;align-items:center;justify-content:center;background:var(--surface2);font-size:0.7rem;">${escapeHtml((author?.username ?? '?')[0])}</span>`
            }
            <span>${escapeHtml(author?.username ?? '익명')}</span>
          </div>
          <div class="card-stats">
            <span class="card-stat">👁 ${fmtNum(post.view_count)}</span>
            <span class="card-stat">❤️ ${fmtNum(likeCount)}</span>
            <span class="card-stat">💬 ${fmtNum(commentCount)}</span>
          </div>
        </div>
      </div>
    </a>`;
}

// ── 키보드 접근성: 밸런스 카드 Enter/Space ────────────────
grid.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.card-balance');
  if (!card || !card.dataset.id) return;
  e.preventDefault();
  if (window.openVoteModal) openVoteModal(card.dataset.id);
});

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
  currentCategory = params.get('cat') ?? '';

  document.querySelectorAll('.cat-btn').forEach(btn => {
    const cat = btn.dataset.cat ?? '';
    btn.classList.toggle('active', cat === currentCategory);
  });
}

// Sort buttons
sortBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sortBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    loadPosts();
  });
});

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
loadPosts();
