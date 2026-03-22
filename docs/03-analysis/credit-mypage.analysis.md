# Gap Analysis: credit-mypage

> 작성일: 2026-03-22 | Phase: Check
> Design 참조: `docs/02-design/features/credit-mypage.design.md`

---

## 1. 분석 요약

| 항목 | 값 |
|------|-----|
| **Match Rate** | **100%** |
| **전체 검증 항목** | 26 |
| ✅ 일치 | 26 |
| ⚠️ 부분 일치 | 0 |
| ❌ 불일치 | 0 |

---

## 2. 항목별 검증

### 2-1. HTML 구조 (mypage.html)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `#statCredits` stat-card (`#statPersuasion` 다음) | ✅ | `stat-val` + `stat-label` 구조 일치 |
| 2 | `#creditHistory` 섹션 (`<!-- My posts -->` 앞) | ✅ | `section-title` + spinner 초기값 일치 |
| 3 | `<body class="page-mypage">` — CSS 스코핑용 클래스 | ✅ | stats-grid !important 전역 오버라이드 방지 |

### 2-2. mypage.js — CREDIT_REASON_LABELS

| # | reason key | 상태 | 비고 |
|---|-----------|------|------|
| 4 | `signup_bonus` → 가입 보너스 / `credit-reason-bonus` | ✅ | |
| 5 | `vote_win` → 투표 승리 / `credit-reason-win` | ✅ | |
| 6 | `creator_reward` → 게임 제작자 / `credit-reason-creator` | ✅ | |
| 7 | `post_create` → 게임 생성 / `credit-reason-spend` | ✅ | |
| 8 | `vote_change` → 투표 변경 / `credit-reason-spend` | ✅ | |

### 2-3. mypage.js — loadCredits()

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 9 | `Promise.all([balanceRes, historyRes])` 병렬 조회 | ✅ | |
| 10 | `credit_balances` 뷰 `.maybeSingle()` | ✅ | |
| 11 | `credits` 테이블 `.limit(20).order('created_at', { ascending: false })` | ✅ | |
| 12 | `fmtNum(Math.floor(balance)) + 'C'` → `#statCredits` | ✅ | |
| 13 | `renderCreditHistory(historyRes.data ?? [])` 호출 | ✅ | |

### 2-4. mypage.js — renderCreditHistory()

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 14 | 빈 상태 메시지 + hint 텍스트 | ✅ | |
| 15 | `escapeHtml()` 적용 (meta.cls, meta.label, amtStr, amtCls, post_id) | ✅ | |
| 16 | `post_id` 조건부 링크 렌더 | ✅ | |

### 2-5. init() 호출 순서

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 17 | `loadStats()` 다음에 `await loadCredits()` 호출 | ✅ | |

### 2-6. CSS (style.css)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 18 | `body.page-mypage .stats-grid { repeat(6, 1fr) }` — 스코프 지정 | ✅ | 전역 !important 대신 page 클래스로 스코핑하여 profile.html 레이아웃 보호 |
| 19 | `@media (max-width: 768px)` repeat(3, 1fr) | ✅ | |
| 20 | `.credit-history-item` (flex, gap, border-radius) | ✅ | |
| 21 | `.credit-reason-bonus/win/creator/spend` 배지 색상 | ✅ | |
| 22 | `.credit-amount-plus/minus` 금액 색상 | ✅ | |
| 23 | `.credit-history-empty`, `.credit-history-hint` 빈 상태 스타일 | ✅ | |
| 24 | `.credit-post-link` hover 스타일 | ✅ | |

### 2-7. 네비바 크레딧 표시 (auth.js) — 설계 범위 외 추가 구현

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 25 | `updateNavbar()` — `profiles` + `credit_balances` 병렬 조회 | ✅ | Promise.all 패턴 준수 |
| 26 | `<span class="nav-credit">XXC</span>` 아바타 왼쪽 렌더 | ✅ | `.nav-credit` CSS 추가됨 |

---

## 3. Gap 목록

**없음** — 모든 설계 항목이 구현에 반영되어 있습니다.

---

## 4. 추가 구현 내역 (설계 범위 외)

| 항목 | 내용 | 평가 |
|------|------|------|
| 네비바 크레딧 잔액 표시 | `auth.js updateNavbar()`에 `credit_balances` 병렬 조회 추가 | ✅ 긍정적 확장 — UX 향상 |
| CSS stats-grid 스코핑 | 전역 `!important` → `body.page-mypage` 스코프 변경 | ✅ 버그 수정 — `profile.html` 레이아웃 보호 |
| `spend_credits()` RPC | SECURITY DEFINER 함수로 안전한 클라이언트 크레딧 차감 | ✅ 보안 강화 |
| 기존 유저 signup_bonus | 4명 기존 유저에게 30C 일괄 지급 (migration) | ✅ 운영 처리 |

---

## 5. 결론

- **Match Rate: 100%** — 설계 문서와 구현이 완전히 일치
- Design 문서에 명시된 보안 주의사항(`escapeHtml` 전적용, `Promise.all` 패턴, `maybeSingle()` null 처리) 모두 준수
- 설계 범위 외 추가 구현(네비바 크레딧, CSS 스코핑 수정, RPC 보안 강화)도 코딩 표준 준수
- `/pdca report credit-mypage` 진행 가능
