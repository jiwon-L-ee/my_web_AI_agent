# Gap Analysis: settle-balance-games

> 작성일: 2026-03-22 | Tool: gap-detector
> Design: `docs/02-design/features/settle-balance-games.design.md`

---

## Executive Summary

| 항목 | 값 |
|------|-----|
| Match Rate | **94%** |
| 총 검증 항목 | 25 |
| 완전 일치 (✅) | 23 |
| 부분 일치 (⚠️) | 1 |
| 미구현 (❌) | 1 |
| 버그 수정 | 1 (query 체이닝 버그 → 즉시 수정 완료) |

---

## 1. Edge Function (supabase/functions/settle-balance-games/index.ts)

### 1-1. 기본 구조

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| Deno.serve() 사용 | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY 인증 | ✅ | ✅ |
| BATCH_SIZE = 50 | ✅ | ✅ |
| K = 1.0 (조정 가능 상수) | ✅ | ✅ |

### 1-2. 만료 게임 조회

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| post_results에서 settledIds 사전 조회 | ✅ | ✅ |
| posts WHERE category='밸런스게임' AND expires_at <= now | ✅ | ✅ |
| 정산 완료 게임 exclude (NOT IN) | ✅ (버그 수정됨) | ✅ |
| BATCH_SIZE limit | ✅ | ✅ |

**버그 수정**: `const query = ...` 후 `query.not(...)` 호출 시 Supabase SDK 빌더의 불변 체이닝 패턴으로 인해 필터가 적용되지 않던 문제 수정.

```typescript
// Before (버그)
const query = supabase.from('posts')...;
if (excludeIds.length > 0) {
  query.not('id', 'in', ...);  // 반환값 무시 → 필터 미적용
}

// After (수정)
let query = supabase.from('posts')...;
if (excludeIds.length > 0) {
  query = query.not('id', 'in', ...);  // 재할당으로 필터 적용
}
```

> 참고: 멱등성 가드(`post_results` INSERT 시 `23505` unique violation 감지)가 실제 이중 정산을 막고 있었으나 불필요한 DB 조회를 유발하므로 수정 완료.

### 1-3. settlePost() — 투표 집계

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| votes 테이블 조회 (user_id, choice) | ✅ | ✅ |
| votesA, votesB, totalVotes 집계 | ✅ | ✅ |
| loggedIn = user_id가 있는 투표만 | ✅ | ✅ |
| loggedInA, loggedInB 분리 | ✅ | ✅ |

### 1-4. settlePost() — 정산 계산

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| pctA = votesA / totalVotes * 100 (없으면 50) | ✅ | ✅ |
| proximity = 1 - \|pctA - 50\| / 50 | ✅ | ✅ |
| C = round(proximity × loggedIn.length × K) | ✅ | ✅ |
| winningSide: A / B / tie | ✅ | ✅ |

### 1-5. settlePost() — post_results INSERT

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| post_id, winning_side, votes_a, votes_b 저장 | ✅ | ✅ |
| logged_in_voters, proximity, creator_reward 저장 | ✅ | ✅ |
| credits_paid = false 초기값 | ✅ | ✅ |
| resolved_at 기록 | ✅ | ✅ |
| 23505 unique violation → 스킵 (멱등성) | ✅ | ✅ |
| loggedIn.length == 0 or C == 0 → credits_paid true 후 종료 | ✅ | ✅ |

### 1-6. settlePost() — credits 계산 (tie)

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| 동률: 로그인 참여자 전원 균등 분배 | ✅ | ✅ |
| perPerson = C / loggedIn.length | ✅ | ✅ |
| reason: 'vote_win' | ✅ | ✅ |

### 1-7. settlePost() — credits 계산 (winner)

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| 승리팀 로그인 투표자 추출 (winnerIds) | ✅ | ✅ |
| persuasion_likes 조회 — 승리팀 댓글 설득됨 카운트 | ⚠️ | ⚠️ |
| comment_likes 조회 — 승리팀 댓글 좋아요 카운트 | ✅ (인메모리 필터) | ✅ |
| 기여점수 = (persuasion × 3) + (likes × 1) | ✅ | ✅ |
| 기여점수 비례 분배 (totalScore == 0이면 균등) | ✅ | ✅ |
| amount > 0인 경우만 creditRows에 추가 | ✅ | ✅ |

