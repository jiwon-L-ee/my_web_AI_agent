# platform/ CLAUDE.md

**맞불** — 밸런스게임·토론·퀴즈 커뮤니티. 슬로건: "사소한 고집의 끝".
정적 HTML/CSS/JS + Supabase(Auth · DB · Storage).

### 네비게이션 카테고리 (전 페이지 동일)
`홈(밸런스게임) / 토론 / 퀴즈 / 커뮤니티 / 랭킹`

> `정보` 탭 제거됨 (2026-03-23). `ranking.html`로 교체.
> 랭킹 탭은 `<a href="ranking.html" class="nav-link">랭킹</a>` — `data-cat` 속성 없음.

### 게시물 카테고리 (DB 저장값)
`밸런스게임 / 퀴즈 / 테스트 / 커뮤니티`

> `정보` 카테고리 제거됨 (2026-03-23). create.html 탭 및 categorySelect에서도 삭제.

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
| 홈 | 밸런스게임 | 히어로 + 바형 리스트(5) + 퀴즈·커뮤니티 프리뷰 (만료 게시물 제외) |
| 토론 | 밸런스게임 | 서브탭 "진행 중 / 마감됨" — 진행 중: 미만료 바형 리스트, 마감됨: 만료된 토론 목록 |
| 퀴즈 | 퀴즈 + 테스트 | 카드 그리드 |
| 커뮤니티 | 커뮤니티 | 카드 그리드 (항상 최신순, 좋아요 수 표시) |
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
| `js/ranking.js` | 유저 랭킹 — `get_ranking_stats()` RPC 호출, 5개 탭, 내 순위 배너 |
| `js/community-edit.js` | 커뮤니티 글 수정 — 기존 이미지 복원(`data-existing`), 신규 이미지 업로드(`data-local`) |
| `js/notifications.js` | 인앱 알림 벨 — `initNotifications(user)` 진입점, 30초 폴링, 드롭다운 |
| `ranking.html` | 랭킹 페이지 (종합·크레딧·좋아요·설득함·팔로워) |
| `community-edit.html` | 커뮤니티 글 수정 페이지 — `community-edit.js` 전용 |
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
| `loadDebateBarPage(reset)` | 토론 탭 "진행 중" 서브탭 — 미만료 바형 리스트 |
| `loadClosedDebatesTab()` | 토론 탭 "마감됨" 서브탭 — 만료된 토론 목록 |
| `loadClosedDebates()` | 만료 게시물 쿼리 + `post_results` 포함 렌더링 |
| `loadCommunityListPage()` | 커뮤니티 탭 — 항상 `created_at DESC`, sortBar 숨김 |
| `loadQuizPreview()` | OX퀴즈+테스트 최신 4개, 없으면 섹션 숨김 |
| `loadCommunityPreview()` | 커뮤니티 최신 4개 + 좋아요 수, 없으면 섹션 숨김 |
| `renderDebateBarList(posts, votesByPost, bestByPost)` | 바형 아이템 HTML 생성 |
| `renderPreviewItem(post)` | 프리뷰 아이템 HTML — PREVIEW_ICONS 사용 |

**퀴즈 탭 필터**: `.in('category', ['퀴즈', '테스트'])` 사용
**퀴즈 카드 뱃지**: `buildQuizTypeBadge(post)` — `.card-quiz-type-{quiz_type}` 클래스로 유형 표시
**PREVIEW_ICONS**: `'퀴즈'` 키 추가됨. 새 카테고리 추가 시 반드시 추가.
**만료 필터 (홈/토론 진행 중)**: `.or('expires_at.is.null,expires_at.gt.${nowIso}')` — 만료된 게시물 홈에서 제외

