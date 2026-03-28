-- 알림 시스템 마이그레이션
-- notifications 테이블 + RLS + notify_rebuttal RPC

-- 1) notifications 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('rebuttal', 'vote_ended')),
  post_id    UUID        REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID        REFERENCES comments(id) ON DELETE SET NULL,
  actor_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);

-- 2) RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- 3) notify_rebuttal RPC (SECURITY DEFINER — 클라이언트가 INSERT 직접 못 하도록)
CREATE OR REPLACE FUNCTION notify_rebuttal(
  p_target_user_id UUID,
  p_post_id        UUID,
  p_comment_id     UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 자기 자신에게 알림 금지
  IF p_target_user_id = auth.uid() THEN RETURN; END IF;
  -- 동일 반박 중복 방지
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id   = p_target_user_id
      AND type      = 'rebuttal'
      AND comment_id = p_comment_id
  ) THEN RETURN; END IF;

  INSERT INTO notifications(user_id, type, post_id, comment_id, actor_id)
  VALUES (p_target_user_id, 'rebuttal', p_post_id, p_comment_id, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION notify_rebuttal TO authenticated;
