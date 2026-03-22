# Design: post-디자인-개선

## 디자인 철학

두 가지 레퍼런스를 결합한다:

| 레퍼런스 | 차용할 요소 |
|----------|------------|
| `infographic.html` | gradient text, radial glow, Black Han Sans 타이틀, 숨 쉬는 여백, letter-spacing |
| `index.html` hero 섹션 | A/B 배경 분할, 불꽃 강도, VS 구분선, 베스트 댓글 3열 레이아웃 |

**원칙**: 이모지 전면 제거 → SVG 아이콘 또는 CSS 형태로 대체. 숫자·통계는 텍스트 레이블로 표기.

---

## 1. 색상 토큰 (기존 CSS 변수 재활용)

```css
--bg:          #0d1117   /* 페이지 배경 */
--surface:     #161b22   /* 카드/섹션 배경 */
--surface2:    #21262d   /* 입력 필드, 내부 강조 */
--border:      #30363d   /* 구분선 */
--text:        #c9d1d9   /* 본문 */
--text-muted:  #8b949e   /* 부가 정보 */
--accent:      #e94560   /* CTA, 강조 */
--blue:        #2f80ed   /* A진영 */
--orange:      #f5a623   /* B진영 */
```

추가 토큰 (post.html 인라인):
```css
--gradient-title: linear-gradient(135deg, #fff 0%, #ffe4a0 40%, #f5a623 70%, #e94560 100%);
--glow-accent:    0 0 60px rgba(233, 69, 96, 0.18);
--glow-blue:      0 0 40px rgba(47, 128, 237, 0.14);
--glow-orange:    0 0 40px rgba(245, 166, 35, 0.14);
```

---

## 2. 타이포그래피 위계

| 요소 | 폰트 | 크기 | 굵기 | 비고 |
|------|------|------|------|------|
| 포스트 제목 | Black Han Sans | clamp(1.8rem, 4vw, 2.6rem) | 900 | gradient text 적용 |
| 섹션 헤딩 | Pretendard | 0.7rem | 700 | letter-spacing 0.35em, uppercase, text-muted |
| 본문 설명 | Pretendard | 1rem | 400 | line-height 1.85 |
| 메타 (작성자/시간) | Pretendard | 0.85rem | 400 | text-muted |
| 통계 숫자 | Pretendard | 0.88rem | 500 | text-muted |
| 댓글 | Pretendard | 0.92rem | 400 | line-height 1.75 |

---

## 3. 레이아웃 구조

```
page-narrow (max-width: 800px)
│
├─ [돌아가기] ← 홈 모달에서 진입 시만 표시
│
├─ POST HEADER ──────────────────────────── (border-bottom)
│   ├─ 카테고리 뱃지 (소형)
│   ├─ 제목 (Black Han Sans + gradient text + text-shadow glow)
│   └─ 메타 행: 작성자 아바타 | 이름 | 시간 | 조회 | 댓글 | 좋아요
│
├─ 본문 설명 (display:none → 내용 있을 때만)
│
├─ [BALANCE GAME] 투표 섹션 ────────────── (hero 스타일)
│   ├─ 섹션 레이블 "지금 투표하기" (uppercase, letter-spacing)
│   ├─ hero-battle: A/B 배경 분할 + 불꽃 CSS + VS 구분선
│   │   ├─ 좌: A진영 선택지 + 투표율 %
│   │   └─ 우: B진영 선택지 + 투표율 %
│   ├─ 투표 버튼 행 (A 투표 / B 투표)
│   └─ 베스트 주장 행: [A 베스트] | [총 N명 참전] | [B 베스트]
│
├─ [QUIZ] 퀴즈 CTA ──────────────────────
│   └─ 배경 glow + "퀴즈 도전" 레이블 + 대형 CTA 버튼
│
├─ [TEST] 테스트 CTA ────────────────────
│   └─ 배경 glow + "AI 테스트" 레이블 + 대형 CTA 버튼
│
└─ COMMENTS ──────────────────────────── (margin-top 56px)
    ├─ 댓글 헤딩 (섹션 레이블 스타일)
    ├─ 댓글 입력 폼
    └─ [밸런스게임] 진영 2열 아레나 / [기타] 일반 목록
```

---

## 4. 섹션별 상세 스펙

### 4-1. POST HEADER

```css
.post-header {
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 40px;
  position: relative;
}

/* 배경 glow (infographic 스타일) */
.post-header::before {
  content: '';
  position: absolute;
  top: -20px; left: 50%; transform: translateX(-50%);
  width: 60%; height: 80px;
  background: radial-gradient(ellipse, rgba(233,69,96,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.post-title {
  font-family: 'Black Han Sans', sans-serif;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #fff 0%, #ffe4a0 40%, #f5a623 70%, #e94560 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 30px rgba(233,69,96,0.2));
  margin-bottom: 24px;
}
```

