-- 이메일 회원가입 지원 + 프로필 설정 단계 추가
-- profiles 테이블에 profile_completed 컬럼 추가
alter table public.profiles
  add column if not exists profile_completed boolean default false;

-- 기존 유저(Google OAuth로 이미 가입한 유저)는 profile_completed = true 처리
update public.profiles
  set profile_completed = true
  where profile_completed = false;

-- handle_new_user 트리거 수정:
-- Google 가입 시에도 user_metadata를 자동 반영하지 않음 (사용자가 직접 프로필 설정)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url, profile_completed)
  values (
    new.id,
    null,
    null,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
