# 투표 플로우 설계서

> 상태: 설계 완료 / 구현 대기
> 작성일: 2026-03-22

---

## 1. 개요

현재 홈/토론 탭에서 투표 모달로 즉시 투표가 가능한 구조를 폐지.
댓글을 읽은 후에만 투표할 수 있도록 플로우를 변경하고,
투표 변경 시에는 설득된 댓글 선택(필수) + 크레딧 소비로 진입 장벽을 둠.

---

## 2. 신규 투표 플로우

### 2-A. 최초 투표 (First Vote)

```
[홈/토론 탭]
  밸런스게임 클릭
      ↓
[현재] 투표 모달 오픈 → A/B 즉시 선택
[변경] post.html?id=XXX 로 이동
      ↓
[post.html]
  댓글(양 진영) 열람
      ↓
  투표 버튼 클릭 (A 또는 B)
      ↓
  투표 완료 → 결과 공개 + 댓글 작성 가능
```

**변경 포인트**
- `vote-modal.js`의 A/B 버튼 클릭 시 → `post.html?id=XXX&from=home` 로 리다이렉트
- 모달 자체는 유지하되 투표 UI 대신 **"댓글 보고 투표하기 →"** 버튼 하나만 표시
- post.html 진입 시 `?from=home` 파라미터가 있으면 뒤로가기 버튼 표시 (이미 구현됨)

**홈 히어로의 투표 %**
- 투표 전/후 관계없이 **현재 % 공개** (블라인드 투표 폐지)
- **예외**: 마감 1시간 전부터는 % 비공개 (Section 7 참조)
- 투표율을 보고 판단하는 것도 전략의 일부 — 단 마지막 1시간은 제외

---

### 2-B. 투표 변경 (Vote Change)

```
[post.html — 이미 투표한 상태]
  "투표 변경" 버튼 클릭
      ↓
  [변경 전 안내 모달]
  "투표를 바꾸려면 상대 진영에서
   당신을 설득한 댓글을 선택해야 합니다.
   또한 5 크레딧이 차감됩니다."
      ↓
  [상대 진영 댓글 목록 표시]
  (현재 내 투표가 A → B진영 댓글 목록 / 반대도 동일)
  ※ 설득됨 포인트 수치는 UI에 표시하지 않음
      ↓
  댓글 하나 선택 (설득됨 대상)
      ↓
  [크레딧 확인]
  잔액 ≥ 5 크레딧?
    ↓ YES                       ↓ NO
  크레딧 -5 차감              "크레딧이 부족합니다"
  투표 변경 완료               변경 불가
  선택된 댓글 작성자에게
  설득됨 포인트 +1 (비공개)
```

**현재 코드와의 차이**
| 항목 | 현재 | 변경 후 |
|------|------|--------|
| 투표 변경 모달 옵션 | "내 생각이 바뀜" / "설득됨" | 상대 진영 댓글 목록에서 **필수 선택** |
| 크레딧 차감 | 없음 | -5 크레딧 |
| 1분 이내 취소 | 없음 | 무료 취소 허용 |
| 선택받은 댓글 작성자 | 없음 | **설득됨 포인트 +1** (비공개) |

---

## 2-C. 설득됨 포인트 (Persuasion Point)

### 개념
- 내 댓글이 누군가의 투표를 바꾸게 만들면 나는 **설득됨 포인트 +1** 획득
- **비공개 지표**: 게시물 페이지, 프로필 어디에도 포인트 숫자가 표시되지 않음
- **용도**: 밸런스게임 만료 시 승리 크레딧 가중치 계산에만 사용

### 비공개 원칙
```
❌ 표시 금지
  - 댓글 옆 "설득됨 3" 숫자
  - 프로필의 "총 설득됨 포인트"
  - 게시물 통계의 설득됨 집계

✅ 허용 (이미 구현됨)
  - 마이페이지 #statPersuasion (본인만, 카운트는 표시)
    → 본인도 자신의 포인트를 직접 확인할 수 없도록 변경 검토
```

### DB 원천
`persuasion_likes` 테이블:
- `comment_id` → 설득됨을 받은 댓글
- 1행 = 설득됨 포인트 1점
- `UNIQUE(user_id, post_id)` → 한 게시물에서 1명은 1개 댓글만 설득됨 가능

