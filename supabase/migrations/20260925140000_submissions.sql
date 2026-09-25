-- [2026-09-25] 제출 기록. 설계는 docs/submission-history-design.md.
--
-- 내보낼 때 "어디에 제출하나요?"를 받아, 그 순간의 결과물(HTML)과 데이터를
-- 남깁니다. 목업이던 "버전 관리"를 대체합니다.
--
-- 이 파일은 다시 실행해도 안전합니다(if not exists / drop policy if exists).

create table if not exists public.portfolio_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 포트폴리오를 지워도 제출 기록은 남깁니다. 낸 사실은 사라지지 않습니다.
  portfolio_id uuid references public.portfolios(id) on delete set null,
  -- 지워진 뒤에도 목록에 제목이 보이도록 그때 제목을 적어 둡니다.
  portfolio_title text not null default '',
  company text not null default '',
  position text not null default '',
  jd_url text,
  job_switch_run_id uuid references public.job_switch_runs(id) on delete set null,
  submitted_on date not null default current_date,
  note text not null default '',
  format text not null default 'pdf' check (format in ('pdf', 'html', 'link')),
  lang text not null default 'ko' check (lang in ('ko', 'en')),
  -- Storage 'submissions' 버킷 경로. 링크만 보낸 기록은 null 일 수 있습니다.
  html_path text,
  -- { portfolio, projects, blocks } — "이 버전으로 새 포트폴리오 만들기"에 씁니다.
  snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.portfolio_submissions is
  '어디에 어떤 포트폴리오를 냈는지. 본인만 봅니다 — 커뮤니티·공개 링크 어디에도 노출하지 않습니다.';

create index if not exists portfolio_submissions_user_idx
  on public.portfolio_submissions (user_id, submitted_on desc, created_at desc);
create index if not exists portfolio_submissions_portfolio_idx
  on public.portfolio_submissions (portfolio_id);

alter table public.portfolio_submissions enable row level security;

drop policy if exists "portfolio_submissions_own" on public.portfolio_submissions;
create policy "portfolio_submissions_own" on public.portfolio_submissions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      portfolio_id is null
      or exists (
        select 1 from public.portfolios p
        where p.id = portfolio_submissions.portfolio_id and p.user_id = auth.uid()
      )
    )
  );

-- ──────────────────────────────────────────────────────────
-- submissions 스토리지 — 비공개
-- ──────────────────────────────────────────────────────────
-- 다른 버킷과 달리 public 이 아닙니다. 어느 회사에 무엇을 냈는지는 재직 중
-- 이직 준비에서 가장 민감한 정보라, 주소를 알아도 본인이 아니면 못 읽어야
-- 합니다. 경로는 `${userId}/${submissionId}.html`.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

drop policy if exists "users can read their own submissions" on storage.objects;
create policy "users can read their own submissions"
on storage.objects for select
to authenticated
using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can upload their own submissions" on storage.objects;
create policy "users can upload their own submissions"
on storage.objects for insert
to authenticated
with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own submissions" on storage.objects;
create policy "users can delete their own submissions"
on storage.objects for delete
to authenticated
using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
