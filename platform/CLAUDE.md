# platform/ CLAUDE.md

**맞불** — 밸런스게임·토론·퀴즈 커뮤니티. 슬로건: "사소한 고집의 끝".
정적 HTML/CSS/JS + Supabase(Auth · DB · Storage).

### 네비게이션 카테고리 (전 페이지 동일)
`홈(밸런스게임) / 토론 / 퀴즈 / 커뮤니티 / 정보`

### 게시물 카테고리 (DB 저장값)
`밸런스게임 / 퀴즈 / 테스트 / 커뮤니티 / 정보`

> `OX퀴즈`는 `퀴즈` 카테고리 + `quiz_type='ox'`로 대체됨 (2026-03-22 마이그레이션 완료)

**카테고리 추가 시 체크리스트** (누락 시 작성 자체 불가):
- `create.html` `#categorySelect` — `<option value="새카테고리">새카테고리</option>` 추가
- `create.js` `titles` 객체 — 새 카테고리 키 추가
- `home.js` `PREVIEW_ICONS` — SVG 아이콘 추가 (이모지 금지)

### 퀴즈 유형 (`posts.quiz_type`)
| 값 | 설명 | 플레이어 동작 |
|---|---|---|
| `ox` | O/X 퀴즈 | O/X 버튼 선택 → 정오답 |
| `multiple` | 객관식 4지선다 | A~D 버튼 → 정오답 강조 |
| `short` | 단답형 | 텍스트 입력 → 복수 정답 비교 (대소문자 무시) |
| `subjective` | 주관식 | 자유 작성 → 제출 후 모범답안 공개 |

### 카테고리 → 탭 매핑
| 탭 | DB 카테고리 | 표시 방식 |
|----|------------|---------|
| 홈 | 밸런스게임 | 히어로 + 바형 리스트(5) + 퀴즈·커뮤니티 프리뷰 |
| 토론 | 밸런스게임 | 바형 리스트 전체 (인기순/최신순 정렬) |
| 퀴즈 | 퀴즈 + 테스트 | 카드 그리드 |
| 커뮤니티 | 커뮤니티 | 카드 그리드 |
| 정보 | 정보 | 카드 그리드 |

> 세부 내용은 `docs/` 참조:
> - [`docs/db.md`](docs/db.md) — DB 스키마, 마이그레이션, 쿼리 패턴
> - [`docs/patterns.md`](docs/patterns.md) — 보안 규칙, 이벤트 처리, 인증 패턴
> - [`docs/ui.md`](docs/ui.md) — 히어로, 투표 모달, 카드, 파티클 등 UI 구조
> - [`docs/history.md`](docs/history.md) — 변경 이력

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `js/supabase.js` | `window.db` 초기화. 모든 페이지 JS의 전제조건 |
| `js/auth.js` | `getUser`, `requireAuth`, `escapeHtml`, `relativeTime`, `safeRedirectUrl`, `getGuestId` |
| `js/home.js` | 카드 그리드, 히어로 섹션, 바형 리스트, 프리뷰 섹션, 파티클 |
| `js/vote-modal.js` | 밸런스게임 투표 모달 (IIFE). index.html 전용 |
| `js/create.js` | 게시물 작성, 썸네일 업로드, 퀴즈 문항 빌더, `toggleCategoryFields()` |
| `js/post.js` | 투표UI, 퀴즈/테스트 CTA, 좋아요, 댓글 CRUD |
| `js/quiz.js` | 퀴즈 플레이어 — `quiz.html` 전용. OX/객관식/단답형/주관식 통합 |
| `js/test.js` | TM 테스트 플레이어 — `test.html` 전용 |
| `js/mypage.js` | 통계 집계, 게시물 삭제 |
| `js/profile.js` | 팔로우/언팔로우, 유저 게시물 그리드 |
| `infographic.html` | 첫 방문 인트로 (Black Han Sans, 불씨 파티클) |

## 홈 페이지 구조 (밸런스게임 탭)

```
히어로 (밸런스게임 votes 합산 top 1)
"다른 뜨거운 논쟁" 바형 리스트 (2~6위, 5개)
─── 구분선 (#quizDivider) ───
퀴즈 & 테스트 프리뷰 (OX퀴즈+테스트 최신 4개) — 없으면 섹션 전체 숨김
─── 구분선 (#communityDivider) ───
커뮤니티 프리뷰 (최신 4개) — 없으면 섹션 전체 숨김
```

**show/hide 원칙**: divider는 반드시 해당 프리뷰 헤더와 함께 show/hide.
```js
// 보이기
if (quizDivider)       quizDivider.style.display       = '';
if (quizPreviewHeader) quizPreviewHeader.style.display = '';
// 숨기기
if (quizDivider)       quizDivider.style.display       = 'none';
if (quizPreviewHeader) quizPreviewHeader.style.display = 'none';
```