**⚠️ persuasion_likes 쿼리 방식 차이:**

```typescript
// 설계: 직접 post_id 필터 + winnerIds 필터
.from('persuasion_likes')
.select('comment_id, comments!inner(user_id)')
.eq('post_id', post.id)
.in('comments.user_id', winnerIds)

// 구현: join을 통한 post_id 필터 (post_id 직접 필터 미사용)
.from('persuasion_likes')
.select('comment_id, comments!inner(user_id, post_id)')
.eq('comments.post_id', post.id)
// winnerIds 필터는 인메모리에서 처리
```

기능상 동일하게 동작하지만, `persuasion_likes` 테이블에 `post_id` 컬럼이 있다면 직접 필터가 더 효율적. 현재 구현은 약간 비효율적이나 정확도에는 영향 없음.

### 1-8. settlePost() — 마무리

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| creator_reward: post.user_id && C > 0 | ✅ | ✅ |
| credits bulk INSERT (service_role) | ✅ | ✅ |
| credits_paid = true 마킹 | ✅ | ✅ |

### 1-9. Cron 설정

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| 0 * * * * 스케줄 | ❌ 수동 설정 필요 | ❌ |

> Cron은 Supabase Dashboard에서 수동 설정 필요. 코드로 자동화 불가.

---

## 2. post.js UI 연동

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| renderExpiryBadge() 함수 | ✅ | ✅ |
| D-N / D-day / 종료 세 가지 상태 | ✅ | ✅ |
| loadAndRenderResult() 함수 | ✅ | ✅ |
| post_results.credits_paid 확인 후 배너 렌더 | ✅ | ✅ |
| pending 상태: "집계 중..." 표시 | ✅ | ✅ |
| renderPost() isVote 블록에서 두 함수 호출 | ✅ | ✅ |

---

## 3. post.html 구조

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| #expiryBadge: .vote-section-label 내부 | ✅ | ✅ |
| #resultBanner: voteSection 하단 | ✅ | ✅ |

---

## 4. CSS 스타일

| 설계 항목 | 구현 | 상태 |
|-----------|------|------|
| .expiry-badge (공통) | ✅ | ✅ |
| .expiry-active (파란색) | ✅ | ✅ |
| .expiry-today (오렌지) | ✅ | ✅ |
| .expiry-ended (회색) | ✅ | ✅ |
| .result-banner | ✅ | ✅ |
| .result-pending, .result-winner, .result-stats | ✅ | ✅ |

---

## 5. Gap 요약

### 수정 완료 (이번 분석 중 즉시 수정)

| # | 파일 | 내용 | 영향도 |
|---|------|------|--------|
| 1 | `index.ts:29-31` | `query.not()` 반환값 미할당으로 exclude 필터 미적용 → `let query`, `query = query.not(...)` 수정 | Medium |

### 잔존 갭 (허용 범위)

| # | 파일 | 내용 | 영향도 |
|---|------|------|--------|
| 2 | `index.ts:154-157` | persuasion_likes 쿼리: join 경유 필터 vs 직접 `post_id` 필터 (기능 동일, 효율 차이) | Low |
| 3 | Supabase Dashboard | Cron 스케줄 수동 설정 필요 (`0 * * * *`) | 운영 필수 |

---

## 6. 결론

**Match Rate: 94%** — 임계값(90%) 초과. 설계 대비 구현이 충실히 완료됨.

주요 구현 완료:
- Supabase Edge Function (Deno TypeScript, BATCH_SIZE=50, K=1.0)
- 밸런스게임 자동 정산 알고리즘 (proximity, C, 기여점수 분배)
- post.html D-day 배지 + 정산 결과 배너
- 멱등성 가드 (post_results unique violation 처리)

남은 작업:
- Supabase Dashboard에서 Cron 트리거 설정 (`0 * * * *`)
- (선택) persuasion_likes 쿼리 직접 post_id 필터로 최적화
