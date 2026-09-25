# Tellmefolio — 작업 컨텍스트

새 세션에서 이 프로젝트를 이어받을 때 이 파일부터 읽으면 됩니다.
사람이 읽어도 되고, AI 에이전트에게 "repo의 CONTEXT.md 읽어줘"라고 해도 됩니다.

> 마지막 갱신: 2026-09-25 (커밋 `32bb840` 기준)

---

## 무엇을 만드는가

AI 포트폴리오 제작 서비스. 한 줄 요약은 **"이야기하면 포트폴리오가 됩니다"** 입니다.

원본 자료(GitHub 저장소, 웹 링크, 메모)를 넣으면 AI가 케이스 스터디 구조
(맥락·역할·문제·실행·성과·회고)로 초안을 만들고, 사용자가 편집해 PDF로
내보냅니다. 차별점 한 줄은 **"GitHub에는 코드가 있지만 이야기는 없다"** 입니다.

직무별 재해석(채용 공고에 맞춰 다시 쓰기)은 최상위 기능이 아니라 **부가
기능**으로 격하했습니다. 타깃도 개발자에 국한하지 않고 포트폴리오가 필요한
모든 직무로 넓혔습니다.

---

## 기술 스택

```
Vite + React 18 + TypeScript
Tailwind CSS 3
GSAP (ScrollTrigger)      — 랜딩 모션
react-router-dom          — 라우팅 (랜딩만 정적 import, 나머지는 React.lazy)
lucide-react              — 아이콘
Supabase                  — Auth + DB + Storage + Edge Functions
브라우저 인쇄 엔진         — PDF 내보내기 (템플릿 iframe 의 print(), 글자가 선택되는 PDF)
jsdom (dev)               — tpl:check 템플릿 검증
```

**Next.js 가 아닙니다.** 빌드는 `tsc -b && vite build` 라 타입 에러가 있으면
빌드가 멈춥니다. CSR 전용입니다.

---

## 어디에 있는가

| | |
|---|---|
| 로컬 (집 맥) | `~/Documents/GitHub/Tellmefolio` — 원격 **HTTPS**, GitHub Desktop으로 푸시 |
| 로컬 (회사 맥) | `~/Documents/GitHub/Tellmefolio` — 원격 **HTTPS**, GitHub Desktop으로 푸시 |
| GitHub | `github.com/chaexove-ai/Tellmefolio` (Public) |
| Vercel | `vercel.com/tellmefolio/tellmefolio-app` |
| 배포 URL | `tellmefolio-app.vercel.app` |

두 노트북 모두 **같은 경로, 같은 방식(HTTPS + GitHub Desktop)** 입니다.
터미널 `git push` 가 인증에서 막히면 GitHub Desktop 의 "Push origin" 을 쓰세요.

> 집 맥의 `~/Projects/tellmefolio-app`(원격 SSH)는 8월에 멈춘 **옛 사본**입니다.
> 2026-09-25 에 집 맥도 위 경로로 옮겼습니다. 옛 사본에서 작업하면 버전이 다시
> 갈라지니 열지 마세요.

### 배포 방식 — 중요

**Vercel이 GitHub repo에 연결돼 있어 `git push` 하면 프런트엔드는 자동
배포됩니다.** `vercel --prod` 는 쓰지 않습니다(로컬 CLI 인증이 깨져 있고
고칠 필요도 없습니다).

**Edge Function은 git push로 배포되지 않습니다.** 따로 실행해야 합니다.

```bash
npx supabase login                                    # 노트북마다 1회
npx supabase link --project-ref tswxxqqnzqexwxkgpajg  # 노트북마다 1회
npx supabase functions deploy generate-draft
npx supabase functions deploy translate-portfolio
npx supabase functions deploy delete-account
npx supabase functions deploy job-switch
npx supabase functions deploy interview

# 시크릿도 별도입니다 (AI 함수는 ANTHROPIC_API_KEY 하나만 필수)
npx supabase secrets list
npx supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set MODEL=claude-haiku-...           # 없으면 haiku 기본값
```

