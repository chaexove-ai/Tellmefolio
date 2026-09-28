-- [2026-09-28] 프로젝트 보여주기 방식.
--
-- 테마(템플릿)는 포트폴리오 전체의 색·글꼴이고, 이건 프로젝트 하나를
-- 어떤 배치로 보여줄지입니다. 한 포트폴리오 안에 앱·브랜딩·웹이 섞여
-- 있어서 프로젝트마다 고릅니다. 규칙은 src/lib/templateRules.ts.
--
--   auto     자료를 보고 고름(기본)
--   case     케이스 스터디 — 대표 이미지 + 칸별 글
--   mobile   모바일 화면 — 세로 스크린숏을 폰 틀에 나란히
--   visual   비주얼 — 이미지를 크게, 글은 짧게
--   compare  전후 비교 — 이전/이후 이미지를 나란히
--   metrics  성과 지표 — 성과 칸의 숫자를 크게
--
-- 기존 행은 'auto' 가 되어 지금까지처럼(또는 자료에 맞게) 보입니다.
-- 다시 돌려도 됩니다.

alter table public.portfolio_projects
  add column if not exists display text not null default 'auto';

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_display_check;

alter table public.portfolio_projects
  add constraint portfolio_projects_display_check
  check (display in ('auto', 'case', 'mobile', 'visual', 'compare', 'metrics'));
