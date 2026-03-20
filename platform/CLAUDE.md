# platform/ CLAUDE.md

## 개요

**맞불** — 토론·밸런스게임·OX퀴즈 커뮤니티. 슬로건: "사소한 고집의 끝".
카테고리: 밸런스게임 / OX퀴즈 / 테스트 (이 순서 고정, 전 페이지 동일).
정적 HTML/CSS/JS + Supabase(Auth·DB·Storage) 구성.

## 주요 파일

- `infographic.html` — 맞불 소개 인트로 (첫 방문 시 표시, Black Han Sans 폰트, 불씨 캔버스 파티클)
- `js/supabase.js` — `window.db` (Supabase 클라이언트). 모든 페이지 JS의 전제조건
- `js/auth.js` — 공통 유틸 함수 정의: `getUser`, `requireAuth`, `initAuth`, `updateNavbar`, `escapeHtml`, `relativeTime`, `safeRedirectUrl`
- `js/home.js` — 카드 그리드 렌더링, 카테고리/정렬 필터, 페이지네이션, 모바일 셀렉트 연동. **밸런스게임 배너 카드** + 인기 카드(`.card-hot`) 감지
- `js/vote-modal.js` — **밸런스게임 투표 모달** (IIFE). `window.openVoteModal(postId)` 노출, `window.isHotPost(views, likes)` 노출. index.html에만 존재 — overlay 없으면 즉시 return
- `js/create.js` — 썸네일 파일 검증(MIME + 2MB), Storage 업로드, `toggleCategoryFields()`, posts INSERT
- `js/post.js` — 카테고리별 투표UI/TM플레이어 조건부 렌더링, 좋아요 토글, 댓글 CRUD + **댓글 좋아요** + **side 진영 뱃지** (이벤트 위임)
- `js/mypage.js` — 통계 집계 (Promise.all 패턴), 게시물 삭제 (이벤트 위임)
- `js/profile.js` — 팔로우/언팔로우 토글, 유저 게시물 그리드

## Supabase DB 스키마

```
profiles      (id uuid PK → auth.users, username, avatar_url, bio)
posts         (id, user_id→profiles, title, description, category CHECK, model_url, thumbnail_url, view_count, option_a, option_b)
likes         (id, user_id, post_id, UNIQUE(user_id,post_id))
comments      (id, user_id, post_id, content, side CHECK('A','B') nullable)   ← side: 투표 진영 태깅
comment_likes (id, user_id→profiles, comment_id→comments, UNIQUE(user_id,comment_id))  ← 2026-03-21 추가
follows       (follower_id, following_id, PK 복합)
votes         (id, user_id→profiles, post_id→posts, choice CHECK('A','B'), UNIQUE(user_id,post_id))
```

**인덱스**: posts(user_id, created_at desc, view_count desc), likes(post_id, user_id), comments(post_id), comments(post_id, side), comment_likes(comment_id), comment_likes(user_id), follows(following_id, follower_id), votes(post_id), votes(user_id)

**마이그레이션 파일**: `supabase/migrations/20260321_comment_likes.sql` — MCP로 적용 완료

## 패턴 & 규칙