DB 마이그레이션(`supabase/migrations/`)도 마찬가지로 별도 적용입니다.

```bash
npx supabase db push
npx supabase migration list   # Local/Remote 양쪽에 다 찍혔는지 확인
```

#### 마이그레이션 규칙 두 가지 — 지키지 않으면 막힙니다

**1. 파일명은 14자리 타임스탬프로.** `20260921120000_이름.sql` 형태입니다.
버전 번호는 파일명 앞 숫자에서 뽑는데, 8자리(`YYYYMMDD`)로 짓다가 같은 날
두 개를 만들면 버전이 겹쳐서 `schema_migrations` 기본키 충돌(23505)이
납니다. 2026-09-21 에 covers 와 density 가 둘 다 `20260921` 이라 실제로
막혔고, density 쪽 파일명을 바꿔서 풀었습니다.

**2. 스키마는 대시보드에서 손으로 만지지 않습니다.** 대시보드에서 만든 건
마이그레이션 기록에 남지 않아서, 나중에 같은 내용의 파일을 `db push` 하면
"already exists"(42710)로 멈춥니다. covers 버킷의 정책 4개가 이 경우였고,
`drop policy if exists` 를 앞에 붙여서 다시 실행 가능하게 고쳤습니다.

그래서 **새 마이그레이션은 전부 재실행 가능하게 씁니다** — `create table
if not exists`, `add column if not exists`, 정책은 `drop policy if exists`
후 `create policy`. 기존 파일들이 이 규칙을 따르고 있으니 그대로 흉내내면
됩니다. 재실행해도 데이터가 날아가지 않는지는 반드시 확인하고 쓰세요.

### 노트북 두 대로 작업합니다

오전엔 회사 노트북, 저녁엔 집 노트북. 시작할 때 `git pull`, 끝낼 때 `git push`.
pull 로 `package.json` 이 바뀌었으면 `npm install` 도 다시 합니다.

> **겪은 일 (2026-09-25)**: 집 맥 클론이 98커밋 뒤처진 채 커밋하지 않은 수정
> (`TemplateStyle.tsx`)을 들고 있어서 pull 이 막혔습니다. 확인해 보니 그 수정은
> 이미 회사 맥에서 커밋(`7ce608b`)됐고 파일은 나중에 삭제된 상태였습니다.
> **작업을 끝낼 때 커밋하지 않은 변경을 남기지 마세요** — 애매하면 WIP 커밋이라도
> 해서 올립니다.
**패치 zip을 주고받는 방식은 쓰지 않습니다** — repo가 Public이니 clone 하면 됩니다.

`.env.local` 은 git에 없으니 노트북마다 직접 만들어야 합니다
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
Vite는 **빌드 시점에** 환경변수를 코드에 박습니다 — 변수만 추가하고 재배포하지
않으면 반영되지 않습니다. 값이 없으면 앱이 죽지 않고 로그인만 목업으로
폴백하므로, `/login` 에 "연동 준비 중입니다"가 뜨는지로 원인을 확인합니다.

---

## 템플릿

템플릿은 `public/templates/<id>.html` 입니다. React 컴포넌트가 아니라
그냥 HTML 파일이고, 브라우저로 열면 그대로 보입니다.

**이 제품의 품질은 템플릿 품질입니다.** AI 가 글을 써주는 건 이제
차별점이 아닙니다 — 차별점은 그 글이 실제로 보낼 만한 물건이 되어
나오는가이고, 그건 템플릿이 정합니다. 그래서 템플릿 만드는 비용을
낮추는 것이 곧 제품 개선입니다.

### 새 템플릿 넣기

```bash
npm run tpl:prepare ~/Downloads/받은디자인.html my-template
# → 저장 찌꺼기 제거, iconify 풀기, Tailwind CSS 인라인, 스크립트 제거,
#    인쇄 규칙 기본값 추가까지 자동

# 파일을 열어 data-tf 를 답니다 (규칙은 src/lib/htmlTemplate.ts 주석)

npm run tpl:check my-template
# → 필수 바인딩, 외부 의존, 인쇄 규칙, 지어낸 내용, 실제 채우기까지 검사

# 통과하면 src/lib/htmlTemplates.ts 에 한 줄 추가
```

