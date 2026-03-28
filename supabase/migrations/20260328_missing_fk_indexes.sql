-- 인덱스 없는 FK 컬럼에 인덱스 추가 (성능)
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_vote_changes_comment_id ON vote_changes(comment_id);
CREATE INDEX IF NOT EXISTS idx_vote_changes_post_id ON vote_changes(post_id);
CREATE INDEX IF NOT EXISTS idx_vote_changes_user_id ON vote_changes(user_id);
