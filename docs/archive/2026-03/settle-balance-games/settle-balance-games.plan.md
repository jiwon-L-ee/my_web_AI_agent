# Plan: settle-balance-games

> 작성일: 2026-03-22 | Phase: Plan

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 밸런스게임이 만료되어도 크레딧 정산이 자동으로 이루어지지 않아, 승리팀과 제작자가 보상을 받지 못하고 있음 |
| **Solution** | Supabase Edge Function + Cron 트리거로 매 시간 만료된 게임을 탐지·정산하고 credits 테이블에 자동 INSERT |
| **Function UX Effect** | 정산 후 post.html에 결과 배너(승리팀, 제작자 획득 크레딧) 및 D-day 배지 표시 — 사용자는 아무 액션 없이 크레딧을 수령 |
| **Core Value** | "팽팽한 논쟁일수록 더 많이 받는" C = proximity × N × K 공식이 실제 크레딧으로 실현됨 — 크레딧 경제의 완성 |

---

## 1. 배경 및 목적

크레딧 시스템(Phase 1) 구현 완료 후 마지막 미구현 핵심 기능.
게임 만료 시 정산이 없으면:
- 가입 보너스(+30) 소진 후 크레딧 획득 경로 없음
- 제작자 인센티브 구조 작동 불가
- 승리팀 보상 미지급

---

## 2. 기능 요구사항

### 2-1. 정산 트리거
- **Cron 주기**: 매 시간 (예: `0 * * * *`)
- **탐지 조건**: `posts WHERE category = '밸런스게임' AND expires_at <= now() AND id NOT IN (SELECT post_id FROM post_results)`
- **중복 실행 방지**: `post_results.credits_paid = true` 확인 후 스킵

### 2-2. 정산 로직 (credit-system.md 기반)

```
1. 투표 집계
   - 전체 투표수, A/B 각 투표수
   - 로그인 투표자(user_id NOT NULL) 수만 C 계산에 사용

2. 근접도 계산
   proximity = 1 - |pctA - 50| / 50   (0.00 ~ 1.00)

3. C 계산 (공통 기반)
   C = Math.round(proximity × loggedInVoters × K)   K = 1.0

4. 승리 진영 결정
   votesA > votesB → 'A' | votesB > votesA → 'B' | 동률 → 'tie'

5. 제작자 보상
   credits INSERT: { user_id: post.user_id, amount: C, reason: 'creator_reward' }

6. 승리팀 분배
   기여점수 = (persuasion_likes × 3) + (comment_likes × 1)
   팀 총 기여점수 > 0: 개인 = C × (개인점수 / 팀총점수)
   팀 총 기여점수 = 0: 균등 = C / 승리자수
   credits bulk INSERT (reason: 'vote_win')

7. 동률 처리
   양 팀 로그인 투표자 전원: amount = C / 전체_로그인_투표자
   (제작자 보상 포함)

8. post_results INSERT (정산 기록)
   → credits_paid = true 마킹
```

### 2-3. UI 연동 (post.html / post.js)

| 상태 | 표시 |
|------|------|
| 진행 중 (D > 0) | `만료까지 D-N` 배지 |
| 마감 1시간 전 | 블라인드 배너 (기구현) |
| 만료 후 (정산 완료) | 결과 배너: 승리팀 + 제작자 보상액 |
| 만료 후 (정산 중) | "집계 중..." 표시 |

---

## 3. 구현 범위

### Phase 1 (이번 구현)
- [ ] `supabase/functions/settle-balance-games/index.ts` — 정산 Edge Function
- [ ] Cron 트리거 설정 (`supabase/functions/settle-balance-games/schedule.sql` 또는 Dashboard)
- [ ] `platform/js/post.js` — `loadPostResult()` 함수 (post_results 조회)
- [ ] `platform/js/post.js` — D-day 배지 렌더링
- [ ] `platform/js/post.js` — 정산 결과 배너 렌더링
- [ ] `platform/post.html` — 결과 배너 HTML 추가

### Phase 2 (별도 PDCA)
- mypage 크레딧 잔액 + 이력 UI

---

## 4. 기술 제약

- **Supabase Edge Function**: Deno 런타임, TypeScript
- **Cron**: Supabase Dashboard → Edge Functions → Schedule 설정 또는 `pg_cron` 확장
- **RLS**: Edge Function은 `service_role` 키로 실행 → RLS 우회 가능 (credits 정책과 무관)
- **멱등성**: 같은 post_id에 대해 중복 실행 방지 필수 (`credits_paid` 플래그)
- **원자성**: credits bulk INSERT 실패 시 post_results도 롤백 필요 → DB 트랜잭션 or 순서 보장

---

## 5. 구현 순서

1. Edge Function 기본 구조 + Supabase 클라이언트 (service_role)
2. 만료 게임 탐지 쿼리
3. 정산 로직 (proximity → C → 기여점수 → credits INSERT)
4. post_results INSERT + credits_paid 마킹
5. Cron 트리거 설정
6. post.js D-day 배지 + 결과 배너
7. 로컬 테스트 (만료 게임 수동 생성 후 Function invoke)

---

## 6. 위험 요소

| 위험 | 대응 |
|------|------|
| 중복 정산 | `credits_paid` 플래그 + upsert 패턴 |
| 로그인 투표자 0명 | C = 0 → credits INSERT 스킵, post_results만 기록 |
| 제작자 탈퇴 | `credits.user_id` FK `ON DELETE CASCADE` — 탈퇴 시 자동 정리 |
| Edge Function 타임아웃 | 대량 게임 동시 만료 시 → 배치 처리 (limit 50) |