---

## 3. UI 상세

### 3-A. 투표 모달 변경 (vote-modal.js / index.html)

**현재 모달 내용**: A버튼 / B버튼 → 즉시 투표
**변경 후 모달 내용**:
```
┌─────────────────────────────────────────┐
│  🔥 [게시물 제목]                        │
│                                          │
│  A 진영                vs  B 진영        │
│  [option_a]               [option_b]     │
│                                          │
│  댓글을 읽고 투표해보세요.               │
│  양쪽의 의견을 들어본 후                 │
│  더 나은 선택을 할 수 있습니다.          │
│                                          │
│  [  댓글 보고 투표하기  →  ]             │
│                                          │
│  (투표 후에는 결과가 공개됩니다)         │
└─────────────────────────────────────────┘
```
- "댓글 보고 투표하기" 버튼 → `location.href = 'post.html?id=XXX&from=home'`
- 기존 투표 완료 상태라면 모달에서 결과만 표시 (A%/B%, 내 선택 표시)

### 3-B. 투표 변경 UI (post.js / post.html)

**"투표 변경" 버튼 클릭 시**:
```
┌─────────────────────────────────────────┐
│  투표를 바꾸시겠어요?                    │
│                                          │
│  상대 진영에서 당신을 설득한 댓글을      │
│  선택해주세요.                           │
│                                          │
│  ── B진영 댓글 ──                        │
│  ○ "[댓글 내용 미리보기]" — 작성자       │
│  ○ "[댓글 내용 미리보기]" — 작성자       │
│  ○ "[댓글 내용 미리보기]" — 작성자       │
│                                          │
│  ⚡ 변경 비용: 5 크레딧 (잔액: 23)      │
│                                          │
│  [  취소  ]    [  변경하기 (-5 크레딧)  ]│
└─────────────────────────────────────────┘
```
- 상대 진영 댓글이 없으면 "아직 상대 진영 댓글이 없습니다 — 변경 불가" 표시
- 크레딧 부족 시 버튼 비활성화 + 안내 문구

---

## 4. 1분 이내 무료 취소 (실수 방지 버퍼)

```js
// post.js 투표 완료 후
const voteTimestamp = Date.now(); // 투표 시각 기록 (메모리)

// "투표 변경" 버튼 클릭 시
const elapsed = Date.now() - voteTimestamp;
if (elapsed < 60_000) {
  // 1분 이내: 크레딧 차감 없이 즉시 취소/재선택 가능
  showFreeChangeModal();
} else {
  // 1분 이후: 설득됨 선택 + 크레딧 차감
  showPersuasionChangeModal();
}
```

---

## 5. DB 변경 사항

### 5-A. `persuasion_likes` 테이블 — 역할 확장
기존: 설득됨 좋아요 (선택적)
변경: 투표 변경의 **필수 기록** — 어떤 댓글에 설득됐는지 추적

```sql
-- 기존 컬럼 유지, 의미만 변경
-- UNIQUE(user_id, post_id) → 게시물당 1개 (이미 존재)
```

### 5-B. 투표 변경 이력 (선택 — 향후 분석용)
```sql
CREATE TABLE vote_changes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_choice  TEXT NOT NULL,   -- 'A' | 'B'
  to_choice    TEXT NOT NULL,   -- 'A' | 'B'
  comment_id   UUID REFERENCES comments(id) ON DELETE SET NULL, -- 설득된 댓글
  credits_spent INT DEFAULT 5,
  changed_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. 구현 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `platform/js/vote-modal.js` | A/B 버튼 → "댓글 보고 투표하기" 버튼으로 교체 |
| `platform/js/post.js` | 투표 변경 모달: "내 생각 바뀜" 옵션 삭제, 상대 댓글 선택 UI, 크레딧 차감 로직 |
| `platform/post.html` | 투표 변경 모달 HTML 구조 업데이트 |
| `platform/css/style.css` | 변경 모달 댓글 선택 라디오 UI 스타일 |
| `supabase/migrations/` | `vote_changes` 테이블 생성 |

---

## 7. 마감 1시간 전 블라인드 모드

### 7-A. 개요

밸런스게임 마감(`expires_at`) 1시간 전부터 투표율을 숨기고 A/B 순서를 랜덤으로 뒤바꿔
마지막 참가자가 승부 결과를 알고 전략적으로 투표하는 것을 방지한다.

```
expires_at - now() < 1시간
  → 블라인드 모드 ON
      ├─ 투표율(%, 바 그래프) 비공개
      ├─ A/B 표시 순서 랜덤 교체 (ab_flipped 기반)
      └─ 댓글 진영 레이블 교체
