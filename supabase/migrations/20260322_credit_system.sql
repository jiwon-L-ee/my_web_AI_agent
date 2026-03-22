-- 크레딧 시스템 마이그레이션
-- posts.expires_at, posts.ab_flipped, credits, post_results, vote_changes

-- ── 1. posts 컬럼 추가 ────────────────────────────────────────────────

-- 밸런스게임 만료 시각
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 마감 1시간 전 A/B 반전 여부 (생성 시 랜덤 설정)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS ab_flipped BOOLEAN NOT NULL DEFAULT false;

-- 기존 밸런스게임 데이터: expires_at = created_at + 7일
UPDATE posts
SET expires_at = created_at + INTERVAL '7 days'
WHERE category = '밸런스게임' AND expires_at IS NULL;

-- ── 2. credits 테이블 ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(8,2) NOT NULL,   -- 양수: 획득 / 음수: 소비
  reason      TEXT NOT NULL,
  -- reason 값:
  --   'signup_bonus'   신규 가입 보너스 (+30)
  --   'vote_win'       승리 크레딧 (기여도 비례, +N)
  --   'creator_reward' 근접도 보상 (+N)
  --   'post_create'    밸런스게임 생성 (-10)
  --   'vote_change'    투표 변경 (-5)
  post_id     UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credits_user_id_idx ON credits(user_id);
CREATE INDEX IF NOT EXISTS credits_post_id_idx ON credits(post_id);

-- ── 3. post_results 테이블 ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_results (
  post_id          UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  winning_side     TEXT,                -- 'A' | 'B' | 'tie'
  votes_a          INT DEFAULT 0,
  votes_b          INT DEFAULT 0,
  logged_in_voters INT DEFAULT 0,       -- 로그인 투표자 수
  proximity        NUMERIC(5,4),        -- 0.0000 ~ 1.0000
  creator_reward   NUMERIC(8,2) DEFAULT 0,
  credits_paid     BOOLEAN DEFAULT false,
  resolved_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 4. vote_changes 테이블 (분석용) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS vote_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_choice   TEXT NOT NULL,          -- 'A' | 'B'
  to_choice     TEXT NOT NULL,          -- 'A' | 'B'
  comment_id    UUID REFERENCES comments(id) ON DELETE SET NULL,
  credits_spent NUMERIC(8,2) DEFAULT 5,
  changed_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 5. RLS 정책 ──────────────────────────────────────────────────────

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_changes ENABLE ROW LEVEL SECURITY;

-- credits: 본인 기록만 조회 가능
CREATE POLICY "credits_select_own"
  ON credits FOR SELECT
  USING (auth.uid() = user_id);

-- credits: insert는 서비스 롤(Edge Function)만 (anon/authenticated 차단)
-- → Edge Function에서 service_role key로 직접 insert

-- post_results: 모든 유저가 읽기 가능 (공개 결과)
CREATE POLICY "post_results_select_all"
  ON post_results FOR SELECT
  USING (true);

-- vote_changes: 본인 기록만 조회 가능
CREATE POLICY "vote_changes_select_own"
  ON vote_changes FOR SELECT
  USING (auth.uid() = user_id);

-- ── 6. 신규 가입 보너스 트리거 ────────────────────────────────────────

-- profiles 생성 시 30크레딧 자동 지급
CREATE OR REPLACE FUNCTION handle_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO credits (user_id, amount, reason)
  VALUES (NEW.id, 30, 'signup_bonus');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 on_auth_user_created 트리거와 충돌 방지: profiles insert 후 실행
CREATE OR REPLACE TRIGGER on_profile_created_credit_bonus
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_signup_bonus();

-- ── 7. 크레딧 잔액 뷰 (mypage에서 사용) ─────────────────────────────

CREATE OR REPLACE VIEW credit_balances AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0) AS balance
FROM credits
GROUP BY user_id;

-- RLS: 뷰는 credits 테이블 정책 상속
