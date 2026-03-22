# Plan: credit-mypage

> 작성일: 2026-03-22 | Phase: Plan

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 크레딧 정산(settle-balance-games)이 완료됐지만 사용자가 자신의 크레딧 잔액과 획득 이력을 확인할 방법이 없어, 크레딧 경제의 동기 부여 효과가 반감됨 |
| **Solution** | mypage.html에 크레딧 잔액 stat 카드와 이력 섹션을 추가하고, `credit_balances` 뷰 + `credits` 테이블을 조회해 표시 |
| **Function UX Effect** | 마이페이지 방문만으로 잔액 확인 + reason별(가입보너스·승리·제작자) 이력 리스트로 "어떻게 벌었는지" 즉시 파악 가능 |
| **Core Value** | 크레딧 획득 가시화로 밸런스게임 참여·제작 동기 강화 — "내가 얼마나 이겼는지" 확인되는 순간 재방문율 상승 |

---

## 1. 배경 및 목적

settle-balance-games Edge Function으로 크레딧 정산이 자동화됐으나, 사용자 화면에서는 확인 불가.

현재 mypage.html stats-grid:
- 내 게시물 / 전체 조회수 / 받은 좋아요 / 팔로워 / 설득한 인원

추가 필요:
- **크레딧 잔액** (stat 카드 1개)
- **크레딧 이력** (별도 섹션, 최근 20건)

DB 기반:
- `credit_balances` 뷰 — `user_id, balance` (credits 테이블 SUM)
- `credits` 테이블 — `id, user_id, amount, reason, post_id, created_at`
- RLS: 본인 기록만 SELECT 가능 (credentials: anon key 사용 가능)

---

## 2. 기능 요구사항

### 2-1. 크레딧 잔액 stat 카드

- `#statCredits` — stats-grid에 추가
- 값: `credit_balances` 뷰에서 본인 `balance` 조회
- 단위: 숫자 + "C" 접미어 표시 (예: "127C")
- 로딩 전: "—" 표시

### 2-2. 크레딧 이력 섹션

- `#creditHistory` — 내 게시물 섹션 위에 위치
- `credits` 테이블에서 본인 기록 최근 20건 조회 (`order: created_at desc`)
- 각 항목 표시:
  - reason 레이블 (한글 매핑)
  - amount (+ 부호 포함, 예: +30)
  - post_id가 있으면 게시물 링크
  - 날짜 (`relativeTime()`)

### 2-3. reason 매핑

| reason | 표시 레이블 | 색상 |
|--------|------------|------|
| `signup_bonus` | 가입 보너스 | 파랑(accent) |
| `vote_win` | 투표 승리 | 초록 |
| `creator_reward` | 게임 제작자 | 오렌지(gold) |

### 2-4. 빈 상태

- 이력이 없으면 "아직 크레딧 이력이 없습니다." 안내
- 크레딧 획득 방법 힌트: "밸런스게임에 참여하고 승리하면 크레딧을 얻어요"

---

## 3. 구현 범위

| 파일 | 변경 내용 |
|------|----------|
| `platform/mypage.html` | stats-grid에 `#statCredits` 카드 추가, `#creditHistory` 섹션 추가 |
| `platform/js/mypage.js` | `loadCredits()` 함수 추가 (잔액 + 이력), `init()`에서 호출 |
| `platform/css/style.css` | `.credit-history-item`, `.credit-reason-badge` 스타일 추가 |

---

## 4. 기술 제약

- **RLS**: `credits` 테이블은 `auth.uid() = user_id` SELECT 정책 — anon key로 접근 가능 (로그인 필수)
- **`credit_balances` 뷰**: `credits` 테이블 RLS 상속 → 마찬가지로 본인 잔액만 반환
- **최대 조회**: 최근 20건 (무한 스크롤 불필요, 간단한 이력만)
- **post 링크**: `post_id`가 있으면 `post.html?id=` 링크, 없으면 plain text (signup_bonus는 post_id null)

---

## 5. 구현 순서

1. `mypage.html` — `#statCredits` 카드, `#creditHistory` div 추가
2. `mypage.js` — `loadCredits()`: `credit_balances` + `credits` 병렬 조회
3. `mypage.js` — `renderCreditHistory()`: reason 매핑 + 리스트 렌더
4. `mypage.js` — `init()`에 `loadCredits()` 호출 추가
5. `style.css` — 이력 리스트 + 배지 스타일

---

## 6. 위험 요소

| 위험 | 대응 |
|------|------|
| credit_balances 뷰에서 잔액 없음 | maybeSingle() → null 처리 → 0 표시 |
| credits 쿼리 느림 | 최근 20건 limit + created_at 인덱스 활용 |
| signup_bonus의 post_id=null | 링크 렌더 시 post_id 존재 여부 분기 처리 |
