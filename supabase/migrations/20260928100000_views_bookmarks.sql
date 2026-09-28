-- 조회수 · "참고할게요"(북마크) — 숫자는 포트폴리오 주인에게만 보입니다.
--
-- [왜 주인에게만]
-- 부트캠프 동기끼리 쓰는 작은 커뮤니티라 공개 숫자는 인기 순위가 되기 쉽습니다.
-- 주인이 궁금한 건 "몇 명이 봤나"보다 "내가 링크를 보낸 곳에서 열어 봤나"입니다.
--
-- [조회]
-- 공개 열람 페이지(/p/:id)가 열릴 때 record_portfolio_view 를 부릅니다. 같은 사람은
-- 하루에 한 번만 셉니다(로그인한 사람은 계정, 아닌 사람은 브라우저에 둔 임의 id).
-- 주인이 자기 것을 연 건 세지 않습니다. 테이블은 아무도 직접 읽거나 쓰지 못하고
-- 함수로만 들어갑니다. 한계: 브라우저 저장소를 지우면 다시 한 명으로 셉니다 —
-- 정확한 통계가 아니라 "열어 봤는지"의 신호입니다.
--
-- [참고할게요]
-- 누른 사람에게는 "참고한 포트폴리오" 목록, 받은 사람에게는 수만 보입니다.
-- 누가 눌렀는지는 주인도 모릅니다.

create table if not exists public.portfolio_views (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now(),
  primary key (portfolio_id, viewer_key, viewed_on)
);
alter table public.portfolio_views enable row level security;
-- 정책 없음: 클라이언트는 직접 읽고 쓸 수 없습니다. 아래 함수만 씁니다.

create table if not exists public.portfolio_bookmarks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, portfolio_id)
);
create index if not exists portfolio_bookmarks_portfolio_idx on public.portfolio_bookmarks (portfolio_id);
alter table public.portfolio_bookmarks enable row level security;

drop policy if exists "bookmarks_select_own" on public.portfolio_bookmarks;
create policy "bookmarks_select_own" on public.portfolio_bookmarks
  for select using (auth.uid() = user_id);

-- 공개된 남의 포트폴리오만 표시할 수 있습니다.
drop policy if exists "bookmarks_insert_own" on public.portfolio_bookmarks;
create policy "bookmarks_insert_own" on public.portfolio_bookmarks
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.visibility = 'public' and p.user_id <> auth.uid()
    )
  );

drop policy if exists "bookmarks_delete_own" on public.portfolio_bookmarks;
create policy "bookmarks_delete_own" on public.portfolio_bookmarks
  for delete using (auth.uid() = user_id);

create or replace function public.record_portfolio_view(p_portfolio uuid, p_visitor text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_vis text;
  v_key text;
begin
  select user_id, visibility into v_owner, v_vis from public.portfolios where id = p_portfolio;
  if v_owner is null or v_vis <> 'public' then
    return;
  end if;
  if auth.uid() is not null and auth.uid() = v_owner then
    return;
  end if;
  v_key := coalesce('u:' || auth.uid()::text, 'a:' || left(coalesce(nullif(p_visitor, ''), 'unknown'), 64));
  insert into public.portfolio_views (portfolio_id, viewer_key)
  values (p_portfolio, v_key)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_portfolio_view(uuid, text) from public;
grant execute on function public.record_portfolio_view(uuid, text) to anon, authenticated;

-- 내 포트폴리오들의 숫자. 남의 것은 나오지 않습니다(p.user_id = auth.uid()).
create or replace function public.my_portfolio_stats()
returns table (portfolio_id uuid, views integer, views_7d integer, bookmarks integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    (select count(*) from public.portfolio_views v where v.portfolio_id = p.id)::integer,
    (select count(*) from public.portfolio_views v
      where v.portfolio_id = p.id
        and v.viewed_on >= ((now() at time zone 'Asia/Seoul')::date - 6))::integer,
    (select count(*) from public.portfolio_bookmarks b where b.portfolio_id = p.id)::integer
  from public.portfolios p
  where p.user_id = auth.uid();
$$;
revoke all on function public.my_portfolio_stats() from public;
grant execute on function public.my_portfolio_stats() to authenticated;
