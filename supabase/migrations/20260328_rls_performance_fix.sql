-- RLS 정책 성능 최적화: auth.uid() → (select auth.uid())
-- 영향: profiles, posts, likes, comments, follows, credits,
--       comment_likes, quiz_questions, votes, persuasion_likes, vote_changes

-- profiles
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- posts
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING ((select auth.uid()) = user_id);

-- likes
DROP POLICY IF EXISTS "likes_insert" ON likes;
DROP POLICY IF EXISTS "likes_delete" ON likes;
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING ((select auth.uid()) = user_id);

-- comments
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING ((select auth.uid()) = user_id);

-- follows
DROP POLICY IF EXISTS "follows_insert" ON follows;
DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING ((select auth.uid()) = follower_id);

-- credits
DROP POLICY IF EXISTS "credits_select_own" ON credits;
DROP POLICY IF EXISTS "credits_insert_own" ON credits;
CREATE POLICY "credits_select_own" ON credits FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "credits_insert_own" ON credits FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- comment_likes
DROP POLICY IF EXISTS "comment_likes_insert_own" ON comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete_own" ON comment_likes;
CREATE POLICY "comment_likes_insert_own" ON comment_likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "comment_likes_delete_own" ON comment_likes FOR DELETE USING ((select auth.uid()) = user_id);

-- quiz_questions
DROP POLICY IF EXISTS "quiz_questions_insert_own" ON quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_update_own" ON quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_delete_own" ON quiz_questions;
CREATE POLICY "quiz_questions_insert_own" ON quiz_questions
  FOR INSERT WITH CHECK (post_id IN (SELECT id FROM posts WHERE user_id = (select auth.uid())));
CREATE POLICY "quiz_questions_update_own" ON quiz_questions
  FOR UPDATE USING (post_id IN (SELECT id FROM posts WHERE user_id = (select auth.uid())));
CREATE POLICY "quiz_questions_delete_own" ON quiz_questions
  FOR DELETE USING (post_id IN (SELECT id FROM posts WHERE user_id = (select auth.uid())));

-- votes
DROP POLICY IF EXISTS "votes_insert_own" ON votes;
DROP POLICY IF EXISTS "votes_update_own" ON votes;
DROP POLICY IF EXISTS "votes_delete_own" ON votes;
CREATE POLICY "votes_insert_own" ON votes FOR INSERT WITH CHECK (
  ((select auth.uid()) = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);
CREATE POLICY "votes_update_own" ON votes FOR UPDATE USING (
  ((select auth.uid()) = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);
CREATE POLICY "votes_delete_own" ON votes FOR DELETE USING (
  ((select auth.uid()) = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);

-- persuasion_likes
DROP POLICY IF EXISTS "persuasion_likes_insert_own" ON persuasion_likes;
DROP POLICY IF EXISTS "persuasion_likes_delete_own" ON persuasion_likes;
DROP POLICY IF EXISTS "persuasion_likes_update_own" ON persuasion_likes;
CREATE POLICY "persuasion_likes_insert_own" ON persuasion_likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "persuasion_likes_delete_own" ON persuasion_likes FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "persuasion_likes_update_own" ON persuasion_likes FOR UPDATE USING ((select auth.uid()) = user_id);

-- vote_changes
DROP POLICY IF EXISTS "vote_changes_select_own" ON vote_changes;
DROP POLICY IF EXISTS "vote_changes_insert_own" ON vote_changes;
CREATE POLICY "vote_changes_select_own" ON vote_changes FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "vote_changes_insert_own" ON vote_changes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
