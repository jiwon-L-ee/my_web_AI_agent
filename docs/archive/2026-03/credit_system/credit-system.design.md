# 크레딧 시스템 설계서

> 상태: 설계 완료 / 구현 대기
> 최종 수정: 2026-03-22 (v2 — 블라인드투표·베팅 폐지, 구조 단순화)

---

## 1. 설계 철학

> "건전하고 박진감 넘치는 토론 환경"

- **제작자 인센티브**: 한쪽이 압도하는 게임이 아니라 팽팽한 논쟁을 만들수록 보상
- **참여자 인센티브**: 이기는 진영에 투표하면 보상 → 논쟁을 열심히 읽고 판단
- **남용 방지**: 의견 변경에 비용 부과 → 충분히 고민하고 투표하도록 유도

---

## 2. 크레딧 흐름 요약

```
소비 (나가는 것)          │  획득 (들어오는 것)
───────────────────────────┼──────────────────────────────
제작자 밸런스게임 생성     │  제작자: 5:5 근접도 × 로그인 참여자 수
참여자 투표 변경           │  참여자: 승리 진영 투표 시
```

단 두 가지로 소비, 단 두 가지로 획득. 나머지 모든 이전 설계(베팅, 좋아요 보상, 블라인드 투표)는 **폐지**.

---

## 3. 크레딧 소비 규칙

| 행동 | 비용 | 비고 |
|------|------|------|
| 밸런스게임 생성 | **10 크레딧** | 퀴즈·커뮤니티는 무료 |
| 투표 변경 | **5 크레딧** | 1분 이내 취소는 무료 (실수 버퍼) |

> **신규 가입자 보너스**: 30 크레딧 지급 (첫 게시물 생성 + 투표 변경 가능)

---

## 4. 크레딧 획득 규칙

### 핵심 원칙: 제작자 보상 = 승리팀 총 보상

```
C = proximity × 로그인_참여자_수 × 계수(K)

┌─────────────────────────────────────────────────┐
│  제작자 받는 총 크레딧  =  C                     │
│  승리팀 받는 총 크레딧  =  C  (동일)             │
│  승리팀 개인 배분       =  C × (개인 기여도 비율) │
└─────────────────────────────────────────────────┘
```

- 게임이 팽팽할수록(proximity ↑), 참여자가 많을수록(N ↑) **모두가 더 많이 받음**
- 제작자와 승리팀이 동일한 총액을 가져가므로 **이해관계가 일치**
- K(계수)는 초기값 **1.0** (경제 균형 보며 조정)

---

### 4-A. C 계산 공식 (공통 기반)

#### 근접도(proximity)

```
근접도 = 1 - |pctA - 50| / 50      (범위: 0.00 ~ 1.00)
```

| 최종 비율 | 근접도 | 비고 |
|----------|--------|------|
| 50 : 50 | **1.00** | 최대 보상 |
| 60 : 40 | 0.80 | |
| 70 : 30 | 0.60 | |
| 80 : 20 | 0.40 | |
| 90 : 10 | 0.20 | |
| 100 : 0 | **0.00** | 보상 없음 |

#### C 예시 (K = 1.0)

| 시나리오 | 비율 | 근접도 | 로그인 참여자 | **C** |
|---------|------|--------|------------|-------|
| 팽팽한 논쟁 | 52:48 | 0.96 | 200명 | **192 크레딧** |
| 보통 논쟁 | 65:35 | 0.70 | 100명 | **70 크레딧** |
| 한쪽 압도 | 85:15 | 0.30 | 100명 | **30 크레딧** |
| 완전 쏠림 | 100:0 | 0.00 | 50명 | **0 크레딧** |

---

### 4-B. 제작자 보상

```
제작자_크레딧 = C
```

- 팽팽한 게임을 만들수록, 참여자가 많을수록 보상 증가
- 생성 비용 -10 크레딧 차감 후 순이익 = C - 10

---

### 4-C. 승리팀 보상: C를 기여도로 분배

#### 개인 기여도 점수

```
기여점수 = (설득됨_포인트 × 3) + (댓글_좋아요_합계 × 1)
```

| 지표 | 원천 테이블 | 가중치 | 공개 여부 |
|------|-----------|--------|---------|
| 설득됨 포인트 | `persuasion_likes` | × 3 | **비공개** |
| 댓글 좋아요 | `comment_likes` | × 1 | 공개 |

