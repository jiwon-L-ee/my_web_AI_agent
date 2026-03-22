# 코딩 패턴 & 보안 규칙

## 스크립트 로드 순서 (필수)

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/supabase.js"></script>   <!-- window.db 정의 -->
<script src="js/auth.js"></script>       <!-- getUser, escapeHtml 등 정의 -->

<!-- index.html 전용: vote-modal.js 반드시 home.js 이전 -->
<script src="js/vote-modal.js"></script> <!-- window.openVoteModal, window.isHotPost 노출 -->
<script src="js/home.js"></script>       <!-- window.isHotPost 사용 -->

<!-- 기타 페이지 -->
<script src="js/[페이지].js"></script>
```

테스트 플레이어가 있는 페이지(post.html)는 TF.js를 supabase.js **이전**에 로드:
```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js"></script>
```
TF.js 누락 시: "분석 중 오류가 발생했습니다" alert 표시.

## XSS 방지

`innerHTML` 삽입 시 **항상** `escapeHtml()` 사용 — 텍스트뿐 아니라 class 속성값도 포함:

```js
// ❌ 취약
`<span class="badge badge-${post.category}">`

// ✅ 안전
`<span class="badge badge-${escapeHtml(post.category)}">`
```

## 이벤트 처리

inline `onclick` 금지 — 동적 삽입 요소뿐 아니라 HTML 정적 버튼도 포함:

```html
<!-- ❌ 금지 -->
<button onclick="signOut()">로그아웃</button>

<!-- ✅ JS에서 addEventListener -->
<button id="signOutBtn">로그아웃</button>
```

동적 삽입 버튼은 `data-*` 속성 + 부모 이벤트 위임:

```js
grid.addEventListener('click', e => {
  const btn = e.target.closest('.btn-del-post');
  if (btn) deletePost(btn.dataset.id, btn);
});
```

## 오픈 리다이렉트 방지

```js
// login.html에서 ?next= 처리 시 반드시 safeRedirectUrl() 경유
location.href = safeRedirectUrl(next, 'index.html'); // auth.js 정의
```

## 인증 보호 페이지 패턴

```js
async function init() {
  currentUser = await requireAuth(); // 비로그인 → login.html?next=... 자동 리다이렉트
  if (!currentUser) return;
  initAuth(); // navbar 업데이트
  // ...
}
```

## async init() 내 이벤트 리스너 주의

UI 반응성이 필요한 리스너를 `async init()` 안에 두면 auth 완료 전까지 무반응:

```js
// ❌ auth 지연 동안 카테고리 토글 안 됨
async function init() {
  await requireAuth();
  document.getElementById('categorySelect').addEventListener('change', toggle);
}

// ✅ IIFE로 즉시 실행
(function () {
  document.getElementById('categorySelect').addEventListener('change', toggle);
  toggle();
})();
```

## 카테고리별 조건부 렌더링

**post.js** — 뷰 전환:
```js
const isVote = ['밸런스게임', 'OX퀴즈'].includes(p.category);
document.getElementById('voteSection').style.display = isVote ? '' : 'none';
document.getElementById('playerSection').style.display = isVote ? 'none' : '';
if (isVote) { await loadVotes(postId); renderVoteUI(p); }
else         { setupPlayer(p.model_url); }
```

**create.js** — 입력 필드 전환:
```js
function toggleCategoryFields() {
  const cat = categorySelect.value;
  // 테스트:    modelUrlGroup 표시, optionA/B 숨김
  // 밸런스게임: optionA/B 표시 (라벨 "A 선택지"/"B 선택지"), modelUrl 숨김
  // OX퀴즈:   optionA/B 표시 (라벨 "O 주장"/"X 주장"), modelUrl 숨김
}
```
카테고리 ≠ "테스트" → `model_url = null` 저장.

## 테스트 플레이어 (TM 모델 로드)

```js
const url = modelUrl.endsWith('/') ? modelUrl : modelUrl + '/';
model = await window.tmImage.load(url + 'model.json', url + 'metadata.json');
```

## 댓글 textarea Enter 키

Enter = 제출, Shift+Enter = 줄바꿈. 이벤트 위임으로 등록:

```js
formArea.addEventListener('keydown', e => {
  if (e.target.id === 'commentInput' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitComment();
  }
});
```

placeholder도 "(Enter로 제출, Shift+Enter로 줄바꿈)"으로 통일.

## 이모지 금지 범위

카드 아이콘뿐 아니라 **모달 버튼, 인터랙티브 UI 요소 전반에도 이모지 사용 금지**.
텍스트만 사용하고 필요한 경우 inline SVG 또는 CSS로 대체:

```html
<!-- ❌ -->
<button>🤔 스스로 생각이 바뀌었어요</button>

<!-- ✅ -->
<button>스스로 생각이 바뀌었어요</button>
```

예외: 진영 표시 배지 내 🔵 🟠 는 허용 (단, 점진적 SVG 대체 예정).

## 트러블슈팅

| 증상 | 원인 & 해결 |
|------|-------------|
| 화면에 아무것도 안 보임 | `file://` 프로토콜 → `python -m http.server 8080` 사용 |
| OAuth 로그인 안 됨 | 동일. 반드시 `http://localhost:8080/` 접속 |
| 캐시된 구버전 표시 | `Ctrl+Shift+R` (강제 새로고침) |
| 댓글 폼 이벤트 미작동 | `setupCommentForm()`이 async → `commentFormArea`(정적 요소)에 위임 |
| votes(count) 에러 | PostgREST v10+ 필요. 에러 시 별도 count 쿼리 분리 |
| TM 분석 오류 alert | TF.js CDN 누락 — supabase.js 이전에 로드 |
