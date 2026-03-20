# 기술 사양서: 맞불 플랫폼 리디자인

> 슬로건: **"사소한 고집의 끝"**
> 방향: ML 테스트 공유 플랫폼 → **토론·밸런스게임 커뮤니티** (테스트는 서브 기능으로 유지)

---

## 개요

현재 플랫폼은 Teachable Machine 기반 ML 테스트 공유가 메인이나, 리디자인 후에는
**밸런스게임(A vs B 선택 토론)**이 핵심 콘텐츠가 된다.
테스트 카테고리는 커뮤니티 기능으로 유지하되, 노출 우선순위를 낮춘다.

### 변경 범위 요약

| 영역 | 현재 | 변경 후 |
|------|------|---------|
| 사이트 소개 문구 | "ML 테스트를 공유하고 발견하세요" | "사소한 고집의 끝" |
| 카테고리 순서 | 테스트 → 밸런스게임 → OX퀴즈 | **밸런스게임 → OX퀴즈 → 테스트** |
| 기본 카테고리 선택 | 테스트 | **밸런스게임** |
| 게시물 상세 메인 UI | TM 테스트 플레이어 (항상 표시) | **A/B 투표 UI** (카테고리별 조건부) |
| 테스트 플레이어 | 항상 표시 | category='테스트'일 때만 표시 |
| DB posts 테이블 | model_url | + `option_a`, `option_b` 컬럼 추가 |
| DB 신규 테이블 | 없음 | `votes` 테이블 추가 |

---

## 기술 스택

- **Frontend**: 정적 HTML/CSS/JS (변경 없음)
- **Backend**: Supabase (Auth, DB, Storage, RLS)
- **Database**: PostgreSQL (Supabase)

---

## 기능 요구사항

### 1. 브랜딩 변경

**파일**: `platform/index.html`

- 인트로 오버레이 문구: `"ML 테스트를 공유하고 발견하세요"` → `"사소한 고집의 끝"`
- 인트로 서브텍스트(선택): `"당신의 선택이 기준이 됩니다"` 등 슬로건 강화 문구 추가 가능

---

### 2. 카테고리 순서 재정렬

**파일**: `index.html`, `post.html`, `create.html` (nav-cats, catSelectMobile, categorySelect)

변경 전:
```
전체 | 테스트 | 밸런스게임 | OX퀴즈
```

변경 후:
```
전체 | 밸런스게임 | OX퀴즈 | 테스트
```

- `create.html`의 `<select id="categorySelect">` 기본값: `밸런스게임`이 첫 번째 `<option>`

---

### 3. 게시물 작성 폼 (create.html / create.js)

카테고리별로 다른 필드를 조건부 표시한다.

#### 3-1. 밸런스게임 카테고리 선택 시

새로 추가할 필드 (현재 없음):
```
A 선택지 *  (텍스트 input, maxlength=100)  — ex) "치킨"
B 선택지 *  (텍스트 input, maxlength=100)  — ex) "피자"
```

- `model_url` 필드는 숨김 + required 해제
- `option_a`, `option_b` 필드는 표시 + required 설정

#### 3-2. 테스트 카테고리 선택 시 (기존 유지)

- `model_url` 필드 표시 + required
- `option_a`, `option_b` 필드 숨김

#### 3-3. OX퀴즈 카테고리 선택 시

- 밸런스게임과 동일하게 option_a/option_b 필드 사용
- 단, 라벨을 "O 주장" / "X 주장"으로 표시 (JS에서 동적 라벨 변경)

#### create.js 수정 사항

- `toggleModelUrlField()` → `toggleCategoryFields()` 로 확장
- `handleSubmit()`에서 category별로 `option_a`, `option_b` 또는 `model_url` 수집
- DB INSERT: `option_a`, `option_b` 컬럼 포함

---

### 4. 게시물 상세 페이지 (post.html / post.js)

#### 4-1. 밸런스게임 / OX퀴즈: A/B 투표 UI (신규)

현재 `.player-section`은 항상 표시되는데, **category가 '테스트'가 아닐 경우 투표 UI로 대체**한다.

**투표 UI 구조**:
```
┌─────────────────────────────┐
│  [A 선택지]   vs   [B 선택지] │
│  [투표 버튼 A]     [투표 버튼 B] │
│  ████████░░░ 67%  ░░░░░████ 33% │
│  (A: 1,234표)      (B: 601표)   │
└─────────────────────────────┘
```

- 비로그인: 투표 버튼 클릭 시 login.html?next=... 로 리다이렉트
- 로그인 후: 투표 가능 (중복 투표 불가, 재투표로 변경 가능)
- 투표 후: 실시간으로 바 비율 업데이트 (페이지 새로고침 없이)
- 이미 투표한 경우: 본인이 선택한 쪽 버튼에 강조 표시

#### 4-2. 테스트: 기존 TM 플레이어 유지 (조건부)

