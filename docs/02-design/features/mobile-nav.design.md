# mobile-nav Design

> Plan 참조: `docs/01-plan/features/mobile-nav.plan.md`

---

## 1. 전체 구조

### 1-1. 컴포넌트 구성

```
[Navbar]
  ├── nav-logo (좌)
  ├── nav-center (데스크탑만, 중앙 absolute)
  ├── nav-auth (우, margin-left: auto)
  ├── btn-theme-toggle (우)
  └── btn-hamburger (모바일만, nav-auth 왼쪽)

[드로어 시스템 — <body> 최상위]
  ├── nav-overlay (반투명 오버레이)
  └── nav-drawer (슬라이드 패널)
        ├── nav-drawer-header
        │     ├── 로고 (불꽃 SVG + "맞불")
        │     └── btn-drawer-close (X 버튼)
        ├── nav-drawer-nav (메뉴 링크 5개)
        └── nav-drawer-footer (테마 토글)
```

### 1-2. 반응형 동작

| 화면 | nav-center | cat-select-mobile | btn-hamburger | nav-drawer |
|------|-----------|------------------|--------------|-----------|
| ≥ 769px | 표시 | 숨김 | 숨김 | 비활성 (z-index 무관) |
| ≤ 768px | 숨김 | **제거** (HTML 삭제) | **표시** | 슬라이드 인/아웃 |

---

## 2. UI 디자인 상세

### 2-1. 햄버거 버튼 `.btn-hamburger`

**위치**: `nav-auth` div 바로 앞 (로고 ↔ auth 사이 공간)

```
[🔥맞불]  ···  [🔔 👤]  [☀]  [☰]
```

> 모바일에서 오른쪽에서 두 번째 위치. auth(🔔👤) → theme(☀) → hamburger(☰) 순서.
> 실제 nav-inner 순서: logo | nav-center | nav-auth | theme | **hamburger**

**시각 디자인:**
- 크기: 36×36px 터치 영역, 아이콘 자체는 20×20px
- 배경: none (기본), hover시 `var(--surface2)` 배경
- 테두리 없음, `border-radius: 8px`
- 색상: `var(--text-muted)` → hover `var(--text)`

**아이콘 — 3-line to X 모핑 애니메이션:**
```
기본 상태 (☰)    열린 상태 (✕)
━━━━━━━         ╲     ╱
━━━━━━━    →      ╲╱
━━━━━━━         ╱╲
```
CSS transform으로 top/bottom 라인 rotate, middle 라인 fade out.

```css
.btn-hamburger .bar { transition: transform 0.25s ease, opacity 0.25s; }
.btn-hamburger.open .bar-top    { transform: translateY(5px) rotate(45deg); }
.btn-hamburger.open .bar-mid    { opacity: 0; transform: scaleX(0); }
.btn-hamburger.open .bar-bottom { transform: translateY(-5px) rotate(-45deg); }
```

SVG 구조:
```html
<svg width="20" height="15" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <line class="bar bar-top"    x1="0" y1="1.5"  x2="20" y2="1.5"/>
  <line class="bar bar-mid"    x1="0" y1="7.5"  x2="20" y2="7.5"/>
  <line class="bar bar-bottom" x1="0" y1="13.5" x2="20" y2="13.5"/>
</svg>
```

---

### 2-2. 오버레이 `.nav-overlay`

- `position: fixed; inset: 0; z-index: 200`
- `background: rgba(0, 0, 0, 0.55)`
- 기본: `visibility: hidden; opacity: 0`
- 열릴 때: `visibility: visible; opacity: 1`
- transition: `opacity 0.25s ease, visibility 0.25s`

> `display: none` 대신 `visibility: hidden` 사용 → transition이 부드럽게 작동

---

### 2-3. 사이드 드로어 `.nav-drawer`

**크기 & 위치:**
- `position: fixed; top: 0; left: 0; bottom: 0`
- `width: 272px` (모바일 기준 화면의 ~72%)
- `z-index: 201`
- `transform: translateX(-100%)` (기본) → `.open { transform: translateX(0) }`
- `transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)` (Material Design easing)

**배경 & 테두리:**
- `background: var(--surface)` (`#161b22`)
- `border-right: 1px solid var(--border)`
- 우측 상단 모서리에 매우 미묘한 glow: `box-shadow: 4px 0 24px rgba(0,0,0,0.5)`