## home.js 주요 함수

| 함수 | 역할 |
|------|------|
| `loadBalanceGameHome()` | 홈 탭 — 히어로 + 바형5 + 프리뷰 병렬 로드 |
| `loadDebateBarPage(reset)` | 토론 탭 — 바형 리스트 전체 (currentSort 사용) |
| `loadQuizPreview()` | OX퀴즈+테스트 최신 4개, 없으면 섹션 숨김 |
| `loadCommunityPreview()` | 커뮤니티 최신 4개, 없으면 섹션 숨김 |
| `renderDebateBarList(posts, votesByPost, bestByPost)` | 바형 아이템 HTML 생성 |
| `renderPreviewItem(post)` | 프리뷰 아이템 HTML — PREVIEW_ICONS 사용 |

**퀴즈 탭 필터**: `.in('category', ['퀴즈', '테스트'])` 사용
**퀴즈 카드 뱃지**: `buildQuizTypeBadge(post)` — `.card-quiz-type-{quiz_type}` 클래스로 유형 표시
**PREVIEW_ICONS**: `'퀴즈'` 키 추가됨. 새 카테고리 추가 시 반드시 추가.

## 아이콘 원칙

**이모지 절대 금지** — 카테고리 아이콘은 `PREVIEW_ICONS` 상수의 inline SVG 사용.
새 카테고리 추가 시 `PREVIEW_ICONS` 객체에 SVG 추가 후 `renderPreviewItem`에서 참조.

## 히어로 배틀 아레나 — CSS 변수 & 불꽃 강도

`.hero-battle` 요소에 JS로 설정하는 CSS custom properties:

| 변수 | 설명 |
|------|------|
| `--divide` | 배경 분할 위치 (예: `60%`) |
| `--pct-a` / `--pct-b` | 투표율 숫자 |
| `--flame-a-opacity` / `--flame-b-opacity` | 불꽃 투명도 |
| `--flame-a-sat` / `--flame-b-sat` | 채도 (CSS `%` 단위 포함) |
| `--flame-a-bright` / `--flame-b-bright` | 밝기 |
| `--flame-a-scale` / `--flame-b-scale` | 불꽃 높이 scaleY 값 |

**투표율 → 강도 계산식** (`pct` = 0~100):
```js
opacity = 0.25 + (pct / 100) * 0.75   // 0.25 ~ 1.0
sat     = (60 + pct * 1.4) + '%'       // 60% ~ 200%
bright  = 0.6 + (pct / 100) * 0.5     // 0.6 ~ 1.1
scale   = 0.65 + (pct / 100) * 0.5    // 0.65 ~ 1.15
```

## 레이아웃 & 트랜스폼 트랩

**`flex` 쏠림 효과 금지**: 투표율에 따라 `element.style.flex = pct`로 패널 크기를 조절하면
패배 측 텍스트가 극도로 찌그러짐. CSS custom property로 불꽃 강도·opacity를 대신 조절할 것.

**`scaleX(-1) + transform-origin` 트랩**: `scaleX(-1)`로 수평 미러링 + `scaleY()`를 함께
쓸 때 `transform-origin: bottom right`는 요소를 화면 밖으로 밀어냄.
반드시 `transform-origin: bottom center` 사용:
```css
/* ✅ */
.hero-flame-b {
  transform: scaleX(-1) scaleY(var(--flame-b-scale, 1));
  transform-origin: bottom center;
}
/* ❌ bottom right → scaleX(-1)과 함께 쓰면 요소가 우측으로 밀려 비표시됨 */
```

## 절대 규칙 (항상 준수)

**스크립트 로드 순서**: `supabase.js` → `auth.js` → (index만: `vote-modal.js` →) `home.js` or `[페이지].js`

**XSS 방지**: `innerHTML` 삽입 시 반드시 `escapeHtml()` — class 속성값도 포함
```js
`<span class="badge badge-${escapeHtml(post.category)}">`  // ✅
`<span class="badge badge-${post.category}">`              // ❌
```

**textContent 이중 인코딩 금지**: `textContent`는 브라우저가 자동 이스케이프 → raw 값 직접 할당
```js
el.textContent = post.option_a;            // ✅ raw 값
el.textContent = escapeHtml(post.option_a); // ❌ &amp; 등이 리터럴로 화면 노출
```
`innerHTML`에는 `escapeHtml()`, `textContent`에는 raw 값이 원칙.

**이벤트**: inline `onclick` 금지 (정적 버튼 포함) → `addEventListener` 또는 이벤트 위임

