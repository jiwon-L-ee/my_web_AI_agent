# Design: credit-mypage

> 작성일: 2026-03-22 | Plan 참조: `docs/01-plan/features/credit-mypage.plan.md`

---

## 1. 전체 구조

```
[mypage.html 로드] → mypage.js init()
  ├─ loadProfile()          (기존)
  ├─ loadStats()            (기존)
  ├─ loadCredits()          ← 신규
  │    ├─ credit_balances 뷰 → #statCredits 업데이트
  │    └─ credits 테이블 최근 20건 → renderCreditHistory()
  └─ loadMyPosts()          (기존)
```

---

## 2. HTML 설계 (mypage.html)

### 2-1. #statCredits 카드 (stats-grid에 추가)

```html
<!-- 기존 5개 stat-card 다음에 추가 -->
<div class="stat-card">
  <div id="statCredits" class="stat-val">—</div>
  <div class="stat-label">크레딧 잔액</div>
</div>
```

**삽입 위치**: `#statPersuasion` 카드 다음 (stats-grid 마지막)

### 2-2. #creditHistory 섹션 (내 게시물 위에 추가)

```html
<!-- My posts 섹션 바로 위 -->
<div class="section-title">크레딧 이력</div>
<div id="creditHistory">
  <div class="spinner-wrap"><div class="spinner"></div></div>
</div>
```

**삽입 위치**: `<!-- My posts -->` div 바로 앞

---

## 3. mypage.js 설계

### 3-1. loadCredits() — 진입점

```javascript
async function loadCredits() {
  // 병렬: 잔액 + 이력 동시 조회
  const [balanceRes, historyRes] = await Promise.all([
    db.from('credit_balances')
      .select('balance')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
    db.from('credits')
      .select('id, amount, reason, post_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  // 잔액 stat 카드
  const balance = balanceRes.data?.balance ?? 0;
  document.getElementById('statCredits').textContent = fmtNum(Math.floor(balance)) + 'C';

  // 이력 섹션
  renderCreditHistory(historyRes.data ?? []);
}
```

### 3-2. renderCreditHistory() — 이력 렌더

```javascript
const CREDIT_REASON_LABELS = {
  signup_bonus:    { label: '가입 보너스',  cls: 'credit-reason-bonus'   },
  vote_win:        { label: '투표 승리',    cls: 'credit-reason-win'     },
  creator_reward:  { label: '게임 제작자',  cls: 'credit-reason-creator' },
  post_create:     { label: '게임 생성',    cls: 'credit-reason-spend'   },
  vote_change:     { label: '투표 변경',    cls: 'credit-reason-spend'   },
};

function renderCreditHistory(items) {
  const el = document.getElementById('creditHistory');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `
      <div class="credit-history-empty">
        <p>아직 크레딧 이력이 없습니다.</p>
        <p class="credit-history-hint">밸런스게임에 참여하고 승리하면 크레딧을 얻어요</p>
      </div>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const meta   = CREDIT_REASON_LABELS[item.reason] ?? { label: item.reason, cls: '' };
    const sign   = item.amount >= 0 ? '+' : '';
    const amtStr = sign + Math.floor(item.amount) + 'C';
    const amtCls = item.amount >= 0 ? 'credit-amount-plus' : 'credit-amount-minus';
    const postLink = item.post_id
      ? `<a href="post.html?id=${escapeHtml(item.post_id)}" class="credit-post-link">게시물 보기</a>`
      : '';
    return `
      <div class="credit-history-item">
        <span class="credit-reason-badge ${escapeHtml(meta.cls)}">${escapeHtml(meta.label)}</span>
        <span class="credit-history-date">${escapeHtml(relativeTime(item.created_at))}</span>
        ${postLink}
        <span class="credit-amount ${escapeHtml(amtCls)}">${escapeHtml(amtStr)}</span>
      </div>`;
  }).join('');
}
```

### 3-3. init() 수정

```javascript
async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  await loadProfile();
  await loadStats();
  await loadCredits();   // ← 추가 (loadStats 다음)
  await loadMyPosts();
  // ... 기존 이벤트 리스너
}
```

---

## 4. CSS 설계

### 4-1. stats-grid 컬럼 수 업데이트

```css
/* 기존 5 → 6으로 변경 */
.stats-grid { grid-template-columns: repeat(6, 1fr) !important; }

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
}
```

> **주의**: `style.css` 하단에 이미 `repeat(5, 1fr) !important` 오버라이드가 있음 → 해당 값을 6으로 수정

### 4-2. 크레딧 이력 아이템

```css
/* 크레딧 이력 섹션 */
#creditHistory {
  margin-bottom: 32px;
}

.credit-history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
}

.credit-reason-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.credit-reason-bonus   { background: rgba(113,216,247,0.12); color: #71d8f7; border: 1px solid rgba(113,216,247,0.25); }
.credit-reason-win     { background: rgba(46,213,115,0.12);  color: #2ed573; border: 1px solid rgba(46,213,115,0.25); }
.credit-reason-creator { background: rgba(255,201,71,0.12);  color: #ffc947; border: 1px solid rgba(255,201,71,0.25); }
.credit-reason-spend   { background: rgba(255,99,99,0.10);   color: #ff6363; border: 1px solid rgba(255,99,99,0.2); }

.credit-history-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  flex: 1;
}

.credit-post-link {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.credit-post-link:hover { color: var(--accent); }

.credit-amount {
  font-size: 0.9rem;
  font-weight: 700;
  flex-shrink: 0;
}
.credit-amount-plus  { color: #2ed573; }
.credit-amount-minus { color: #ff6363; }

/* 빈 상태 */
.credit-history-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.credit-history-hint {
  margin-top: 6px;
  font-size: 0.78rem;
  opacity: 0.7;
}
```

---

## 5. 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `platform/mypage.html` | `#statCredits` stat-card 추가, `#creditHistory` 섹션 추가 |
| `platform/js/mypage.js` | `loadCredits()`, `renderCreditHistory()`, `CREDIT_REASON_LABELS` 추가; `init()`에 호출 추가 |
| `platform/css/style.css` | stats-grid `repeat(5→6, 1fr)` 수정; 이력 아이템 스타일 추가 |

---

## 6. 주의사항

- **escapeHtml()**: reason class 및 amtStr도 반드시 escapeHtml 적용
- **textContent vs innerHTML**: `escapeHtml` 없이 직접 출력하면 XSS 위험 — `renderCreditHistory`는 innerHTML 사용이므로 모든 동적 값 escapeHtml 필수
- **Promise.all 패턴**: `loadCredits` 내부 balanceRes + historyRes는 독립 쿼리 → `Promise.all` 사용
- **fmtNum**: 잔액은 `Math.floor(balance)` 후 fmtNum 적용 (소수점 제거)
- **stats-grid !important**: CSS 기존 오버라이드가 `!important`이므로 동일한 selector에서 수정 필요

---

## 7. 구현 순서 (Do Phase)

1. `mypage.html` — `#statCredits` 카드, `#creditHistory` div 추가
2. `style.css` — stats-grid 컬럼 5→6, 이력 스타일 추가
3. `mypage.js` — `CREDIT_REASON_LABELS`, `renderCreditHistory()` 추가
4. `mypage.js` — `loadCredits()` 추가
5. `mypage.js` — `init()`에 `await loadCredits()` 호출 추가
6. 로컬 서버에서 확인 (credits 데이터 없는 경우 빈 상태 포함)