### 스크립트 로드 순서 (필수)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/supabase.js"></script>
<script src="js/auth.js"></script>
<!-- index.html 전용: vote-modal.js가 home.js보다 반드시 먼저 -->
<script src="js/vote-modal.js"></script>  <!-- window.isHotPost, window.openVoteModal 노출 -->
<script src="js/home.js"></script>        <!-- window.isHotPost 사용 -->
<!-- 기타 페이지: -->
<script src="js/[페이지].js"></script>
```

### 인증 보호 페이지 패턴
```js
async function init() {
  currentUser = await requireAuth(); // 비로그인 시 login.html?next=... 로 자동 리다이렉트
  if (!currentUser) return;
  initAuth(); // navbar 업데이트
  ...
}
```

### XSS 방지
- `innerHTML` 삽입 시 항상 `escapeHtml()` 사용 (auth.js 정의)
- **class 속성 내 동적 값도 이스케이프 필수**: 텍스트 내용뿐 아니라 class 속성값도 이스케이프
  ```js
  // ❌ 취약 — class 속성에 escapeHtml 미적용
  `<span class="badge badge-${post.category}">`
  // ✅ 안전
  `<span class="badge badge-${escapeHtml(post.category)}">`
  ```
- inline onclick 금지 범위: **동적 삽입 버튼뿐 아니라 HTML 파일의 정적 버튼도 포함**
  ```html
  <!-- ❌ 금지 -->
  <button onclick="signOut()">로그아웃</button>
  <!-- ✅ 올바른 패턴: id 부여 후 JS에서 addEventListener -->
  <button id="signOutBtn">로그아웃</button>
  ```
- 동적 버튼의 이벤트는 `data-*` 속성 + 부모 요소 이벤트 위임

```js
// 올바른 패턴
grid.addEventListener('click', e => {
  const btn = e.target.closest('.btn-del-post');
  if (btn) deletePost(btn.dataset.id, btn);
});
```

### 오픈 리다이렉트 방지
```js
// login.html 에서 ?next= 처리 시
location.href = safeRedirectUrl(next, 'index.html'); // auth.js 정의
```

### Supabase count 쿼리 + Promise.all 패턴
```js
// 금지: Promise.all 내부에서 await 혼용
const results = await Promise.all([
  query1,
  .in('post_id', await getIds()), // ❌
]);

// 올바른 패턴
const ids = await getIds();
const results = await Promise.all([
  query1,
  ids.length ? query2.in('post_id', ids) : Promise.resolve({ count: 0 }), // ✅
]);
```

### 테스트 플레이어 (TM 모델 동적 로드)
```js
const url = modelUrl.endsWith('/') ? modelUrl : modelUrl + '/';
model = await window.tmImage.load(url + 'model.json', url + 'metadata.json');
```
CDN 로드 순서 **필수** — TF.js를 먼저 로드해야 TM 라이브러리가 동작함:
```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js"></script>
```
TF.js 누락 시 증상: "분석 중 오류가 발생했습니다. 모델 URL을 확인해주세요." alert 표시

### 모바일 카테고리 필터
- 데스크탑: `.nav-cats` (a 태그 링크)
- 모바일(768px↓): `#catSelectMobile` (select → URL 이동)
- `home.js`에서 두 방식 모두 `currentCategory` 변수와 동기화

## 주의사항

- **file:// 프로토콜 불가**: Google OAuth가 작동하지 않음. 반드시 로컬 서버(python -m http.server 등) 사용
- **login.html setupNotice**: Google OAuth 미설정 시 안내 배너 표시. 설정 완료 후 `#setupNotice` div 제거
- **post.html 댓글 폼**: `setupCommentForm()` 인라인 스크립트가 async로 DOM 삽입 → post.js의 이벤트 리스너는 `commentFormArea`(정적 요소)에 위임
- **썸네일 업로드 경로**: `{user_id}/{timestamp}.{ext}` — Storage DELETE 정책이 첫 폴더명으로 소유자 확인
- **에러 메시지**: 사용자에게는 일반 메시지, 기술 상세는 `console.error`만 사용
- **async init() 내 이벤트 리스너 주의**: UI 반응성이 필요한 리스너(카테고리 토글 등)를 `async init()` 안에 두면 auth 완료 전까지 반응 못 함 → IIFE로 분리해 즉시 실행
  ```js
  // ❌ async init() 안에 두면 auth 지연 동안 무반응
  // ✅ 즉시 실행
  (function() {
    document.getElementById('categorySelect').addEventListener('change', toggle);
    toggle();
  })();
  ```
- **카테고리별 조건부 필드**: create.js에서 카테고리 = "테스트"일 때만 model_url 필드 표시·required. 나머지는 `model_url = null`로 저장

## UI 패턴

