-- AI 사용량 한도 — draft_generations 에 어떤 기능의 호출인지(kind) 남깁니다.
-- 한도 계산은 supabase/functions/_shared/usage.ts.
--   draft      generate-draft
--   translate  translate-portfolio
--   job_switch job-switch
--   interview  interview 의 초안 만들기(기록용 — 한도는 interview_sessions 수로 셉니다)
-- 기존 행은 전부 generate-draft 나 job-switch 였지만 구분할 수 없어 draft 로 둡니다.

alter table public.draft_generations
  add column if not exists kind text not null default 'draft';

alter table public.draft_generations
  drop constraint if exists draft_generations_kind_check;
alter table public.draft_generations
  add constraint draft_generations_kind_check
  check (kind in ('draft', 'translate', 'job_switch', 'interview'));

create index if not exists draft_generations_user_kind_created_idx
  on public.draft_generations (user_id, kind, created_at desc);

create index if not exists interview_sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

-- 기록은 이제 함수만 남깁니다. 브라우저에서 직접 넣을 이유가 없고,
-- 넣을 수 있으면 남의 계정은 못 건드려도 기록이 지저분해집니다.
-- 함수는 사용자 JWT 로 넣으므로 insert 정책은 그대로 두되, 삭제·수정 정책은
-- 계속 두지 않습니다 — 사용자가 자기 기록을 지워 한도를 되돌릴 수 없게.
drop policy if exists "draft_generations_delete" on public.draft_generations;
drop policy if exists "draft_generations_update" on public.draft_generations;