`tpl:check` 가 잡는 것 중 가장 중요한 건 **빠진 data-tf** 입니다.
키를 하나 빠뜨리면 그 내용이 화면에서 **조용히 사라집니다** — 에러도
없고 빈 칸도 안 보입니다. 사용자가 쓴 글이 결과물에서 빠지는 게 이
제품에서 가장 나쁜 실패라, 사람 눈에 맡기지 않습니다.

검증기는 앱과 **같은 채우기 엔진**(`src/lib/htmlTemplate.ts`)을 씁니다.
검증기가 따로 구현을 갖고 있으면, 검증은 통과하는데 화면에서는 깨지는
일이 생깁니다.

### 기계가 못 보는 것

폰 폭에서의 모양, 실제 인쇄 결과, 디자인 자체. 이 셋은 브라우저로
열어 직접 봐야 합니다.

### 템플릿에 넣으면 안 되는 것

- 지어낸 숫자 (`42+ Projects`, `99% 만족도`) — 한 줄만 들켜도 나머지
  전부를 의심받습니다
- 박아둔 기술·고객사 목록 — 누가 써도 같은 내용이 나옵니다
- 입력 폼 — 내보낸 파일에는 받아줄 서버가 없습니다
- 외부 스크립트·이미지 — 오프라인에서 깨지고, 미리보기 iframe 은
  스크립트를 막습니다

---

## 데이터 구조

`supabase/migrations/` 에 SQL이 있습니다. 쓰기 RLS는 전부 `user_id = auth.uid()` 기준이고,
읽기는 예외가 있습니다 — 공개된 포트폴리오(`/p/:id`, 커뮤니티)와 `profiles` 는 남도 읽습니다.

| 테이블 | 용도 |
|---|---|
| `portfolios` | 포트폴리오 1건. 제목·직무(`job`)·직무색(`job_color`)·공개범위·`listed`(커뮤니티 게시, 공개와 별개)·템플릿·색테마·폰트·레이아웃·`density`·커버이미지 경로·요약·`gaps[]`·`lead_field`(맨 앞에 둘 본문 필드, 직무 전환본만) |
| `portfolio_projects` | 그 안의 프로젝트들. `position` 순서, 케이스 스터디 6필드 + `stack[]` + `depth`(보여줄 깊이) |
| `portfolio_project_images` | 프로젝트별 이미지 (순서·삭제) |
| `portfolio_blocks` | 자유 블록(글·구분선). 설계는 `docs/editor-freedom.md` |
| `profiles` | 커뮤니티에 보이는 닉네임·사진. 읽기 전체 공개, 쓰기 본인만. 가입 트리거가 만들고 기본 닉네임은 소셜 실명 |
| `interview_sessions` · `interview_messages` | 대화로 만들기. 세션은 칸 상태(`fields`)·지금 묻는 칸·질문 수·되묻기 수·토큰 합계, 메시지는 대화 한 줄씩(사용자 답은 `answer_no` 로 근거 id `a{n}:{i}` 의 앞부분) |
| `job_switch_runs` · `job_switch_projects` | 직무 전환 재구성 결과. 공고 해부·근거 매칭·검증 경고·맨 앞 필드(`lead`)와 프로젝트별 재작성 문장. 원본은 안 바꾸고, "저장"을 눌러야 새 `portfolios` 행이 됩니다 |
| `draft_generations` | AI 호출 기록 (`input_tokens`/`output_tokens`). 가짜 사용량 배지는 제거했고(09-21), 유료 전환 시 이걸 세서 한도를 붙입니다 |
| Storage `portfolio-covers` | 커버·프로젝트 이미지 (`{userId}/{portfolioId}/...`) |
| Storage `avatars` | 프로필 사진 (`{userId}/avatar.<ext>` 하나를 덮어씀). 위 버킷과 경로 구조가 달라 분리 |

### Edge Functions

