-- AI 문장 다듬기(refine 함수) 호출도 사용량 기록·한도에 넣습니다. 한도는 _shared/usage.ts.
alter table public.draft_generations
  drop constraint if exists draft_generations_kind_check;
alter table public.draft_generations
  add constraint draft_generations_kind_check
  check (kind in ('draft', 'translate', 'job_switch', 'interview', 'refine'));
