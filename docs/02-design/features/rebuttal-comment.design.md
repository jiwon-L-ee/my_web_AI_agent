# Design: rebuttal-comment

> Plan: `docs/01-plan/features/rebuttal-comment.plan.md`

---

## 1. DB 변경

### 1.1 comments.parent_id 컬럼 추가

```sql
-- supabase/migrations/20260328_rebuttal_comment.sql

-- 1) comments 테이블에 parent_id 추가
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- 2) spend_credits RPC whitelist에 'rebuttal_comment' 추가
CREATE OR REPLACE FUNCTION spend_credits(
  p_amount NUMERIC,
  p_reason TEXT,
  p_post_id UUID DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_reason NOT IN ('post_create', 'vote_change', 'rebuttal_comment') THEN
    RAISE EXCEPTION 'Invalid reason: %', p_reason;
  END IF;
  INSERT INTO credits (user_id, amount, reason, post_id)
  VALUES (auth.uid(), -ABS(p_amount), p_reason, p_post_id);
END;
$$;
GRANT EXECUTE ON FUNCTION spend_credits TO authenticated;
```

### 1.2 데이터 구조

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `parent_id IS NULL` | — | 루트 댓글 (기존 댓글) |
| `parent_id IS NOT NULL` | UUID | 반박 덧글 (대댓글, 1단계만 지원) |

- 덧글의 `side`는 작성자의 `userVote` 기준으로 자동 저장 (루트댓글과 동일)
- 덧글은 루트댓글의 `post_id`를 공유

---

## 2. JS 변경 — post.js

### 2.1 상수 추가 (최상단)

```js
// [BALANCE:REBUTTAL_COST] 반박 덧글 비용: 2 크레딧 → docs/balance.md 참고
const REBUTTAL_COST = 2;
```

### 2.2 loadComments() 변경

**현재 쿼리**:
```js
.select('*,profiles(username,avatar_url),comment_likes(count),persuasion_likes(count)')
.eq('post_id', postId)
.order('created_at', { ascending: true })
```

**변경 후**:
```js
.select('*,profiles(username,avatar_url),comment_likes(count),persuasion_likes(count)')
.eq('post_id', postId)
.is('parent_id', null)            // 루트댓글만 1차 쿼리
.order('created_at', { ascending: true })
```

그리고 덧글을 별도 쿼리로 가져와 그룹핑:

```js
// 루트댓글 ID 목록으로 덧글 일괄 조회
const rootIds = data.map(c => c.id);
const { data: replies } = await db
  .from('comments')
  .select('*,profiles(username,avatar_url),comment_likes(count)')
  .in('parent_id', rootIds)
  .order('created_at', { ascending: true });

// parent_id별 그룹핑
const repliesByParent = {};
(replies ?? []).forEach(r => {
  if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
  repliesByParent[r.parent_id].push(r);
});
```

이후 `renderCommentItem(c, ..., repliesByParent)` 형태로 전달.

### 2.3 renderCommentItem() 변경

**시그니처 변경**:
```js
// 변경 전
function renderCommentItem(c, myLikedCommentIds, isVotePost)
// 변경 후
function renderCommentItem(c, myLikedCommentIds, isVotePost, repliesByParent = {})
```

**반박 버튼 추가**:
```js
// 반박 버튼 표시 조건:
// - 로그인 상태
// - 상대 진영 댓글 (c.side !== userVote, 둘 다 non-null)
// - 만료되지 않은 게시물
// - 루트댓글에만 (parent_id가 없는 댓글에만)
const showRebuttal = currentUser
  && isVotePost
  && c.side
  && userVote
  && c.side !== userVote
  && !isExpiredPost
  && !c.parent_id;  // 덧글에는 반박 버튼 없음

const rebuttalBtn = showRebuttal
  ? `<button class="btn-rebuttal" data-comment-id="${c.id}" aria-label="반박하기">
       반박
     </button>`
  : '';
```