| 함수 | 하는 일 |
|---|---|
| `generate-draft` | 저장소 README·언어 구성 + 메모 + **웹 링크 본문**을 받아 초안 JSON 생성. 링크는 서버가 직접 fetch(브라우저는 CORS에 막힘), `isSafeUrl`로 루프백·사설망·메타데이터 엔드포인트 차단(SSRF 방지), 최대 3개·4000자·타임아웃 8초 |
| `translate-portfolio` | 포트폴리오를 영어로. title/summary/job + 프로젝트 서술형 6필드 + role/stack |
| `job-switch` | 직무 전환 재구성 4단계(공고 해부 → 근거 매칭 → 재작성 → 기계 검증). 원본은 포트폴리오 id 로 서버가 직접 읽고 **본인 것인지 확인**합니다. 모델은 1단계 `JOB_SWITCH_LIGHT_MODEL`(기본 Haiku), 2·3단계 `JOB_SWITCH_STRONG_MODEL`(기본 `claude-sonnet-5`). 날조 방지 로직은 `_shared/evidence.ts` 에 있고 `interview` 와 같이 씁니다 — 고치면 두 함수 모두 다시 배포 |
| `interview` | 대화로 만들기. `mode` 가 `start`/`answer`/`draft`. 질문은 `INTERVIEW_MODEL`(기본 Haiku), 초안은 `JOB_SWITCH_STRONG_MODEL`. 서버 규칙(근거 없는 칸 채움 거부, 되묻기 칸당 1회, 질문 12개)은 `rules.ts` |
| `delete-account` | 계정 삭제. 대상은 JWT 의 본인뿐(id 를 받지 않음), 두 버킷의 파일까지 지웁니다. service_role 키는 이 함수 안에만 |

제약: **첫 응답까지 150초.** AI 생성이 더 길어지면 큐로 빼거나 그 호출만 분리해야
합니다. 키는 서버에만 두고 JWT는 자동 검증됩니다.

### 영문 내보내기가 동작하는 방식

Export 화면에서 "영어 버전"을 **누른 시점에만** 번역을 호출합니다 — 한국어만
쓰고 끝나면 번역 비용이 0입니다. 실패하거나 응답이 이상하면 원문을 그대로
보여줍니다(번역 실패보다 원문 노출이 안전한 실패 방식).

주의할 분리가 하나 있습니다. **데이터 텍스트는 `translate.ts`가 번역하지만,
섹션 라벨("맥락 및 배경" 같은 제목)은 번역 대상이 아닙니다.** 라벨은
`buildTemplateData.ts` 가 `lang` 에 따라 ko/en 중 하나를 골라 템플릿에 넣습니다.
새 라벨을 추가하면 ko/en 둘 다 적으세요.

---

## 디자인 시스템

`src/index.css` 와 `tailwind.config.js` 에 정의돼 있습니다.

### 색 — 전부 CSS 변수입니다

**구조상 다크가 `:root` 기반이고, `:root.light` 가 라이트로 덮어씁니다.**
다만 **화면은 라이트로 고정**했습니다(2026-09-21). OS 설정을 따라가지 않고 테마
토글도 렌더하지 않습니다. 코드는 지우지 않았으니 되살리려면 `index.html` 의 테마
스크립트 한 줄과 `ThemeToggle` 렌더를 되돌리면 됩니다.
`neutral-50~950` 과 `brand` 유틸리티가 고정 hex가 아니라 CSS 변수(`--n50`~`--n950`,
`--brand`)에 연결돼 있어서, 컴포넌트 className을 그대로 둔 채 테마가 바뀝니다.

```
--brand        다크 rgb(194 112 61) #C2703D   라이트 rgb(160 88 41) #A05829
--brand-solid  양쪽 공통 rgb(168 92 48)  ← 흰 글자를 얹는 버튼 배경 (.btn-primary)
--brand-dark   hover 상태
--n950         다크 #0A0A0A / 라이트 #FAF7F1  ← 페이지 배경
```

