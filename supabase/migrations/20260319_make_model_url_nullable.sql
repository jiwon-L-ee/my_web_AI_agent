-- model_url을 nullable로 변경 (밸런스게임, OX퀴즈는 TM 모델 URL 불필요)
ALTER TABLE public.posts ALTER COLUMN model_url DROP NOT NULL;