- **폰트**: Pretendard Variable (CDN `@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css')`)
- **infographic.html 전용**: `Black Han Sans` (Google Fonts) — display용. "불" 같이 획이 복잡한 한글은 이 폰트에서 너무 두꺼워 보일 수 있음 → 해당 섹션은 `font-family: var(--font); font-weight: 800` 으로 대체
- **네브바 로고**: 인라인 SVG 불꽃 + `.logo-wordmark` 그라디언트 텍스트 (이미지 파일 미사용)
  - SVG viewBox `0 0 18 24`, 경로: `M9 23C4 21 1 15 3 9C4.5 5 7 2 7 0C9 3 9 7 8 10C10 7 12 3 11 1C15 5 16 13 14 17C13 20 11 23 9 23Z`
  - gradient ID: navbar = `lgNav`, login 카드 = `lgCard`, 인트로 오버레이 = `lgIntro` (같은 페이지 내 중복 ID 방지)
  - **SVG 크기는 CSS로 제어** (`width: 24px; height: 32px`) — HTML 속성 수정 없이 모든 페이지에 일괄 적용
  - **flicker 애니메이션**: `navFlicker` keyframes — scaleX/scaleY/rotate 조합, `transform-origin: 50% 100%` (불꽃 아래 고정)
  - **glow**: `filter: drop-shadow(0 0 5px rgba(249,115,22,0.7)) drop-shadow(0 0 10px rgba(233,69,96,0.35))`
  - **hover**: glow 3배 강화 + `animation-duration: 1.4s` (빠른 흔들림), `transition: filter 0.25s ease`
- **세션스토리지 키 두 종류**:
  - `introSeen` — platform/index.html 인트로 오버레이 (로딩바 애니메이션) 스킵용
  - `matbulIntroSeen` — 루트 → infographic.html 첫 방문 인트로 스킵용
  - QA 재확인: `http://localhost:8080/?reset` 으로 `matbulIntroSeen` 초기화
- **직접 URL 접근 우회 방지**: `platform/index.html` 맨 위(DOCTYPE 이전)에 sessionStorage 체크 삽입
  ```html
  <!DOCTYPE html>
  <script>
    if (!sessionStorage.getItem('matbulIntroSeen')) { location.replace('infographic.html'); }
  </script>
  <html lang="ko">
  ```

### 카테고리별 조건부 렌더링 (post.js)

```js
const isVote = ['밸런스게임', 'OX퀴즈'].includes(p.category);
document.getElementById('voteSection').style.display = isVote ? '' : 'none';
document.getElementById('playerSection').style.display = isVote ? 'none' : '';
if (isVote) { await loadVotes(postId); renderVoteUI(p); }
else { setupPlayer(p.model_url); }
```

### 카테고리별 입력 필드 (create.js)

```js
function toggleCategoryFields() {
  const cat = categorySelect.value;
  // 테스트: modelUrlGroup 표시, optionA/B 숨김
  // 밸런스게임: optionA/B 표시 (라벨 "A 선택지"/"B 선택지"), modelUrl 숨김
  // OX퀴즈: optionA/B 표시 (라벨 "O 주장"/"X 주장"), modelUrl 숨김
}
```

### 투표 토글 패턴 (post.js toggleVote / vote-modal.js handleVote)

- 비로그인 → `login.html?next=...` 리다이렉트
- 같은 선택 재클릭 → DELETE (취소)
- 다른 선택 변경 → UPDATE
- 신규 투표 → INSERT
- **중복 클릭 방지**: `isVoting` 플래그로 async 중 재진입 차단 (post.js, vote-modal.js 모두 적용)
- **댓글 삭제**: 반드시 `.eq('user_id', currentUser.id)` 포함 (RLS + 클라이언트 이중 방어)

### 밸런스게임 카드 패턴 (home.js)