> **컴포넌트에 hex를 직접 박지 마세요.** `text-brand`, `bg-neutral-900` 처럼
> Tailwind 클래스를 쓰면 라이트/다크가 자동으로 맞습니다.
> 액센트를 테마별로 분리한 이유는 대비율입니다 — 단일 hex로는 라이트와
> 다크를 동시에 WCAG AA(4.5:1)에 맞출 수 없었습니다.
> **라이트 테마에서는 neutral 번호가 뒤집힙니다** — `--n950` 이 가장 밝은 색입니다.

예외가 두 군데 있습니다. 홈(`Dashboard.tsx`)의 액센트와 직무색 배지는 hex를
씁니다 — `job_color` 가 원래 hex 컬럼이고, "hex + 알파 접미사"로 은은한 배경을
만드는 방식이라 RGB 트리플 변수로는 다루기 어렵습니다.

### 폰트

- 제목 — **Gowun Batang** (serif, 획이 가늘고 손글씨 느낌)
- 본문 — **Pretendard** (dynamic-subset 로드, 풀셋 쓰면 2MB 넘어감)

### 글씨 크기 — 기준이 있습니다

`tailwind.config.js` 의 `fontSize` 에서 줄 간격을 재정의했습니다.
**컴포넌트에 px 를 직접 박지 말고 유틸리티를 쓰세요.**

```
text-xs    12px / 18px   설명·라벨·보조 문구
text-sm    14px / 22px   본문·입력칸 (기본)
text-base  16px / 24px
text-lg    18px / 28px
text-xl    20px / 28px   페이지 제목
```

**크기는 Tailwind 기본값 그대로이고, 줄 간격만 늘렸습니다**(기본 16/20 →
18/22). 한글은 획이 많아 같은 크기에서도 줄이 붙으면 빽빽해 보입니다.
글자를 키우지 않고 읽기만 편하게 하는 방법입니다.

> **겪은 일**: 화면이 작아 보여 14/16 까지 올렸다가 13/15 로 내렸고
> 결국 원래 크기로 돌아왔습니다. 원인은 글씨가 아니라 **브라우저 확대
> 배율**이었습니다 — 크롬은 사이트마다 배율을 따로 기억하는데
> `localhost` 쪽이 100% 가 아니었습니다. 화면이 작아 보이면 디자인을
> 고치기 전에 `Cmd + 0` 부터 눌러보세요.

예외는 세 군데입니다.

- **`.badge`** — 12px 고정. 알약 모양이라 글자가 커지면 좌우로 길어져
  한 줄에 들어가던 배지들이 줄을 밀어냅니다.
- **책등(`Bookshelf`)** — 책등 폭이 54px 이라 물리적으로 좁습니다.
- **편집기 본문 입력칸** — `text-base`(16px). 이 앱에서 글을 가장 오래
  쓰고 고치는 칸이라, 빽빽한 화면에 맞춘 기준을 여기까지 적용할 이유가
  없습니다.

그리고 **템플릿(`public/templates/*.html`)은 이 스케일과 무관합니다.** 앱의
Tailwind 설정이 아니라 파일 안에 인라인된 자체 CSS 를 씁니다. 앱 화면을
건드려도 결과물(PDF·HTML)의 줄바꿈은 달라지지 않습니다.

### 아이콘

`lucide-react`, `strokeWidth={1.5}`, 색은 `text-brand` 로 변수 상속.
Gowun Batang의 가는 획과 무게를 맞추려고 얇게 갑니다.
예외는 소셜 로그인 로고입니다 — `BrandIcons.tsx` 참고.

### 톤

보라/파랑 그라데이션(가장 흔한 "AI 티")을 의도적으로 피하고, 클레이·테라코타
톤을 씁니다. 라이트 테마도 차가운 회색이 아니라 원고지·잉크 느낌의 웜톤입니다.

---

## 주요 파일

