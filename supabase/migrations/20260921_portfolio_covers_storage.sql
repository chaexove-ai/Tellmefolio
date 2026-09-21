-- [2026-09] 대표 이미지 Storage 버킷 생성.
--
--
-- [2026-09-21] 정책 생성문을 drop-then-create 로 바꿨습니다.
-- 이 버킷과 정책은 CLI 도입 전에 대시보드에서 손으로 만들어져 있었고,
-- 그래서 `supabase db push` 가 42710(already exists)으로 멈췄습니다.
-- 저장소의 다른 마이그레이션과 같은 방식으로 맞춰 다시 실행 가능하게
-- 했습니다. 정책 내용은 그대로입니다.
-- portfolios.cover_image_path 컬럼은 20260918 마이그레이션 때부터 있었지만
-- 실제로 파일을 올릴 버킷과 접근 정책은 여기서 처음 만듭니다.
--
-- 버킷은 public 으로 둡니다 — 포트폴리오 자체가 다른 사람에게 보여주기
-- 위한 콘텐츠이고(visibility='public' 이면 누구나 볼 수 있음), 대표
-- 이미지 URL 하나가 새어나간다고 해서 개인정보가 노출되는 건 아니라고
-- 판단했습니다. 대신 "누가 올릴 수 있는지"는 아래 정책으로 엄격히
-- 제한합니다 — 파일 경로의 첫 폴더가 본인 user_id 일 때만 쓰기 가능.
insert into storage.buckets (id, name, public)
values ('portfolio-covers', 'portfolio-covers', true)
on conflict (id) do nothing;

-- 공개 읽기: 버킷이 public 이라 사실 없어도 되지만, 이 프로젝트는 RLS를
-- 명시적으로 켜두는 편이라 읽기 정책도 명시적으로 하나 둡니다.
drop policy if exists "portfolio covers are publicly readable" on storage.objects;
create policy "portfolio covers are publicly readable"
on storage.objects for select
using (bucket_id = 'portfolio-covers');

-- 업로드: 로그인한 사용자가, 자기 user_id 폴더 아래에만 쓸 수 있습니다.
-- 앱은 항상 `${userId}/${portfolioId}/cover.<ext>` 형태로 올리므로
-- storage.foldername(name)의 첫 번째 값이 auth.uid() 와 같은지만 봅니다.
drop policy if exists "users can upload their own portfolio covers" on storage.objects;
create policy "users can upload their own portfolio covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolio-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 교체: 앱이 upsert:true 로 올리기 때문에 update 정책도 필요합니다.
drop policy if exists "users can update their own portfolio covers" on storage.objects;
create policy "users can update their own portfolio covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'portfolio-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete their own portfolio covers" on storage.objects;
create policy "users can delete their own portfolio covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolio-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
