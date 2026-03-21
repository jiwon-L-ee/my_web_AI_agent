# DB 스키마 & 쿼리 패턴

## 테이블 스키마

```
profiles      (id uuid PK → auth.users, username, avatar_url, bio)
posts         (id, user_id→profiles, title, description, category CHECK, model_url, thumbnail_url, view_count, option_a, option_b)
likes         (id, user_id, post_id, UNIQUE(user_id,post_id))
comments      (id, user_id, post_id, content, side CHECK('A','B') nullable)
comment_likes (id, user_id→profiles, comment_id→comments, UNIQUE(user_id,comment_id))
follows       (follower_id, following_id, PK 복합)
votes         (id, user_id→profiles, post_id→posts, choice CHECK('A','B'), UNIQUE(user_id,post_id))
```

`comments.side` — 투표 진영 태깅. 밸런스게임/OX퀴즈에서 댓글 작성 시 현재 투표 choice 자동 주입.

## 인덱스

```
posts(user_id), posts(created_at desc), posts(view_count desc)
likes(post_id, user_id)
comments(post_id), comments(post_id, side)
comment_likes(comment_id), comment_likes(user_id)
follows(following_id, follower_id)
votes(post_id), votes(user_id)
```

## 마이그레이션

| 파일 | 내용 | 상태 |
|------|------|------|
| `supabase/migrations/20260319_create_platform_tables.sql` | 기본 테이블 생성 | 적용완료 |
| `supabase/migrations/20260320_balance_game.sql` | votes 테이블, option_a/b 컬럼 | 적용완료 |
| `supabase/migrations/20260321_comment_likes.sql` | comment_likes + comments.side | 적용완료 |

## Promise.all + count 쿼리 패턴

```js
// ❌ 금지: Promise.all 내부에서 await 혼용
const results = await Promise.all([
  query1,
  query2.in('post_id', await getIds()), // await가 Promise.all 안에 있으면 안 됨
]);

// ✅ 올바른 패턴: await를 밖에서 먼저 처리
const ids = await getIds();
const results = await Promise.all([
  query1,
  ids.length ? query2.in('post_id', ids) : Promise.resolve({ count: 0 }),
]);
```

## 투표 토글 로직 (post.js / vote-modal.js 공통)

| 상태 | 동작 |
|------|------|
| 비로그인 | `login.html?next=...` 리다이렉트 |
| 같은 선택 재클릭 | DELETE (취소) |
| 다른 선택으로 변경 | UPDATE |
| 신규 투표 | INSERT |

- **중복 클릭 방지**: `isVoting` boolean 플래그 — async 처리 중 재진입 차단
- **댓글 삭제**: 반드시 `.eq('user_id', currentUser.id)` 포함 (RLS + 클라이언트 이중 방어)
- **votes(count) 집계**: PostgREST v10+ 필요. 에러 시 별도 count 쿼리로 분리

## 댓글 진영(side) 태깅

```js
// submitComment — 투표 후 댓글 작성 시 자동 태깅
const side = (['밸런스게임', 'OX퀴즈'].includes(post?.category) && userVote)
  ? userVote  // 'A' | 'B'
  : null;
const insertData = { user_id, post_id, content };
if (side) insertData.side = side;
```

## 댓글 좋아요 (post.js)

- `loadComments()` → `comment_likes(count)` 포함 조회 + 유저 좋아요 목록 별도 IN 쿼리 (N+1 방지)
- 이벤트 위임: `#commentList` → `.comment-like-btn` 클릭
- 취소: `.delete().eq('comment_id', id).eq('user_id', currentUser.id)`
- `btn.innerHTML` 변경 후 `data-comment-id` 속성 유지됨 (element 속성 ≠ innerHTML)

## Storage

- **버킷**: `thumbnails` (public)
- **업로드 경로**: `{user_id}/{timestamp}.{ext}` — DELETE 정책이 첫 폴더명으로 소유자 확인
- **파일 검증**: MIME 타입 + 2MB 제한 (create.js)