```
public/templates/                 HTML 템플릿 (devcore.html, minimal-serif.html) — 위 "템플릿" 절
scripts/                          prepare-template.mjs, check-template.ts (npm run tpl:*)
src/
├── index.css                     테마 변수 + @layer components (.btn-*, .sec-*, .step-*, .book*)
├── landingContent.ts             랜딩 문구를 한곳에. 카피만 고칠 땐 이 파일만 열면 됨
├── mockData.ts                   남은 목업. VersionHistory 와 AIRequestStatus 타입만 씀
├── lib/
│   ├── supabase.ts               동적 import로 별도 청크 (메인 청크 유지)
│   ├── portfolios.ts             포트폴리오·프로젝트 CRUD, 공개·게시, 직무·직무색·제목·연도
│   ├── htmlTemplate.ts           템플릿 채우기 엔진 (data-tf 규칙은 이 파일 주석). 앱과 tpl:check 가 공유
│   ├── htmlTemplates.ts          고를 수 있는 템플릿 목록 — 여기 적혀야 선택지에 뜹니다
│   ├── buildTemplateData.ts      포트폴리오 → 템플릿 데이터 (ko/en 라벨 포함)
│   ├── blocks.ts                 자유 블록 CRUD
│   ├── images.ts                 이미지 업로드 전 축소 (shrinkImage)
│   ├── profile.ts  account.ts    프로필, 계정 데이터 내보내기·삭제
│   ├── draft.ts  translate.ts  github.ts
│   └── portfolioTheme.ts  scrollRefresh.ts  formatRelativeTime.ts
├── pages/
│   ├── Landing.tsx  Login.tsx  Dashboard.tsx(홈)  PortfolioList.tsx(내 서재)
│   ├── PublicPortfolio.tsx       공개 열람 /p/:id
│   ├── wizard/       SourceInput → AIDraftGeneration → PortfolioEditor(스타일·미리보기 포함) → Export
│   ├── gallery/      커뮤니티 (라우트는 /community, 폴더명은 gallery 유지)
│   ├── account/      AccountSettings · SocialAccountManage · DataManage
│   ├── jobswitch/                직무 전환 요청·결과 (lib/jobSwitch.ts)
│   ├── chat/ChatBuilder.tsx      대화로 만들기 /chat/:id (lib/interview.ts, 홈 입력창은 components/ChatStart.tsx)
│   └── VersionHistory.tsx        ← 아직 목업
└── components/
    ├── TemplateFrame.tsx         템플릿 iframe (1280x800 고정 창 + 축소, 공개 링크는 실제 폭)
    ├── EditorPreview.tsx  StylePanel.tsx  WizardLayout.tsx  DesktopOnly.tsx(1200px 게이트)
    ├── Bookshelf.tsx             책등 세로쓰기 서재 (hover로 펼쳐짐, 이름·색·연도 인라인 수정)
    ├── ProfileEditor.tsx  UserMenu.tsx  SocialLoginButtons.tsx  BrandIcons.tsx
    ├── GrainCover.tsx            그라디언트+그레인 표지 (색조 = 직무 색)
    ├── Steps.tsx  PerspectiveScroller.tsx  BeforeAfterDemo.tsx  HeroRewrite.tsx  MarqueeRail.tsx
    └── Faq.tsx  Reveal.tsx  RouteFallback.tsx  ScrollProgress.tsx  ScrollToTop.tsx  ThemeToggle.tsx  AIRequestStatus.tsx
supabase/
├── functions/                    generate-draft · translate-portfolio · delete-account · job-switch · interview
│   └── _shared/evidence.ts       날조 방지 공용 로직 (근거 쪼개기·검증)
└── migrations/                   14자리 타임스탬프 규칙 (위 "마이그레이션 규칙")
docs/
├── checklist.md                  전체 점검 체크리스트 (단계별 할 일의 원본)
├── editor-redesign.md  editor-freedom.md   편집 화면·자유 블록 설계
├── job-switch-design.md          직무 전환 재구성 설계 (2026-09-25 구현)
├── chat-builder-design.md        대화로 만들기(겉은 챗봇, 속은 인터뷰) 설계 (2026-09-25 구현)
└── mockups/chat-builder.html     위 설계의 눌러볼 수 있는 예시 화면
```