---

### 2-4. 드로어 헤더 `.nav-drawer-header`

```
┌──────────────────────────────────┐
│  🔥 맞불                      [✕] │
│  ─────────────────────────────── │  ← 구분선
```

- `height: 64px` (navbar 높이와 일치 → 시각적 연속성)
- `padding: 0 16px`
- `display: flex; align-items: center; justify-content: space-between`
- 하단 구분선: `border-bottom: 1px solid var(--border)`

**드로어 로고:**
- 불꽃 SVG (navbar와 동일한 `lgNav` gradient) + "맞불" 텍스트
- `font-size: 1.2rem; font-weight: 900; letter-spacing: -0.04em`
- gradient 텍스트 (`#e94560` → `#f5a623`)

**닫기 버튼 `.btn-drawer-close`:**
- 28×28px 터치 영역
- X 아이콘 SVG (stroke, 14×14px)
- `color: var(--text-muted)` → hover `var(--text)`
- `background: none; border: none; border-radius: 6px`

---

### 2-5. 네비게이션 링크 `.nav-drawer-link`

```
┌──────────────────────────────────┐
│                                  │
│  [아이콘]  홈                     │  ← 기본
│  [아이콘]  토론                   │
│  [아이콘]  퀴즈                   │
│  [아이콘]  커뮤니티               │
│  [아이콘]  랭킹                   │
│                                  │
```

**각 링크 스타일:**
- `display: flex; align-items: center; gap: 14px`
- `padding: 14px 20px`
- `font-size: 0.95rem; font-weight: 500`
- `color: var(--text-muted)`
- `border-radius: 0` (full-width)
- `transition: background 0.15s, color 0.15s`

**Hover 상태:**
- `background: var(--surface2)` (`#21262d`)
- `color: var(--text)`

**Active 상태 (현재 탭):**
- `color: var(--accent)` (`#e94560`)
- `background: rgba(233, 69, 96, 0.08)`
- 왼쪽 강조 바: `border-left: 3px solid var(--accent)` → padding-left 3px 보정
- 아이콘 색상도 `var(--accent)`

**비활성 기본:**
- `border-left: 3px solid transparent` (공간 확보로 active 시 레이아웃 흔들림 방지)

**아이콘 SVG (20×20px, stroke 기반):**

| 탭 | 아이콘 설명 | SVG 패턴 |
|----|-----------|---------|
| 홈 | 집 실루엣 | `<path d="M3 9l9-7 9 7v11..."/>` |
| 토론 | 교차하는 말풍선 2개 | `<path d="M21 15a2 2..."/>` |
| 퀴즈 | 물음표 원형 | `<circle>` + `?` path |
| 커뮤니티 | 사람 2명 | `<path d="M17 21v-2a4 4..."/>` |
| 랭킹 | 트로피 | `<path d="M8 21l4-7 4 7M12 ..."/>` |

---

### 2-6. 드로어 푸터 `.nav-drawer-footer`

```
│  ─────────────────────────────── │  ← 상단 구분선
│  [☀/🌙]  다크 / 라이트 모드      │
└──────────────────────────────────┘
```

- 드로어 하단 고정: `margin-top: auto`
- `padding: 16px 20px`
- `border-top: 1px solid var(--border)`
- 테마 토글 버튼 재사용 (`btn-theme-toggle` 복사)
  - 텍스트 레이블 "다크 모드" / "라이트 모드" 추가
  - `display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 0`

---

## 3. 인터랙션 설계

### 3-1. 열기 트리거

| 트리거 | 조건 | 동작 |
|--------|------|------|
| 햄버거 버튼 클릭 | 항상 | 드로어 열림 |
| 왼쪽 가장자리 스와이프 → | `touchStartX < 30px && dx > 60px` | 드로어 열림 |

### 3-2. 닫기 트리거

| 트리거 | 조건 | 동작 |
|--------|------|------|
| 오버레이 클릭 | 드로어 열린 상태 | 드로어 닫힘 |
| 닫기 버튼(X) 클릭 | 드로어 열린 상태 | 드로어 닫힘 |
| 스와이프 ← (드로어 위에서) | `dx < -60px` | 드로어 닫힘 |
| Escape 키 | 드로어 열린 상태 | 드로어 닫힘 |
| 링크 클릭 | 드로어 열린 상태 | 페이지 이동 (자동 닫힘) |

