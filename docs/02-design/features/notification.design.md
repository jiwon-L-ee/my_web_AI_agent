# Design: notification

> Plan 참조: `docs/01-plan/features/notification.plan.md`

---

## 1. DB 설계

### 1.1 notifications 테이블

```sql
-- 마이그레이션: supabase/migrations/20260329_notifications.sql

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('rebuttal', 'vote_ended')),
  post_id    UUID        REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID        REFERENCES comments(id) ON DELETE SET NULL,
  actor_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);
```

### 1.2 RLS 정책

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 알림만
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- UPDATE: 읽음 처리 (is_read 컬럼)
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- INSERT: 클라이언트 직접 INSERT 차단 → SECURITY DEFINER 함수만 허용
-- (INSERT 정책 없음, 함수에서 SECURITY DEFINER로 우회)
```

### 1.3 notify_rebuttal RPC

```sql
CREATE OR REPLACE FUNCTION notify_rebuttal(
  p_target_user_id UUID,
  p_post_id        UUID,
  p_comment_id     UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 자기 자신에게 알림 발송 금지
  IF p_target_user_id = auth.uid() THEN RETURN; END IF;
  -- 중복 방지: 같은 comment_id 반박 알림 이미 있으면 스킵
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = p_target_user_id
      AND type = 'rebuttal'
      AND comment_id = p_comment_id
  ) THEN RETURN; END IF;

  INSERT INTO notifications(user_id, type, post_id, comment_id, actor_id)
  VALUES (p_target_user_id, 'rebuttal', p_post_id, p_comment_id, auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION notify_rebuttal TO authenticated;
```

---

## 2. 파일 구조

```
platform/
├── js/
│   ├── auth.js              — updateNavbar() 에 벨 HTML 삽입 + initNotifications() 호출
│   └── notifications.js     — 알림 벨 전담 모듈 (신규)
├── css/style.css            — 벨·배지·드롭다운 스타일 추가
└── js/post.js               — submitRebuttal() 완료 후 notify_rebuttal RPC 추가

supabase/
├── migrations/20260329_notifications.sql
└── functions/settle-balance-games/index.ts  — 투표 종료 알림 삽입 추가
```

---

## 3. notifications.js 상세 설계

### 3.1 공개 인터페이스

```js
// 진입점 — auth.js updateNavbar(user) 내에서 호출
async function initNotifications(user)

// 내부 함수 (외부 노출 불필요)
async function _fetchUnreadCount()           // → number
async function _fetchNotifications()         // → notification[]
function _renderBell(unreadCount)            // DOM 업데이트
function _renderDropdown(items)              // 드롭다운 목록
async function _markAsRead(notifId)          // 단건 읽음
async function _markAllRead()               // 전체 읽음
function _startPolling()                     // 30초 폴링 시작
function _stopPolling()                      // 폴링 정지 (페이지 언로드)
```

### 3.2 DOM 구조 (auth.js updateNavbar 내 삽입)

```html
<!-- 기존 navAuth innerHTML에 추가 (로그인 사용자만) -->
<div class="notif-bell-wrap" id="notifBellWrap">
  <button class="notif-bell" id="notifBell" aria-label="알림">
    <!-- 종 모양 SVG -->
    <svg class="notif-bell-icon" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <!-- 읽지 않은 알림 수 배지 (없으면 숨김) -->
    <span class="notif-badge" id="notifBadge" style="display:none">0</span>
  </button>
  <!-- 드롭다운 패널 (기본 숨김) -->
  <div class="notif-dropdown" id="notifDropdown" style="display:none">
    <div class="notif-dropdown-header">
      <span>알림</span>
      <button class="notif-mark-all" id="notifMarkAll">모두 읽음</button>
    </div>
    <div class="notif-list" id="notifList">
      <!-- renderDropdown이 채움 -->
    </div>
  </div>
</div>
```

### 3.3 알림 아이템 HTML (renderDropdown)

```js
// type별 SVG 아이콘 (이모지 금지)
const NOTIF_ICONS = {
  rebuttal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>`,
  vote_ended: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>`,
};

// 알림 텍스트
function _notifText(n) {
  const title = escapeHtml(n.posts?.title ?? '게시물');
  if (n.type === 'rebuttal')   return `내 댓글에 반박이 달렸습니다 · ${title}`;
  if (n.type === 'vote_ended') return `투표가 종료됐습니다 · ${title}`;
  return '새 알림';
}

// 아이템 HTML
// data-notif-id, data-post-id 속성으로 이벤트 위임
`<div class="notif-item ${n.is_read ? '' : 'notif-unread'}"
      data-notif-id="${escapeHtml(n.id)}"
      data-post-id="${escapeHtml(n.post_id ?? '')}">
  <span class="notif-icon">${NOTIF_ICONS[n.type] ?? ''}</span>
  <div class="notif-body">
    <p class="notif-text">${_notifText(n)}</p>
    <span class="notif-time">${relativeTime(n.created_at)}</span>
  </div>
  ${n.is_read ? '' : '<span class="notif-dot"></span>'}
</div>`
```

### 3.4 이벤트 처리 (이벤트 위임, inline onclick 금지)

```js
// 벨 버튼 클릭 → 드롭다운 토글 + 목록 로드
notifBell.addEventListener('click', async (e) => {
  e.stopPropagation();
  const isOpen = notifDropdown.style.display !== 'none';
  notifDropdown.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const items = await _fetchNotifications();
    _renderDropdown(items);
  }
});

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', () => {
  if (notifDropdown) notifDropdown.style.display = 'none';
});

