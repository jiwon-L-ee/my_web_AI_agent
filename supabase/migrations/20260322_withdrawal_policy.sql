-- 회원 탈퇴 시 데이터 처리 정책
-- posts.user_id, comments.user_id → ON DELETE SET NULL (게시물·댓글 익명화 보존)
-- likes, votes, follows, comment_likes, persuasion_likes → CASCADE 삭제 (auth.users 트리거)

-- ── 1. posts.user_id FK 재설정 (CASCADE → SET NULL) ──────────
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_user_id_fkey;

ALTER TABLE posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ── 2. comments.user_id FK 재설정 (CASCADE → SET NULL) ───────
ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ── 3. likes, votes, follows → CASCADE (이미 CASCADE인 경우 skip) ─
-- likes
ALTER TABLE likes
  DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE likes
  ADD CONSTRAINT likes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- votes (user_id nullable — 비로그인 투표는 guest_id로만 존재, user_id NULL인 row는 영향 없음)
ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_user_id_fkey;
ALTER TABLE votes
  ADD CONSTRAINT votes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- follows
ALTER TABLE follows
  DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows
  ADD CONSTRAINT follows_follower_id_fkey
  FOREIGN KEY (follower_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE follows
  DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE follows
  ADD CONSTRAINT follows_following_id_fkey
  FOREIGN KEY (following_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- comment_likes
ALTER TABLE comment_likes
  DROP CONSTRAINT IF EXISTS comment_likes_user_id_fkey;
ALTER TABLE comment_likes
  ADD CONSTRAINT comment_likes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- persuasion_likes
ALTER TABLE persuasion_likes
  DROP CONSTRAINT IF EXISTS persuasion_likes_user_id_fkey;
ALTER TABLE persuasion_likes
  ADD CONSTRAINT persuasion_likes_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── 4. profiles → CASCADE (탈퇴 시 프로필 삭제) ──────────────
-- profiles.id는 auth.users.id를 PK로 사용하므로 트리거가 필요하거나
-- profiles에 FK가 이미 CASCADE로 설정되어 있어야 함
-- (on_auth_user_created 트리거 참조)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── 결과 요약 ────────────────────────────────────────────────
-- 탈퇴(auth.users 삭제) 시:
--   profiles          → 삭제 (CASCADE)
--   posts             → user_id = NULL (익명 게시물 유지)
--   comments          → user_id = NULL (익명 댓글 유지)
--   likes             → 삭제 (CASCADE)
--   votes (로그인)    → 삭제 (CASCADE)
--   follows           → 삭제 (CASCADE, 양방향)
--   comment_likes     → 삭제 (CASCADE)
--   persuasion_likes  → 삭제 (CASCADE)