### 3-3. 스크롤 잠금

드로어 열릴 때: `document.body.style.overflow = 'hidden'`
드로어 닫힐 때: `document.body.style.overflow = ''`

### 3-4. 애니메이션 타이밍

```
열기: 드로어 slide-in 0.28s ease + 오버레이 fade-in 0.25s ease (동시)
닫기: 드로어 slide-out 0.25s ease + 오버레이 fade-out 0.2s ease (동시)
```

---

## 4. Active 탭 감지 로직

### 4-1. index.html (home.js)

```js
function updateDrawerActive(cat) {
  document.querySelectorAll('.nav-drawer-link[data-cat]').forEach(a => {
    a.classList.toggle('active', a.dataset.cat === cat);
  });
}
// 기존 switchTab() 혹은 currentCat 업데이트 시 함께 호출
```

### 4-2. ranking.html (ranking.js)

```js
// 드로어에서 랭킹 링크 active
document.querySelector('.nav-drawer-link[data-page="ranking"]')?.classList.add('active');
```

### 4-3. 기타 페이지 (post.html, mypage.html 등)

URL 기반 자동 감지를 `initDrawer()` 내에서 처리:
```js
function setDrawerActiveByUrl() {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');

  document.querySelectorAll('.nav-drawer-link').forEach(a => {
    a.classList.remove('active');
  });

  if (path.includes('ranking.html')) {
    document.querySelector('.nav-drawer-link[data-page="ranking"]')?.classList.add('active');
  } else if (path.includes('index.html') || path.endsWith('/platform/') || path.endsWith('/platform')) {
    const activeCat = cat || '밸런스게임';
    document.querySelector(`.nav-drawer-link[data-cat="${activeCat}"]`)?.classList.add('active');
  }
  // post.html, mypage.html 등은 active 탭 없음 (정상)
}
```

---

## 5. HTML 구조 (구체적 마크업)

### 5-1. nav 내 햄버거 버튼 위치

```html
<nav class="navbar">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">...</a>
    <div class="nav-center">...</div>       <!-- 데스크탑 전용 -->
    <div class="nav-auth" id="navAuth">...</div>
    <button class="btn-theme-toggle" id="themeToggle" ...>...</button>
    <!-- 모바일 햄버거 — 기존 cat-select-mobile 대체 -->
    <button class="btn-hamburger" id="hamburgerBtn" aria-label="메뉴 열기" aria-expanded="false">
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line class="bar bar-top"    x1="0" y1="1.5"  x2="20" y2="1.5"/>
        <line class="bar bar-mid"    x1="0" y1="7.5"  x2="20" y2="7.5"/>
        <line class="bar bar-bottom" x1="0" y1="13.5" x2="20" y2="13.5"/>
      </svg>
    </button>
  </div>
</nav>
```

### 5-2. 드로어 시스템 (</body> 직전)

```html
<!-- 오버레이 -->
<div class="nav-overlay" id="navOverlay"></div>

<!-- 사이드 드로어 -->
<nav class="nav-drawer" id="navDrawer" aria-label="사이트 내비게이션" aria-hidden="true">
  <!-- 헤더 -->
  <div class="nav-drawer-header">
    <a href="index.html" class="nav-drawer-logo">
      <svg class="logo-flame-sm" width="16" height="22" viewBox="0 0 18 24" fill="none" aria-hidden="true">
        <defs><linearGradient id="lgDrawer" x1="9" y1="24" x2="9" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#e94560"/><stop offset="55%" stop-color="#f5a623"/><stop offset="100%" stop-color="#ffe170"/>
        </linearGradient></defs>
        <path d="M9 23C4 21 1 15 3 9C4.5 5 7 2 7 0C9 3 9 7 8 10C10 7 12 3 11 1C15 5 16 13 14 17C13 20 11 23 9 23Z" fill="url(#lgDrawer)"/>
      </svg>
      <span class="nav-drawer-logo-text">맞불</span>
    </a>
    <button class="btn-drawer-close" id="drawerCloseBtn" aria-label="메뉴 닫기">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
      </svg>
    </button>
  </div>

  <!-- 네비게이션 링크 -->
  <div class="nav-drawer-links">
    <a href="index.html" class="nav-drawer-link" data-cat="밸런스게임" data-page="home">
      <svg class="drawer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span>홈</span>
    </a>
    <a href="index.html?cat=토론" class="nav-drawer-link" data-cat="토론" data-page="debate">
      <svg class="drawer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span>토론</span>
    </a>
    <a href="index.html?cat=퀴즈" class="nav-drawer-link" data-cat="퀴즈" data-page="quiz">
      <svg class="drawer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>퀴즈</span>
    </a>
    <a href="index.html?cat=커뮤니티" class="nav-drawer-link" data-cat="커뮤니티" data-page="community">
      <svg class="drawer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span>커뮤니티</span>
    </a>
    <a href="ranking.html" class="nav-drawer-link" data-page="ranking">
      <svg class="drawer-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/>
      </svg>
      <span>랭킹</span>
    </a>
  </div>

  <!-- 푸터: 테마 토글 -->
  <div class="nav-drawer-footer">
    <button class="nav-drawer-theme-btn" id="drawerThemeBtn">
      <svg class="drawer-icon theme-icon-dark" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      <svg class="drawer-icon theme-icon-light" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      <span class="drawer-theme-label">라이트 모드</span>
    </button>
  </div>
</nav>
```

