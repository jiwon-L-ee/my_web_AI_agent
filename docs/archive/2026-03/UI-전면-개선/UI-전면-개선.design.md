# Design: UI-전면-개선

## 개선 항목

| # | 위치 | 문제 | 해결 방향 |
|---|------|------|-----------|
| 1 | vote 모달 | `.vm-vs-circle` 과녁처럼 생긴 원형 배지 | 얇은 라인 + "VS" 텍스트로 교체 |
| 2 | vote 모달 | 패널이 밋밋함 — 불꽃 없음 | `.vm-arena`에 미니 hero-flame 추가 |
| 3 | post 투표 | `.vb-flame` opacity 낮아 불꽃이 안 보임 | opacity 0.55→0.72, bg 강도 ↑ |
| 4 | 전체 footer | `href="#"` 빈 링크 6종 클릭 불가 | 맞불소개→infographic.html, 나머지 비활성 처리 |

---

## 1. vm-vs-circle 과녁 제거

**현재**: `border-radius:50%` 원형 배지 → 과녁처럼 보임

**변경**:
```css
/* 기존 .vm-vs-circle 원형 배경 제거 */
.vm-vs-circle {
  background: transparent;
  border: none;
  font-size: 0.55rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}
/* .vm-center-vs에 얇은 라인 추가 */
.vm-center-vs::before,
.vm-center-vs::after {
  content: '';
  flex: 1;
  width: 1px;
  background: linear-gradient(to bottom, transparent, var(--border), transparent);
}
```

## 2. vote 모달 미니 불꽃

`.vm-arena`에 `position:relative; overflow:hidden` 추가 후 flame div 삽입:
```html
<div class="vm-arena" id="vmArena">
  <!-- 미니 불꽃 (hero-flame CSS 재활용, vm-flame 클래스로 크기 제한) -->
  <div class="hero-flame hero-flame-a vm-flame" aria-hidden="true">
    <div class="hf-layer hf-l1"></div>
    <div class="hf-layer hf-l2"></div>
    <div class="hf-layer hf-l3"></div>
  </div>
  <div class="hero-flame hero-flame-b vm-flame" aria-hidden="true">
    <div class="hf-layer hf-r1"></div>
    <div class="hf-layer hf-r2"></div>
    <div class="hf-layer hf-r3"></div>
  </div>
  ...
```

```css
/* 모달 미니 불꽃 크기 제한 */
.vm-flame { width: 24%; height: 90%; opacity: 0.5; z-index: 0; }
.hero-flame-a.vm-flame { left: 1%; }
.hero-flame-b.vm-flame { right: 1%; }
/* vm-panel이 불꽃 위에 올라오도록 */
.vm-panel { position: relative; z-index: 1; }
```

## 3. post vote-battle 불꽃 강도

```css
.vb-flame { opacity: 0.72; }   /* 0.55 → 0.72 */
.vote-bg-a { background: rgba(47,128,237,0.10); }   /* 0.07 → 0.10 */
.vote-bg-b { background: rgba(245,166,35,0.10); }   /* 0.07 → 0.10 */
```

## 4. Footer 링크 수정

| 링크 | 현재 | 변경 |
|------|------|------|
| 맞불 소개 | `href="#"` | `href="infographic.html"` |
| 팀 소개 | `href="#"` | 비활성 (스타일 흐리게) |
| 문의하기 | `href="#"` | 비활성 |
| 이용약관 | `href="#"` | 비활성 |
| 개인정보처리방침 | `href="#"` | 비활성 |
| 커뮤니티 가이드라인 | `href="#"` | 비활성 |

```css
/* style.css 추가 */
.footer-link-todo {
  opacity: 0.35;
  pointer-events: none;
  cursor: default;
}
```

대상 파일: index.html, post.html, create.html, mypage.html, profile.html, quiz.html

---

## 수정 파일

| 파일 | 변경 |
|------|------|
| `platform/css/style.css` | vm-vs-circle 스타일, vm-flame, footer-link-todo |
| `platform/index.html` | vm-arena flame 추가, footer 링크 |
| `platform/post.html` | vb-flame opacity, footer 링크 |
| `platform/create.html` | footer 링크 |
| `platform/mypage.html` | footer 링크 |
| `platform/profile.html` | footer 링크 |
| `platform/quiz.html` | footer 링크 |