```

### 7-B. ab_flipped 필드

| 항목 | 내용 |
|------|------|
| 컬럼 | `posts.ab_flipped BOOLEAN DEFAULT false` |
| 설정 시점 | 게시물 생성 시 DB 기본값 `random() > 0.5` (랜덤) |
| 적용 시점 | `expires_at - now() < 1h` 조건일 때만 클라이언트가 참조 |
| 목적 | 모든 사용자에게 일관된 순서 보장 (새로고침해도 동일) + 게시물 제목만으론 순서 예측 불가 |

### 7-C. 클라이언트 로직

```js
// post.js — 블라인드 모드 판단
function isBlindMode(post) {
  if (!post.expires_at) return false;
  const msLeft = new Date(post.expires_at) - Date.now();
  return msLeft > 0 && msLeft < 60 * 60 * 1000; // 0 < 남은시간 < 1시간
}

// 표시용 A/B 매핑 (DB 원본은 그대로 유지)
function getDisplayMapping(post) {
  const blind = isBlindMode(post);
  if (blind && post.ab_flipped) {
    // 표시 A → DB B, 표시 B → DB A
    return { displayA: post.option_b, displayB: post.option_a, flipped: true };
  }
  return { displayA: post.option_a, displayB: post.option_b, flipped: false };
}

// 투표 기록 시: 화면 A 클릭 → flipped이면 DB에 'B' 저장
function resolveDbChoice(displayChoice, flipped) {
  if (!flipped) return displayChoice;
  return displayChoice === 'A' ? 'B' : 'A';
}
```

### 7-D. 블라인드 모드 UI

**post.html — 투표 섹션 (블라인드 모드 시)**:
```
┌─────────────────────────────────────────┐
│  🔥 [게시물 제목]                        │
│                                          │
│  A 진영              vs  B 진영          │
│  [option_?]              [option_?]      │
│                                          │
│  ⏳ 마감 1시간 전 — 투표율 비공개        │
│     댓글만 보고 판단해보세요!            │
│                                          │
│  [  A 선택  ]          [  B 선택  ]      │
└─────────────────────────────────────────┘
```
- 투표율 바 그래프 / % 수치 전부 숨김 (`display: none`)
- 투표 완료 후에도 % 비공개 (만료 후 공개)

**홈/토론 목록 (블라인드 모드 시)**:
- debate-bar의 A%/B% 텍스트 → `??% / ??%` 또는 바 전체 흐림 처리
- "마감 임박 🔥" 뱃지 표시

### 7-E. 댓글 진영 레이블 교체

블라인드 모드 + ab_flipped = true 일 때:
- DB `side = 'A'` 댓글 → 화면에 **B진영** 으로 표시
- DB `side = 'B'` 댓글 → 화면에 **A진영** 으로 표시
- 댓글 작성 시: 투표한 DB 원본 side 기준으로 저장 (표시만 반전)

### 7-F. DB 변경

```sql
-- posts 테이블에 ab_flipped 컬럼 추가
ALTER TABLE posts
  ADD COLUMN ab_flipped BOOLEAN NOT NULL DEFAULT false;

-- 게시물 생성 시 랜덤 설정 (create.js에서 삽입 시 처리)
-- INSERT INTO posts (..., ab_flipped) VALUES (..., random() > 0.5)
```

---

## 8. 구현 우선순위

1. `vote-modal.js` — A/B 버튼을 post.html 이동 버튼으로 교체 (간단)
2. `post.js` — 투표 변경 모달에서 "내 생각 바뀜" 제거, 상대 댓글 목록 표시
3. 크레딧 차감 연동 (credits 테이블 구현 후)
4. 마감 1시간 전 블라인드 모드 (post.js + home.js + create.js)
5. `vote_changes` 이력 테이블 (optional)
