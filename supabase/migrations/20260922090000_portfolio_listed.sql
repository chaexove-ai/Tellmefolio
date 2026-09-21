-- [2026-09-22] 커뮤니티 게시 여부를 공개 여부와 분리합니다.
--
-- [왜 나누는가]
-- visibility='public' 은 "링크를 가진 사람이 볼 수 있다"는 뜻입니다.
-- 여기에 "커뮤니티 목록에 뜬다"까지 묶으면, 재직 중에 이직을 준비하는
-- 사람은 이 서비스를 쓸 수 없습니다 — 채용 담당자에게 링크를 보내려고
-- 공개했을 뿐인데 현재 회사 사람이 커뮤니티에서 보게 됩니다. 포트폴리오에는
-- 회사명·재직 기간·성과 수치가 들어갑니다.
--
-- 이 서비스의 존재 이유가 "실제 채용에 쓸 수 있는 포트폴리오"라면,
-- 링크는 조용해야 합니다. 그래서 두 축으로 나눕니다.
--   visibility — 링크로 열람 가능한가 (RLS가 읽는 값, 기존 그대로)
--   listed     — 커뮤니티 목록에 노출할 것인가 (화면 필터용)
--
-- 기본값은 false 입니다. 이미 공개된 것이 있더라도 이 마이그레이션 때문에
-- 갑자기 목록에 뜨는 일은 없어야 합니다 — 사용자가 동의한 적 없는 노출을
-- 마이그레이션이 만들어내면 안 됩니다.
--
-- [RLS를 건드리지 않는 이유]
-- listed 는 노출 여부일 뿐 접근 권한이 아닙니다. 읽기 권한은 여전히
-- visibility 가 정합니다. listed=true 인데 visibility='private' 인 행은
-- 애초에 RLS 가 막으므로 목록에도 나오지 않습니다.
alter table public.portfolios
  add column if not exists listed boolean not null default false;

-- 커뮤니티 목록은 "공개이면서 게시된 것"을 최근 수정순으로 읽습니다.
create index if not exists portfolios_listed_idx
  on public.portfolios (updated_at desc)
  where visibility = 'public' and listed = true;
