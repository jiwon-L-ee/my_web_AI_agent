-- 보안 수정: credit_balances 뷰 security_invoker + DB 함수 search_path 설정

-- 1. credit_balances 뷰 security_invoker 적용 (RLS 우회 방지)
DROP VIEW IF EXISTS credit_balances;
CREATE VIEW credit_balances WITH (security_invoker = on) AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0) AS balance
FROM credits
GROUP BY user_id;

-- 2. handle_new_user: search_path 추가
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, profile_completed)
  VALUES (new.id, null, null, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. increment_view_count: search_path 추가
CREATE OR REPLACE FUNCTION public.increment_view_count(post_id uuid)
RETURNS void AS $$
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = post_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 4. spend_credits: search_path 추가
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_amount  NUMERIC,
  p_reason  TEXT,
  p_post_id UUID DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_reason NOT IN ('post_create', 'vote_change', 'rebuttal_comment') THEN
    RAISE EXCEPTION 'Invalid reason: %', p_reason;
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  INSERT INTO public.credits (user_id, amount, reason, post_id)
  VALUES (auth.uid(), -ABS(p_amount), p_reason, p_post_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_credits TO authenticated;