**리다이렉트**: `?next=` 파라미터는 반드시 `safeRedirectUrl()` 경유

**Promise.all**: 내부에서 `await` 혼용 금지 → 사전 resolve 후 전달

**RLS**: **모든** DELETE 쿼리(posts·댓글·투표)에 반드시 `.eq('user_id', currentUser.id)` 포함 (guest 투표는 `.eq('guest_id', guestId)`)
- posts: `.delete().eq('id', postId).eq('user_id', currentUser.id)`
- RLS만 의존 금지 — 정책 설정 오류 시 타인 데이터 삭제 가능

**익명 투표**: votes 테이블은 `user_id` nullable + `guest_id TEXT`. 비로그인 시 `getGuestId()`(localStorage UUID)로 식별.
`toggleVote` 패턴:
```js
const isGuest = !currentUser;
const guestId = isGuest ? getGuestId() : null;
let q = db.from('votes').delete().eq('post_id', postId);
if (isGuest) q = q.eq('guest_id', guestId);
else q = q.eq('user_id', currentUser.id);
```
`vote-modal.js`와 `post.js` 양쪽에 동일 패턴 적용.

**이벤트 위임 주의**: 동적 리스트(questionList 등)에 이벤트 위임 등록 시 `{ once: true }` **절대 금지**.
`{ once: true }`는 첫 이벤트 후 리스너가 소멸되어 이후 상호작용이 전부 끊김.
대신 목록 컨테이너에 한 번만 등록(`setupXxxEvents()` 패턴)하고 innerHTML 재생성 시에도 재등록하지 않음.

## 퀴즈 시스템

### post.html 섹션 분기
```js
// category별 섹션 표시 (post.js renderPost 내)
isVote (밸런스게임) → #voteSection
isQuiz (퀴즈)       → #quizSection + "퀴즈 풀기" → quiz.html?id=
isTest (테스트)     → #testSection + "테스트 시작" → test.html?id=
```

### 퀴즈 플레이어 (quiz.html / quiz.js)
- `quiz_questions` 테이블에서 `order_num` 순으로 문항 로드
- 문항별 `quiz_type`에 따라 OX/객관식/단답형/주관식 UI 분기
- 결과: 정답수/오답수/주관식수 집계 (주관식은 점수 미반영)

### 퀴즈 빌더 (create.html / create.js)
- `setupQuestionListEvents()` — `#questionList`에 이벤트 위임 한 번만 등록 (init에서 호출)
- `addQuestion()` → `questions[]` 배열에 유형별 빈 객체 추가 → `renderQuestionList()` 호출
- 제출 시: posts INSERT → quiz_questions bulk INSERT (order_num = 배열 인덱스)

### quiz_questions 스키마
```
id, post_id, order_num, question_text,
options JSONB,          -- 객관식: [{text, is_correct}]
correct_answers TEXT[], -- OX/단답형/주관식: 복수 정답
```

## 밸런스게임 댓글 시스템 (post.js / post.html)

### 핵심 규칙
- **1인 1댓글**: 밸런스게임에서만 적용. 기존 댓글 있으면 INSERT 대신 UPDATE (앱 레벨)
- **side 자동 태깅**: `submitComment` 시 `userVote` → `comments.side` 저장
- **투표 변경 시**: 기존 댓글 **삭제** (`deleteMyComment()`) + "왜 바꿨나요?" 모달 표시 — side 업데이트가 아님
- **진영 변경 시 상태 초기화 필수**: 연속 변경 버그 방지
  ```js
  canPersuasionLike = false;
  myPersuasionLikeId = null;
  myPersuasionCommentId = null;
  ```

### 댓글 진영 분리 레이아웃
밸런스게임에서 `loadComments()`가 `.comment-arena` 2컬럼 그리드로 렌더링:
```js
const commentsA = data.filter(c => c.side === 'A');
const commentsB = data.filter(c => c.side === 'B');
// → .comment-col-a (좌) / .comment-col-b (우)
// 모바일 640px 이하: 1컬럼 세로
```

### 설득됨 좋아요 (`persuasion_likes` 테이블)
- UNIQUE(user_id, post_id) — 게시물당 1개
- 자기 댓글 제외: 앱 레벨 (`c.user_id !== currentUser?.id`)
- **표시 조건**: `canPersuasionLike === true && myPersuasionCommentId === null` — 클릭 전에만 잠깐 표시, 클릭 후 즉시 사라짐
- **카운트 노출 금지**: post 페이지에서 숫자 표시 금지. 마이페이지 `#statPersuasion`(본인만)에서만 확인 가능
- `canPersuasionLike`: "왜 바꿨나요?" 모달에서 "설득됐어요" 선택 시 true
- upsert 패턴 (`onConflict: 'user_id,post_id'`): 기존 것 변경 가능