---

## 6. CSS 전체 스펙

```css
/* ── 햄버거 버튼 ── */
.btn-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.btn-hamburger:hover { background: var(--surface2); color: var(--text); }
.btn-hamburger .bar { transition: transform 0.25s ease, opacity 0.2s ease; transform-origin: center; }
.btn-hamburger.open .bar-top    { transform: translateY(6px) rotate(45deg); }
.btn-hamburger.open .bar-mid    { opacity: 0; transform: scaleX(0.3); }
.btn-hamburger.open .bar-bottom { transform: translateY(-6px) rotate(-45deg); }

/* ── 오버레이 ── */
.nav-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s;
}
.nav-overlay.open { opacity: 1; visibility: visible; }

/* ── 드로어 패널 ── */
.nav-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 272px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  box-shadow: 4px 0 32px rgba(0, 0, 0, 0.6);
  z-index: 201;
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nav-drawer.open { transform: translateX(0); }

/* ── 드로어 헤더 ── */
.nav-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.nav-drawer-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.nav-drawer-logo-text {
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: -0.04em;
  background: linear-gradient(160deg, #e94560 0%, #f5a623 55%, #ffe170 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-drawer-close:hover { background: var(--surface2); color: var(--text); }

/* ── 드로어 링크 목록 ── */
.nav-drawer-links {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.nav-drawer-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 20px 13px 17px;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.nav-drawer-link:hover {
  background: var(--surface2);
  color: var(--text);
}
.nav-drawer-link.active {
  color: var(--accent);
  background: rgba(233, 69, 96, 0.08);
  border-left-color: var(--accent);
}
.nav-drawer-link.active .drawer-icon { stroke: var(--accent); }

.drawer-icon {
  flex-shrink: 0;
  stroke: currentColor;
  transition: stroke 0.15s;
}

/* ── 드로어 푸터 ── */
.nav-drawer-footer {
  border-top: 1px solid var(--border);
  padding: 12px 20px 20px 17px;
  flex-shrink: 0;
}

.nav-drawer-theme-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s;
}
.nav-drawer-theme-btn:hover { color: var(--text); }

/* 라이트모드 아이콘 토글 (기존 btn-theme-toggle 패턴 재사용) */
body:not(.light-mode) .nav-drawer-theme-btn .theme-icon-light { display: none; }
body.light-mode .nav-drawer-theme-btn .theme-icon-dark { display: none; }
body.light-mode .nav-drawer-theme-btn .drawer-theme-label::before { content: '다크 모드'; }
body:not(.light-mode) .nav-drawer-theme-btn .drawer-theme-label::before { content: '라이트 모드'; }
.drawer-theme-label { font-size: 0; } /* ::before로만 텍스트 표시 */

/* ── 모바일 반응형 ── */
@media (max-width: 768px) {
  .btn-hamburger { display: flex; }
  .nav-center { display: none !important; }
  .cat-select-mobile { display: none !important; }
}

/* ── 라이트모드 드로어 ── */
body.light-mode .nav-drawer {
  box-shadow: 4px 0 32px rgba(0, 0, 0, 0.15);
}
```

