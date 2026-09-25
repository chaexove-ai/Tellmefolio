-- [2026-09-25] 직무 전환 재구성. 설계는 docs/job-switch-design.md.
--
-- 재구성 결과는 portfolios 에 바로 쓰지 않습니다. 원본 하나에서 직무별로
-- 여러 번 돌릴 수 있고, 원본은 그대로 남아야 합니다. 사용자가 결과 화면에서
-- "이대로 저장"을 눌렀을 때만 새 portfolios 행으로 복사합니다.
--
-- 이 파일은 다시 실행해도 안전합니다(if not exists / drop policy if exists).

-- ──────────────────────────────────────────────────────────
-- job_switch_runs: 한 번 돌린 기록 (1·2·4단계 결과)
-- ──────────────────────────────────────────────────────────
create table if not exists public.job_switch_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 원본을 지우면 재구성 기록도 같이 지웁니다. 원본 없이 남은 재구성본은
  -- "무엇을 바꿨는지"를 보여줄 수 없습니다.
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  target_job text not null default '',
  jd_url text,
  jd_text text not null default '',
  -- 1단계 공고 해부: { role, requirements: [{id,text,kind,keywords}], vocabulary }
  requirements jsonb not null default '{}',
  -- 2단계 근거 매칭: [{ requirementId, level, evidenceIds, why }]
  matches jsonb not null default '[]',
  -- 4단계 기계 검증에 걸린 문장들
  flags jsonb not null default '[]',
  -- 맨 앞에 둘 필드(context/problem/execution/outcome). 사용자가 결과
  -- 화면에서 바꾸면 그 값으로 덮어씁니다.
  lead text not null default 'context',
  lead_reason text not null default '',
  -- 저장을 눌러 만들어진 새 포트폴리오. 한 번 저장한 결과를 또 저장하면
  -- 같은 것이 두 벌 생기므로 화면이 이 값으로 막습니다.
  saved_portfolio_id uuid references public.portfolios(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.job_switch_runs is '직무 전환 재구성 1회. 원본 portfolios 는 바꾸지 않습니다.';

create index if not exists job_switch_runs_user_idx
  on public.job_switch_runs (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- job_switch_projects: 3단계 재작성 결과 (프로젝트별)
-- ──────────────────────────────────────────────────────────
create table if not exists public.job_switch_projects (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.job_switch_runs(id) on delete cascade,
  -- 원본 프로젝트가 지워져도 재구성본은 남겨 둡니다(비교만 못 할 뿐).
  source_project_id uuid references public.portfolio_projects(id) on delete set null,
  position int not null default 0,
  name text not null default '',
  role text not null default '',
  context text not null default '',
  problem text not null default '',
  execution text not null default '',
  outcome text not null default '',
  reflection text not null default '',
  stack text[] not null default '{}',
  -- 필드별 문장과 근거: { outcome: [{ text, evidence: [id], requirements: [id] }], ... }
  sentences jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists job_switch_projects_run_idx
  on public.job_switch_projects (run_id, position);

-- ──────────────────────────────────────────────────────────
-- portfolios.lead_field: 저장된 재구성본이 어떤 필드를 맨 앞에 둘지
-- ──────────────────────────────────────────────────────────
-- null 이면 기본 순서(맥락 → 문제 → 실행 → 성과 → 배운 점).
-- 순서만 바꾸는 값이라 내용은 그대로입니다. buildTemplateData.ts 가 읽습니다.
alter table public.portfolios
  add column if not exists lead_field text;

-- ──────────────────────────────────────────────────────────
-- RLS — 본인 것만
-- ──────────────────────────────────────────────────────────
alter table public.job_switch_runs enable row level security;
alter table public.job_switch_projects enable row level security;

drop policy if exists "job_switch_runs_own" on public.job_switch_runs;
create policy "job_switch_runs_own" on public.job_switch_runs
  for all
  using (auth.uid() = user_id)
  -- 남의 포트폴리오를 원본으로 적어 넣지 못하게 합니다.
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = job_switch_runs.portfolio_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "job_switch_projects_own" on public.job_switch_projects;
create policy "job_switch_projects_own" on public.job_switch_projects
  for all
  using (
    exists (
      select 1 from public.job_switch_runs r
      where r.id = job_switch_projects.run_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.job_switch_runs r
      where r.id = job_switch_projects.run_id and r.user_id = auth.uid()
    )
  );
