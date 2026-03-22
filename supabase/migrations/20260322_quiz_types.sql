-- Quiz types migration: OX퀴즈 → 퀴즈 카테고리 + 세부 유형 + 다중 문항 지원
-- Applied 2026-03-22

-- 1. quiz_type 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quiz_type TEXT
  CHECK (quiz_type IN ('ox', 'multiple', 'short', 'subjective'));

-- 2. category CHECK 제약 확장 (OX퀴즈 제거, 퀴즈/커뮤니티/정보 추가)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN ('테스트', '밸런스게임', '퀴즈', '커뮤니티', '정보'));

-- 3. 기존 OX퀴즈 게시물 마이그레이션
UPDATE posts SET category = '퀴즈', quiz_type = 'ox' WHERE category = 'OX퀴즈';

-- 4. quiz_questions 테이블 생성
CREATE TABLE IF NOT EXISTS quiz_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  order_num      INT NOT NULL DEFAULT 0,
  question_text  TEXT NOT NULL,
  -- 객관식: [{text: string, is_correct: boolean}, ...] (4개)
  options        JSONB,
  -- 단답형/주관식/OX: 정답 목록 (복수 허용)
  correct_answers TEXT[],
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_questions_select_all" ON quiz_questions
  FOR SELECT USING (true);

CREATE POLICY "quiz_questions_insert_own" ON quiz_questions
  FOR INSERT WITH CHECK (
    post_id IN (SELECT id FROM posts WHERE user_id = auth.uid())
  );

CREATE POLICY "quiz_questions_update_own" ON quiz_questions
  FOR UPDATE USING (
    post_id IN (SELECT id FROM posts WHERE user_id = auth.uid())
  );

CREATE POLICY "quiz_questions_delete_own" ON quiz_questions
  FOR DELETE USING (
    post_id IN (SELECT id FROM posts WHERE user_id = auth.uid())
  );

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_quiz_questions_post_id ON quiz_questions (post_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order   ON quiz_questions (post_id, order_num);