**덧글 목록 렌더링** (댓글 아이템 하단에 추가):
```js
// 이 댓글에 달린 덧글들
const myReplies = repliesByParent[c.id] ?? [];
const repliesHtml = myReplies.length
  ? `<div class="comment-replies">
       ${myReplies.map(r => renderReplyItem(r, myLikedCommentIds)).join('')}
     </div>`
  : '';

// 인라인 반박 폼 자리 (JS로 동적 삽입 — 초기에는 비어있음)
const rebuttalFormPlaceholder = showRebuttal
  ? `<div class="rebuttal-form-wrap" data-parent-id="${c.id}"></div>`
  : '';
```

**반환 HTML 말미에 추가**:
```js
return `
  <div class="comment-item" data-id="${c.id}">
    ...기존 구조...
    <div style="margin-top:6px;...">
      <button class="comment-like-btn...">...</button>
      ${persuasionBtn}
      ${rebuttalBtn}        ← 추가
    </div>
    ${rebuttalFormPlaceholder}  ← 추가
    ${repliesHtml}              ← 추가
  </div>`;
```

### 2.4 renderReplyItem() 함수 추가 (신규)

덧글 전용 렌더 함수. 기존 `renderCommentItem`보다 단순 (반박 버튼 없음, 설득됨 버튼 없음):

