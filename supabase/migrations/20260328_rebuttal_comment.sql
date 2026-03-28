-- 반박 덧글 기능 마이그레이션
-- comments.parent_id 추가 + spend_credits whitelist 업데이트

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
