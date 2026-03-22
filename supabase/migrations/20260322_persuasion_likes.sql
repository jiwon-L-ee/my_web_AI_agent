-- 설득됨 좋아요 테이블
-- 밸런스게임에서 의견이 바뀐 사용자가 상대방 주장에 "설득됨" 표시
-- 게시물당 1개만 가능 (UNIQUE user_id, post_id), 자기 댓글 제외는 앱에서 처리

CREATE TABLE IF NOT EXISTS persuasion_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)  -- 게시물당 1개만
);

ALTER TABLE persuasion_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persuasion_likes_select_all" ON persuasion_likes FOR SELECT USING (true);
CREATE POLICY "persuasion_likes_insert_own" ON persuasion_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "persuasion_likes_delete_own" ON persuasion_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "persuasion_likes_update_own" ON persuasion_likes FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_persuasion_likes_post_id    ON persuasion_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_persuasion_likes_comment_id ON persuasion_likes (comment_id);
