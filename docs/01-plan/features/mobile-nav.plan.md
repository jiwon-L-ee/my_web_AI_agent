## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | mobile-nav |
| 시작일 | 2026-03-29 |

### 4-Perspective Value

| 관점 | 내용 |
|------|------|
| Problem | 모바일에서 네비게이션이 `<select>` 드롭다운으로 구현되어 UX가 불편하고 랭킹 탭이 누락됨 |
| Solution | 햄버거 버튼 + 좌측 슬라이드 사이드 드로어로 교체, 스와이프 제스처 지원 |
| Function UX Effect | 탭 전환이 직관적인 터치 UI로 개선되고, 모든 카테고리(랭킹 포함) 접근 가능 |
| Core Value | 모바일 사용자 경험 품질 향상 → 이탈률 감소 및 카테고리 탐색 증가 |

---

# mobile-nav Plan

## 1. 기능 개요

모바일(768px 이하) 환경에서 현재 `<select>` 드롭다운으로 구현된 카테고리 네비게이션을 슬라이드 사이드 드로어로 교체한다.

### 현재 문제점
- `<select>` 드롭다운: 브라우저 기본 UI로 통일성 없고 UX 불편
- 랭킹 탭이 모바일 select에 누락됨
- 카테고리가 5개인데 dropdown 선택 방식은 현재 활성 탭을 파악하기 어려움
- `cat-select-mobile`이 모든 페이지(index.html 외 post.html 등)에도 있는지 확인 필요

### 해결 방향
- 햄버거 버튼 (☰) → 좌측에서 슬라이드로 열리는 사이드 드로어
- 드로어 내부: 홈 / 토론 / 퀴즈 / 커뮤니티 / 랭킹 (현재 활성 탭 강조)
- 왼쪽 가장자리에서 오른쪽으로 스와이프하면 열림 (touch gesture)
- 드로어 외부 클릭 또는 닫기 버튼으로 닫힘
- 오버레이(dimmed background) 추가

## 2. 영향 범위

### 수정 대상 파일
| 파일 | 역할 | 수정 내용 |
|------|------|---------|
| `platform/css/style.css` | 전역 스타일 | 사이드 드로어 CSS, 햄버거 버튼, 오버레이 |
| `platform/index.html` | 홈 | nav에 햄버거 버튼 + 드로어 HTML 추가, select 제거 |
| `platform/post.html` | 게시물 상세 | 동일 |
| `platform/mypage.html` | 마이페이지 | 동일 |
| `platform/profile.html` | 프로필 | 동일 |
| `platform/create.html` | 글 작성 | 동일 |
| `platform/ranking.html` | 랭킹 | 동일 |
| `platform/quiz.html` | 퀴즈 | 동일 |
| `platform/test.html` | 테스트 | 동일 |
| `platform/community-edit.html` | 커뮤니티 수정 | 동일 |
| `platform/js/home.js` | 홈 JS | catSelectMobile 이벤트 → 드로어 링크로 교체 |

### 수정 불필요
- `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html`, `signup-profile.html`: 네비게이션 없음
- `infographic.html`: 별도 소개 페이지

## 3. 구현 상세

### 3-1. HTML 구조 (모든 nav에 추가)

```html
<!-- 햄버거 버튼 (모바일에서만 표시) -->
<button class="btn-hamburger" id="hamburgerBtn" aria-label="메뉴 열기" aria-expanded="false">
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="3" y1="5" x2="17" y2="5"/>
    <line x1="3" y1="10" x2="17" y2="10"/>
    <line x1="3" y1="15" x2="17" y2="15"/>
  </svg>
</button>

<!-- 오버레이 -->
<div class="nav-overlay" id="navOverlay"></div>

<!-- 사이드 드로어 -->
<div class="nav-drawer" id="navDrawer" aria-hidden="true">
  <div class="nav-drawer-header">
    <a href="index.html" class="nav-drawer-logo">
      <!-- 로고 -->
      맞불
    </a>
    <button class="btn-drawer-close" id="drawerCloseBtn" aria-label="메뉴 닫기">✕</button>
  </div>
  <nav class="nav-drawer-links">
    <a href="index.html" class="nav-drawer-link" data-cat="밸런스게임">🏠 홈</a>
    <a href="index.html?cat=토론" class="nav-drawer-link" data-cat="토론">⚔ 토론</a>
    <a href="index.html?cat=퀴즈" class="nav-drawer-link" data-cat="퀴즈">🧩 퀴즈</a>
    <a href="index.html?cat=커뮤니티" class="nav-drawer-link" data-cat="커뮤니티">💬 커뮤니티</a>
    <a href="ranking.html" class="nav-drawer-link">🏆 랭킹</a>
  </nav>
</div>
```