**`renderDebateBarList` 시그니처**: `renderDebateBarList(posts, votesByPost, bestByPost, myVotes = {})`
- `myVotes`: `{ [postId]: 'A'|'B' }` — 로그인 시 DB(user_id), 게스트 시 DB(guest_id) + localStorage 보완
- 게스트 myVotes 조회 패턴:
```js
const { data: myVoteData } = await db.from('votes').select('post_id,choice')
  .eq('guest_id', getGuestId()).in('post_id', postIds);
(myVoteData ?? []).forEach(v => { myVotes[v.post_id] = v.choice; });
// localStorage로 보완 (DB 쿼리 실패 대비)
const stored = JSON.parse(localStorage.getItem('matbul-guest-votes') || '{}');
postIds.forEach(id => { if (stored[id] && !myVotes[id]) myVotes[id] = stored[id]; });
```
- `loadDebateBarPage`와 `loadBalanceGameHome` 양쪽 모두 적용

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

**블라인드 모드 완전 처리** — 숫자 텍스트만이 아니라 CSS custom property도 반드시 50/50 고정:
```js
const vbA = blind ? 50 : pctA;
const vbB = blind ? 50 : pctB;
heroBattle.style.setProperty('--divide', vbA + '%');   // ← 50% 고정
applyFlame('a', vbA);  // ← 불꽃도 균등
applyFlame('b', vbB);
```
`--divide`, `--vb-pct-a`, `--pct-a/b`, 불꽃 세기 모두 blind 시 50 사용.
히어로 텍스트(`heroPctA/B`, `hsrPctA/B`)도 `blind ? '??' : pctA + '%'` 처리 필수.

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

**스크립트 로드 순서**: `supabase.js` → `auth.js` → `notifications.js` → (index만: `vote-modal.js` →) `home.js` or `[페이지].js`

> `notifications.js`는 nav가 있는 모든 페이지에 포함 (login/signup/reset-password/forgot-password 제외)

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

**공유 상수 스코프**: 여러 함수에서 공통으로 쓰는 상수는 반드시 모듈 최상단에 선언
- 함수 내부 `const`는 다른 함수에서 접근 불가 → `ReferenceError`
- 사례: `VOTE_CHANGE_COST`가 `showVoteChangeModal` 내부에 있었으나 `setupVoteChangeModal`에서 참조 → 투표 변경 전체 불가 버그

**RLS**: SELECT / INSERT / UPDATE / DELETE 4가지 정책 모두 확인 필수
- 새 테이블 생성 또는 새 연산 추가 시 해당 정책 존재 여부 반드시 체크
- **UPDATE 정책 누락 함정**: RLS가 활성화된 테이블에 UPDATE 정책이 없으면 UPDATE가 조용히 0행 처리됨 (에러 없음) — `comments_update` 정책 누락으로 댓글 수정 전체 불가였던 사례
- **모든** DELETE 쿼리에 반드시 `.eq('user_id', currentUser.id)` 포함 (guest 투표는 `.eq('guest_id', guestId)`)
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
- **투표 변경 시**: 기존 댓글을 DELETE (comment_likes·persuasion_likes CASCADE 삭제됨)
  - 1분 무료 변경 구간에서 댓글이 있으면 `confirm()` 경고 표시
  - 크레딧 모달(showVoteChangeModal)에서도 "⚠ 기존 댓글이 삭제됩니다" 경고 표시
  - `applyVoteChange()` 패턴:
    ```js
    if (myComment) {
      await db.from('comments')
        .delete()
        .eq('id', myComment.id)
        .eq('user_id', currentUser.id);
      myComment = null;
    }
    ```
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
- **댓글 수정 시**: `comment_likes` + `persuasion_likes` 일괄 삭제 (좋아요·설득됨 초기화) + `edited_at` 저장
  - 댓글 아이템에 "수정" 버튼(`.btn-edit-comment`) 표시 → 클릭 시 폼 textarea 채우기 + 스크롤

### 일반 댓글 수정 패턴 (editingCommentId)
`loadMyComment()`는 밸런스게임 전용(`if (isVote)` 블록 내 호출) — 커뮤니티 등 다른 카테고리에서 `myComment`는 항상 null.
다른 카테고리 댓글 수정은 `editingCommentId` 변수로 처리:
```js
let editingCommentId = null; // 수정 대상 댓글 ID (null = 신규 작성)

// 수정 버튼 클릭 핸들러
editingCommentId = editBtn.dataset.commentId;
textarea.value = commentTextEl.textContent; // textContent = 브라우저가 HTML 엔티티 디코딩한 원본
submitBtn.textContent = '수정';

// submitComment() 분기
if (post?.category === '밸런스게임' && myComment) { /* 밸런스게임 수정 */ }
else if (editingCommentId)                         { /* 일반 수정 */ }
else                                               { /* 신규 INSERT */ }
```
- **`editingCommentId` 초기화 필수**: 수정 성공 후 `editingCommentId = null`, 삭제 시에도 초기화

