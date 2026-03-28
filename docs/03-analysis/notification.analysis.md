# Gap Analysis: notification

> 분석일: 2026-03-27
> Design 문서: `docs/02-design/features/notification.design.md`

---

## Match Rate: 100%

---

## 1. 항목별 검증 결과

### 1.1 DB 마이그레이션 (`20260329_notifications.sql`)

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| notifications 테이블 (id, user_id, type, post_id, comment_id, actor_id, is_read, created_at) | ✅ | 컬럼 타입/제약 일치 |
| CHECK constraint (type IN ('rebuttal', 'vote_ended')) | ✅ | |
| idx_notifications_user 인덱스 | ✅ | |
| RLS 활성화 | ✅ | |
| notifications_select 정책 | ✅ | user_id = auth.uid() |
| notifications_update 정책 | ✅ | user_id = auth.uid() |
| notify_rebuttal SECURITY DEFINER RPC | ✅ | |
| 자기 자신 알림 금지 로직 | ✅ | auth.uid() 체크 |
| 중복 알림 방지 로직 | ✅ | comment_id 기준 |
| GRANT EXECUTE TO authenticated | ✅ | |

### 1.2 notifications.js

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| initNotifications(user) 진입점 | ✅ | |
| _setupEvents() — 이벤트 위임 패턴 | ✅ | |
| 벨 버튼 클릭 → 드롭다운 토글 | ✅ | |
| 외부 클릭 시 드롭다운 닫기 | ✅ | document click 리스너 |
| 드롭다운 내부 클릭 stopPropagation | ✅ | |
| 알림 아이템 클릭 이벤트 위임 | ✅ | .notif-item[data-notif-id] |
| 클릭 시 읽음 처리 + DOM 업데이트 | ✅ | classList, dot 제거 |
| 클릭 시 post.html 이동 | ✅ | |
| 모두 읽음 버튼 | ✅ | |
| _fetchUnreadCount() | ✅ | count: 'exact', head: true |
| _fetchNotifications() — posts(title) join, limit 20 | ✅ | |
| _markAsRead(notifId) — RLS 보완 .eq('user_id') | ✅ | |
| _markAllRead() | ✅ | |
| _renderBell(count) — 배지 99+ 처리 | ✅ | |
| _notifText(n) — escapeHtml 적용 | ✅ | |
| _renderDropdown(items) — XSS 방지 escapeHtml | ✅ | |
| NOTIF_ICONS SVG (이모지 금지) | ✅ | |
| _startPolling() — 30초, visibilityState 체크 | ✅ | |
| _stopPolling() + beforeunload 정리 | ✅ | |

### 1.3 auth.js updateNavbar()

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| 벨 HTML (notifBellWrap, notifBell, notifBadge) | ✅ | |
| 드롭다운 HTML (notifDropdown, notifList, notifMarkAll) | ✅ | |
| typeof initNotifications === 'function' 체크 후 호출 | ✅ | |
| 벨이 기존 creditHtml과 nav-avatar 사이에 위치 | ✅ | |

### 1.4 post.js submitRebuttal()

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| parentComment.user_id 조회 | ✅ | .select('user_id').eq('id', parentCommentId) |
| notify_rebuttal RPC 호출 | ✅ | p_target_user_id, p_post_id, p_comment_id |
| try/catch 묵음 처리 (반박 제출 차단 안 함) | ✅ | |

### 1.5 settle-balance-games/index.ts

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| allVotes에서 user_id !== null 필터링 | ✅ | |
| Set으로 중복 제거 | ✅ | |
| vote_ended 타입 notifications bulk INSERT | ✅ | |
| try/catch 묵음 처리 (정산 차단 안 함) | ✅ | |

### 1.6 CSS (style.css)

| 설계 항목 | 구현 여부 | 비고 |
|----------|----------|------|
| .notif-bell-wrap | ✅ | |
| .notif-bell + :hover | ✅ | |
| .notif-badge | ✅ | |
| .notif-dropdown | ✅ | z-index: 1000 |
| .notif-dropdown-header | ✅ | |
| .notif-mark-all | ✅ | |
| .notif-list + :empty::after | ✅ | |
| .notif-item + :hover + .notif-unread | ✅ | |
| .notif-icon, .notif-body, .notif-text, .notif-time, .notif-dot | ✅ | |
| 모바일 480px 미디어 쿼리 | ✅ | |

### 1.7 HTML 파일 스크립트 태그

| 파일 | notifications.js 추가 | 로드 순서 |
|------|----------------------|----------|
| index.html | ✅ | auth.js → notifications.js → vote-modal.js ✅ |
| post.html | ✅ | auth.js → notifications.js ✅ |
| mypage.html | ✅ | auth.js → notifications.js → mypage.js ✅ |
| profile.html | ✅ | auth.js → notifications.js → profile.js ✅ |
| ranking.html | ✅ | auth.js → notifications.js → ranking.js ✅ |
| create.html | ✅ | auth.js → notifications.js → create.js ✅ |
| community-create.html | ✅ | auth.js → notifications.js → community-create.js ✅ |
| community-edit.html | ✅ | auth.js → notifications.js → community-edit.js ✅ |
| quiz.html | ✅ | auth.js → notifications.js → quiz.js ✅ |
| test.html | ✅ | auth.js → notifications.js → test.js ✅ |

---

## 2. Gap 목록

없음. 모든 설계 항목이 구현됨.

---

## 3. 결론

- **Match Rate: 100%**
- 누락 항목: 0
- 보안 고려사항: 모두 반영 (XSS escapeHtml, 이벤트 위임, RLS, SECURITY DEFINER)
- 주의사항: Supabase 마이그레이션 적용 필요 (`npx supabase db push` 또는 MCP apply_migration)
