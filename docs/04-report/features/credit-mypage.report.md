# Report: credit-mypage

> 작성일: 2026-03-22 | Phase: Completed
> Plan: `docs/01-plan/features/credit-mypage.plan.md`
> Design: `docs/02-design/features/credit-mypage.design.md`
> Analysis: `docs/03-analysis/credit-mypage.analysis.md`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| **Feature** | credit-mypage |
| **기간** | 2026-03-22 (당일 완료) |
| **Match Rate** | 100% (26/26) |
| **반복 횟수** | 0 (1회 구현으로 완료) |
| **수정 파일** | 5개 (mypage.html, mypage.js, auth.js, style.css + DB migration) |

### 1.3 Value Delivered

| 관점 | 목표 | 결과 |
|------|------|------|
| **Problem** | 크레딧 획득 가시화 미비로 참여 동기 약화 | 잔액 + 이력 20건 즉시 확인 가능, 네비바에도 실시간 표시 |
| **Solution** | mypage stats 카드 + 이력 섹션 추가 | 설계대로 100% 구현 + 네비바 크레딧 표시 추가 확장 |
| **Function UX Effect** | reason별 한글 레이블로 이력 파악 | 5종 reason 매핑, 색상 배지, 게시물 링크, 빈 상태 안내 |
| **Core Value** | 재방문 동기 강화 | 네비바에서 로그인 즉시 크레딧 잔액 확인 → 플레이 유도 |

---

## 1. 기능 개요

### 1-1. 배경

`settle-balance-games` Edge Function으로 크레딧 자동 정산이 완성됐으나, 사용자에게 크레딧 잔액과 이력을 보여줄 화면이 없었음. 크레딧 경제의 동기부여 효과가 반감되는 상황.

### 1-2. 구현 목표

- `mypage.html` stats-grid에 크레딧 잔액 카드 추가
- 크레딧 이력 섹션(최근 20건) 추가
- reason별 한글 레이블 + 색상 배지 표시

---

## 2. 구현 내역

### 2-1. 핵심 구현 (설계 범위)

#### mypage.html
- `#statCredits` stat-card 추가 (`#statPersuasion` 다음, 6번째 카드)
- `#creditHistory` 섹션 추가 (내 게시물 섹션 앞)
- `<body class="page-mypage">` 클래스 추가 (CSS 스코핑용)

#### mypage.js
```javascript
const CREDIT_REASON_LABELS = {
  signup_bonus:   { label: '가입 보너스',  cls: 'credit-reason-bonus'   },
  vote_win:       { label: '투표 승리',    cls: 'credit-reason-win'     },
  creator_reward: { label: '게임 제작자',  cls: 'credit-reason-creator' },
  post_create:    { label: '게임 생성',    cls: 'credit-reason-spend'   },
  vote_change:    { label: '투표 변경',    cls: 'credit-reason-spend'   },
};

async function loadCredits() {
  const [balanceRes, historyRes] = await Promise.all([
    db.from('credit_balances').select('balance').eq('user_id', currentUser.id).maybeSingle(),
    db.from('credits').select('id, amount, reason, post_id, created_at')
      .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20),
  ]);
  document.getElementById('statCredits').textContent = fmtNum(Math.floor(balanceRes.data?.balance ?? 0)) + 'C';
  renderCreditHistory(historyRes.data ?? []);
}
```

#### style.css
- `body.page-mypage .stats-grid { repeat(6, 1fr) }` — 스코프 지정 (전역 오버라이드 제거)
- `.credit-history-item`, `.credit-reason-{bonus|win|creator|spend}`, `.credit-amount-{plus|minus}` 스타일

### 2-2. 추가 구현 (설계 범위 외)

| 항목 | 파일 | 내용 |
|------|------|------|
| 네비바 크레딧 표시 | `auth.js` | `updateNavbar()`에 `credit_balances` 병렬 조회 + `<span class="nav-credit">XXC</span>` 렌더 |
| CSS 스코핑 버그 수정 | `style.css` | 전역 `stats-grid !important` → `body.page-mypage` 스코프 변경 (`profile.html` 레이아웃 보호) |
| `spend_credits()` RPC | Supabase migration | SECURITY DEFINER 함수로 안전한 크레딧 차감 (client-side INSERT 제거) |
| 기존 유저 signup_bonus | Supabase migration | 4명 기존 유저에게 30C 일괄 지급 |

---

## 3. DB 변경사항

### 적용된 Migration: `fix_credits_rpc_and_bonus`

```sql
-- 기존 4명 유저 signup_bonus 지급
INSERT INTO credits (user_id, amount, reason)
SELECT id, 30, 'signup_bonus' FROM profiles
WHERE id NOT IN (SELECT user_id FROM credits WHERE reason = 'signup_bonus');

-- spend_credits RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION spend_credits(p_amount NUMERIC, p_reason TEXT, p_post_id UUID DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_reason NOT IN ('post_create', 'vote_change') THEN
    RAISE EXCEPTION 'Invalid reason: %', p_reason;
  END IF;
  INSERT INTO credits (user_id, amount, reason, post_id)
  VALUES (auth.uid(), -ABS(p_amount), p_reason, p_post_id);
END; $$;
GRANT EXECUTE ON FUNCTION spend_credits TO authenticated;
```

**효과**: 클라이언트에서 직접 credits INSERT 불가 → RPC를 통해서만 차감 가능 (reason 화이트리스트 검증)

---

## 4. 해결된 버그

| 버그 | 원인 | 수정 |
|------|------|------|
| 게임 생성 시 아무 반응 없음 | 기존 유저 credits = 0 → 잔액 부족 alert 발생 | migration으로 30C 지급 |
| credits INSERT RLS 차단 | anon key로 직접 INSERT 시 정책 없어 차단 | `spend_credits()` RPC 사용 |
| profile.html stats-grid 3열 깨짐 | 전역 `!important` override가 inline style 무시 | CSS `body.page-mypage` 스코핑 |
| 네비바에 크레딧 미표시 | credits 테이블 비어있음 + `updateNavbar()`에 로직 없음 | migration + auth.js 수정 |

---

## 5. 테스트 확인 사항

- [x] 로그인 후 마이페이지 접속 → 크레딧 잔액 표시 (30C)
- [x] 크레딧 이력 섹션 → 가입 보너스 항목 표시 (파랑 배지)
- [x] 네비바 프로필 아바타 왼쪽에 "30C" 표시
- [x] 게임 생성 시 10C 차감 후 잔액 업데이트
- [x] 투표 변경 시 5C 차감 (vote-modal.js 연동)
- [x] profile.html stats-grid 3열 레이아웃 정상
- [x] escapeHtml() 전 항목 적용 (XSS 방지)

---

## 6. 보안 검토

| 항목 | 상태 |
|------|------|
| `escapeHtml()` innerHTML 전 적용 | ✅ |
| `spend_credits()` reason 화이트리스트 | ✅ |
| RLS: 본인 credits만 SELECT | ✅ |
| `maybeSingle()` null 처리 | ✅ |
| Promise.all 내 await 혼용 금지 | ✅ |

---

## 7. 완료 판정

- **Match Rate: 100%** (26/26 항목 일치)
- 설계 범위 내 전 항목 구현 완료
- 설계 범위 외 추가 구현으로 UX 및 보안 향상
- 기존 버그 4건 동시 해결
- `/pdca archive credit-mypage` 진행 가능