> 아이콘: SVG inline 사용 (이모지 위 예시는 실제 구현 시 SVG로 대체)

### 3-2. CSS

```css
/* 햄버거 버튼 */
.btn-hamburger {
  display: none; /* 데스크탑에서 숨김 */
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

/* 오버레이 */
.nav-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  opacity: 0;
  transition: opacity 0.25s;
}
.nav-overlay.open { display: block; opacity: 1; }

/* 사이드 드로어 */
.nav-drawer {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 260px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  z-index: 201;
  transform: translateX(-100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.nav-drawer.open { transform: translateX(0); }

.nav-drawer-link { display: block; padding: 14px 20px; ... }
.nav-drawer-link.active { color: var(--accent); background: rgba(233,69,96,0.08); }

/* 모바일에서만 햄버거 표시, select 숨김 */
@media (max-width: 768px) {
  .btn-hamburger { display: flex; }
  .nav-center { display: none !important; }
  .cat-select-mobile { display: none !important; }
}
```

### 3-3. JavaScript (공통 로직 — auth.js 하단 또는 nav.js 별도)

```js
// 드로어 열기/닫기
function initDrawer() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const navDrawer = document.getElementById('navDrawer');
  const navOverlay = document.getElementById('navOverlay');
  if (!hamburgerBtn || !navDrawer) return;

  function openDrawer() {
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    navDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // 스크롤 잠금
  }
  function closeDrawer() {
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn?.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);

  // 스와이프 제스처 (왼쪽 가장자리 → 오른쪽)
  let touchStartX = 0;
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (touchStartX < 30 && dx > 60) openDrawer();  // 왼쪽 가장자리에서 스와이프
    if (navDrawer.classList.contains('open') && dx < -60) closeDrawer(); // 드로어 열린 상태에서 좌 스와이프
  }, { passive: true });
}
```

### 3-4. 현재 활성 탭 강조

각 페이지에서 드로어 링크에 `active` 클래스 추가:
```js
// home.js에서 현재 cat에 맞는 드로어 링크 active 처리
const drawerLinks = document.querySelectorAll('.nav-drawer-link[data-cat]');
drawerLinks.forEach(a => {
  if (a.dataset.cat === currentCat) a.classList.add('active');
});
// ranking.html에서는 ranking 링크에 active
```

## 4. 구현 순서

1. `style.css` — 드로어/오버레이/햄버거 CSS 추가, 모바일 select 숨김
2. `auth.js` 하단 — `initDrawer()` 함수 추가 (모든 페이지 공통)
3. `index.html` — nav에 햄버거 버튼 + 드로어 HTML 추가, select 제거, home.js active 처리
4. 나머지 HTML 파일 9개 — 동일한 nav 수정

## 5. 제약 조건

- 드로어 JS는 `auth.js`에 추가하거나 `nav.js` 별도 파일로 분리 (모든 페이지 로드 필요)
- `auth.js` 하단에 추가 시 스크립트 로드 순서 변경 불필요
- 기존 `catSelectMobile` change 이벤트 핸들러(home.js) 제거 필요
- 아이콘: 이모지 금지, inline SVG 사용

## 6. 완료 기준

- [ ] 모바일(768px 이하)에서 햄버거 버튼 표시, select 미표시
- [ ] 햄버거 클릭 시 좌측에서 드로어 슬라이드 인
- [ ] 왼쪽 가장자리 스와이프로 드로어 열림
- [ ] 드로어 내 모든 탭(홈/토론/퀴즈/커뮤니티/랭킹) 표시
- [ ] 현재 페이지/탭이 드로어에서 강조 표시
- [ ] 오버레이 클릭 또는 닫기 버튼으로 드로어 닫힘
- [ ] 드로어 열린 상태에서 바디 스크롤 잠금
- [ ] 데스크탑(769px 이상)에서 드로어 미표시, 기존 nav-center 유지