### 댓글 edited_at
- DB 컬럼: `comments.edited_at TIMESTAMPTZ` (마이그레이션: `20260327_comment_edited_at.sql`)
- 수정 성공 시: `update({ content, edited_at: new Date().toISOString() })`
- 렌더링: `c.edited_at ? '<span class="comment-edited">(수정됨)</span>' : ''`

### 댓글 정렬 (sortByScore)
좋아요 + 설득됨 합산 내림차순 정렬. `loadComments()` 쿼리에 `persuasion_likes(count)` 포함 필요:
```js
const sortByScore = (arr) => arr.slice().sort((a, b) => {
  const scoreA = (a.comment_likes?.[0]?.count ?? 0) + (a.persuasion_likes?.[0]?.count ?? 0);
  const scoreB = (b.comment_likes?.[0]?.count ?? 0) + (b.persuasion_likes?.[0]?.count ?? 0);
  return scoreB - scoreA;
});
// 밸런스게임: commentsA, commentsB, neutral 각각 sortByScore() 적용
// 일반: sortByScore(data).map(...)
```

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

---

## 새 HTML 페이지 생성 시 필수 체크리스트

새 `.html` 파일을 만들 때 반드시 포함해야 하는 항목 (누락 시 DB 연결 전체 불가 또는 테마 깨짐):

```html
<!-- 1. Supabase CDN — supabase.js보다 반드시 먼저 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/supabase.js"></script>
<script src="js/auth.js"></script>
<script src="js/[페이지].js"></script>

<!-- 2. 테마 토글 — 모든 페이지 body 닫기 전 -->
<script>
  (function() {
    if (localStorage.getItem('matbul-theme') === 'light') document.body.classList.add('light-mode');
    document.getElementById('themeToggle').addEventListener('click', function() {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('matbul-theme', isLight ? 'light' : 'dark');
    });
  })();
</script>
```

> **실수 패턴**: Supabase CDN 누락 → `window.supabase` undefined → `db` 객체 생성 실패 → 모든 DB 호출 무한 스피너

## 새 페이지 JS 초기화 패턴

```js
// ✅ 올바른 순서 — initAuth() 반드시 await
(async () => {
  await initAuth();        // 네브바 먼저 완성 (await 없으면 "로그인"으로 고정됨)
  currentUser = await getUser();
  // ... 나머지 초기화
})();
```

> **실수 패턴**: `initAuth()` await 누락 → profiles 쿼리 완료 전에 페이지 렌더링 → 로그인 상태임에도 "로그인" 버튼 표시

## 랭킹 시스템

### 함수
`public.get_ranking_stats()` — SECURITY DEFINER (credits RLS 우회)
- 반환: `user_id, username, avatar_url, credits, like_count, persuasion_count, follower_count, overall_score`
- 호출: `db.rpc('get_ranking_stats')`
- 권한: `authenticated, anon` 모두 실행 가능

### 종합 점수 공식
```
overall_score = credits × 1 + like_count × 10 + persuasion_count × 25 + follower_count × 15
```

### 설득함(persuasion_count) 집계
`persuasion_likes.comment_id → comments.user_id` 조인으로 내 댓글이 설득한 횟수를 집계.
`persuasion_likes.user_id`는 설득된 사람(좋아요 준 사람)이고, 설득한 사람은 comment 작성자.

## 토론 탭 서브탭 구조

토론 탭 클릭 시 `debateSubTabs` (`#debateSubTabs`)가 표시되며 "진행 중 / 마감됨" 서브탭을 제공.

### 상태 변수
```js
let currentDebateTab = 'active'; // 'active' | 'closed'
```