---

## 7. JavaScript 스펙 (auth.js 하단 추가)

```js
// ── 사이드 드로어 ─────────────────────────────────────────────
function initDrawer() {
  const hamburgerBtn  = document.getElementById('hamburgerBtn');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const navDrawer     = document.getElementById('navDrawer');
  const navOverlay    = document.getElementById('navOverlay');
  if (!hamburgerBtn || !navDrawer) return;

  // --- 열기 / 닫기 ---
  function openDrawer() {
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    hamburgerBtn.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    navDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    hamburgerBtn.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn?.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // --- 스와이프 제스처 ---
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return; // 세로 스크롤은 무시
    if (touchStartX < 30 && dx > 60) openDrawer();
    if (navDrawer.classList.contains('open') && dx < -60) closeDrawer();
  }, { passive: true });

  // --- 드로어 테마 토글 ---
  const drawerThemeBtn = document.getElementById('drawerThemeBtn');
  drawerThemeBtn?.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('matbul-theme', isLight ? 'light' : 'dark');
  });

  // --- URL 기반 active 탭 감지 ---
  setDrawerActiveByUrl();
}

function setDrawerActiveByUrl() {
  const path = location.pathname;
  const cat  = new URLSearchParams(location.search).get('cat');
  document.querySelectorAll('.nav-drawer-link').forEach(a => a.classList.remove('active'));

  if (path.includes('ranking.html')) {
    document.querySelector('.nav-drawer-link[data-page="ranking"]')?.classList.add('active');
  } else if (!path.includes('.html') || path.includes('index.html')) {
    const activeCat = cat || '밸런스게임';
    document.querySelector(`.nav-drawer-link[data-cat="${activeCat}"]`)?.classList.add('active');
  }
}
```

> `initDrawer()`는 모든 페이지에서 `auth.js` load 후 자동 실행.
> auth.js 하단에 `initDrawer();` 한 줄 추가로 전 페이지 적용.

---

## 8. home.js 수정 사항

### 제거: catSelectMobile 이벤트 핸들러
```js
// 제거 대상 (home.js 내 catSelectMobile 관련 코드)
document.getElementById('catSelectMobile')?.addEventListener('change', e => { ... });
```

### 추가: 탭 전환 시 드로어 active 동기화
```js
// switchTab() 또는 currentCat 변경 함수 내
function switchTab(cat) {
  currentCat = cat;
  // ... 기존 탭 전환 로직 ...
  // 드로어 링크 active 업데이트
  document.querySelectorAll('.nav-drawer-link[data-cat]').forEach(a => {
    a.classList.toggle('active', a.dataset.cat === cat);
  });
}
```

---

## 9. 구현 순서

1. `style.css` — 섹션 7 CSS 전체 추가 (햄버거, 오버레이, 드로어)
2. `auth.js` — `initDrawer()` + `setDrawerActiveByUrl()` 추가, 하단에 `initDrawer();` 호출
3. `platform/index.html` — nav 햄버거 버튼 추가, `cat-select-mobile` 제거, 드로어 HTML 삽입
4. `home.js` — `catSelectMobile` 이벤트 제거, switchTab에 드로어 active 동기화 추가
5. 나머지 HTML 9개 파일 — nav 햄버거 버튼 + 드로어 HTML 삽입, `cat-select-mobile` 제거

---

## 10. 완료 기준 (체크리스트)

- [ ] 모바일에서 햄버거 버튼(☰) 표시, 기존 select 미표시
- [ ] 햄버거 클릭 → 3→X 아이콘 변환 애니메이션
- [ ] 클릭/스와이프로 드로어 슬라이드 인 (0.28s easing)
- [ ] 오버레이 fade-in 동기
- [ ] 드로어 내 5개 탭 + SVG 아이콘 표시
- [ ] 현재 탭에 accent 왼쪽 바 + 배경 강조
- [ ] 오버레이 클릭 / X 버튼 / ESC / 좌 스와이프로 닫힘
- [ ] 열린 상태에서 바디 스크롤 잠금
- [ ] 드로어 내 테마 토글 작동
- [ ] 데스크탑(769px+)에서 드로어 숨김, nav-center 유지
- [ ] 라이트모드에서 드로어 배경/텍스트 정상 표시
