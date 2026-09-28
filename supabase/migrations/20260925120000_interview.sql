-- [2026-09-25] 대화로 만들기. 설계는 docs/chat-builder-design.md.
--
-- 겉은 챗봇, 속은 인터뷰입니다. 대화 한 번 = 프로젝트 하나. AI 는 글을
-- 대신 쓰지 않고 묻고, 사용자의 답이 곧 재료(근거)입니다.
--
-- 이 파일은 다시 실행해도 안전합니다(if not exists / drop policy if exists).

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 처음부터 정해질 수도 있고(“다른 프로젝트도 이야기하기”로 기존
  -- 포트폴리오에 이어 붙일 때), 초안을 만들 때 새로 생길 수도 있습니다.
  portfolio_id uuid references public.portfolios(id) on delete set null,
  -- 초안이 만들어진 프로젝트. 대화를 다시 열었을 때 편집기로 보내는 데 씁니다.
  project_id uuid references public.portfolio_projects(id) on delete set null,
  -- 첫 문장에서 뽑은 프로젝트 이름
  title text not null default '',
  status text not null default 'open' check (status in ('open', 'drafted')),
  -- 칸 상태: { "outcome": { "state": "filled"|"skipped", "summary": "…", "answerIds": ["a3:0"] }, … }
  fields jsonb not null default '{}',
  -- 지금 묻고 있는 칸. 사용자가 "넘어가기"를 누르면 이 칸을 건너뜀으로 둡니다.
  current_field text,
  -- 서버 규칙을 지키기 위한 셈: 질문 수(상한 12), 칸별 되묻기 횟수(칸당 1)
  question_count int not null default 0,
  follow_ups jsonb not null default '{}',
  -- 초안 만들 때 걸린 "확인 필요" 문장들 (_shared/evidence.ts 의 Flag)
  flags jsonb not null default '[]',
  -- 대화 턴마다 쓴 토큰을 모아 두었다가, 초안을 만들 때 draft_generations 에
  -- 한 줄로 남깁니다(사용자 눈에는 1회).
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_user_idx
  on public.interview_sessions (user_id, updated_at desc);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  position int not null,
  role text not null check (role in ('ai', 'user')),
  text text not null default '',
  -- 사용자 답변 순번(1부터). 근거 id a{answer_no}:{문장 순번} 의 앞부분입니다.
  answer_no int,
  -- AI 질문이 겨냥한 칸, 되묻기였는지
  target_field text,
  follow_up boolean not null default false,
  -- 사용자가 "넘어가기"를 눌렀는지
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists interview_messages_session_idx
  on public.interview_messages (session_id, position);

alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;

drop policy if exists "interview_sessions_own" on public.interview_sessions;
create policy "interview_sessions_own" on public.interview_sessions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- 남의 포트폴리오에 이어 붙이지 못하게 합니다.
    and (
      portfolio_id is null
      or exists (
        select 1 from public.portfolios p
        where p.id = interview_sessions.portfolio_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "interview_messages_own" on public.interview_messages;
create policy "interview_messages_own" on public.interview_messages
  for all
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = interview_messages.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = interview_messages.session_id and s.user_id = auth.uid()
    )
  );
