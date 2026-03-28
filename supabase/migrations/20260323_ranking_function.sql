-- 랭킹 집계 함수 (SECURITY DEFINER — credits RLS 우회)
-- 크레딧 / 좋아요 수 / 설득함 수 / 팔로워 수 / 종합점수 반환

CREATE OR REPLACE FUNCTION public.get_ranking_stats()
RETURNS TABLE (
  user_id          uuid,
  username         text,
  avatar_url       text,
  credits          numeric,
  like_count       bigint,
  persuasion_count bigint,
  follower_count   bigint,
  overall_score    numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id                              AS user_id,
    p.username,
    p.avatar_url,
    COALESCE(c.balance, 0)            AS credits,
    COALESCE(l.cnt, 0)                AS like_count,
    COALESCE(ps.cnt, 0)               AS persuasion_count,
    COALESCE(f.cnt, 0)                AS follower_count,
    -- 종합점수: 크레딧 1pt + 좋아요 10pt + 설득함 25pt + 팔로워 15pt
    COALESCE(c.balance, 0)
      + COALESCE(l.cnt, 0)  * 10
      + COALESCE(ps.cnt, 0) * 25
      + COALESCE(f.cnt, 0)  * 15
    AS overall_score
  FROM profiles p
  -- 크레딧 합산
  LEFT JOIN (
    SELECT user_id, SUM(amount) AS balance
    FROM credits
    GROUP BY user_id
  ) c ON c.user_id = p.id
  -- 내 게시물에 받은 좋아요 합산
  LEFT JOIN (
    SELECT po.user_id, COUNT(*) AS cnt
    FROM likes li
    JOIN posts po ON li.post_id = po.id
    WHERE po.user_id IS NOT NULL
    GROUP BY po.user_id
  ) l ON l.user_id = p.id
  -- 내 댓글이 설득한 횟수
  LEFT JOIN (
    SELECT co.user_id, COUNT(*) AS cnt
    FROM persuasion_likes pl
    JOIN comments co ON pl.comment_id = co.id
    WHERE co.user_id IS NOT NULL
    GROUP BY co.user_id
  ) ps ON ps.user_id = p.id
  -- 팔로워 수
  LEFT JOIN (
    SELECT following_id AS user_id, COUNT(*) AS cnt
    FROM follows
    GROUP BY following_id
  ) f ON f.user_id = p.id
  WHERE p.username IS NOT NULL
  ORDER BY overall_score DESC;
$$;

-- 인증/비인증 모두 실행 가능
GRANT EXECUTE ON FUNCTION public.get_ranking_stats() TO authenticated, anon;