### 서브탭 전환 패턴
```js
debateSubTabs.addEventListener('click', e => {
  const tab = e.target.closest('.debate-sub-tab');
  if (!tab) return;
  const dtab = tab.dataset.dtab;
  if (dtab === currentDebateTab) return;
  if (dtab === 'closed') loadClosedDebatesTab();
  else loadDebateBarPage();
});
```

### style.display 전환 주의사항
서브탭 전환 시 `debatesBarList`/`closedDebatesList`를 교대로 show/hide.
**`innerHTML` 설정만으로는 hidden 요소가 보이지 않음** — `style.display`를 반드시 명시 복원:
```js
// ❌ 틀린 패턴 — display:none 상태 그대로라 화면에 안 보임
debatesBarList.innerHTML = `<div>...</div>`;

// ✅ 올바른 패턴
debatesBarList.style.display = '';   // ← 반드시 먼저 복원
debatesBarList.innerHTML = `<div>...</div>`;
```

### HTML 구조 (index.html 내 토론 섹션)
```html
<div class="debate-sub-tabs" id="debateSubTabs" style="display:none">
  <button class="debate-sub-tab active" data-dtab="active">진행 중</button>
  <button class="debate-sub-tab" data-dtab="closed">마감됨</button>
</div>
<!-- 진행 중 목록 -->
<div class="debates-bar-list" id="debatesBarList"></div>
<!-- 마감됨 목록 -->
<div class="home-section-divider" id="closedDivider" style="display:none"></div>
<div class="home-preview-hd" id="closedHeader" style="display:none">마감된 토론</div>
<div class="debates-bar-list" id="closedDebatesList" style="display:none"></div>
```

## 마감된 토론 (post.js)

### isExpiredPost 플래그
```js
let isExpiredPost = false; // renderPost()에서 설정
```
`renderPost()` → `if (isVote)` 블록에서 `isExpiredPost = isExpired` 설정.

### disabled 버튼 함정
HTML `disabled` 속성은 **부모 요소의 이벤트 리스너를 막지 못함** — 클릭이 bubbling.
반드시 함수 내부에서 JS 레벨 가드 사용:
```js
async function toggleVote(dbChoice, displayChoice) {
  if (isExpiredPost) return; // ← JS 레벨 가드 필수
  ...
}
async function submitComment() {
  if (isExpiredPost) return; // ← JS 레벨 가드 필수
  ...
}
```

### 만료 게시물 UI
- 투표 버튼: `disabled = true`, `opacity: 0.4`, `cursor: default`
- 섹션 레이블: "마감된 토론"으로 변경
- 댓글 폼: "이 토론은 마감되어 댓글을 작성할 수 없습니다." 메시지로 교체
- 결과 배너: `loadAndRenderResult()` 호출 → `credits` 테이블에서 내 크레딧 수익 표시

## 커뮤니티 글 수정 (2026-03-27 추가)

- **페이지**: `community-edit.html` + `js/community-edit.js`
- **DB**: `posts.edited_at TIMESTAMPTZ` 컬럼 (마이그레이션: `20260327_community_edit.sql`)
- **진입**: `post.html`에서 커뮤니티 작성자에게만 `#editBtn` 표시 → `community-edit.html?id=`
- **수정됨 배지**: `p.edited_at` 있으면 `#editedBadge` `(수정됨)` 표시
- **이미지 구분**: 기존 이미지 `data-existing="1"` (URL 유지), 신규 이미지 `data-local="1"` (업로드)
- **저장 시**: `payload.edited_at = new Date().toISOString()` 포함하여 UPDATE

## 게스트 투표 localStorage 패턴 (2026-03-27 추가)

비로그인 사용자의 투표 여부를 localStorage에 캐시:
- **키**: `matbul-guest-votes` → `{ [postId]: 'A'|'B' }` 형식
- **헬퍼** (post.js): `guestVoteSave(pid, choice)` / `guestVoteLoad(pid)`
- **저장 시점**: 투표 INSERT 성공 후 (`toggleVote`, `applyVoteChange`)
- **표시**: `#myVoteIndicator` — 투표바 아래 "내 선택: A진영 · [선택지]" 텍스트
- **복원**: `loadVotes()` → DB 쿼리 후 결과 없으면 `guestVoteLoad(pid)` 백업 사용

