# Plan: rebuttal-comment

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | rebuttal-comment (반박 덧글) |
| 시작일 | 2026-03-27 |
| 예상 완료 | 2026-03-28 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| Problem | 상대 진영 댓글에 즉각 반박할 방법이 없어 토론이 단방향으로 흐름 |
| Solution | 상대 진영 댓글 하위에 크레딧 2를 소모하는 덧글(대댓글) 반박 기능 제공 |
| Function UX Effect | 진영 간 실시간 반박 스레드 형성 → 토론 깊이 증가, 설득됨 통계 연동으로 토론 결과 정량화 |
| Core Value | 크레딧 소모로 무분별한 반박 억제 + 덧글 좋아요·설득됨이 랭킹에 반영되어 "설득력 있는 유저" 식별 |

---

## 1. 기능 정의

### 1.1 핵심 기능

- **반박 덧글 작성**: 밸런스게임 post.html에서 상대 진영 댓글 하위에 대댓글 작성
- **크레딧 소모**: 덧글 1개 작성 시 크레딧 2 차감 (`reason: 'rebuttal_comment'`)
- **좋아요**: 덧글에도 `comment_likes` 기반 좋아요 가능
- **설득됨 연동**: 덧글이 설득됨(`persuasion_likes`) 통계에 반영 — 랭킹 `persuasion_count` 포함
- **최종 통계 반영**: `get_ranking_stats()` 함수가 덧글의 좋아요·설득됨도 집계

### 1.2 적용 범위

- 밸런스게임(`category = '밸런스게임'`) 게시물 전용
- 로그인 유저만 반박 덧글 작성 가능 (크레딧 필요)
- 만료된 게시물(`isExpiredPost`)에서는 작성 불가
- 자기 댓글에는 반박 불가 (자기 진영 댓글에도 반박 버튼 미표시)

### 1.3 제외 범위

- 덧글에 다시 대댓글 작성 (2단계 이상 중첩) — 미지원
- 퀴즈·커뮤니티 카테고리 — 미지원
- 비로그인 사용자의 반박 덧글 — 미지원

---

## 2. 데이터 모델

### 2.1 comments 테이블 변경

```sql
-- parent_id 추가: 대댓글 연결
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
```

- `parent_id IS NULL`: 일반 댓글 (루트)
- `parent_id IS NOT NULL`: 반박 덧글

### 2.2 credits 테이블 — 새 reason 값

| reason | 설명 | 금액 |
|--------|------|------|
| `rebuttal_comment` | 반박 덧글 작성 | -2 |

`credits` INSERT는 앱 레벨에서 직접 처리 (`authenticated` 유저 insert 권한 필요 → RLS 정책 추가 필요)

> **주의**: 기존 `credits` 테이블 INSERT는 Edge Function(service_role)만 허용. 반박 덧글은 클라이언트에서 직접 차감하거나, `spend_credits` RPC 함수를 재사용하는 방향 검토 필요.
> → `spend_credits` RPC가 이미 존재한다면 해당 함수로 통일.

### 2.3 get_ranking_stats() 함수 변경

`persuasion_count` 집계 시 parent_id가 있는 덧글(대댓글)도 포함되어야 함.
현재 `persuasion_likes.comment_id → comments.user_id` 조인이 parent_id 여부에 관계없이 작동 → **추가 변경 불필요** (comments.id 기반 조인이므로 자동 포함).

---

## 3. UI/UX 설계

### 3.1 반박 버튼 표시 조건

각 댓글 아이템에 "반박" 버튼 추가:
- 표시: 로그인 상태 + `c.side !== userVote` (상대 진영 댓글) + `!isExpiredPost`
- 미표시: 자기 진영 댓글, 중립 댓글, 비로그인, 만료 게시물

### 3.2 덧글 입력 UI

