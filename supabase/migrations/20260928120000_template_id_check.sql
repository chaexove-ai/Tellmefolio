-- [2026-09-28] 템플릿을 바꾸면 "스타일을 저장하지 못했습니다"가 나던 버그.
--
-- 처음 스키마(20260918)의 template_id 체크가 옛 React 템플릿 이름
-- ('research','live','minimal','magazine')만 허용했습니다. 이후 HTML 템플릿
-- ('minimal-serif','devcore')으로 바꾸면서 체크를 고치지 않아, 편집기에서
-- 템플릿을 고르면 DB 가 거절했습니다(23514). 기존 행은 'research' 로 남아 있고
-- 화면은 모르는 id 를 기본 템플릿으로 그려서 지금까지 드러나지 않았습니다.
--
-- 목록으로 묶어 두면 템플릿을 추가할 때마다 같은 일이 생깁니다. 모르는 id 는
-- 프런트(templateCache.resolveTemplateId)가 기본 템플릿으로 돌리므로, DB 는
-- 모양(소문자·숫자·하이픈, 40자 이하)만 확인합니다.
-- 다시 돌려도 됩니다.

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.portfolios'::regclass
      and con.contype = 'c'
      and att.attname = 'template_id'
  loop
    execute format('alter table public.portfolios drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.portfolios
  add constraint portfolios_template_id_check
  check (template_id ~ '^[a-z0-9-]{1,40}$');
