-- [2026-09-28] 템플릿 고정 문구 바꾸기.
--
-- "함께 일해요", "프로젝트", "사용한 도구 · 기술" 같은 글자는 템플릿에 박혀
-- 있어서 사용자가 바꿀 수 없었습니다. 템플릿에서 바꿀 수 있는 자리에
-- data-tf-text="키" 를 달고, 사용자가 고친 값을 여기 둡니다.
--
--   { "ko": { "contactTitle": "같이 만들어요" }, "en": { "contactTitle": "Let's build" } }
--
-- 없는 키는 템플릿 기본 문구 그대로. 키 이름은 템플릿끼리 맞춰서 템플릿을
-- 바꿔도 따라갑니다. 칸 이름(맥락 및 배경 등)도 fieldContext 같은 키로 여기 둡니다.
-- 다시 돌려도 됩니다.

alter table public.portfolios
  add column if not exists copy jsonb not null default '{}'::jsonb;
