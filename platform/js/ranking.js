// ranking.js — 유저 랭킹 페이지

const RANK_PAGE_SIZE = 20;
const RANK_MAX_PAGES = 5;   // 최대 100위까지 표시

let allStats    = [];   // get_ranking_stats() 결과 전체
let currentTab  = 'overall';
let rankPage    = 0;    // 현재 페이지 (0-indexed)
let currentUser = null;

const TABS = {
  overall:    { label: '종합',   key: 'overall_score',    unit: 'pt' },
  credits:    { label: '크레딧', key: 'credits',          unit: '크레딧' },
  likes:      { label: '좋아요', key: 'like_count',       unit: '개' },
  persuasion: { label: '설득함', key: 'persuasion_count', unit: '회' },
  followers:  { label: '팔로워', key: 'follower_count',   unit: '명' },
};

// ── 초기화 ──────────────────────────────────────────────────────
(async () => {
  await initAuth();            // 네브바 먼저 완성 (await 필수)
  currentUser = await getUser();
  setupTabs();
  await loadRanking();
})();

// ── 탭 이벤트 ───────────────────────────────────────────────────
function setupTabs() {
  const tabEls = document.querySelectorAll('.rank-tab');
  tabEls.forEach(btn => {
    btn.addEventListener('click', () => {
      tabEls.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      rankPage = 0;
      renderTable();
      updateMyRankBanner();
    });
  });
}

// ── 데이터 로드 ─────────────────────────────────────────────────
async function loadRanking() {
  const container = document.getElementById('rankingContainer');
  container.innerHTML = '<div class="rank-loading"><div class="spinner"></div></div>';

  try {
    const { data, error } = await db.rpc('get_ranking_stats');
    if (error) throw error;
    allStats = data || [];
    renderTable();
    updateMyRankBanner();
  } catch (err) {
    console.error('ranking error:', err);
    container.innerHTML = `<div class="rank-empty">랭킹을 불러오지 못했습니다.<br><small style="color:var(--accent)">${escapeHtml(err?.message || String(err))}</small></div>`;
  }
}

// ── 테이블 렌더 ─────────────────────────────────────────────────
function renderTable() {
  const container = document.getElementById('rankingContainer');
  const tab       = TABS[currentTab];
  const sorted    = [...allStats].sort((a, b) => Number(b[tab.key]) - Number(a[tab.key]));

  if (!sorted.length) {
    container.innerHTML = '<div class="rank-empty">아직 랭킹 데이터가 없습니다.</div>';
    return;
  }

  const isOverall = currentTab === 'overall';
  const pageStart = rankPage * RANK_PAGE_SIZE;
  const pageData  = sorted.slice(pageStart, pageStart + RANK_PAGE_SIZE);

  const rows = pageData.map((u, i) => {
    const rank    = pageStart + i + 1;
    const rankCls = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const score   = Number(u[tab.key]).toLocaleString();
    const isMe    = currentUser && u.user_id === currentUser.id;
    const rowStyle = isMe ? ' style="background:rgba(233,69,96,0.04);"' : '';

    const avatarHtml = u.avatar_url
      ? `<img class="rank-avatar" src="${escapeHtml(u.avatar_url)}" alt="" loading="lazy">`
      : `<div class="rank-avatar-placeholder">${escapeHtml((u.username || '?')[0].toUpperCase())}</div>`;

    const subStats = isOverall
      ? `<div class="rank-sub-stats">
           <span class="rank-sub-stat">${Number(u.credits).toLocaleString()} 크레딧</span>
           <span>·</span>
           <span class="rank-sub-stat">좋아요 ${Number(u.like_count).toLocaleString()}</span>
           <span>·</span>
           <span class="rank-sub-stat">설득 ${Number(u.persuasion_count).toLocaleString()}</span>
           <span>·</span>
           <span class="rank-sub-stat">팔로워 ${Number(u.follower_count).toLocaleString()}</span>
         </div>`
      : '';

    return `
      <tr class="rank-row"${rowStyle}>
        <td class="rank-no ${rankCls}">${rankIcon}</td>
        <td>
          <div class="rank-user">
            ${avatarHtml}
            <div>
              <a class="rank-username" href="profile.html?id=${escapeHtml(u.user_id)}">${escapeHtml(u.username || '알 수 없음')}</a>
              ${subStats}
            </div>
          </div>
        </td>
        <td class="rank-score${rank <= 3 ? ' highlight' : ''}">
          ${score}<span style="font-size:0.75rem;font-weight:400;color:var(--text-muted);margin-left:3px">${tab.unit}</span>
        </td>
      </tr>`;
  }).join('');

  const thLabel = tab.label === '종합' ? '종합 점수' : tab.label;

  container.innerHTML = `
    <table class="rank-table">
      <thead>
        <tr>
          <th style="width:48px">#</th>
          <th>유저</th>
          <th class="num">${escapeHtml(thLabel)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  renderRankPagination(sorted.length);
}

// ── 랭킹 페이지네이션 ────────────────────────────────────────────
function renderRankPagination(totalUsers) {
  const el = document.getElementById('rankPagination');
  if (!el) return;
  const totalPages = Math.min(Math.ceil(totalUsers / RANK_PAGE_SIZE), RANK_MAX_PAGES);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const btns = [];
  for (let i = 0; i < totalPages; i++) {
    btns.push(`<button class="page-btn${i === rankPage ? ' active' : ''}" data-rpage="${i}">${i + 1}</button>`);
  }
  el.innerHTML = `<div class="pagination">${btns.join('')}</div>`;
  el.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rankPage = parseInt(btn.dataset.rpage);
      renderTable();
      updateMyRankBanner();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ── 내 순위 배너 ─────────────────────────────────────────────────
function updateMyRankBanner() {
  const banner = document.getElementById('myRankBanner');
  if (!currentUser || !allStats.length) { banner.style.display = 'none'; return; }

  const tab    = TABS[currentTab];
  const sorted = [...allStats].sort((a, b) => Number(b[tab.key]) - Number(a[tab.key]));
  const idx    = sorted.findIndex(u => u.user_id === currentUser.id);
  if (idx === -1) { banner.style.display = 'none'; return; }

  const rank    = idx + 1;
  const myData  = sorted[idx];
  const score   = Number(myData[tab.key]).toLocaleString();

  const outOfTop = rank > RANK_PAGE_SIZE * RANK_MAX_PAGES;
  document.getElementById('myRankNo').textContent    = `${rank}위`;
  document.getElementById('myRankLabel').textContent = `내 ${tab.label} 순위`;
  document.getElementById('myRankDesc').textContent  = `${score} ${tab.unit} · 전체 ${sorted.length}명 중${outOfTop ? ' (100위권 밖)' : ''}`;
  banner.style.display = 'flex';
}