// 드롭다운 내부 클릭 이벤트 위임
notifList.addEventListener('click', async (e) => {
  const item = e.target.closest('.notif-item[data-notif-id]');
  if (!item) return;
  const notifId = item.dataset.notifId;
  const postId  = item.dataset.postId;
  await _markAsRead(notifId);
  if (postId) location.href = `post.html?id=${postId}`;
});

// 모두 읽음 버튼
notifMarkAll.addEventListener('click', async (e) => {
  e.stopPropagation();
  await _markAllRead();
  _renderBell(0);
  const items = await _fetchNotifications();
  _renderDropdown(items);
});
```

### 3.5 폴링 로직

```js
let _pollingTimer = null;

function _startPolling() {
  _pollingTimer = setInterval(async () => {
    // 페이지 숨김 상태면 건너뜀
    if (document.visibilityState === 'hidden') return;
    const count = await _fetchUnreadCount();
    _renderBell(count);
  }, 30_000); // 30초
}

function _stopPolling() {
  if (_pollingTimer) clearInterval(_pollingTimer);
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', _stopPolling);
```

### 3.6 Supabase 쿼리

```js
// 읽지 않은 수
const { count } = await db.from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('is_read', false);

// 최근 20개 (게시물 제목 join)
const { data } = await db.from('notifications')
  .select('*, posts(title)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(20);

// 단건 읽음
await db.from('notifications')
  .update({ is_read: true })
  .eq('id', notifId)
  .eq('user_id', user.id); // RLS 보완

// 전체 읽음
await db.from('notifications')
  .update({ is_read: true })
  .eq('user_id', user.id)
  .eq('is_read', false);
```

---

## 4. auth.js 수정 상세

### 4.1 updateNavbar() 변경 (로그인 분기)

```js
// 기존
navAuth.innerHTML = `
  ${creditHtml}
  <a href="mypage.html" class="nav-avatar" ...>...</a>
`;

// 변경 후 — 벨 HTML 추가, initNotifications 호출
navAuth.innerHTML = `
  ${creditHtml}
  <div class="notif-bell-wrap" id="notifBellWrap">
    <button class="notif-bell" id="notifBell" aria-label="알림">
      <svg ...>...</svg>
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
  <a href="mypage.html" class="nav-avatar" ...>...</a>
`;

// notifications.js가 이미 로드됐을 경우에만 호출 (함수 존재 확인)
if (typeof initNotifications === 'function') {
  initNotifications(user);
}
```

### 4.2 스크립트 로드 순서 (모든 HTML 파일)

```html
<script src="js/supabase.js"></script>
<script src="js/auth.js"></script>
<script src="js/notifications.js"></script>  <!-- auth.js 뒤, 페이지 JS 앞 -->
<script src="js/[page].js"></script>
```

> notifications.js를 각 HTML 파일에 추가해야 함
> 대상: index.html, post.html, mypage.html, profile.html, ranking.html,
>        create.html, community-create.html, community-edit.html, quiz.html, test.html

---

## 5. post.js 수정 상세 (submitRebuttal)

```js
async function submitRebuttal(formWrap) {
  // ... 기존 로직 ...

  const { data: insertedReply, error: replyErr } = await db.from('comments').insert({
    post_id:   postId,
    user_id:   currentUser.id,
    content:   content.trim(),
    side:      userVote,
    parent_id: parentCommentId,
  }).select('id').single();

  if (replyErr) { /* 기존 오류 처리 */ return; }

  // ── 반박 알림 발송 (추가) ──────────────────────────────────────
  // parentComment의 user_id 조회 (이미 DOM에 data-comment-id로 있거나 별도 쿼리)
  try {
    const { data: parentComment } = await db.from('comments')
      .select('user_id')
      .eq('id', parentCommentId)
      .single();
    if (parentComment?.user_id) {
      await db.rpc('notify_rebuttal', {
        p_target_user_id: parentComment.user_id,
        p_post_id:        postId,
        p_comment_id:     parentCommentId,
      });
    }
  } catch (_) { /* 알림 실패가 반박 제출을 막지 않음 */ }

  // ... 기존 UI 갱신 로직 ...
}
```

---

## 6. settle-balance-games/index.ts 수정 상세

### 6.1 settlePost 함수 끝에 알림 삽입

```typescript
// ── 9. 투표 종료 알림 삽입 ──────────────────────────────────────
// 로그인 투표자(user_id NOT NULL)에게만 발송
const voterIds = [...new Set(
  allVotes
    .filter((v: { user_id: string | null }) => v.user_id)
    .map((v: { user_id: string }) => v.user_id)
)];

if (voterIds.length > 0) {
  const notifRows = voterIds.map((uid: string) => ({
    user_id:  uid,
    type:     'vote_ended' as const,
    post_id:  post.id,
    is_read:  false,
  }));
  // 오류가 정산을 막지 않도록 try/catch
  try {
    await supabase.from('notifications').insert(notifRows);
  } catch (_) { /* silent */ }
}
```

> Edge Function은 service_role key로 실행되므로 RLS INSERT 정책 없이도 삽입 가능.

---

## 7. CSS 추가 (style.css)

```css
/* ── 알림 벨 ──────────────────────────────────────────── */
.notif-bell-wrap {
  position: relative;
}
.notif-bell {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: color 0.15s, background 0.15s;
  position: relative;
}
.notif-bell:hover { color: var(--text); background: var(--surface2); }

.notif-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 알림 드롭다운 ──────────────────────────────────────── */
.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  z-index: 1000;
  overflow: hidden;
}
.notif-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.9rem;
}
.notif-mark-all {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--accent);
  padding: 0;
}
.notif-mark-all:hover { opacity: 0.75; }