- `post.js`의 `setupPlayer()` 호출을 `if (post.category === '테스트')` 조건으로 감쌈
- category가 테스트가 아닐 경우 `.player-section` DOM 숨김 또는 제거

#### post.html 구조 변경

현재 `.player-section` 블록을 **두 개의 섹션으로 분리**:
```html
<!-- 밸런스게임/OX퀴즈용 투표 섹션 -->
<div id="voteSection" class="vote-section" style="display:none">...</div>

<!-- 테스트용 플레이어 섹션 (기존 유지) -->
<div id="playerSection" class="player-section" style="display:none">...</div>
```

`post.js`에서 post 로드 후 category에 따라 적절한 섹션만 표시.

---

### 5. 데이터베이스 변경

#### 5-1. posts 테이블 컬럼 추가

```sql
ALTER TABLE posts
  ADD COLUMN option_a TEXT,
  ADD COLUMN option_b TEXT;
```

- `option_a`, `option_b`: 밸런스게임/OX퀴즈 게시물의 A/B 선택지 텍스트
- 테스트 게시물은 NULL

#### 5-2. votes 테이블 신규 생성

```sql
CREATE TABLE votes (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  choice    TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)  -- 유저당 게시물 1표
);
```

**인덱스**:
```sql
CREATE INDEX idx_votes_post_id ON votes(post_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
```

**RLS 정책**:
- SELECT: 전체 공개 (투표 집계 표시용)
- INSERT: 로그인한 본인만 (`auth.uid() = user_id`)
- UPDATE: 본인 투표만 변경 가능 (재투표 = choice 변경)
- DELETE: 본인 투표만 삭제 가능

#### 5-3. 집계 함수 (선택)

투표 집계를 효율적으로 하기 위해 DB 함수 추가 고려:
```sql
-- 또는 posts 쿼리 시 votes 집계를 함께 가져오는 방식
SELECT *,
  (SELECT COUNT(*) FROM votes WHERE post_id = posts.id AND choice = 'A') AS vote_a,
  (SELECT COUNT(*) FROM votes WHERE post_id = posts.id AND choice = 'B') AS vote_b
FROM posts WHERE id = $1;
```

---

### 6. post.js 투표 로직

새로 추가할 함수들:

```
loadVotes(postId)       — A/B 투표 수 조회, 유저 투표 여부 확인
renderVoteUI(post)      — 투표 UI 렌더링 (option_a, option_b 텍스트 + 바 표시)
toggleVote(choice)      — 투표 토글 (INSERT or UPDATE)
updateVoteBar()         — 투표 후 바 비율 업데이트
```

기존 `setupPlayer()` 관련 코드는 `if (post.category === '테스트')` 블록 안으로 이동.

---

## 파일별 수정 체크리스트

| 파일 | 수정 내용 |
|------|-----------|
| `index.html` | 인트로 문구 변경, 카테고리 순서 변경 |
| `post.html` | 카테고리 순서 변경, voteSection/playerSection 분리 |
| `create.html` | 카테고리 순서+기본값 변경, option_a/option_b 필드 추가 |
| `js/create.js` | toggleCategoryFields() 확장, handleSubmit() option_a/b 처리 |
| `js/post.js` | 카테고리 조건부 렌더링, 투표 로직 추가 |
| `css/style.css` | 투표 UI 스타일 추가 (vote-section, vote-btn, vote-bar 등) |
| DB migration | posts 컬럼 추가, votes 테이블 + RLS 생성 |

---

## 보안 요구사항

- 투표 중복 방지: DB UNIQUE(user_id, post_id) 제약 + RLS
- 투표 조작 방지: RLS로 본인 투표만 INSERT/UPDATE/DELETE 가능
- option_a/b 표시: 반드시 `escapeHtml()` 적용 (XSS 방지)

---

## 인수 기준

1. **브랜딩**: 인트로 오버레이에 "사소한 고집의 끝" 슬로건 표시
2. **카테고리**: 홈/상세/작성 페이지 모두 "밸런스게임 → OX퀴즈 → 테스트" 순서
3. **밸런스게임 작성**: option_a, option_b 입력 필드가 표시되고 DB에 저장됨
4. **투표 UI**: 밸런스게임 상세 페이지에서 A/B 버튼과 비율 바가 표시됨
5. **투표 기능**: 로그인 유저가 투표하면 즉시 바 비율이 업데이트됨, 재투표 가능
6. **테스트 격리**: category='테스트'인 게시물에서만 TM 플레이어 표시
7. **보안**: votes 테이블 RLS 정책 적용, option 텍스트 escapeHtml 처리

---

## 마이그레이션 파일

`supabase/migrations/20260320_balance_game.sql` 에 작성 예정:
- `posts` 테이블 `option_a`, `option_b` 컬럼 추가
- `votes` 테이블 생성
- votes RLS 정책 4개 (SELECT/INSERT/UPDATE/DELETE)
- votes 인덱스 2개
