-- [2026-09-23] 프로필 — 커뮤니티에 "누가 올렸는지"를 붙이기 위한 최소 테이블.
--
-- [왜 지금 필요한가]
-- 갤러리는 이미 남의 포트폴리오를 섞어서 보여주는데, 작성자 칸이
-- 없었습니다(Gallery.tsx 주석에 "컬럼이 없고"라고 적혀 있었습니다).
-- 누가 만들었는지 모르는 목록은 커뮤니티가 아니라 그냥 목록입니다.
--
-- [왜 auth.users 를 그냥 안 쓰는가]
-- auth.users 는 클라이언트에서 남의 행을 읽을 수 없습니다 — 당연합니다,
-- 거기엔 이메일이 들어 있습니다. 커뮤니티에서 남의 닉네임을 보여주려면
-- "공개해도 되는 것만" 담은 별도 테이블이 필요합니다. 이 테이블에
-- 이메일을 넣지 않는 것이 핵심입니다.
--
-- [닉네임 기본값]
-- 소셜 로그인의 이름(full_name / user_name / name)을 그대로 씁니다.
-- 주의: 구직용 포트폴리오라 재직 중인 사람이 많습니다. 기본값이
-- 실명이므로, 설정 화면에서 "커뮤니티에 이 이름으로 표시됩니다"를
-- 반드시 보여줘야 합니다. 그 문구가 이 기본값의 짝입니다.
--
-- 닉네임에 unique 를 걸지 않았습니다. 지금은 표시용이라 겹쳐도 문제가
-- 없고, unique 를 걸면 아래 자동 생성 트리거가 충돌 처리를 해야 해서
-- 가입 자체가 실패할 수 있습니다. /u/<닉네임> 같은 주소를 만들 때
-- 그때 가서 걸면 됩니다.

-- ──────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  -- auth.users 와 1:1. 별도 id 를 두면 "이 프로필이 누구 것인가"를
  -- 한 번 더 조인해야 하고, 그 조인이 틀릴 여지가 생깁니다.
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  -- 파일 자체는 Storage 에 있고 여기엔 경로만 둡니다 — 표지 이미지와
  -- 같은 방식(portfolios.cover_image_path).
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '커뮤니티에 공개해도 되는 사용자 정보만. 이메일 등 식별 정보는 여기 넣지 않습니다.';
comment on column public.profiles.nickname is '커뮤니티 목록에 표시되는 이름. 가입 시 소셜 이름으로 채우고, 본인이 바꿀 수 있습니다.';

alter table public.profiles enable row level security;

-- 읽기는 전체 공개입니다. 커뮤니티에서 남의 닉네임을 봐야 하는 게
-- 이 테이블의 존재 이유이고, 여기엔 공개해도 되는 것만 들어 있습니다.
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
using (true);

-- 쓰기는 본인 것만.
drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ──────────────────────────────────────────────────────────
-- 가입 시 자동 생성
-- ──────────────────────────────────────────────────────────
--
-- 앱에서 "없으면 만든다"로 처리할 수도 있지만, 그러면 프로필을 한 번도
-- 안 연 사용자는 행이 없고, 갤러리에서 그 사람 것만 작성자가 비어
-- 보입니다. 가입 시점에 만들어두면 그 구멍이 없습니다.
--
-- security definer 가 필요합니다 — 트리거가 도는 시점은 아직 auth.uid()
-- 가 없는 서버 내부라 위 RLS 정책을 통과하지 못합니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    -- 공급자마다 이름을 담는 칸이 다릅니다: Google 은 full_name,
    -- GitHub 은 user_name, 그 외는 name 을 씁니다.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 이미 가입해 있는 사용자들(트리거가 생기기 전에 가입한 사람)도 채웁니다.
-- 이게 없으면 기존 계정은 전부 프로필이 없는 채로 남습니다.
insert into public.profiles (id, nickname)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'user_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    ''
  )
from auth.users u
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────
-- avatars 스토리지
-- ──────────────────────────────────────────────────────────
--
-- portfolio-covers 를 재사용하지 않고 버킷을 나눴습니다. 그 버킷의
-- 정책과 삭제 로직은 전부 `${userId}/${portfolioId}/…` 구조를 전제로
-- 합니다(계정 삭제 함수가 폴더를 그렇게 훑습니다). 프로필 사진은
-- 포트폴리오에 속하지 않으므로 그 구조에 억지로 끼우면 두 군데가
-- 동시에 틀리기 쉽습니다.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

-- 경로는 항상 `${userId}/avatar.<ext>` 입니다. 첫 폴더가 본인 id 일
-- 때만 쓸 수 있습니다 — 표지 이미지와 같은 방식입니다.
drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
