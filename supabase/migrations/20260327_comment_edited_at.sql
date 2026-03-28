-- comments.edited_at: 댓글 수정 시 타임스탬프 기록
alter table public.comments add column if not exists edited_at timestamptz;
