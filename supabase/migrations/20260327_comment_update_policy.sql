-- comments UPDATE RLS policy (댓글 수정: 작성자 본인만 가능)
create policy "comments_update"
  on public.comments
  for update
  using (auth.uid() = user_id);
