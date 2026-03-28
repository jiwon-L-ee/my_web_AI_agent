// Auth helpers — depends on supabase.js (db)

async function getUser() {
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + '/platform/signup-profile.html',
    },
  });
  if (error) alert('로그인 실패: ' + error.message);
}

async function signUpWithEmail(email, password) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: location.origin + '/platform/signup-profile.html',
    },
  });
  if (error) throw error;
  // Supabase returns user with empty identities for already-registered emails
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('already registered');
  }
  return data;
}

async function signInWithEmail(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function resetPasswordForEmail(email) {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/platform/reset-password.html',
  });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function signOut() {
  await db.auth.signOut();
  location.href = 'index.html';
}

// Update navbar based on auth state
async function initAuth() {
  const user = await getUser();
  await updateNavbar(user);

  db.auth.onAuthStateChange(async (_event, session) => {
    await updateNavbar(session?.user ?? null);
  });
}

async function updateNavbar(user) {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;

  if (user) {
    // profiles + credit_balances 병렬 조회
    let username = null;
    let avatarUrl = null;
    let balance = null;
    try {
      const [profileRes, creditRes] = await Promise.all([
        db.from('profiles').select('username, avatar_url').eq('id', user.id).single(),
        db.from('credit_balances').select('balance').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) {
        username = profileRes.data.username;
        avatarUrl = profileRes.data.avatar_url;
      }
      if (creditRes.data) {
        balance = creditRes.data.balance;
      }
    } catch (_) {}

    const displayName = username || user.email || '?';
    const creditHtml = balance !== null
      ? `<span class="nav-credit" title="크레딧 잔액">${Math.floor(balance)}C</span>`
      : '';
    navAuth.innerHTML = `
      ${creditHtml}
      <div class="notif-bell-wrap" id="notifBellWrap">
        <button class="notif-bell" id="notifBell" aria-label="알림">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif-badge" id="notifBadge" style="display:none">0</span>
        </button>
        <div class="notif-dropdown" id="notifDropdown" style="display:none">
          <div class="notif-dropdown-header">
            <span>알림</span>
            <button class="notif-mark-all" id="notifMarkAll">모두 읽음</button>
          </div>
          <div class="notif-list" id="notifList"></div>
        </div>
      </div>
      <a href="mypage.html" class="nav-avatar" title="${escapeHtml(displayName)}">
        ${avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="내 프로필">`
          : `<span class="avatar-placeholder">${displayName[0].toUpperCase()}</span>`
        }
      </a>
    `;
    if (typeof initNotifications === 'function') {
      initNotifications(user);
    }
  } else {
    navAuth.innerHTML = `<a href="login.html" class="btn-login">로그인</a>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// Redirect to login if not authenticated
async function requireAuth() {
  const user = await getUser();
  if (!user) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return null;
  }
  return user;
}

// Validate that a redirect URL is same-origin (오픈 리다이렉트 방지)
function safeRedirectUrl(url, fallback = 'index.html') {
  if (!url) return fallback;
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

// 비로그인 투표용 게스트 ID (localStorage에 UUID 영속 저장)
function getGuestId() {
  let gid = localStorage.getItem('matbul_gid');
  if (!gid) {
    gid = crypto.randomUUID();
    localStorage.setItem('matbul_gid', gid);
  }
  return gid;
}

// ── 사이드 드로어 ──────────────────────────────────────────────
function initDrawer() {
  const hamburgerBtn   = document.getElementById('hamburgerBtn');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const navDrawer      = document.getElementById('navDrawer');
  const navOverlay     = document.getElementById('navOverlay');
  if (!hamburgerBtn || !navDrawer) return;

  function openDrawer() {
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    hamburgerBtn.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    navDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    hamburgerBtn.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn?.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // 스와이프 제스처
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (touchStartX < 30 && dx > 60) openDrawer();
    if (navDrawer.classList.contains('open') && dx < -60) closeDrawer();
  }, { passive: true });

  // 드로어 내 테마 토글
  const drawerThemeBtn = document.getElementById('drawerThemeBtn');
  drawerThemeBtn?.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('matbul-theme', isLight ? 'light' : 'dark');
    updateDrawerThemeLabel();
  });

  setDrawerActiveByUrl();
  updateDrawerThemeLabel();
}

function setDrawerActiveByUrl() {
  const path = location.pathname;
  const cat  = new URLSearchParams(location.search).get('cat');
  document.querySelectorAll('.nav-drawer-link').forEach(a => a.classList.remove('active'));
  if (path.includes('ranking.html')) {
    document.querySelector('.nav-drawer-link[data-page="ranking"]')?.classList.add('active');
  } else if (!path.includes('.html') || path.includes('index.html')) {
    const activeCat = cat || '밸런스게임';
    document.querySelector(`.nav-drawer-link[data-cat="${activeCat}"]`)?.classList.add('active');
  }
}

function updateDrawerThemeLabel() {
  const label = document.querySelector('.drawer-theme-label');
  if (!label) return;
  const isLight = document.body.classList.contains('light-mode');
  label.textContent = isLight ? '다크 모드' : '라이트 모드';
}

// Format date to relative time
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

// DOM 로드 후 드로어 초기화
document.addEventListener('DOMContentLoaded', initDrawer);