반박 버튼 클릭 시 해당 댓글 아이템 하단에 인라인 텍스트에어리어 + "작성(크레딧 2)" 버튼 등장:
```
┌─────────────────────────────────────────┐
│ [상대 진영 댓글 내용]                    │
│  👍 3  😢 1   [반박]                     │
│  ┌──────────────────────────────────┐   │
│  │ 반박 내용 입력...                │   │
│  └──────────────────────────────────┘   │
│  [작성 (크레딧 2 소모)]  [취소]          │
└─────────────────────────────────────────┘
```

### 3.3 덧글 렌더링

댓글 아이템 하단에 들여쓰기 형태로 표시:
```
[A진영] 홍길동: "이게 맞음"
  └─ [B진영] 김철수: "틀렸음, 왜냐하면..." 👍 2
```

### 3.4 크레딧 부족 처리

잔액 < 2일 경우 alert("크레딧이 부족합니다. 현재 잔액: N크레딧") 후 중단.

---

## 4. 구현 계획

### 4.1 DB 마이그레이션 (새 파일)

`supabase/migrations/20260328_rebuttal_comment.sql`
- `comments.parent_id` 컬럼 추가
- 인덱스 추가
- `spend_credits` RPC 존재 확인 및 `rebuttal_comment` reason 처리 포함 여부 검토

### 4.2 post.js 변경

- `loadComments()`: `parent_id` 포함 쿼리, 루트댓글에 덧글 그룹핑
- `renderCommentItem()`: 반박 버튼 추가, 덧글 목록 렌더링
- `submitRebuttal(parentCommentId)`: 잔액 확인 → comments INSERT → credits 차감
- 이벤트 위임: `.btn-rebuttal` 클릭 → 인라인 폼 토글

### 4.3 post.html 변경

- 반박 폼 인라인 렌더링은 JS에서 동적 생성 (별도 HTML 불필요)

### 4.4 CSS 변경

`platform/css/style.css`:
- `.comment-replies`: 덧글 컨테이너 들여쓰기
- `.btn-rebuttal`: 반박 버튼 스타일
- `.rebuttal-form`: 인라인 반박 폼

---

## 5. 밸런스 설계

| 항목 | 값 | 근거 |
|------|-----|------|
| 반박 덧글 비용 | 2 크레딧 | 투표 변경(5)보다 저렴, 무분별 남발 억제 |
| 덧글 중첩 깊이 | 1단계만 | UX 복잡도 최소화 |
| 덧글 개수 제한 | 없음 | 크레딧 비용으로 자연 억제 |

---

## 6. 기술 제약 및 주의사항

- **이벤트 위임**: 반박 버튼은 동적 삽입 → inline onclick 금지, `.comment-col-a/.comment-col-b` 컨테이너에 위임
- **XSS**: 덧글 내용 `escapeHtml()` 필수
- **RLS**: `comments` INSERT 정책은 `authenticated` 유저 허용 (기존 정책 재사용)
- **credits INSERT**: `spend_credits` RPC 존재 여부 먼저 확인 → 없으면 `rebuttal_comment` reason을 직접 INSERT하는 별도 RLS 정책 필요
- **1인 1댓글 규칙**: 밸런스게임 루트댓글에만 적용 — 덧글은 복수 작성 가능
- **설득됨(persuasion_likes)**: 덧글도 같은 `comment_likes` 기반이므로 추가 처리 불필요
- **isExpiredPost JS 가드**: `submitRebuttal`에서도 `if (isExpiredPost) return` 추가 필수

---

## 7. 완료 기준

- [ ] 상대 진영 댓글에 반박 덧글 작성 가능
- [ ] 덧글 작성 시 크레딧 2 차감 (잔액 부족 시 차단)
- [ ] 덧글 좋아요 작동
- [ ] 덧글이 `persuasion_likes` → 랭킹 `persuasion_count`에 포함
- [ ] 만료 게시물에서 반박 불가
- [ ] 자기 진영 댓글에 반박 버튼 미표시
- [ ] XSS 방어 (`escapeHtml` 적용)
- [ ] 이벤트 위임 방식 (inline onclick 없음)
