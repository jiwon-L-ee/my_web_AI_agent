# Design: 플랫폼-UX-전면개선

## 1. create 페이지 UX 개선

### 카테고리 탭 방식으로 교체

현재 `<select>` → 아이콘+텍스트 탭 버튼으로 교체:

```html
<div class="cat-tabs" id="catTabs">
  <button type="button" class="cat-tab active" data-cat="밸런스게임">
    <svg>...</svg> 밸런스게임
  </button>
  <button type="button" class="cat-tab" data-cat="퀴즈">
    <svg>...</svg> 퀴즈
  </button>
  <button type="button" class="cat-tab" data-cat="테스트">
    <svg>...</svg> 테스트
  </button>
  <button type="button" class="cat-tab" data-cat="커뮤니티">
    <svg>...</svg> 커뮤니티
  </button>
  <button type="button" class="cat-tab" data-cat="정보">
    <svg>...</svg> 정보
  </button>
</div>
<input type="hidden" id="categorySelect" value="밸런스게임">
```

### 레이아웃 개선

| 카테고리 | 레이아웃 |
|---------|---------|
| 밸런스게임 | 제목 → A선택지 / B선택지 (나란히) → 설명(선택) → 썸네일 |
| 퀴즈 | 제목 → 퀴즈유형 탭 → 문제 빌더 |
| 테스트 | 제목 → 모델URL → 설명 → 썸네일 |
| 커뮤니티 | 제목 → 내용(textarea 크게) → 이미지첨부(선택) |
| 정보 | 제목 → 내용(textarea 크게) → 썸네일(선택) |

**커뮤니티/정보**: `create-grid` 2컬럼 레이아웃 제거 → 단일 컬럼 심플 폼

### CSS 설계

```css
.cat-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.cat-tab {
  flex: 1;
  min-width: 80px;
  padding: 10px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface2);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: border-color 0.15s, color 0.15s;
}
.cat-tab.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(233,69,96,0.06);
}
```

---

## 2. 회원탈퇴

### mypage.html 추가

```html
<!-- 계정 설정 섹션 (하단) -->
<div class="account-settings">
  <div class="section-title">계정 설정</div>
  <div class="account-danger-zone">
    <div>
      <strong>회원탈퇴</strong>
      <p>탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
    </div>
    <button id="deleteAccountBtn" class="btn-danger">회원탈퇴</button>
  </div>
</div>

<!-- 탈퇴 확인 모달 -->
<div class="modal-overlay" id="deleteModal">
  <div class="modal-card">
    <h3>정말 탈퇴하시겠어요?</h3>
    <p>모든 게시물, 댓글, 투표 기록이 영구 삭제됩니다.</p>
    <input id="deleteConfirmInput" class="form-input" placeholder="'탈퇴합니다' 입력">
    <div class="modal-actions">
      <button id="cancelDeleteBtn" class="btn-cancel">취소</button>
      <button id="confirmDeleteBtn" class="btn-danger" disabled>탈퇴하기</button>
    </div>
  </div>
</div>
```

### mypage.js 탈퇴 로직

```js
// 회원탈퇴 — Supabase 이메일 계정: signOut 후 RPC로 삭제 요청
// Google 계정: 동일 처리 (admin 권한 없으므로 sign-out + 표시만)
async function deleteAccount() {
  // 1. 게시물 익명 처리 (user_id null로) — 선택적
  // 2. auth.signOut()
  // 3. 안내 메시지 후 index.html로 이동
  await db.auth.signOut();
  location.href = 'index.html';
}
```

---

## 3. 푸터 법적 문서 활성화

### 공통 법적 모달 스크립트 (`js/legal-modal.js`)

모든 페이지에서 재사용 가능한 독립 모듈:

```js
// legal-modal.js
(function() {
  // 모달 HTML 동적 삽입
  // openLegal(type) — 'terms' | 'privacy' | 'guidelines'
  // 푸터 링크 클릭 시 자동 연결
  window.openLegal = openLegal;
})();
```

### 푸터 링크 활성화 (모든 HTML 파일)

```html
<!-- 기존 -->
<li><a href="#" class="footer-link-todo">이용약관</a></li>

<!-- 변경 -->
<li><a href="#" data-legal="terms">이용약관</a></li>
<li><a href="#" data-legal="privacy">개인정보처리방침</a></li>
<li><a href="#" data-legal="guidelines">커뮤니티 가이드라인</a></li>
<li><a href="mailto:matbul@example.com">문의하기</a></li>
```

---

## 4. 다크/라이트모드 토글

### 네비게이션 버튼 추가

```html
<button id="themeToggle" class="btn-theme-toggle" aria-label="테마 전환">
  <svg id="themeIconDark"><!-- 달/별 아이콘 --></svg>
  <svg id="themeIconLight"><!-- 해 아이콘 --></svg>
</button>
```

### CSS 라이트모드 변수

```css
body.light-mode {
  --bg:       #f4f4f0;
  --surface:  #ffffff;
  --surface2: #f0eeeb;
  --border:   #e0ddd8;
  --text:     #1a1a1a;
  --text-muted: #666;
  /* accent/blue/orange는 동일 유지 */
}
```

### JS (공통 적용)

```js
// theme-toggle.js (inline 또는 공통 스크립트)
const saved = localStorage.getItem('matbul-theme');
if (saved === 'light') document.body.classList.add('light-mode');

document.getElementById('themeToggle').addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('matbul-theme', isLight ? 'light' : 'dark');
});
```

---

## 5. 로그인/회원가입 탭 명확화

URL 파라미터 지원 추가:
```js
// login.html 초기화 시
const tabParam = new URLSearchParams(location.search).get('tab');
if (tabParam === 'signup') activateTab('tab-signup');
else if (tabParam === 'login') activateTab('tab-login');
```

탭 2개로 단순화 (로그인 / 회원가입) — Google을 각 탭 하단으로 이동

---

## 구현 순서

1. `js/legal-modal.js` 신규 생성 + `legal/guidelines.txt` 작성
2. 전체 페이지 푸터 `footer-link-todo` 교체
3. `create.html` + `create.js` UX 개선
4. `mypage.html` + `mypage.js` 회원탈퇴
5. `css/style.css` 라이트모드 + 토글 버튼 스타일
6. 전 페이지 네비게이션에 테마 토글 버튼 추가
7. `login.html` 탭 구조 개선
