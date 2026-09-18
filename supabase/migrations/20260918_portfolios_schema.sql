-- [2026-09] 포트폴리오 데이터를 위한 첫 스키마.
--
-- 지금까지는 서재 목록(mockData.ts)도, 마법사에서 편집한 내용도, 방금
-- TemplateStyle에서 추가한 "직접 편집" 저장도 전부 진짜 DB가 아니라
-- mock 배열/router state/localStorage였습니다. 이 마이그레이션은 그
-- 자리를 대신할 최소한의 테이블만 만듭니다 — 버전 이력(스냅샷) 같은
-- 건 아직 넣지 않았습니다. 우선 "만들고 저장하고 다시 열어서 이어서
-- 편집한다"는 한 바퀴부터 실제로 돌게 하는 게 목표입니다.
--
-- generate-draft Edge Function 주석에도 "사용자별 호출 횟수 제한은
-- DB 테이블이 있어야 가능하다"고 이미 적혀 있어서, draft_generations
-- 테이블도 같이 넣었습니다 — AI 호출 비용 방어용 최소 기록입니다.
--
-- 적용 방법: Supabase 대시보드 → SQL Editor 에 이 파일 내용을 붙여넣고
-- 실행하면 됩니다. (로컬에 Supabase CLI가 연결돼 있지 않아 보여서, 이
-- 파일은 지금은 저장소에 이력만 남기는 용도이고 자동 적용되지 않습니다.)

-- ──────────────────────────────────────────────────────────
-- portfolios: 사용자가 만드는 포트폴리오 한 개
-- ──────────────────────────────────────────────────────────
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '제목 없음',
  job text,
  -- 서재 카드의 강조 점 색. GrainCover 처럼 seed로 매번 계산할 수도
  -- 있었지만, 사용자가 직접 고른 색일 수도 있어서(잡 색상 배지) 일단
  -- 저장해두는 쪽을 택했습니다.
  job_color text not null default '#c2703d',
  year text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  -- TemplateStyle.tsx 의 templates 배열과 값이 같아야 합니다.
  template_id text not null default 'research' check (template_id in ('research', 'live', 'minimal', 'magazine')),
  color_theme text not null default 'dark' check (color_theme in ('dark', 'light')),
  font text not null default 'Pretendard',
  layout text not null default '1col' check (layout in ('1col', '2col')),
  -- 대표 이미지는 Supabase Storage 버킷에 올리고 경로만 여기 저장합니다.
  -- 지금은 컬럼만 만들어두고, Storage 버킷 연결은 다음 단계입니다.
  cover_image_path text,
  -- Draft.summary / Draft.gaps (lib/draft.ts) 를 그대로 담습니다.
  summary text,
  gaps text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.portfolios is '사용자가 만드는 포트폴리오 한 건. 서재 목록·마법사·직접 편집 결과가 여기로 모입니다.';

create index if not exists portfolios_user_id_idx on public.portfolios (user_id);

-- ──────────────────────────────────────────────────────────
-- portfolio_projects: 포트폴리오 안의 케이스 스터디(프로젝트) 여러 개
-- PortfolioEditor.tsx 의 7칸(제목·맥락·역할·문제정의·실행·성과·회고)과
-- 1:1로 맞춥니다.
-- ──────────────────────────────────────────────────────────
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  -- 프로젝트가 여러 개일 때 탭 순서.
  position int not null default 0,
  name text not null default '',
  context text not null default '',
  role text not null default '',
  problem text not null default '',
  execution text not null default '',
  outcome text not null default '',
  reflection text not null default '',
  stack text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.portfolio_projects is '포트폴리오 하나에 딸린 프로젝트(케이스 스터디)들. PortfolioEditor의 7개 입력칸과 대응.';

create index if not exists portfolio_projects_portfolio_id_idx on public.portfolio_projects (portfolio_id);

-- ──────────────────────────────────────────────────────────
-- draft_generations: AI 초안 생성 호출 기록 (사용량 제한 전 단계)
-- 지금 당장 이 테이블로 막지는 않지만, 나중에 "하루 N회" 같은 제한을
-- 걸려면 이 기록이 있어야 셀 수 있습니다.
-- ──────────────────────────────────────────────────────────
create table if not exists public.draft_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

comment on table public.draft_generations is 'generate-draft Edge Function 호출 기록. 사용량 제한을 걸 때 이 테이블로 셉니다.';

create index if not exists draft_generations_user_id_created_at_idx
  on public.draft_generations (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- updated_at 자동 갱신
-- ──────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

drop trigger if exists portfolio_projects_set_updated_at on public.portfolio_projects;
create trigger portfolio_projects_set_updated_at
  before update on public.portfolio_projects
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- RLS — 본인 것만 보이고 고칠 수 있게. publishable 키를 브라우저에
-- 그대로 노출해도 되는 이유가 이 정책들 때문입니다(src/lib/supabase.ts
-- 주석 참고).
-- ──────────────────────────────────────────────────────────
alter table public.portfolios enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.draft_generations enable row level security;

drop policy if exists "portfolios_select" on public.portfolios;
create policy "portfolios_select" on public.portfolios
  for select using (auth.uid() = user_id or visibility = 'public');

drop policy if exists "portfolios_insert" on public.portfolios;
create policy "portfolios_insert" on public.portfolios
  for insert with check (auth.uid() = user_id);

drop policy if exists "portfolios_update" on public.portfolios;
create policy "portfolios_update" on public.portfolios
  for update using (auth.uid() = user_id);

drop policy if exists "portfolios_delete" on public.portfolios;
create policy "portfolios_delete" on public.portfolios
  for delete using (auth.uid() = user_id);

drop policy if exists "portfolio_projects_select" on public.portfolio_projects;
create policy "portfolio_projects_select" on public.portfolio_projects
  for select using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_projects.portfolio_id
        and (p.user_id = auth.uid() or p.visibility = 'public')
    )
  );

drop policy if exists "portfolio_projects_write" on public.portfolio_projects;
create policy "portfolio_projects_write" on public.portfolio_projects
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_projects.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_projects.portfolio_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "draft_generations_select" on public.draft_generations;
create policy "draft_generations_select" on public.draft_generations
  for select using (auth.uid() = user_id);

drop policy if exists "draft_generations_insert" on public.draft_generations;
create policy "draft_generations_insert" on public.draft_generations
  for insert with check (auth.uid() = user_id);