.notif-list {
  max-height: 360px;
  overflow-y: auto;
}
.notif-list:empty::after {
  content: "새 알림이 없습니다";
  display: block;
  text-align: center;
  padding: 24px 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
  position: relative;
}
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: var(--surface2); }
.notif-unread { background: rgba(233,69,96,0.06); }

.notif-icon {
  flex-shrink: 0;
  color: var(--accent);
  margin-top: 2px;
}
.notif-body { flex: 1; min-width: 0; }
.notif-text {
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--text);
  margin: 0 0 2px;
  word-break: keep-all;
}
.notif-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}
.notif-dot {
  width: 7px;
  height: 7px;
  background: var(--accent);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

/* 모바일 (480px 이하): 드롭다운 전체 너비 */
@media (max-width: 480px) {
  .notif-dropdown {
    width: calc(100vw - 32px);
    right: -8px;
  }
}
```

---

## 8. 구현 순서

1. `supabase/migrations/20260329_notifications.sql` 작성 → Supabase 적용
2. `platform/js/notifications.js` 신규 작성
3. `platform/css/style.css` 벨/드롭다운 스타일 추가
4. `platform/js/auth.js` `updateNavbar()` 수정
5. 각 HTML 파일에 `<script src="js/notifications.js">` 추가 (auth.js 뒤)
6. `platform/js/post.js` `submitRebuttal()` 에 `notify_rebuttal` RPC 호출 추가
7. `supabase/functions/settle-balance-games/index.ts` 투표 종료 알림 삽입 추가

---

## 9. 예외/엣지 케이스

| 케이스 | 처리 방법 |
|--------|----------|
| 알림 생성 실패 | try/catch로 묵음 처리 — 주 기능(반박 제출, 정산) 차단 안 함 |
| 자기 자신 반박 | `notify_rebuttal` RPC 내에서 `auth.uid() = p_target_user_id` 체크 |
| 중복 알림 | `notify_rebuttal` RPC에서 같은 comment_id 이미 있으면 INSERT 스킵 |
| 비로그인 투표자 | `user_id IS NULL` 행 제외 (vote_ended 알림 대상에서 제외) |
| notifications.js 미로드 | `typeof initNotifications === 'function'` 체크 후 호출 |
