# Gap Analysis: UI-전면-개선

**Design 문서**: `docs/02-design/features/UI-전면-개선.design.md`
**분석일**: 2026-03-21
**Match Rate**: **100%** (설계 범위 내 전 항목 Pass)

---

## 카테고리별 결과

| 카테고리 | 항목 | Pass | Fail | 점수 |
|---------|:---:|:---:|:---:|:---:|
| vm-vs-circle 과녁 제거 | 8 | 8 | 0 | 100% |
| vote modal 미니 불꽃 | 7 | 7 | 0 | 100% |
| post vote-battle 불꽃 강도 | 3 | 3 | 0 | 100% |
| footer 링크 수정 | 15 | 15 | 0 | 100% |
| **전체** | **33** | **33** | **0** | **100%** |

---

## 1. vm-vs-circle 과녁 제거 (style.css)

| 항목 | 설계 | 구현 | 결과 |
|------|------|------|:---:|
| background: transparent | transparent | L1573 | Pass |
| border: none | none | L1574 | Pass |
| border-radius 제거 | 0 | border-radius: 0 L1577 | Pass |
| font-size: 0.55rem | 0.55rem | L1581 | Pass |
| font-weight: 900 | 900 | L1582 | Pass |
| letter-spacing: 0.12em | 0.12em | L1583 | Pass |
| color: var(--text-muted) | var(--text-muted) | L1584 | Pass |
| ::before/::after 얇은 라인 | linear-gradient 선 | L1565-1570 | Pass |

## 2. vote modal 미니 불꽃 (index.html + style.css)

| 항목 | 설계 | 구현 | 결과 |
|------|------|------|:---:|
| hero-flame-a vm-flame div | HTML div | index.html:230-233 | Pass |
| hero-flame-b vm-flame div | HTML div | index.html:235-238 | Pass |
| .vm-flame CSS (width/height/opacity/z-index) | 24%; 90%; 0.5; 0 | style.css:1589 | Pass |
| .hero-flame-a.vm-flame left: 1% | left: 1% | style.css:1590 | Pass |
| .hero-flame-b.vm-flame right: 1% | right: 1% | style.css:1591 | Pass |
| .vm-panel z-index: 1 | position:relative; z-index:1 | style.css:1592 | Pass |
| .vm-arena position:relative; overflow:hidden | 양쪽 모두 적용 | style.css:1443-1444 | Pass |

## 3. post vote-battle 불꽃 강도 (post.html)

| 항목 | 설계 | 구현 | 결과 |
|------|------|------|:---:|
| .vb-flame opacity: 0.72 | 0.55→0.72 | post.html:95 | Pass |
| .vote-bg-a rgba opacity 0.10 | 0.07→0.10 | post.html:100 | Pass |
| .vote-bg-b rgba opacity 0.10 | 0.07→0.10 | post.html:104 | Pass |

## 4. footer 링크 수정 (6개 파일)

### "맞불 소개" → infographic.html

| 파일 | 결과 |
|------|:---:|
| index.html | Pass |
| post.html | Pass |
| create.html | Pass |
| mypage.html | Pass |
| profile.html | Pass |
| quiz.html | Pass |

### footer-link-todo class (나머지 5개 링크)

| 파일 | 결과 |
|------|:---:|
| index.html | Pass |
| post.html | Pass |
| create.html | Pass |
| mypage.html | Pass |
| profile.html | Pass |
| quiz.html | Pass |

### .footer-link-todo CSS 정의

| 속성 | 결과 |
|------|:---:|
| opacity: 0.35 | Pass |
| pointer-events: none | Pass |
| cursor: default | Pass |

---

## 설계 범위 외 발견 사항

footer-logo 이모지 미교체 파일 4곳 (설계에 명시되지 않았으나 일관성 저하):

| 파일 | footer-logo | 비고 |
|------|------------|------|
| index.html | SVG flame | 교체 완료 |
| post.html | SVG flame | 교체 완료 |
| create.html | `🔥 맞불` | 미교체 |
| mypage.html | `🔥 맞불` | 미교체 |
| profile.html | `🔥 맞불` | 미교체 |
| quiz.html | `🔥 맞불` | 미교체 |
| login.html | `🔥 맞불` | 미교체 |

---

## 결론

**Match Rate: 100%** — 설계 문서에 명시된 33개 항목 전부 구현 완료.
선택적 개선: 나머지 HTML 파일 footer-logo 이모지 → SVG 일괄 교체 권장.