```js
// post.js guestVoteSave 패턴
function guestVoteSave(pid, choice) {
  const stored = JSON.parse(localStorage.getItem('matbul-guest-votes') || '{}');
  if (choice === null) delete stored[pid];
  else stored[pid] = choice;
  localStorage.setItem('matbul-guest-votes', JSON.stringify(stored));
}
```

## 게시물 생성 크레딧 비용 (2026-03-27 기준)

| 카테고리 | 비용 | 상수/함수 위치 |
|---------|------|--------------|
| 밸런스게임 | 3일=20 / +1일당 +5 (최대 7일=40) | `create.js` `calcDurationCost()` |
| 퀴즈 | 20 크레딧 | `create.js` `QUIZ_CREATE_COST` |
| 테스트 | 20 크레딧 | `create.js` `TEST_CREATE_COST` |
| 커뮤니티 | 무료 | — |

**비용 변경 시 반드시 함께 수정:**
1. `create.js` — 상수/함수 값
2. `create.html` — `#durationRow` 버튼 텍스트 (밸런스게임) 또는 `.duration-credit-notice` 안내 문구 (퀴즈/테스트)

**크레딧 차감**: post INSERT 성공 후 `db.rpc('spend_credits', { p_amount, p_reason: 'post_create', p_post_id })` 호출.
잔액 부족 시 INSERT 전에 `credit_balances` 뷰로 잔액 확인 → alert 후 return.

## 크레딧 계산서 UI (create.html / create.js)

게시물 작성 폼 하단(약관 체크박스 위)에 실시간 계산서 박스 표시.

- **HTML**: `#creditReceipt` — `.credit-receipt` (기본 `display:none`, `.visible` 클래스로 표시)
- **JS**: `updateCreditReceipt()` — 카테고리 선택·기간 버튼 클릭 시 호출
- **커뮤니티**: `receipt.classList.remove('visible')` — 박스 자체 숨김
- **호출 시점**: 카테고리 탭 변경(`toggleCategoryFields` 후), 기간 버튼 클릭 후, `init()` 최초 로드 시

## 반박 덧글(대댓글) 시스템 (2026-03-28 추가)

밸런스게임에서 상대 진영 댓글/덧글에 크레딧 2를 소모하여 덧글로 반박하는 기능.
루트댓글뿐 아니라 **덧글에도 반박 가능** (DB는 1-level 유지, UI만 각 아이템 아래 폼 배치).

### DB 구조
- `comments.parent_id UUID` — `comments(id)` 참조, CASCADE 삭제
- `parent_id IS NULL`: 루트댓글 / `parent_id IS NOT NULL`: 반박 덧글
- `spend_credits` RPC reason: `'rebuttal_comment'`
- **1-level 원칙**: 덧글의 `parent_id`는 항상 루트댓글 ID (덧글→덧글 반박도 루트에 삽입)

### 2-pass 쿼리 패턴 (post.js `loadComments`)
Supabase PostgREST recursive join 미지원 → 별도 쿼리 후 JS 그룹핑:
```js
// 1차: 루트댓글만
db.from('comments').select('...').eq('post_id', postId).is('parent_id', null)

// 2차: 덧글 일괄 조회
db.from('comments').select('*,profiles(...),comment_likes(count)').in('parent_id', rootIds)

// JS 그룹핑
const repliesByParent = {};
replies.forEach(r => {
  if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
  repliesByParent[r.parent_id].push(r);
});
```

### data-reply-id 기반 폼 식별 패턴 (핵심)
루트댓글과 덧글이 동일한 `data-parent-id`를 공유할 수 있으므로 `data-reply-id`로 폼 고유 식별:

```
루트댓글 버튼:   data-comment-id="${c.id}"        data-reply-id="${c.id}"
루트댓글 폼wrap: data-parent-id="${c.id}"          data-reply-id="${c.id}"

덧글 버튼:       data-comment-id="${r.parent_id}"  data-reply-id="${r.id}"
덧글 폼wrap:     data-parent-id="${r.parent_id}"   data-reply-id="${r.id}"
```