### post.js 상태 변수
```js
let myComment = null;             // 내 기존 댓글 {id, content, side}
let myPersuasionLikeId = null;    // 내 설득됨 좋아요 ID
let myPersuasionCommentId = null; // 내가 설득됨을 준 comment_id
let canPersuasionLike = false;    // 설득됐어요 선택 후 true
```

### 초기화 순서 (밸런스게임)
`loadVotes()` → `renderVoteUI()` → `setupPersuasionModal()` → `loadMyComment()` → `loadPersuasionLike()` → `updateCommentForm()`

### 댓글 폼 상태
- 투표 전: textarea 비활성화 ("먼저 투표해주세요")
- 기존 댓글 있음: 내용 prefill, 버튼 "수정"
- 기존 댓글 없음: 버튼 "작성"
- **Enter = 제출, Shift+Enter = 줄바꿈** (Ctrl+Enter 아님)

### 댓글 폼 진영 표시
투표 후 폼 상단에 탭 형태 진영 레이블 표시:
- `#commentSideTag`: "A진영 · [선택지명]" 또는 "B진영 · [선택지명]"
- CSS 클래스: `.comment-side-tag-a` (파랑) / `.comment-side-tag-b` (주황)
- `#commentFormInner`에 `.comment-form-a` / `.comment-form-b` 클래스 → textarea 테두리 진영 색상
- 투표 취소/전: `#commentSideTag` 숨김, 클래스 초기화

## 프로필 링크 패턴 (작성자 클릭 → profile.html)

### 댓글 작성자 (post.js `renderCommentItem`)
`c.user_id`를 이용해 `profileHref` 변수 생성 후 아바타·이름을 `<a>`로 래핑:
```js
const profileHref = c.user_id ? `profile.html?id=${escapeHtml(c.user_id)}` : null;
// 아바타 래핑
profileHref
  ? `<a href="${profileHref}" class="comment-avatar-link">${avatarHtml}</a>`
  : avatarHtml
// 작성자 이름
profileHref
  ? `<a class="comment-author comment-author-link" href="${profileHref}">${escapeHtml(name)}</a>`
  : `<span class="comment-author">${escapeHtml(name)}</span>`
```
- `user_id` 없는 경우 plain text 유지 (방어 코드)
- `loadComments` 쿼리에서 `*` select로 `c.user_id` 자동 포함됨

### 카드 작성자 (home.js `renderDefaultCard`)
카드가 `<a>` 태그이므로 내부에 `<a>` 중첩 불가 → `data-profile-id` + 이벤트 위임 패턴:
```html
<!-- div에 data 속성 + role/tabindex -->
<div class="card-author card-author-link"
     data-profile-id="${escapeHtml(post.user_id)}"
     role="button" tabindex="0" title="프로필 보기">
```
```js
// grid 클릭 위임에서 카드 링크보다 먼저 처리
grid.addEventListener('click', e => {
  const authorEl = e.target.closest('.card-author[data-profile-id]');
  if (!authorEl) return;
  e.preventDefault();  // 카드 <a> 링크 차단
  location.href = `profile.html?id=${authorEl.dataset.profileId}`;
});
```

### CSS 클래스
```css
.comment-avatar-link { display: contents; }  /* 레이아웃 깨짐 없이 래핑 */
a.comment-author-link { color: inherit; text-decoration: none; }
a.comment-author-link:hover { text-decoration: underline; color: var(--accent); }
.card-author-link { cursor: pointer; }
.card-author-link:hover { background: var(--surface2); }
```

### profile.html / profile.js
- `?id={userId}` 파라미터로 타인 프로필 조회
- 팔로우/언팔로우 완전 구현 (follows 테이블, RLS 포함)
- 게시물 작성자 섹션(`#authorLink`)은 이미 `profile.html?id=` 링크 적용됨

## Supabase

- **프로젝트 URL**: `https://mwsfzxhblboskdlffsxi.supabase.co`
- **테이블**: profiles, posts, likes, comments, comment_likes, follows, votes, quiz_questions, **persuasion_likes**
- **Storage**: thumbnails 버킷 (public)
- **DB 함수**: `increment_view_count(post_id uuid)` (RPC)
- **트리거**: `on_auth_user_created` (구글 로그인 시 profiles 자동 생성)

## 실행

```bash
python -m http.server 8080
# → http://localhost:8080/          첫 방문: infographic → 플랫폼
# → http://localhost:8080/?reset    infographic 재확인 (QA)
# file:// 불가 — OAuth 미지원
```
