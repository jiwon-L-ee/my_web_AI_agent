# Gap Analysis: post-디자인-개선

## 분석 개요

| 항목 | 내용 |
|------|------|
| Feature | post-디자인-개선 |
| Design 문서 | `docs/02-design/features/post-디자인-개선.design.md` |
| 구현 파일 | `platform/post.html`, `platform/js/post.js` |
| 분석일 | 2026-03-21 |
| **Match Rate** | **86%** |

---

## 항목별 검증 결과 (10개 포인트)

| # | 검증 포인트 | 상태 | 점수 | 비고 |
|---|-----------|------|:---:|------|
| 1 | CSS 토큰 변수 (`--gradient-title`, `--glow-*`) | 미구현 | 5/10 | 값은 사용되나 CSS custom property로 선언 안 됨 |
| 2 | `.post-title` Black Han Sans + clamp + gradient text | 일치 | 9/10 | max `2.5rem` vs 설계 `2.6rem`, drop-shadow 미세 차이 |
| 3 | `.post-header::before` radial glow | 일치 | 8/10 | width `70%` vs `60%`, height `100px` vs `80px` |
| 4 | `.vote-section-label` uppercase + letter-spacing | 일치 | 9/10 | `0.38em` vs 설계 `0.35em` |
| 5 | `.vote-battle` A/B 분할 + VS + 컬러바 | 일치 | 9/10 | `min-height: 150px` vs `160px` |
| 6 | 이모지 → SVG (eye, chat, heart, trash) | 부분 | 7/10 | post.html 이모지 0개. post.js 댓글 영역 8개 잔존 (설계 범위 외) |
| 7 | `.comments-title` uppercase + fade `::after` | 일치 | 9/10 | letter-spacing `0.38em` vs `0.35em` |
| 8 | `#backBtn` + `?from=home` 체크 | 완전 일치 | 10/10 | HTML 버튼 + JS 이벤트 모두 구현 완료 |
| 9 | `updateLikeBtn()` SVG heart 토글 | 완전 일치 | 10/10 | filled/outline heart 정확히 구현 |
| 10 | `.page-narrow` max-width: 800px | 완전 일치 | 10/10 | 정확히 일치 |

**총점: 86/100 → Match Rate: 86%**

---

## 차이점 상세

### 1. CSS 토큰 변수 미선언 (구조적 이탈)

**설계**: `--gradient-title`, `--glow-accent`, `--glow-blue`, `--glow-orange` CSS custom property로 선언
**구현**: 해당 값들이 각 rule에 직접 하드코딩됨 (CSS variable 미사용)

```css
/* 설계 요구 */
--gradient-title: linear-gradient(135deg, #fff 0%, #ffe4a0 40%, #f5a623 70%, #e94560 100%);
--glow-accent: 0 0 60px rgba(233, 69, 96, 0.18);

/* 현재 구현 — 인라인 직접 기재 */
background: linear-gradient(135deg, #fff 0%, #ffe4a0 40%, #f5a623 70%, #e94560 100%);
```

### 2. 수치 미세 차이 (Low Impact)

| 속성 | 설계 | 구현 | 영향 |
|------|------|------|------|
| `.post-title` clamp max | `2.6rem` | `2.5rem` | 낮음 |
| `.post-title` drop-shadow | `30px / 0.2` | `28px / 0.18` | 낮음 |
| `.post-header::before` width | `60%` | `70%` | 낮음 |
| `.post-header::before` height | `80px` | `100px` | 낮음 |
| letter-spacing (label) | `0.35em` | `0.38em` | 낮음 |
| `.vote-battle` min-height | `160px` | `150px` | 낮음 |

### 3. post.js 댓글 영역 이모지 잔존 (설계 범위 외)

| 위치 | 이모지 | 맥락 |
|------|--------|------|
| `renderCommentItem` | `🔵` `🟠` | 진영 배지 |
| 설득됨 버튼 | `🫡` | persuasion 버튼 텍스트 |
| 댓글 좋아요 | `❤️` `🤍` | comment-level 좋아요 |
| 댓글 컬럼 헤더 | `🔵` `🟠` | A/B 컬럼 제목 |

> 설계 문서 4-3항의 교체 대상 4종 (eye, chat, heart-post, trash)은 모두 SVG로 교체 완료.
> 위 이모지는 설계 범위 밖 (댓글 시스템). 다음 이터레이션에서 별도 처리 권장.

---

## 권장 조치

### 즉시 조치 (86% → 90%+ 달성)

**CSS 토큰 변수 선언 추가** — post.html `<style>` 블록 상단에 추가:

```css
/* post.html 전용 토큰 */
--gradient-title: linear-gradient(135deg, #fff 0%, #ffe4a0 40%, #f5a623 70%, #e94560 100%);
--glow-accent: 0 0 60px rgba(233, 69, 96, 0.18);
--glow-blue: 0 0 40px rgba(47, 128, 237, 0.14);
--glow-orange: 0 0 40px rgba(245, 166, 35, 0.14);
```

그 후 `var()` 참조로 교체.

### 선택 조치

- 수치 미세 차이는 의도적 구현 개선으로 판단 → 설계 문서 업데이트 권장
- 댓글 이모지 → SVG 교체는 별도 `comment-이모지-개선` 피처로 PDCA 진행 권장

---

## 결론

86% Match Rate — 핵심 기능(backBtn, SVG heart, vote-battle, gradient title)은 완전 구현.
CSS 토큰 변수 선언 1건 추가로 90%+ 달성 가능.
수치 미세 차이는 시각적으로 동등하며 의도적 개선 범주.