- `showRebuttalForm`은 `.rebuttal-form-wrap[data-reply-id="${replyId}"]`로 폼 찾음
- `submitRebuttal`은 `formWrap.dataset.parentId`로 루트댓글 ID 가져와 INSERT

### 주요 함수 (post.js)
| 함수 | 역할 |
|------|------|
| `renderReplyItem(r, myLikedCommentIds)` | 덧글 전용 렌더. 반박 버튼 + `replyFormWrap` 자체 내장 |
| `showRebuttalForm(parentCommentId, mention, replyId)` | `data-reply-id`로 폼 고유 탐색 후 토글 |
| `submitRebuttal(formWrap)` | formWrap DOM 직접 전달 → `dataset.parentId`로 INSERT |

### submitRebuttal 패턴 (formWrap 직접 전달)
```js
// ✅ formWrap을 직접 받아 querySelector 중복 방지
async function submitRebuttal(formWrap) {
  const parentCommentId = formWrap.dataset.parentId;
  const textarea = formWrap.querySelector('.rebuttal-input');
  // ...
}

// 호출부 (클릭 이벤트 / Enter 키 공통)
const formWrap = e.target.closest('.rebuttal-form-wrap');
if (formWrap) await submitRebuttal(formWrap);
```

### 반박 버튼 표시 조건
```js
// 루트댓글 (renderCommentItem)
const showRebuttal = currentUser && isVotePost && c.side && userVote
  && c.side !== userVote && !isExpiredPost;

// 덧글 (renderReplyItem) — 조건 동일, post?.category 직접 확인
const showReplyRebuttal = currentUser
  && post?.category === '밸런스게임'
  && r.side && userVote && r.side !== userVote && !isExpiredPost;
```

### spend_credits reason 확장 절차
`spend_credits` RPC의 reason whitelist에 새 값을 추가할 때:
1. `CREATE OR REPLACE FUNCTION spend_credits(...)` — whitelist `NOT IN (...)` 배열에 추가
2. 마이그레이션 파일 생성 후 **Supabase에 먼저 적용**
3. JS 코드에서 새 reason으로 `db.rpc('spend_credits', {...})` 호출

현재 whitelist: `'post_create'`, `'vote_change'`, `'rebuttal_comment'`

### 트러블슈팅: 신규 컬럼 쿼리로 댓글 전체 빈 상태
**증상**: 댓글이 아예 안 보임 ("아직 댓글이 없습니다" 표시)
**원인**: `.is('parent_id', null)` 등 신규 컬럼 기반 필터를 코드에 추가했으나 마이그레이션 미적용 → 쿼리 에러 → `if (error || !data?.length)` 분기로 빈 상태 렌더
**해결**: Supabase MCP `apply_migration` 또는 `npx supabase db push`로 마이그레이션 선적용

### 트러블슈팅: 반박 버튼 클릭해도 반응 없음 (silent fail)
**증상**: 반박 버튼이 보이는데 클릭해도 폼이 안 열림
**원인**: 같은 진영(예: B) 루트댓글에 달린 상대 진영(A) 덧글의 반박 버튼이 B루트의 form wrap을 가리키는데, B루트는 `showRebuttal=false`라 form wrap 없음 → `showRebuttalForm` querySelector 실패 후 조용히 return
**해결**: 각 아이템(루트/덧글)에 `data-reply-id` 부여한 자체 form wrap 내장 → `showRebuttalForm`이 `data-reply-id`로 정확히 찾음

## 커뮤니티 탭 (2026-03-26 변경)

- **정렬**: 항상 `created_at DESC` 고정 — 인기순/최신순 토글 제거 (`sortBar` 숨김)
- **좋아요 표시**: `likes(count)` 쿼리 추가, `.cli-likes` 스팬으로 하트 아이콘 + 개수 표시
- **sortBar**: `sortBarEl.style.display = 'none'`으로 명시 숨김

## 밸런스게임 카드 클릭 동작 (2026-03-23 변경)