**메타 행 변경**:
- 조회수: 눈 SVG 아이콘 (현재 👁 이모지 → SVG로 교체)
- 댓글수: 말풍선 SVG 아이콘 (현재 💬 이모지 → SVG로 교체)
- 좋아요: 하트 SVG (현재 🤍 이모지 → SVG로 교체)

### 4-2. 투표 섹션 (hero-battle 스타일 적용)

`index.html`의 `.hero-battle` CSS 패턴을 post.html에 이식.

```css
/* 섹션 레이블 (infographic 스타일) */
.vote-section-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 20px;
}

/* 배틀 아레나 */
.vote-battle {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  min-height: 160px;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
}

/* A진영 배경 (파랑) / B진영 배경 (오렌지) */
.vote-bg-a { background: rgba(47,128,237,0.08); }
.vote-bg-b { background: rgba(245,166,35,0.08); }

/* 중앙 VS */
.vote-vs-divider {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; z-index: 2;
}
.vote-vs-line { width: 1px; height: 32px; background: var(--border); }
.vote-vs-text { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.1em; }

/* 투표율 바 (하단 얇은 선) */
.vote-bar-row { display: flex; height: 3px; border-radius: 0 0 16px 16px; overflow: hidden; }
.vote-bar-a { background: var(--blue); transition: width 0.6s ease; }
.vote-bar-b { background: var(--orange); transition: width 0.6s ease; }

/* 투표 버튼 */
.vote-btn-a {
  border: 1.5px solid rgba(47,128,237,0.4);
  color: #71d8f7;
  background: rgba(47,128,237,0.08);
}
.vote-btn-a:hover, .vote-btn-a.selected {
  background: rgba(47,128,237,0.2);
  border-color: var(--blue);
  box-shadow: 0 0 20px rgba(47,128,237,0.25);
}
```

### 4-3. 이모지 → SVG 교체 매핑

| 현재 이모지 | SVG 대체 | 위치 |
|------------|---------|------|
| 👁 | `<svg>` eye icon (viewBox="0 0 20 20") | post-stat 조회수 |
| 💬 | `<svg>` chat-bubble (viewBox="0 0 20 20") | post-stat 댓글수 |
| 🤍 / ❤️ | `<svg>` heart (viewBox="0 0 20 20") | likeBtn |
| 🗑️ | `<svg>` trash (viewBox="0 0 20 20") | deleteBtn |
| 풋터 🔥 | flame SVG (기존 lgNav 재사용) | footer-logo |

### 4-4. 댓글 섹션

```css
.comments-section { margin-top: 56px; }

/* 섹션 헤딩 (infographic 레이블 스타일) */
.comments-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 28px;
  display: flex; align-items: center; gap: 12px;
}
.comments-title::after {
  content: ''; flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--border), transparent);
}

.comment-list { gap: 24px; }
.comment-item { gap: 14px; }
.comment-avatar { width: 38px; height: 38px; }
.comment-text { font-size: 0.93rem; line-height: 1.75; }
```

---

## 5. 이모지 제거 SVG 스니펫

```html
<!-- 조회수 eye -->
<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
  <circle cx="10" cy="10" r="2.5"/>
</svg>

<!-- 댓글 chat-bubble -->
<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H7l-4 3V5a1 1 0 011-1z"/>
</svg>

<!-- 하트 (비활성) -->
<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/>
</svg>

<!-- 하트 (활성 — fill) -->
<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
  <path d="M10 17s-7-4.35-7-9a4 4 0 018 0 4 4 0 018 0c0 4.65-7 9-7 9z"/>
</svg>

<!-- 삭제 trash -->
<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <path d="M3 6h14M8 6V4h4v2M5 6l1 12h8l1-12"/>
</svg>
```

---

## 6. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `platform/post.html` | `<style>` 전면 교체, 이모지 → SVG, 투표 섹션 구조 업데이트 |
| `platform/js/post.js` | `renderPost()` 내 좋아요 버튼 HTML (SVG 하트), likeBtn 상태 토글 |
| `platform/css/style.css` | (최소 변경) `.vote-section` 기존 스타일 확인 후 post 전용 오버라이드로 처리 |

> post.html 인라인 `<style>`에서 처리 — style.css는 건드리지 않음

---

## 7. 구현 우선순위

1. **포스트 타이틀** — gradient + Black Han Sans (가장 임팩트 큼)
2. **투표 배틀 섹션** — hero 스타일 이식 (A/B 분할 배경)
3. **이모지 → SVG** — 시각적 완성도
4. **댓글 섹션 헤딩** — 섹션 레이블 스타일
5. **header glow** — 미묘한 분위기 강화