`docs/archive/` 의 `적용방법-v*.md`, `랜딩재구성.md` 는 **이미 반영이 끝난 옛
작업 지시서**입니다. 현재 코드 기준이 아니니 참고만 하세요.

### 랜딩 섹션 순서와 설계 의도

배경 면을 교차시키고(`.surface-alt`) 섹션마다 **레이아웃 형태를 바꿉니다.**
3열 카드 그리드가 연속으로 세 번 나오던 것이 "단조롭다"의 원인이었기 때문입니다.

```
히어로        기본 면   HeroRewrite 모션
차별점        밝은 면   스크롤 잠금 몰입 구간
작동 방식     기본 면   세로 연결선
결과물        밝은 면   가로 스크롤 (갤러리 링크는 제거, 카드는 정적)
대상          기본 면   정의 목록(dl)
FAQ           밝은 면   아코디언
최종 CTA      기본 면
```

---

## 최근 작업 (2026-09-21 ~ 09-23)

커밋 메시지 본문에 이유까지 적어뒀습니다. 자세한 건 `git log` 를 보세요.

**편집기**
- 템플릿/스타일 설정 페이지(`/wizard/style/:id`)를 편집기에 합침 — 오른쪽에
  스타일 패널 + 실시간 미리보기. 옛 주소는 편집기로 리다이렉트만 남김
- 레이아웃을 '나열(1개씩/2개씩)'과 '여백(`density`)' 두 축으로
- 프로젝트 깊이(`depth`)·프로젝트별 이미지·전체화면 미리보기
- 툴·키워드(`stack`) 편집, 자유 블록 1단계(글·구분선), 미리보기에서 블록 바로 고치기
- 동작하지 않는 섹션 3개(AI 문장 다듬기·근거 확인·이력서 대조)는 접어둠

**템플릿 — React 컴포넌트 4종에서 HTML 파일로**
- `public/templates/*.html` + iframe 미리보기. 현재 2종(DevCore, 미니멀 세리프)
- `tpl:prepare` / `tpl:check` 파이프라인: 디자인 도구 껍데기 판별, 스타일시트
  인라인, div 짝·확장 흔적 검사

**내보내기**
- PDF 를 html2canvas 캡처에서 브라우저 인쇄로 — 글자가 선택되는 PDF
- HTML 파일 내보내기 구현(전에는 비활성 버튼), 영문 번역은 누를 때만 호출
- 공개/비공개 전환 + 공개 열람 페이지 `/p/:id`

**커뮤니티·계정**
- 커뮤니티 게시(`listed`)를 공개와 분리, 갤러리를 실제 데이터로
- 프로필(닉네임·사진) — 작성자 표시. 기본 닉네임이 실명이라 두 군데서 알림
- 표지 색조를 직무 색에서 가져옴
- 데이터 관리 버튼 3개(내보내기·전체 삭제·계정 삭제) 실제 구현
- 소셜 계정 관리를 실제 `user.identities` 로 (연결·해제)
- 가짜 AI 사용량 배지 제거, FAQ TODO 2개 채움

**화면 전반**
- 앱 화면은 데스크탑 전용(1200px 미만은 안내 화면), 랜딩·로그인은 모바일 허용
- 라이트 고정·다크 감춤, 위저드 왼쪽 단계 레일, 로그인 전체 화면 분할
- 랜딩: 반전 구역, 결과물 무한 가로 띠, 어두운 전체 폭 CTA, 푸터 확장

**2026-09-25** — 집 맥을 `~/Documents/GitHub/Tellmefolio` 로 옮김,
`package-lock.json` 에 남아 있던 `tsx` 항목 정리. 로그인 왼쪽 책장 그림, 임시 아바타.
**직무 전환 재구성을 실제로 구현**(목업 → Edge Function `job-switch` + 테이블 2개).
**대화로 채우기** — 편집기에서 프로젝트의 빈 칸만 묻는 대화(설계 문서 7-1절). 내 서재를 표지 카드 격자로, 카드에서 커뮤니티 올리기/내리기 토글.
**대화로 만들기 구현** — 홈 맨 위 입력창 → `/chat/:id`(채팅 + 채워지는 칸 6개) → 초안. 홈의 "새 포트폴리오 만들기" 카드는 "자료로 만들기"(기존 위저드)로, 현황 띠의 직무 전환 수는 실제 값으로.

