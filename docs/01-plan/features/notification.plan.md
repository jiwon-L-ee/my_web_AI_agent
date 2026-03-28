# Plan: notification

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | notification |
| 작성일 | 2026-03-27 |
| 예상 범위 | DB 1테이블 + 마이그레이션 + auth.js 네브바 + notifications.js + post.js/settle-balance-games |

### Value Delivered (4-perspective)

| 관점 | 내용 |
|------|------|
| Problem | 반박 댓글이 달리거나 투표가 마감돼도 사용자가 알 방법이 없어 재방문 유인이 약함 |
| Solution | 네브바 알림 벨 + Supabase notifications 테이블 + 실시간 폴링 |
| Function UX Effect | 로그인 사용자가 알림 벨을 클릭하면 읽지 않은 알림 목록(반박/투표종료)을 드롭다운으로 확인, 해당 게시물로 이동 |
| Core Value | 커뮤니티 재방문율 향상, 토론 참여 지속성 강화 |

---

## 1. 기능 요구사항

### 1.1 알림 발생 이벤트

| ID | 이벤트 | 트리거 위치 | 수신자 |
|----|--------|------------|--------|
| N-01 | 반박 댓글 달림 | `post.js` `submitRebuttal()` 성공 후 | 반박 당한 댓글 작성자 |
| N-02 | 투표 종료 | `supabase/functions/settle-balance-games` Edge Function | 해당 게시물에 투표한 유저 |

### 1.2 알림 표시 (인앱 벨)

- 네브바 우측 `#navAuth` 영역에 벨 아이콘 + 읽지 않은 알림 수 배지 표시
- 로그인 사용자에게만 표시 (비로그인 시 숨김)
- 클릭 시 드롭다운: 최근 20개 알림 목록 (아이콘 + 설명 + 시간)
- 드롭다운 항목 클릭 → `post.html?id={post_id}` 이동 + 해당 알림 읽음 처리
- "모두 읽음" 버튼 → 전체 읽음 처리
- 배지는 30초마다 폴링으로 갱신 (Supabase Realtime 불필요)

---

## 2. DB 설계

### 2.1 notifications 테이블

```sql
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('rebuttal', 'vote_ended')),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON notifications(user_id, is_read, created_at DESC);
```

### 2.2 RLS 정책

| 정책 | 조건 |
|------|------|
| SELECT | `user_id = auth.uid()` |
| INSERT | SECURITY DEFINER 함수 경유 (Edge Function / RPC) |
| UPDATE | `user_id = auth.uid()` (읽음 처리) |
| DELETE | 없음 (보존) |

### 2.3 INSERT용 RPC

```sql
-- 반박 알림 삽입 (post.js 클라이언트에서 직접 호출)
CREATE OR REPLACE FUNCTION notify_rebuttal(
  p_target_user_id UUID,
  p_post_id UUID,
  p_comment_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 자기 자신 반박 제외
  IF p_target_user_id = auth.uid() THEN RETURN; END IF;
  INSERT INTO notifications(user_id, type, post_id, comment_id, actor_id)
  VALUES (p_target_user_id, 'rebuttal', p_post_id, p_comment_id, auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION notify_rebuttal TO authenticated;
```

---

## 3. 파일별 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `supabase/migrations/20260329_notifications.sql` | notifications 테이블 + RLS + `notify_rebuttal` RPC |
| `platform/js/auth.js` | `updateNavbar()` 에 벨 HTML 삽입 + `initNotifications()` 호출 |
| `platform/js/notifications.js` | 알림 벨 로직 전담 모듈 (신규) |
| `platform/js/post.js` | `submitRebuttal()` 성공 후 `notify_rebuttal` RPC 호출 |
| `supabase/functions/settle-balance-games/index.ts` | 투표 종료 시 voters 조회 → notifications bulk INSERT |
| `platform/css/style.css` | 벨 아이콘·배지·드롭다운 스타일 |

---

## 4. notifications.js 구조

```
notifications.js
├── initNotifications(user)   — 호출 진입점 (auth.js updateNavbar에서 호출)
├── fetchUnreadCount()        — SELECT count(*) WHERE is_read=false
├── fetchNotifications()      — SELECT 최근 20개
├── renderBell(count)         — 벨 HTML 업데이트 (배지 숫자)
├── renderDropdown(items)     — 드롭다운 목록 렌더링
├── markAsRead(id)            — 단건 UPDATE is_read=true
├── markAllRead()             — UPDATE WHERE user_id = me AND is_read=false
└── startPolling(user)        — setInterval 30s → fetchUnreadCount → renderBell
```

---

## 5. 알림 타입별 표시 텍스트

| type | 아이콘 | 텍스트 |
|------|--------|--------|
| `rebuttal` | 💬 SVG | "내 댓글에 반박이 달렸습니다 · [게시물 제목]" |
| `vote_ended` | ⚡ SVG | "투표가 종료됐습니다 · [게시물 제목]" |

> 아이콘은 인라인 SVG 사용 (이모지 금지 — CLAUDE.md 절대 규칙)

---

## 6. 투표 종료 알림 (settle-balance-games)

현재 Edge Function은 만료된 밸런스게임을 정산하고 크레딧을 지급함.
투표 종료 알림 삽입 로직을 추가:

1. 만료 게시물 ID 목록 확보 (기존 로직)
2. `votes` 테이블에서 해당 게시물에 투표한 `user_id` (nullable, 로그인 사용자만) 조회
3. 중복 제거 후 `notifications` bulk INSERT (`type='vote_ended'`)
4. Service Role Key로 INSERT → RLS 우회 (Edge Function은 이미 service role 사용)

---

## 7. 구현 순서

1. DB 마이그레이션 적용 (`20260329_notifications.sql`)
2. `notifications.js` 작성
3. `auth.js` `updateNavbar()` 수정 → 벨 HTML + `initNotifications` 연결
4. `style.css` 벨 스타일 추가
5. `post.js` `submitRebuttal()` 에 `notify_rebuttal` RPC 호출 추가
6. `settle-balance-games/index.ts` 투표 종료 알림 삽입 추가
7. 각 HTML 파일 — `notifications.js` `<script>` 태그 추가 불필요 (auth.js가 동적 로드)

---

## 8. 비기능 요구사항

- 알림 생성 실패가 주 기능(반박 제출, 투표 정산)을 막지 않아야 함 → try/catch로 감쌈
- 폴링 주기: 30초 (페이지 포커스 시에만 동작 — `document.visibilityState`)
- 알림 보존: 30일 (Edge Function 또는 DB 정책으로 자동 삭제 — 향후 구현)
- 비로그인 사용자: 벨 미표시
