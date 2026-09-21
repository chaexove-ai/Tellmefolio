-- [파일명 주의] 마이그레이션 버전은 파일명 앞의 숫자입니다.
-- 8자리(YYYYMMDD)로 짓다가 같은 날 두 개를 만들면 버전이 겹쳐
-- schema_migrations 기본키 충돌(23505)이 납니다. 실제로 covers 와
-- 이 파일이 둘 다 20260921 이라 한 번 막혔습니다.
-- 앞으로는 Supabase 표준인 14자리(YYYYMMDDHHMMSS)로 짓습니다.
--
-- [2026-09] 여백(density) 설정 추가.
--
-- 배경: "레이아웃 1단/2단"이 유일한 배치 설정이었는데, 실제로는 매거진형
-- 템플릿 하나만 그 값을 읽고 나머지 세 템플릿은 아예 무시하고 있었습니다.
-- 사용자가 연구노트에서 2단을 눌러도 화면에 아무 변화가 없었습니다.
--
-- 그래서 배치 설정을 두 축으로 나눕니다.
--   layout  — 프로젝트를 몇 개씩 나열할지 (1col/2col). 컬럼은 그대로 두고
--             템플릿 4종 전부가 읽도록 구현만 채웠습니다.
--   density — 여백. PDF가 한 장 넘치거나 반대로 휑할 때 실제로 만지게 되는
--             값이라 별도 축으로 뒀습니다. 템플릿 4종 전부에 적용됩니다.
--
-- 기존 행은 전부 'normal' 로 시작합니다 — 지금 보이는 모양이 그대로
-- 유지되어야 하므로 기본값이 기존 간격입니다.
alter table public.portfolios
  add column if not exists density text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'portfolios_density_check'
  ) then
    alter table public.portfolios
      add constraint portfolios_density_check
      check (density in ('roomy', 'normal', 'tight'));
  end if;
end $$;