---

## 남은 할 일

단계별 원본은 **`docs/checklist.md`** 입니다. 여기는 요약입니다.

| 항목 | 메모 |
|---|---|
| 배포판 동작 확인 | 실제 URL에서 초안 생성 1회, 여백 변경 1회 (checklist 0단계의 마지막 칸) |
| 대화로 만들기 2차 | 깃허브 링크 감지, 같은 입력창에서 "PM 공고에 맞게"·"영어로" 같은 명령 — `docs/chat-builder-design.md` 9절 |
| 홈 "최근 AI 요청 상태" | 아직 가짜 목록(날짜까지 박혀 있음). `draft_generations`·`job_switch_runs`·`interview_sessions` 로 바꾸거나 빼야 합니다 |
| 직무 전환 검증 | 설계 문서 7절대로 실제 공고 3개로 돌려 ChatGPT 결과와 비교. 요약 문단은 아직 재작성 대상이 아닙니다 |
| 자유 블록 2~6단계 | `docs/editor-freedom.md` 7절. 1단계(글·구분선)까지 끝남 |
| 템플릿 추가 | 현재 2종. 이 제품의 품질은 템플릿 품질입니다 |
| 목업 섹션 복구 | 에디터의 "AI 문장 다듬기"·"근거 확인"·"이력서 대조" — 접힌 채 예시 데이터 |
| `VersionHistory` | 버전 저장이 없어 화면만 있음. 안 만들 거면 라우트·링크를 뺍니다 |
| `mockData.ts` 정리 | 남은 사용처는 `VersionHistory` 와 `AIRequestStatus` 타입뿐 |
| 랜딩 카피 | 개발자 관점으로 다시 쓰기 — 생성 파이프라인이 실제로 돈 뒤에 하기로 했고, 이제 돕니다 |
| 프리렌더 | CSR 전용이라 네이버·다음 색인이 안 됩니다. 전체 프리렌더보다 `index.html` 메타태그 + 랜딩 정적화 정도가 비용 대비 낫다고 판단 |
| 스크롤 초기화 | `ScrollToTop` 을 넣었지만 완전히 해결되지 않았습니다. GSAP ScrollTrigger 충돌 의심 |
| **`/terms`, `/privacy`** | 🕓 맨 마지막(사업자 등록 후)으로 결정. 단 **외부 공개 전에는 반드시** — 개인정보처리방침은 법적 의무 |

### 건드리지 말 것

- **`public/og.png`** — 바꾸는 안을 검토했지만 **현행 유지로 결정**했습니다.
- **`src/pages/gallery/` 폴더명** — 라우트만 `/community` 로 옮겼고 폴더는 그대로입니다.
- `.env`, `.env.local`, `.vercel/`, `Claude outputs/` — `.gitignore` 에 있습니다.
  repo가 Public이니 절대 커밋되지 않도록 주의하세요.
- **Anthropic API 키와 service_role 키는 프런트엔드에 절대 두지 않습니다.**
- GitHub OAuth 에 `repo` 권한은 요청하지 않습니다 — 비공개 코드 읽기·쓰기
  전권이라 공개 저장소만 지원하는 이 서비스에 과합니다.

---

## 작업 방식

작업하다 궁금하거나 확인해야 할 것이 생기면 **먼저 물어보고 진행**해주세요.
추측으로 밀고 나가서 나중에 되돌리는 것보다 낫습니다.

파일을 고치기 전에는 커밋해서 되돌릴 지점을 만들고, 고친 뒤에는 `git diff` 로
의도한 변경만 들어갔는지 확인하는 습관을 지킵니다.

커밋 전에 `npm run build` 를 한 번 돌리세요 — `tsc -b` 가 포함돼 있어
타입 에러가 배포까지 가지 않습니다.
