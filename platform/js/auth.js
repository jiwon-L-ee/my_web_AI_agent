// Auth helpers — depends on supabase.js (db)

async function getUser() {
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + '/platform/index.html',
    },
  });
  if (error) alert('로그인 실패: ' + error.message);
}

async function signOut() {
  await db.auth.signOut();
  location.href = 'index.html';
}

// Update navbar based on auth state
async function initAuth() {
  const user = await getUser();
  updateNavbar(user);

  db.auth.onAuthStateChange((_event, session) => {
    updateNavbar(session?.user ?? null);
  });
}

function updateNavbar(user) {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;

  if (user) {
    const avatar = user.user_metadata?.avatar_url;
    navAuth.innerHTML = `
      <a href="create.html" class="btn-create">+ 만들기</a>
      <a href="mypage.html" class="nav-avatar" title="${escapeHtml(user.user_metadata?.name ?? user.email)}">
        ${avatar
          ? `<img src="${escapeHtml(avatar)}" alt="내 프로필">`
          : `<span class="avatar-placeholder">${(user.user_metadata?.name ?? user.email ?? '?')[0].toUpperCase()}</span>`
        }
      </a>
    `;
  } else {
    navAuth.innerHTML = `<a href="login.html" class="btn-login">로그인</a>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
