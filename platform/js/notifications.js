// notifications.js — 인앱 알림 벨 모듈
// 의존: supabase.js (db), auth.js (escapeHtml, relativeTime)

// 알림 타입별 SVG 아이콘 (이모지 금지)
const NOTIF_ICONS = {
  rebuttal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  vote_ended: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

let _notifUser = null;
let _pollingTimer = null;

// ── 진입점 ────────────────────────────────────────────────────────────
async function initNotifications(user) {
  _notifUser = user;
  _setupEvents();
  const count = await _fetchUnreadCount();
  _renderBell(count);
  _startPolling();
}

// ── 이벤트 설정 ───────────────────────────────────────────────────────
function _setupEvents() {
  const bell     = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');
  const list     = document.getElementById('notifList');
  const markAll  = document.getElementById('notifMarkAll');

  if (!bell || !dropdown) return;

  // 벨 버튼 클릭 → 드롭다운 토글
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display !== 'none';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const items = await _fetchNotifications();
      _renderDropdown(items);
    }
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', () => {
    if (dropdown) dropdown.style.display = 'none';
  });

  // 드롭다운 내부 클릭이 외부 닫기를 막지 않도록 stopPropagation
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  // 알림 아이템 클릭 — 이벤트 위임
  if (list) {
    list.addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-item[data-notif-id]');
      if (!item) return;
      const notifId = item.dataset.notifId;
      const postId  = item.dataset.postId;
      await _markAsRead(notifId);
      item.classList.remove('notif-unread');
      const dot = item.querySelector('.notif-dot');
      if (dot) dot.remove();
      if (postId) location.href = `post.html?id=${postId}`;
    });
  }

  // 모두 읽음 버튼
  if (markAll) {
    markAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await _markAllRead();
      _renderBell(0);
      const items = await _fetchNotifications();
      _renderDropdown(items);
    });
  }
}

// ── Supabase 쿼리 ─────────────────────────────────────────────────────
async function _fetchUnreadCount() {
  if (!_notifUser) return 0;
  try {
    const { count } = await db.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', _notifUser.id)
      .eq('is_read', false);
    return count ?? 0;
  } catch (_) { return 0; }
}

async function _fetchNotifications() {
  if (!_notifUser) return [];
  try {
    const { data } = await db.from('notifications')
      .select('*, posts(title)')
      .eq('user_id', _notifUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return data ?? [];
  } catch (_) { return []; }
}

async function _markAsRead(notifId) {
  if (!_notifUser || !notifId) return;
  try {
    await db.from('notifications')
      .update({ is_read: true })
      .eq('id', notifId)
      .eq('user_id', _notifUser.id);
    // 읽음 후 배지 갱신
    const count = await _fetchUnreadCount();
    _renderBell(count);
  } catch (_) {}
}

async function _markAllRead() {
  if (!_notifUser) return;
  try {
    await db.from('notifications')
      .update({ is_read: true })
      .eq('user_id', _notifUser.id)
      .eq('is_read', false);
  } catch (_) {}
}

// ── 렌더링 ────────────────────────────────────────────────────────────
function _renderBell(unreadCount) {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function _notifText(n) {
  const title = n.posts?.title ? escapeHtml(n.posts.title) : '게시물';
  if (n.type === 'rebuttal')   return `내 댓글에 반박이 달렸습니다 · ${title}`;
  if (n.type === 'vote_ended') return `투표가 종료됐습니다 · ${title}`;
  return '새 알림';
}

function _renderDropdown(items) {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = items.map(n => `
    <div class="notif-item${n.is_read ? '' : ' notif-unread'}"
         data-notif-id="${escapeHtml(n.id)}"
         data-post-id="${escapeHtml(n.post_id ?? '')}">
      <span class="notif-icon">${NOTIF_ICONS[n.type] ?? ''}</span>
      <div class="notif-body">
        <p class="notif-text">${_notifText(n)}</p>
        <span class="notif-time">${relativeTime(n.created_at)}</span>
      </div>
      ${n.is_read ? '' : '<span class="notif-dot"></span>'}
    </div>
  `).join('');
}

// ── 폴링 ──────────────────────────────────────────────────────────────
function _startPolling() {
  if (_pollingTimer) clearInterval(_pollingTimer);
  _pollingTimer = setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    const count = await _fetchUnreadCount();
    _renderBell(count);
  }, 30_000);
}

function _stopPolling() {
  if (_pollingTimer) {
    clearInterval(_pollingTimer);
    _pollingTimer = null;
  }
}

window.addEventListener('beforeunload', _stopPolling);
