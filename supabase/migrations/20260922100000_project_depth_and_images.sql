-- [2026-09-22] 프로젝트 깊이 + 프로젝트별 이미지.
-- 설계: docs/editor-redesign.md 3절·4절
--
-- [왜]
-- 편집 화면이 프로젝트 10개를 전부 같은 무게로 다뤘습니다. 실제
-- 포트폴리오는 대표작 2~3개가 깊고 나머지는 얕은데, 그 차이를 표현할
-- 방법이 없어서 "10개를 다 깊게 써야 한다"는 압박이 생겼고, 결과적으로
-- 누가 써도 같은 다섯 단락이 나왔습니다.

-- ── 1. 깊이 ──────────────────────────────────────────────────────────
--
-- brief : 제목 + 한 줄 설명 + 이미지 + 스택
-- full  : 기존 5필드 전부 + 이미지
--
-- 기본값이 'full' 인 이유: 기존 프로젝트가 이 마이그레이션 때문에 내용이
-- 사라진 것처럼 보이면 안 됩니다. 지금 보이는 모양이 그대로 유지됩니다.
--
-- [중요] full → brief 로 바꿔도 problem/execution/outcome/reflection 값은
-- 지우지 않습니다. 화면에서 안 그릴 뿐입니다. 이 규칙을 깨면 사용자가
-- 깊이를 바꾸는 것 자체를 두려워하게 됩니다. 애플리케이션 쪽에서 지키는
-- 약속이라 DB 로는 강제하지 않지만, 여기 적어둡니다.
--
-- brief 의 "한 줄 설명"은 새 컬럼이 아니라 기존 context 를 씁니다.
-- 라벨만 바뀝니다 — 두 모드가 같은 칸을 공유하므로 전환해도 다시 쓸
-- 일이 없습니다.
alter table public.portfolio_projects
  add column if not exists depth text not null default 'full';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'portfolio_projects_depth_check'
  ) then
    alter table public.portfolio_projects
      add constraint portfolio_projects_depth_check
      check (depth in ('brief', 'full'));
  end if;
end $$;

-- ── 2. 프로젝트별 이미지 ─────────────────────────────────────────────
--
-- 포트폴리오는 이미지가 핵심인데 그때까지 표지 한 장만 올릴 수 있었습니다.
--
-- 파일 자체는 기존 portfolio-covers 버킷에 넣습니다(새 버킷을 만들지
-- 않습니다). 그 버킷의 정책이 (storage.foldername(name))[1] = auth.uid()
-- 라서, 경로를 {userId}/{portfolioId}/projects/{projectId}/{n}.webp 로
-- 맞추면 정책을 새로 쓸 필요가 없습니다. 버킷 이름이 내용과 어긋나는 것은
-- 감수합니다 — 버킷 이름은 나중에 바꿀 수 없고, 정책을 한 벌 더 관리하는
-- 비용이 더 큽니다.
create table if not exists public.portfolio_project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_project_images_project_idx
  on public.portfolio_project_images (project_id, position);

alter table public.portfolio_project_images enable row level security;

-- 읽기: 내 것이거나, 그 포트폴리오가 공개된 것. portfolio_projects 의
-- 정책과 같은 모양입니다 — 공개 링크(/p/:id)에서 로그인 없이 이미지가
-- 보여야 하므로 visibility='public' 을 함께 봅니다.
drop policy if exists "portfolio_project_images_select" on public.portfolio_project_images;
create policy "portfolio_project_images_select" on public.portfolio_project_images
  for select using (
    exists (
      select 1
      from public.portfolio_projects pp
      join public.portfolios p on p.id = pp.portfolio_id
      where pp.id = portfolio_project_images.project_id
        and (p.user_id = auth.uid() or p.visibility = 'public')
    )
  );

-- 쓰기: 내 포트폴리오에 속한 프로젝트일 때만.
drop policy if exists "portfolio_project_images_write" on public.portfolio_project_images;
create policy "portfolio_project_images_write" on public.portfolio_project_images
  for all using (
    exists (
      select 1
      from public.portfolio_projects pp
      join public.portfolios p on p.id = pp.portfolio_id
      where pp.id = portfolio_project_images.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.portfolio_projects pp
      join public.portfolios p on p.id = pp.portfolio_id
      where pp.id = portfolio_project_images.project_id
        and p.user_id = auth.uid()
    )
  );
