# 맞불 크레딧 밸런스 설정 문서

> 각 항목 옆의 `[BALANCE:TAG]` 를 에디터에서 검색하면
> 해당 값이 사용되는 모든 코드 위치를 즉시 찾을 수 있습니다.

---

## 크레딧 획득

| 항목 | 현재 값 | 태그 | 관련 파일 |
|------|---------|------|----------|
| 신규 가입 보너스 | **+30 크레딧** | `BALANCE:SIGNUP_BONUS` | `supabase/migrations/20260322_credit_system.sql` |
| 투표 승리 보상 | 기여도 비례 (미정산 Edge Function) | `BALANCE:VOTE_WIN` | 정산 Edge Function (미구현) |
| 게임 제작자 근접도 보상 | 게임 결과에 따라 자동 산정 | `BALANCE:CREATOR_REWARD` | `platform/js/post.js` |

---

## 크레딧 소비

### 밸런스게임 생성

| 항목 | 현재 값 | 태그 | 관련 파일 |
|------|---------|------|----------|
| 기본 비용 (3일) | **10 크레딧** | `BALANCE:GAME_CREATE_BASE` | `create.js`, `create.html` |
| 기간 추가 1일당 비용 | **+5 크레딧** | `BALANCE:GAME_CREATE_PER_DAY` | `create.js`, `create.html` |
| 최대 허용 기간 | **7일** | `BALANCE:GAME_MAX_DAYS` | `create.js`, `create.html` |

**비용 공식:**
```
총 비용 = GAME_CREATE_BASE + (선택 일수 - 3) × GAME_CREATE_PER_DAY

예시:
  3일 = 10
  4일 = 10 + 5  = 15
  5일 = 10 + 10 = 20
  6일 = 10 + 15 = 25
  7일 = 10 + 20 = 30
```

#### 비용 변경 시 수정 위치 (2곳)

1. **`platform/js/create.js`** — `calcDurationCost()` 함수 내 숫자
2. **`platform/create.html`** — `#durationRow` 버튼의 `.dur-cost` 텍스트 (표시용)

> 두 곳의 숫자를 반드시 함께 수정해야 합니다.

---

### 투표 변경

| 항목 | 현재 값 | 태그 | 관련 파일 |
|------|---------|------|----------|
| 투표 변경 비용 | **-5 크레딧** | `BALANCE:VOTE_CHANGE_COST` | `post.js`, `credit_system.sql` |
| 무료 변경 허용 시간 | **1분 (60,000ms)** | `BALANCE:FREE_VOTE_WINDOW` | `post.js` |

#### 비용 변경 시 수정 위치 (3곳)

1. **`platform/js/post.js`** — `p_amount: 5` (RPC 차감 호출)
2. **`platform/js/post.js`** — `credits_spent: 5` (vote_changes 기록)
3. **`supabase/migrations/20260322_credit_system.sql`** — `credits_spent NUMERIC(8,2) DEFAULT 5` (스키마 기본값, 신규 마이그레이션 필요)

---

## 빠른 패치 가이드

에디터에서 전체 검색(`Ctrl+Shift+F`) → 태그 검색 → 해당 줄 값 변경

```
BALANCE:SIGNUP_BONUS      → 가입 보너스 +N 변경
BALANCE:GAME_CREATE_BASE  → 기본 생성 비용 변경
BALANCE:GAME_CREATE_PER_DAY → 일당 추가 비용 변경
BALANCE:GAME_MAX_DAYS     → 최대 기간 변경
BALANCE:VOTE_CHANGE_COST  → 투표 변경 비용 변경
BALANCE:FREE_VOTE_WINDOW  → 무료 변경 허용 시간 변경
```
