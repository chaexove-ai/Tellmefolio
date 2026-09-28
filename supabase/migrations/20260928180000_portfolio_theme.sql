-- [2026-09-28] 포트폴리오 분위기(테마) — 말로 바꾸기 1단계.
--
-- 템플릿의 색·서체·모서리를 포트폴리오마다 바꿉니다. 값은 몇 개뿐이고
-- (바탕색·강조색·제목 서체·본문 서체·모서리), 나머지 색은 화면에서 대비를
-- 계산해 정합니다(src/lib/themeRules.ts).
--
--   { "bg": "#efe6d8", "accent": "#a0522d", "titleFont": "gowun-batang",
--     "bodyFont": "gowun-dodum", "radius": "soft", "prompt": "따뜻한 베이지" }
--
-- "말로 바꾸기"(theme 함수) 호출도 사용량 기록·한도에 넣습니다(kind 'theme').
-- 다시 돌려도 됩니다.

alter table public.portfolios
  add column if not exists theme jsonb not null default '{}'::jsonb;

alter table public.draft_generations
  drop constraint if exists draft_generations_kind_check;
alter table public.draft_generations
  add constraint draft_generations_kind_check
  check (kind in ('draft', 'translate', 'job_switch', 'interview', 'refine', 'theme'));