#### 개인 크레딧 배분

```
팀_총_기여점수 = 승리팀 전원의 기여점수 합산

개인_크레딧 =
  기여점수 > 0인 경우: C × (개인_기여점수 / 팀_총_기여점수)
  팀 전원 기여점수 = 0인 경우: C / 승리팀_인원  (균등 분배)
```

---

### 4-D. 보상 비교 요약

```
밸런스게임 1개 만료 시 총 발행 크레딧:

  제작자:   C      (= proximity × 로그인참여자 × K)
  승리팀:   C      (= 제작자와 동일)
  ────────────────
  합계:    2C

  단, 제작자가 생성 시 -10 소비, 패배팀은 0
```

---

## 5. 경제 시뮬레이션 (검증)

**일반 밸런스게임 1개 기준 (60:40, 로그인 100명)**

| 역할 | 크레딧 변화 |
|------|-----------|
| 제작자 (생성) | -10 |
| 제작자 (보상) | +40 (proximity 0.8 × 100명 × 0.5) |
| 제작자 순이익 | **+30** |
| 승리 진영 60명 | 각 +10 → 총 +600 |
| 패배 진영 40명 | 0 |
| 투표 변경 1명 | -5 |

**팽팽한 게임 (51:49, 로그인 200명)이 제작자에게 최고의 시나리오**:
- proximity = 0.98
- 제작자 보상 = 0.98 × 200 × 0.5 = 98크레딧 → 생성 비용 10 차감 후 **+88 크레딧**

---

## 6. 크레딧 소비 상세 — 투표 변경 플로우

→ 상세 UX/DB 설계: `docs/02-design/vote-flow.md` 참조

- 투표 변경 시: 상대 진영 댓글 중 하나를 설득됨으로 **필수 선택**
- credits 기록: `reason = 'vote_change'`, `amount = -5`
- 1분 이내 취소: 크레딧 차감 없이 자유 변경 가능

---

## 7. DB 설계

### 신규 컬럼: `posts.expires_at`
```sql
ALTER TABLE posts ADD COLUMN expires_at TIMESTAMPTZ;
-- 밸런스게임: expires_at = created_at + INTERVAL '7 days'
-- 퀴즈·커뮤니티·정보: NULL (만료 없음)
```

### 신규 테이블: `credits`
```sql
CREATE TABLE credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(8,2) NOT NULL,
  reason      TEXT NOT NULL,
  post_id     UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 신규 테이블: `post_results`
```sql
CREATE TABLE post_results (
  post_id          UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  winning_side     TEXT,
  votes_a          INT DEFAULT 0,
  votes_b          INT DEFAULT 0,
  logged_in_voters INT DEFAULT 0,
  proximity        NUMERIC(5,4),
  creator_reward   INT DEFAULT 0,
  credits_paid     BOOLEAN DEFAULT false,
  resolved_at      TIMESTAMPTZ DEFAULT now()
);
```

### 신규 테이블: `vote_changes`
```sql
CREATE TABLE vote_changes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_choice  TEXT NOT NULL,
  to_choice    TEXT NOT NULL,
  comment_id   UUID REFERENCES comments(id) ON DELETE SET NULL,
  credits_spent INT DEFAULT 5,
  changed_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. 정산 로직 (Edge Function)

→ `supabase/functions/settle-balance-games/index.ts`
→ C = Math.round(proximity × loggedInVoters.length × 1.0) 공식 사용
→ 기여점수 = (설득됨×3) + (좋아요×1), 0이면 균등 분배

---

## 9. UI 변경 사항

- `create.html`: 크레딧 안내 표시
- `post.html`: 만료 D-day 배지, 결과 배너 (Phase 2)
- `mypage.html`: 크레딧 잔액 + 이력 (Phase 2)

---

## 10. 구현 우선순위

1. DB 마이그레이션 ✅
2. 신규 가입 30크레딧 지급 ✅
3. `post.js` 투표 변경 ✅
4. `create.js` 잔액 확인 + 차감 ✅
5. 만료 처리 Edge Function (Phase 2)
6. `mypage.js` 크레딧 UI (Phase 2)
7. `post.html` D-day 배지 (Phase 2)
