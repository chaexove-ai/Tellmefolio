-- [2026-09-22] 자유 블록.
-- 설계: docs/editor-freedom.md 3절
--
-- [왜]
-- 템플릿 4종 × 설정 몇 개로는 취향을 담을 수 없습니다. 담기지 않으면
-- 사람들은 피그마나 노션으로 돌아갑니다. "다섯 칸을 채우는 화면"을
-- "원하는 걸 쌓는 화면"으로 바꾸는 첫 걸음입니다.
--
-- [기존 5필드는 그대로 둡니다 — 중요]
-- 블록은 **더하는 것**이지 portfolio_projects 의 context/problem/execution/
-- outcome/reflection 을 대체하지 않습니다. 프로젝트는 여전히 depth 에 따라
-- 5필드를 그리고, 그 뒤에 블록을 그립니다.
--
-- 5필드를 블록으로 옮기는 마이그레이션은 하지 않습니다:
--   · AI 초안 생성이 5필드 컬럼에 씁니다
--   · 직무 전환 재구성도 5필드를 다시 씁니다
--   · 옮기면 위험만 크고 사용자가 얻는 것이 없습니다
-- 나중에 블록이 자리를 잡으면 그때 흡수를 다시 판단합니다.

create table if not exists public.portfolio_blocks (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  -- null 이면 포트폴리오 직속(소개·연락처 같은 것), 값이 있으면 그
  -- 프로젝트에 붙는 블록. 지금은 프로젝트 블록만 씁니다.
  project_id uuid references public.portfolio_projects(id) on delete cascade,
  position int not null default 0,
  -- 'text' | 'divider' (1단계). 다음: 'quote' | 'columns' | 'embed' | 'canvas'
  --
  -- check 제약을 걸지 않습니다. 종류가 늘어날 때마다 마이그레이션을
  -- 하나씩 더 만들게 되고, 프런트가 먼저 배포되면 그 사이에 저장이
  -- 막힙니다. 모르는 kind 는 화면에서 조용히 건너뜁니다.
  kind text not null,
  span text not null default 'full',
  -- 종류마다 필요한 값이 전혀 다릅니다. 컬럼으로 펼치면 비어 있는 칸이
  -- 서른 개인 테이블이 됩니다. 검증은 애플리케이션(lib/blocks.ts)이
  -- 한 곳에서 합니다.
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_blocks_project_idx
  on public.portfolio_blocks (project_id, position);
create index if not exists portfolio_blocks_portfolio_idx
  on public.portfolio_blocks (portfolio_id, position);

alter table public.portfolio_blocks enable row level security;

-- 읽기: 내 것이거나, 그 포트폴리오가 공개된 것.
-- 공개 링크(/p/:id)에서 로그인 없이 보여야 하므로 visibility 를 함께 봅니다.
drop policy if exists "portfolio_blocks_select" on public.portfolio_blocks;
create policy "portfolio_blocks_select" on public.portfolio_blocks
  for select using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_blocks.portfolio_id
        and (p.user_id = auth.uid() or p.visibility = 'public')
    )
  );

-- 쓰기: 내 포트폴리오일 때만.
drop policy if exists "portfolio_blocks_write" on public.portfolio_blocks;
create policy "portfolio_blocks_write" on public.portfolio_blocks
  for all using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_blocks.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_blocks.portfolio_id and p.user_id = auth.uid()
    )
  );
