# UI 구조 & 컴포넌트

## 디자인 시스템

- **폰트**: Pretendard Variable (CDN import), hero/pct는 Black Han Sans (Google Fonts)
- **테마**: CSS 변수 기반 다크 테마 (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text-muted`, `--accent`, `--blue`, `--orange`)
- **이모지 금지**: CSS 애니메이션 요소 또는 인라인 SVG로 대체

## 세션스토리지 키

| 키 | 용도 |
|----|------|
| `matbulIntroSeen` | 루트 → infographic.html 첫 방문 인트로 스킵 |
| `introSeen` | platform/index.html 로딩바 애니메이션 스킵 |

QA 재확인: `http://localhost:8080/?reset` → `matbulIntroSeen` 초기화

## 직접 URL 접근 우회 방지

`platform/index.html` 맨 위 (DOCTYPE 이전):
```html
<!DOCTYPE html>
<script>
  if (!sessionStorage.getItem('matbulIntroSeen')) { location.replace('infographic.html'); }
</script>
<html lang="ko">
```

## 네브바 구조

```
[.nav-logo 좌측] [.nav-center absolute 중앙] [#navAuth margin-left:auto 우측]
```

- `.nav-center`: `position: absolute; left: 50%; transform: translateX(-50%)` — 로고/auth 너비와 무관한 진짜 중앙
- `.nav-link`: `data-cat` 속성으로 active 상태 관리
- `home.js readUrlParams()`: `.nav-link[data-cat], .cat-btn[data-cat]` 두 셀렉터 active 토글
- 모바일(768px↓): `.nav-center { display: none }` → `#catSelectMobile` (select) 표시
- 만들기 버튼: 네브바에 없음 — mypage.html 전용 `.btn-create-lg`

## SVG 로고 (불꽃)

- viewBox `0 0 18 24`, path: `M9 23C4 21 1 15 3 9C4.5 5 7 2 7 0C9 3 9 7 8 10C10 7 12 3 11 1C15 5 16 13 14 17C13 20 11 23 9 23Z`
- gradient ID: `lgNav`(navbar), `lgCard`(login), `lgIntro`(인트로) — 같은 페이지 내 중복 방지
- CSS로 크기 제어: `width: 24px; height: 32px`
- 애니메이션: `navFlicker` keyframes + glow `filter: drop-shadow`

## 홈 화면 레이아웃 분기 (home.js)

```js
if (currentCategory === '밸런스게임') → loadBalanceGameHome()  // 히어로 + 바형 리스트
if (currentCategory === '투표')        → loadBalanceGameList()  // 카드 그리드만
// 그 외                               → 기존 카드 그리드
```

카테고리-콘텐츠 매핑:
- **홈(밸런스게임)**: 히어로 섹션 + 바형 리스트, "전체보기" → `index.html?cat=투표`
- **투표 탭**: 밸런스게임 전체 카드 그리드 (히어로 없음)
- **토론 탭**: 자유텍스트 토론 (기존 방식)

## 히어로 섹션 (index.html — 밸런스게임 홈 전용)

### HTML 구조 (`hero-battle` 내부)
```
.hero-bg-a / .hero-bg-b     — 배경 분할, var(--divide) CSS 변수로 위치 제어
.hero-flame-a / .hero-flame-b — CSS clip-path 불꽃 (hf-layer × 3, flameBreathe 애니메이션)
.hero-divider               — 중앙 VS 구분선 (얇은 선 + "VS" 텍스트)
.hero-side-a / .hero-side-b — 진영 패널 (태그 → 선택지 → 퍼센트 순)
```

`hero-battle` 밖:
```
.hero-stats-row  — 3열 그리드
  hsr-best-a     — A진영 베스트 댓글
  hsr-center     — 퍼센트 표시 + 투표 버튼(A/B) + 참전 수
  hsr-best-b     — B진영 베스트 댓글
```

### 쏠림 효과 (투표율 기반)

`renderHero()`에서 데이터 로드 후:
```js
heroBattle.style.setProperty('--divide', pctA + '%'); // 배경 분할 이동
sideA.style.flex = pctA.toFixed(1);  // rAF 두 번 후 적용
sideB.style.flex = pctB.toFixed(1);  // CSS transition으로 애니메이션
```

CSS:
- `.hero-bg-a/b`: `inset` 값에 `var(--divide)` 사용 + `transition: inset 1.2s`
- `.hero-side`: `transition: flex 1.2s cubic-bezier(0.34,1,0.64,1); min-width: 0`

### 제거된 요소 (사용 금지)
- `.hero-vortex` — conic-gradient 무지개 소용돌이
- `.hero-logo-center` — 중앙 맞불 SVG 로고
- `hero-beam-a/b`, `hero-clash` — 장풍 빔 애니메이션

## 투표 모달 (vote-modal.js — index.html 전용)

### HTML 위치
`<div class="page">` 이후, `<script>` 태그 이전.

### 구조
```
.vm-overlay#voteModal
  .vm-wrap > .vm-box
    .vm-head        — 카테고리 뱃지 + 주제 제목 (vm-head-title: 1.4rem)
    .vm-arena       — 두 진영 패널 (display: flex)
      .vm-panel-a   — A진영 (flex: 1, 투표 후 flex: pA로 쏠림)
      .vm-center-vs — VS 구분 (투표 후 width: 3px으로 축소)
      .vm-panel-b   — B진영 (flex: 1, 투표 후 flex: pB로 쏠림)
    .vm-hint        — "진영을 선택하세요" (투표 후 숨김)
    .vm-result      — 결과 바 + 퍼센트 + 베스트 주장 (투표 후 표시)
```

### 쏠림 효과 (showResult)
```js
panelA.style.flex = pA.toFixed(1);
panelB.style.flex = pB.toFixed(1);
vsCenter.style.width = '3px';
vsCircle.style.opacity = '0';
// 5% 이상 차이 시:
panelA.classList.add('vm-winner'); // 또는 'vm-loser'
```

- `.vm-winner`: 진영색 glow 강화
- `.vm-loser`: `opacity: 0.5; filter: saturate(0.35)`
- 모바일(580px↓): `flex: none !important` — 쏠림 비활성화

### 노출 API
```js
window.openVoteModal(postId)  // 모달 열기
window.isHotPost(views, likes) // 인기 여부 판별
window.getHeatLevel(views, likes) // 0~3 단계
```

## 밸런스게임 카드 (home.js)

- `.card-balance` — 그리드 전체 너비 (`grid-column: 1/-1`)
- 클릭 시 `post.html` 이동 없이 투표 모달 (`openVoteModal`)
- `renderBalanceCard()` 내에서 `isHot` 재파생 — 클로저 스코프 참조 금지
- 인기 임계값: `view_count >= 100 || likes >= 15` → `.card-hot` (box-shadow 애니메이션)

### 투표율 표시
- `.card-pct`: Black Han Sans, 1.8rem
- `.card-pct-a`: blue glow / `.card-pct-b`: orange glow
- `loadBestComments()`에서 비동기로 `--divide`, `--pct-a/b` CSS 변수 주입

## 열기 단계 인디케이터 (이모지 대체)

```html
<b class="hi h1"></b>달아오르는 중  <!-- hiPulse1: 희미한 맥동 -->
<b class="hi h2"></b>뜨거운 논쟁   <!-- hiSmoke2: 주황 연기 -->
<b class="hi h3"></b>전쟁 중       <!-- hiFlame3: 활활 타오르는 불꽃 -->
```

## Canvas 파티클 시스템 (home.js)

- 열기 단계 카드에 `<canvas class="card-spark-canvas" data-heat="{level}">` 삽입
- 전역 단일 RAF 루프 `tickCardParticles` — `cardParticleMap: Map<canvas, {particles}>`
- `initCardParticles()` — `renderCards()` 후 `setTimeout(..., 60)` 호출 (DOM 반영 대기)
- 재렌더링 시: `cardParticleMap.clear()` + `cancelAnimationFrame(particleRafId)` 후 재시작
- DOM에서 제거된 canvas: `!document.body.contains(canvas)` 체크로 자동 정리

| 단계 | 파티클 수 | 특성 |
|------|----------|------|
| 1 | 6개 | 연기 (slow, gray-blue) |
| 2 | 16개 | 연기+불씨 혼합 (30% 불씨) |
| 3 | 38개 | 활발한 불꽃 (70% 불씨, orange/red/yellow) |

## 카드 stat 아이콘 (SVG, 이모지 대체)

```html
<!-- 조회수 (눈) -->
<svg class="ic-stat" viewBox="0 0 12 8" fill="currentColor">...</svg>
<!-- 좋아요 (하트) -->
<svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor">...</svg>
<!-- 댓글 (말풍선) -->
<svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor">...</svg>
```
