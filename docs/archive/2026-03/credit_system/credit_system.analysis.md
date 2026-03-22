# Gap Analysis Report: credit_system

> 분석일: 2026-03-22 (업데이트) | Match Rate: **86%** (Phase 1 설계 범위 기준 ~97%)

---

## Overall Match Rate

| 항목 | 가중치 | 점수 | 가중합 |
|------|:------:|:---:|:------:|
| DB Schema | 15% | 100% | 15.0% |
| 가입 보너스 트리거 | 5% | 100% | 5.0% |
| credit_balances 뷰 활용 | 5% | 50% | 2.5% |
| 투표 모달 리다이렉트 | 10% | 100% | 10.0% |
| 밸런스게임 생성 크레딧 | 10% | 100% | 10.0% |
| 블라인드 모드 | 15% | 100% | 15.0% |
| 1분 버퍼 | 10% | 100% | 10.0% |
| 투표 변경 모달 | 10% | 85% | 8.5% |
| credits RLS | 10% | 100% | 10.0% |
| 미구현 항목 | 10% | 0% | 0.0% |
| **합계** | **100%** | | **86.0%** |

---

## 수정 완료 항목 (이터레이션 1)

| # | 항목 | 수정 내용 | 상태 |
|---|------|---------|------|
| 1 | 설득됨 카운트 비공개 | `renderCommentItem` persuasion count 표시 제거 | ✅ 완료 |
| 2 | credits INSERT RLS 정책 | `credits_insert_own` + `vote_changes_insert_own` 정책 추가 | ✅ 완료 |
| 3 | 댓글 진영 레이블 블라인드 | `renderCommentItem` ab_flipped 시 displaySide 반전; `loadComments` 헤더 반전 | ✅ 완료 |
| 4 | 홈/토론 목록 블라인드 | `isPostBlind()` + `renderDebateBarList` ??% 표시, dbi-blind-badge | ✅ 완료 |

---

## 잔여 Gap (Phase 2)

| # | 항목 | 파일 | 우선순위 |
|---|------|------|---------|
| 5 | mypage 크레딧 잔액 + 이력 | mypage.js / mypage.html | Phase 2 |
| 6 | post.html 만료 D-day 배지 | post.html / post.js | Phase 2 |
| 7 | 만료 정산 Edge Function | supabase/functions/ | Phase 2 |
| 8 | credit_balances 뷰 클라이언트 활용 | create.js / post.js | Phase 2 |