```js
function renderReplyItem(r, myLikedCommentIds) {
  const author = r.profiles;
  const isOwn  = currentUser?.id === r.user_id;
  const likeCount = r.comment_likes?.[0]?.count ?? 0;
  const liked  = myLikedCommentIds.has(r.id);

  const profileHref = r.user_id ? `profile.html?id=${escapeHtml(r.user_id)}` : null;
  const avatarHtml = author?.avatar_url
    ? `<img class="comment-avatar comment-avatar-sm" src="${escapeHtml(author.avatar_url)}" alt="">`
    : `<div class="comment-avatar comment-avatar-sm">${escapeHtml((author?.username ?? '?')[0])}</div>`;

  // 덧글 작성자 진영 배지 (c.side 기준)
  const sideBadge = r.side
    ? `<span class="side-badge side-badge-${escapeHtml(r.side.toLowerCase())}">${r.side === 'A' ? '🔵 A진영' : '🟠 B진영'}</span>`
    : '';

  return `
    <div class="comment-item comment-reply" data-id="${r.id}" data-parent-id="${r.parent_id}">
      ${profileHref
        ? `<a href="${profileHref}" class="comment-avatar-link">${avatarHtml}</a>`
        : avatarHtml}
      <div class="comment-body">
        <div class="comment-meta">
          ${profileHref
            ? `<a class="comment-author comment-author-link" href="${profileHref}">${escapeHtml(author?.username ?? '익명')}</a>`
            : `<span class="comment-author">${escapeHtml(author?.username ?? '익명')}</span>`}
          ${sideBadge}
          <span class="comment-time">${relativeTime(r.created_at)}</span>
          ${isOwn ? `<button class="btn-del-comment" data-comment-id="${r.id}" aria-label="덧글 삭제">삭제</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(r.content)}</div>
        <div style="margin-top:6px">
          <button class="comment-like-btn${liked ? ' liked' : ''}" data-comment-id="${r.id}" aria-label="덧글 좋아요">
            ${liked ? '❤️' : '🤍'} <span class="clk-count">${likeCount}</span>
          </button>
        </div>
      </div>
    </div>`;
}
```

### 2.5 submitRebuttal(parentCommentId) 함수 추가 (신규)

```js
async function submitRebuttal(parentCommentId) {
  if (isExpiredPost) return;
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  const formWrap = document.querySelector(`.rebuttal-form-wrap[data-parent-id="${parentCommentId}"]`);
  if (!formWrap) return;
  const textarea = formWrap.querySelector('.rebuttal-input');
  const content = textarea?.value.trim();
  if (!content) return;

  // 잔액 확인
  const { data: balanceData } = await db
    .from('credit_balances')
    .select('balance')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  const balance = Number(balanceData?.balance ?? 0);
  if (balance < REBUTTAL_COST) {
    alert(`크레딧이 부족합니다. 현재 잔액: ${balance}크레딧 (반박에는 ${REBUTTAL_COST}크레딧 필요)`);
    return;
  }

  const submitBtn = formWrap.querySelector('.rebuttal-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  const side = userVote ?? null;

  const { error: insertErr } = await db.from('comments').insert({
    user_id: currentUser.id,
    post_id: postId,
    content,
    side,
    parent_id: parentCommentId,
  });

  if (insertErr) {
    alert('반박 작성에 실패했습니다.');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // 크레딧 차감
  await db.rpc('spend_credits', {
    p_amount: REBUTTAL_COST,
    p_reason: 'rebuttal_comment',
    p_post_id: postId,
  });

  // 폼 닫기 및 댓글 재로드
  formWrap.innerHTML = '';
  await loadComments();
}
```

### 2.6 showRebuttalForm(parentCommentId) 함수 추가 (신규)

반박 버튼 클릭 시 인라인 폼 토글:

```js
function showRebuttalForm(parentCommentId) {
  const formWrap = document.querySelector(`.rebuttal-form-wrap[data-parent-id="${parentCommentId}"]`);
  if (!formWrap) return;

  // 이미 열려있으면 닫기 (토글)
  if (formWrap.innerHTML) {
    formWrap.innerHTML = '';
    return;
  }

  // 다른 열린 폼 닫기 (한 번에 하나만)
  document.querySelectorAll('.rebuttal-form-wrap').forEach(el => { el.innerHTML = ''; });

  formWrap.innerHTML = `
    <div class="rebuttal-form">
      <textarea class="rebuttal-input" placeholder="반박 내용을 입력하세요 (Enter 제출, Shift+Enter 줄바꿈)" rows="2"></textarea>
      <div class="rebuttal-form-actions">
        <button class="rebuttal-submit-btn">작성 (크레딧 ${REBUTTAL_COST} 소모)</button>
        <button class="rebuttal-cancel-btn">취소</button>
      </div>
    </div>`;

  const textarea = formWrap.querySelector('.rebuttal-input');
  textarea?.focus();
}
```

### 2.7 이벤트 위임 변경 — commentList 클릭 핸들러

기존 `commentList` 클릭 핸들러에 반박 관련 핸들러 추가:

```js
document.getElementById('commentList')?.addEventListener('click', async e => {
  // 기존: likeBtn, persuasionBtn, editBtn 핸들러 ...

  // 신규: 반박 버튼
  const rebuttalBtn = e.target.closest('.btn-rebuttal');
  if (rebuttalBtn) {
    showRebuttalForm(rebuttalBtn.dataset.commentId);
    return;
  }

  // 신규: 반박 제출
  const rebuttalSubmit = e.target.closest('.rebuttal-submit-btn');
  if (rebuttalSubmit) {
    const formWrap = rebuttalSubmit.closest('.rebuttal-form-wrap');
    const parentId = formWrap?.dataset.parentId;
    if (parentId) await submitRebuttal(parentId);
    return;
  }

  // 신규: 반박 취소
  const rebuttalCancel = e.target.closest('.rebuttal-cancel-btn');
  if (rebuttalCancel) {
    const formWrap = rebuttalCancel.closest('.rebuttal-form-wrap');
    if (formWrap) formWrap.innerHTML = '';
    return;
  }

  // 기존: editBtn ...
  // 기존: deleteBtn (btn-del-comment) — 덧글 삭제도 동일 패턴으로 처리됨
});
```

**Enter 키 제출** — commentList 레벨 keydown 위임:

```js
document.getElementById('commentList')?.addEventListener('keydown', e => {
  if (e.target.classList.contains('rebuttal-input') && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const formWrap = e.target.closest('.rebuttal-form-wrap');
    const parentId = formWrap?.dataset.parentId;
    if (parentId) submitRebuttal(parentId);
  }
});
```

---

## 3. CSS 변경 — style.css

```css
/* 반박 덧글 컨테이너 */
.comment-replies {
  margin-top: 8px;
  margin-left: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 2px solid var(--surface2);
  padding-left: 10px;
}

/* 덧글 아이템 (기존 .comment-item 상속) */
.comment-reply {
  font-size: 0.88rem;
}

/* 덧글용 소형 아바타 */
.comment-avatar-sm {
  width: 24px !important;
  height: 24px !important;
  font-size: 0.65rem !important;
}

/* 반박 버튼 */
.btn-rebuttal {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--surface2);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  margin-left: 4px;
}
.btn-rebuttal:hover {
  background: var(--surface2);
  color: var(--text);
}

/* 반박 폼 */
.rebuttal-form {
  margin-top: 8px;
  margin-left: 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rebuttal-input {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  background: var(--surface2);
  border: 1px solid var(--surface2);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.88rem;
  resize: vertical;
  box-sizing: border-box;
}
.rebuttal-input:focus {
  outline: none;
  border-color: var(--accent);
}
.rebuttal-form-actions {
  display: flex;
  gap: 6px;
}
.rebuttal-submit-btn {
  padding: 4px 10px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
}
.rebuttal-submit-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.rebuttal-cancel-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--surface2);
  border-radius: 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
  cursor: pointer;
}
```

---

## 4. 파일별 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `supabase/migrations/20260328_rebuttal_comment.sql` | `comments.parent_id` 추가, `spend_credits` whitelist 업데이트 |
| `platform/js/post.js` | `REBUTTAL_COST` 상수, `loadComments` 쿼리 분리, `renderCommentItem` 반박 버튼+덧글, `renderReplyItem`, `submitRebuttal`, `showRebuttalForm`, 이벤트 위임 확장 |
| `platform/css/style.css` | `.comment-replies`, `.comment-reply`, `.comment-avatar-sm`, `.btn-rebuttal`, `.rebuttal-form*` |

---

## 5. 주요 설계 결정

| 결정 | 이유 |
|------|------|
| 덧글 쿼리를 루트댓글과 분리 (2-pass) | Supabase PostgREST embedded join으로 recursive 관계 처리가 복잡 → 별도 쿼리 후 JS 그룹핑이 단순 |
| 이벤트 위임 유지 (commentList 단일 등록) | CLAUDE.md 이벤트 위임 규칙 준수. `{ once: true }` 절대 금지 |
| 덧글에 수정 기능 미지원 | 반박 특성상 수정보다 삭제 후 재작성이 자연스러움. 복잡도 최소화 |
| 설득됨(persuasion_likes) 덧글에 미적용 | 설득됨은 투표 변경 후 가능 — 개념상 루트댓글 대상. 덧글까지 확장 시 집계 복잡도 증가 |
| 잔액 확인을 RPC 전에 수행 | UX 개선 — 잔액 부족 시 실패 대신 즉각 안내 |
| 반박 폼 한 번에 하나만 열기 | 여러 폼 동시 열기 방지 → 사용자 혼란 감소 |

---

## 6. 완료 기준 (체크리스트)

- [ ] `comments.parent_id` 컬럼 존재
- [ ] `spend_credits` whitelist에 `'rebuttal_comment'` 포함
- [ ] 상대 진영 루트댓글에만 "반박" 버튼 표시
- [ ] 반박 버튼 클릭 → 인라인 폼 토글 (이미 열려있으면 닫기)
- [ ] 반박 제출 시 크레딧 잔액 확인 (부족 시 alert)
- [ ] 반박 제출 성공 → comments INSERT + spend_credits 차감
- [ ] 덧글이 루트댓글 하단에 들여쓰기로 표시
- [ ] 덧글에 좋아요 작동
- [ ] 덧글 삭제 작동 (작성자 본인만)
- [ ] 만료 게시물에서 반박 버튼 미표시
- [ ] Enter 키로 반박 제출 (Shift+Enter = 줄바꿈)
- [ ] XSS 방어 (escapeHtml 전체 적용)
- [ ] inline onclick 없음 (이벤트 위임 방식)
