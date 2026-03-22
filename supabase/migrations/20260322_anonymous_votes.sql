-- 비로그인 익명 투표 지원
-- user_id를 nullable로 변경하고 guest_id 컬럼 추가

-- 1. user_id NOT NULL 제약 제거
ALTER TABLE votes ALTER COLUMN user_id DROP NOT NULL;

-- 2. guest_id 컬럼 추가 (localStorage에 저장된 랜덤 UUID)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- 3. 기존 UNIQUE(user_id, post_id) 제약 제거 후 partial index로 교체
--    (NULL은 UNIQUE 제약에서 동등 비교 안 되므로 partial index 필수)
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_user_id_post_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS votes_user_post_unique
  ON votes (user_id, post_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS votes_guest_post_unique
  ON votes (guest_id, post_id) WHERE guest_id IS NOT NULL;

-- 4. user_id 또는 guest_id 중 하나는 반드시 존재해야 함
ALTER TABLE votes ADD CONSTRAINT votes_identity_check
  CHECK ((user_id IS NOT NULL) OR (guest_id IS NOT NULL));

-- 5. RLS 정책 업데이트: 로그인 유저(user_id 일치) 또는 비로그인(guest_id 존재) 허용
DROP POLICY IF EXISTS "votes_insert_own" ON votes;
DROP POLICY IF EXISTS "votes_update_own" ON votes;
DROP POLICY IF EXISTS "votes_delete_own" ON votes;

CREATE POLICY "votes_insert_own" ON votes FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);

CREATE POLICY "votes_update_own" ON votes FOR UPDATE USING (
  (auth.uid() = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);

CREATE POLICY "votes_delete_own" ON votes FOR DELETE USING (
  (auth.uid() = user_id) OR (user_id IS NULL AND guest_id IS NOT NULL)
);