- 카테고리 `밸런스게임`만 배너 카드(`card-balance`) 렌더링 — 그리드 전체 너비(`grid-column: 1/-1`)
- OX퀴즈·테스트는 기존 `.card` 스타일 유지
- 클릭 시 `post.html` 이동 **없이** 투표 모달 열림 (`<div data-id="...">` + 이벤트 위임)
- **isHot 파생**: `renderBalanceCard(post, voteCount, hotClass)` 내부에서 `const isHot = hotClass !== ''` 재계산 (클로저 스코프 참조 금지)
- 인기 임계값: `view_count >= 100 || likes >= 15` → `.card-hot` 클래스 (CSS `box-shadow` 애니메이션)

### 댓글 진영(side) 태깅 패턴 (post.js)

```js
// submitComment — 투표 후 댓글 작성 시 자동 태깅
const side = (['밸런스게임', 'OX퀴즈'].includes(post?.category) && userVote)
  ? userVote  // 'A' | 'B'
  : null;     // 미투표 또는 테스트 카테고리
const insertData = { user_id, post_id, content };
if (side) insertData.side = side;
```

### 댓글 좋아요 패턴 (post.js)

- `loadComments()` → `comment_likes(count)` 포함 조회 + 유저 좋아요 목록 별도 IN 쿼리 (N+1 방지)
- 이벤트 위임: `#commentList` → `.comment-like-btn` 클릭
- 좋아요 취소: `.delete().eq('comment_id', id).eq('user_id', currentUser.id)` (RLS + 클라이언트)
- `btn.innerHTML` 변경 후 `data-comment-id` 속성은 유지됨 (element 속성 ≠ innerHTML)

### 모달 HTML 위치 (index.html)

투표 모달 `#voteModal`은 `<div class="page">` 이후, `<script>` 태그 이전에 배치:
```html
<div class="page">...</div>
<!-- ── Vote Modal ── -->
<div class="vm-overlay hidden" id="voteModal" role="dialog" aria-modal="true" ...>
  ...
</div>
<script src="...supabase..."></script>
<script src="js/vote-modal.js"></script>
<script src="js/home.js"></script>
```

### 트러블슈팅

- **구현이 화면에 안 보임**: `file://` 프로토콜 사용 시 OAuth 불가 + 일부 JS 미작동 → 반드시 `python -m http.server 8080` 후 `http://localhost:8080/` 접속
- **강제 새로고침**: `Ctrl+Shift+R` (브라우저 캐시 무시)
- **votes(count) 쿼리**: `posts` 테이블 join시 `votes(count)` 집계는 PostgREST v10+ 필요. 에러 시 별도 count 쿼리로 분리

## 에이전트 검토 이력

**2026-03-19 (1차)**: planner / design / database / backend / frontend / qa 6개 에이전트 코드 검토 및 수정.
주요 수정: 오픈 리다이렉트, N+1 쿼리, inline onclick XSS, 모바일 필터 누락, DB 인덱스, 에러 메시지 노출.

**2026-03-19 (2차 QA 재검증)**: /qa → /orchestrate → QA PASS.
추가 수정: badge CSS class 속성 escapeHtml 누락(`home/post/mypage/profile.js`), `mypage.html` 정적 버튼 inline onclick 제거.

**2026-03-20 (리디자인)**: 토론·밸런스게임 커뮤니티로 전환.
주요 변경: 슬로건·카테고리 순서, votes 테이블 추가, A/B 투표 UI, infographic.html 인트로, SVG 로고.

**2026-03-20 (밸런스게임 UI + 투표 모달)**: 밸런스게임 배너 카드·투표 모달·댓글 좋아요 구현.
주요 변경: comment_likes 테이블 + comments.side 컬럼 추가(MCP 적용), vote-modal.js 신규, home.js 배너 카드·isHotPost, post.js 댓글 side 태깅·좋아요, style.css 대규모 스타일 추가.
주요 버그픽스: isHot ReferenceError(renderBalanceCard 내 재파생), overflow:hidden + ::before 충돌(box-shadow로 대체), isVoting race condition(모달 재오픈 시 초기화), 댓글 삭제 user_id 필터 누락.
검증 결과: index.html에 투표 모달 HTML(83~143줄) + vote-modal.js(148줄) 올바르게 적용 확인.
