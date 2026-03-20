-- posts 테이블 확장: 밸런스게임/OX퀴즈 선택지 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS option_a TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS option_b TEXT;

-- votes 테이블 신규 생성
CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  choice     TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- RLS 활성화
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select_all" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_update_own" ON votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "votes_delete_own" ON votes FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes (post_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes (user_id);