홈/토론 탭에서 밸런스게임 클릭 시 **모달 대신 post.html로 직접 이동**:
```js
// home.js — openVoteModal() 호출 제거, 직접 이동으로 변경
location.href = `post.html?id=${card.dataset.id}`;
```
카드 그리드, 히어로 배틀, 히어로 A/B 버튼, 바형 리스트 모두 동일 패턴 적용.

post.html 투표 버튼 아래 경고 문구 `.vote-caution` 추가:
```html
<p class="vote-caution">⚠ 댓글을 읽고 신중하게 선택하세요. 투표는 되돌리기 어렵습니다.</p>
```

## 인앱 알림 시스템 (2026-03-27 추가)

로그인 사용자에게 네브바 벨 아이콘으로 알림을 표시하는 시스템.

### DB
- **테이블**: `notifications` — `id, user_id, type, post_id, comment_id, actor_id, is_read, created_at`
- **type 값**: `'rebuttal'` (반박 댓글 달림) | `'vote_ended'` (투표 종료)
- **RLS**: SELECT/UPDATE = `user_id = auth.uid()`. INSERT는 클라이언트 직접 불가 → SECURITY DEFINER 함수 경유
- **RPC**: `notify_rebuttal(p_target_user_id, p_post_id, p_comment_id)` — 자기알림 차단 + 중복 방지 내장

### 알림 발생 지점
| 이벤트 | 트리거 위치 | 방식 |
|--------|------------|------|
| 반박 댓글 달림 | `post.js` `submitRebuttal()` 완료 후 | `db.rpc('notify_rebuttal', {...})` |
| 투표 종료 | `settle-balance-games` Edge Function `settlePost()` 끝 | service_role로 bulk INSERT |

### notifications.js 구조
- `initNotifications(user)` — `auth.js` `updateNavbar()` 에서 호출 (로그인 시만)
- 30초 폴링 (`visibilityState === 'hidden'`이면 스킵)
- 이벤트 위임: 드롭다운 내 `.notif-item[data-notif-id]` 클릭 → 읽음 처리 후 `post.html?id=` 이동
- 알림 아이콘: `NOTIF_ICONS` 상수 inline SVG (이모지 금지)

### 주의사항
- `initNotifications`는 `updateNavbar`가 DOM에 벨 HTML을 삽입한 **직후** 호출되어야 함
  → `typeof initNotifications === 'function'` 체크 후 호출 (notifications.js 미로드 방어)
- 알림 생성 실패는 `try/catch`로 묵음 처리 — 반박 제출/정산 메인 플로우 차단 금지
- 투표 종료 알림은 `user_id IS NOT NULL`인 로그인 투표자에게만 발송 (게스트 제외)

## 게시물 제출 (handleSubmit) 패턴 (2026-03-27 추가)

### 타임아웃 가드 — 무한 멈춤 방지

Supabase 요청이 네트워크 이슈로 pending 상태로 멈추면 `catch`가 실행되지 않아 버튼이 영원히 비활성화됨.
**모든 async submit 함수에 타임아웃 가드를 적용**:

```js
async function handleSubmit(e) {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = '저장 중...';

  const timeoutId = setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '게시하기';
    alert('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.');
  }, 30000);

  try {
    // ... 처리 로직
    clearTimeout(timeoutId);
    location.href = '...';
  } catch (err) {
    clearTimeout(timeoutId);
    btn.disabled = false;
    btn.textContent = '게시하기';
  }
}
```

### early return 시 clearTimeout 필수

타임아웃 설정 이후에 early return이 있으면 반드시 `clearTimeout` 포함:

```js
// ❌ 잘못된 패턴 — 30초 후 불필요한 alert 발생
btn.disabled = false; return;

// ✅ 올바른 패턴
const resetBtn = () => { clearTimeout(timeoutId); btn.disabled = false; btn.textContent = '게시하기'; };
resetBtn(); return;
```

### 이미지 업로드 병렬화

여러 이미지를 업로드할 때 순차 `for...of`는 느림 → `Promise.all`로 병렬 처리:

```js
// ❌ 순차 — 이미지 수만큼 느림
for (const imgFile of images) {
  const { error } = await db.storage.from('thumbnails').upload(path, imgFile);
}

// ✅ 병렬
const urls = await Promise.all(images.map(async imgFile => {
  const { error } = await db.storage.from('thumbnails').upload(path, imgFile, { upsert: false });
  if (error) throw error;
  return db.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
}));
```

### post INSERT 후 크레딧 차감 분리

`posts.insert` 성공 후 `spend_credits` RPC가 실패하면 에러가 catch로 전파되어 버튼이 복원됨.
사용자가 다시 제출하면 게시물이 중복 생성됨. **크레딧 차감은 별도 try/catch로 분리**:

```js
const { data, error } = await db.from('posts').insert(payload).select('id').single();
if (error) throw error;

// 크레딧 차감 실패가 post 중복 생성으로 이어지지 않도록 분리
try {
  await db.rpc('spend_credits', { p_amount: cost, p_reason: 'post_create', p_post_id: data.id });
} catch (creditErr) {
  console.error('spend_credits 실패 (post 생성은 완료됨):', creditErr);
}

// post 생성은 이미 완료되었으므로 바로 이동
clearTimeout(timeoutId);
location.href = `post.html?id=${data.id}`;
```

## 라이트모드 테마 (2026-03-28 추가)

`body.light-mode` 클래스로 토글. `localStorage('matbul-theme')` 퍼시스트.

### CSS 변수 (라이트모드)
```css
body.light-mode {
  --bg: #f5f4f0;  --surface: #ffffff;  --surface2: #eeece8;
  --border: #dddbd6;  --text: #1a1a1a;  --text-muted: #666660;
  --blue: #1d6fce;  --orange: #c97a14;
}
```

### 하드코딩 다크모드 색상 → 라이트모드 매핑

`style.css`에는 CSS 변수 없이 하드코딩된 다크 전용 색이 다수 존재. 라이트모드에서 재정의 필요:

| 다크모드 원색 | 설명 | 라이트모드 대체 |
|-------------|------|--------------|
| `#71d8f7` | A팀 파스텔 파랑 | `#1d6fce` |
| `#ffc947` / `#ffe170` | B팀 파스텔 노랑 | `#c97a14` |
| `#f5a623` | 오렌지 (뱃지·아이콘) | `#c97a14` |
| `#4ade80` | 라이브 뱃지 밝은 초록 | `#16a34a` |
| `#444c56` | hover 테두리 다크 | `#c0bdb8` |
| `#1a1f2e` / `#21262d` | 플레이스홀더 다크 그라디언트 | `#e2e8f0` / `#f1f5f9` |

**오버라이드 작성 위치**: `style.css` 하단 `body.light-mode { ... }` 블록.

### inline SVG 색상 오버라이드 기법

SVG에 하드코딩된 `<linearGradient>` stop 색은 CSS로 직접 변경 불가.
→ 부모 요소에 CSS `filter` 적용으로 해결:

```css
/* 로고 불꽃: 상단 #ffe170(연노랑)이 흰 배경에서 안 보임 */
body.light-mode .logo-flame-sm {
  filter: brightness(0.78) saturate(1.5) drop-shadow(0 1px 3px rgba(0,0,0,0.18));
}
```

- `brightness(0.78)`: 연노랑 → 진한 황금빛으로 어둡게
- `saturate(1.5)`: 채도 높여 선명하게
- `drop-shadow(...)`: SVG 윤곽 구분선 (배경과 분리)

### 그라디언트 텍스트 오버라이드 (logo-wordmark)

`-webkit-background-clip: text` 계열은 `background` 재정의로 끝 색만 교체:
```css
body.light-mode .logo-wordmark {
  background: linear-gradient(160deg, #e94560 0%, #c97a14 60%, #d4831a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 라이트모드 추가 수정 시 체크리스트

새 UI 컴포넌트에 하드코딩 색이 있으면:
1. 다크모드에서만 잘 보이는 색인지 확인 (파스텔, 연노랑, 밝은 초록, 다크 hover)
2. `style.css` 하단 `body.light-mode` 블록에 선택자 추가
3. inline SVG라면 `filter` 기법 적용
