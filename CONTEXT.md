# Tellmefolio — 작업 컨텍스트

새 세션에서 이 프로젝트를 이어받을 때 이 파일부터 읽으면 됩니다.
사람이 읽어도 되고, AI 에이전트에게 "repo의 CONTEXT.md 읽어줘"라고 해도 됩니다.

> 마지막 갱신: 2026-09-21 (커밋 `259f0e6`)

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
jsPDF + html2canvas       — PDF 내보내기 (동적 import, 별도 청크)
```

**Next.js 가 아닙니다.** 빌드는 `tsc -b && vite build` 라 타입 에러가 있으면
빌드가 멈춥니다. CSR 전용입니다.

---

## 어디에 있는가

| | |
|---|---|
| 로컬 (집 맥) | `~/Projects/tellmefolio-app` — 원격 SSH |
| 로컬 (회사 맥) | `~/Documents/GitHub/Tellmefolio` — 원격 **HTTPS**, GitHub Desktop으로 푸시 |
| GitHub | `github.com/chaexove-ai/Tellmefolio` (Public) |
| Vercel | `vercel.com/tellmefolio/tellmefolio-app` |
| 배포 URL | `tellmefolio-app.vercel.app` |

클론이 두 개이고 **원격 인증 방식이 서로 다릅니다.** 터미널에서 `git push`가
안 되면 먼저 `git remote -v`로 어느 쪽 클론인지 확인하세요. HTTPS 쪽은
GitHub Desktop의 "Push origin"을 씁니다.

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

# 시크릿도 별도입니다 (함수 두 개 다 ANTHROPIC_API_KEY 하나만 필수)
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
**패치 zip을 주고받는 방식은 쓰지 않습니다** — repo가 Public이니 clone 하면 됩니다.

`.env.local` 은 git에 없으니 노트북마다 직접 만들어야 합니다
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
Vite는 **빌드 시점에** 환경변수를 코드에 박습니다 — 변수만 추가하고 재배포하지
않으면 반영되지 않습니다. 값이 없으면 앱이 죽지 않고 로그인만 목업으로
폴백하므로, `/login` 에 "연동 준비 중입니다"가 뜨는지로 원인을 확인합니다.

---

## 데이터 구조

`supabase/migrations/` 에 SQL이 있습니다. RLS는 전부 `user_id = auth.uid()` 기준.

| 테이블 | 용도 |
|---|---|
| `portfolios` | 포트폴리오 1건. 제목·직무(`job`)·직무색(`job_color`)·공개범위·템플릿·색테마·폰트·레이아웃·커버이미지 경로·요약·`gaps[]` |
| `portfolio_projects` | 그 안의 프로젝트들. `position` 순서, 케이스 스터디 6필드 + `stack[]` |
| `draft_generations` | AI 호출 기록 (`input_tokens`/`output_tokens`) — **사용 횟수 제한의 토대인데 아직 화면과 연결 안 됨** |
| Storage `portfolio-covers` | 커버 이미지 |

### Edge Functions

| 함수 | 하는 일 |
|---|---|
| `generate-draft` | 저장소 README·언어 구성 + 메모 + **웹 링크 본문**을 받아 초안 JSON 생성. 링크는 서버가 직접 fetch(브라우저는 CORS에 막힘), `isSafeUrl`로 루프백·사설망·메타데이터 엔드포인트 차단(SSRF 방지), 최대 3개·4000자·타임아웃 8초 |
| `translate-portfolio` | 포트폴리오를 영어로. title/summary/job + 프로젝트 서술형 6필드 + role/stack |

제약: **첫 응답까지 150초.** AI 생성이 더 길어지면 큐로 빼거나 그 호출만 분리해야
합니다. 키는 서버에만 두고 JWT는 자동 검증됩니다.

### 영문 내보내기가 동작하는 방식

Export 화면에서 "영어 버전"을 **누른 시점에만** 번역을 호출합니다 — 한국어만
쓰고 끝나면 번역 비용이 0입니다. 실패하거나 응답이 이상하면 원문을 그대로
보여줍니다(번역 실패보다 원문 노출이 안전한 실패 방식).

주의할 분리가 하나 있습니다. **데이터 텍스트는 `translate.ts`가 번역하지만,
템플릿이 자체적으로 그리는 라벨("맥락 및 배경" 같은 섹션 제목)은 코드에 박힌
문자열이라 번역 대상이 아닙니다.** 그래서 `PortfolioTemplateProps.lang` 으로
따로 알려줍니다. 템플릿에 새 라벨을 추가하면 `lang` 분기도 같이 넣으세요.
(예외: `ResearchTemplate` 의 Background/Problem 소제목은 학술 논문 관례를
흉내 낸 디자인 의도라 ko/en 상관없이 항상 영어입니다.)

---

## 디자인 시스템

`src/index.css` 와 `tailwind.config.js` 에 정의돼 있습니다.

### 색 — 전부 CSS 변수입니다

**다크가 기본이고, `:root.light` 클래스로 라이트로 전환됩니다.**
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

그리고 **`portfolio-templates/` 는 이 스케일을 따르지 않습니다.** 그쪽은
PDF 로 나가는 문서라 `text-[12px]` 처럼 고정값으로 박아뒀습니다. 앱 화면
쪽을 건드려도 지금까지 만든 PDF 와 줄바꿈이 달라지지 않게 하려는 것입니다.

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
src/
├── index.css                     테마 변수 + @layer components (.btn-*, .sec-*, .step-*, .book*)
├── landingContent.ts             랜딩 문구를 한곳에. 카피만 고칠 땐 이 파일만 열면 됨
├── lib/
│   ├── supabase.ts               동적 import로 별도 청크 (메인 청크 유지)
│   ├── portfolios.ts             포트폴리오·프로젝트 CRUD, 직무·직무색 수정
│   ├── draft.ts                  generate-draft 호출
│   ├── translate.ts              translate-portfolio 호출 + 결과 병합
│   ├── github.ts                 공개 저장소 목록·README·언어 구성
│   ├── exportPdf.ts              DOM → PDF
│   └── templates.ts  portfolioTheme.ts  scrollRefresh.ts  formatRelativeTime.ts
├── pages/
│   ├── Landing.tsx  Login.tsx  Dashboard.tsx(홈)  PortfolioList.tsx(내 서재)
│   ├── wizard/       SourceInput → TemplateStyle → AIDraftGeneration → PortfolioEditor → Export
│   ├── gallery/      커뮤니티 (라우트는 /community, 폴더명은 gallery 유지)
│   ├── account/  jobswitch/  VersionHistory.tsx
└── components/
    ├── portfolio-templates/      PortfolioRenderer + Research/Live/Minimal/Magazine
    ├── Bookshelf.tsx             책등 세로쓰기 서재 (hover로 펼쳐짐)
    ├── Steps.tsx  PerspectiveScroller.tsx  BeforeAfterDemo.tsx  HeroRewrite.tsx
    ├── BrandIcons.tsx  SocialLoginButtons.tsx  UserMenu.tsx  GrainCover.tsx
    └── Faq.tsx  Reveal.tsx  RouteFallback.tsx  ScrollProgress.tsx  ScrollToTop.tsx  ThemeToggle.tsx
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

## 최근 작업 (2026-09-21)

1. **웹 링크 자료를 초안 생성에 실제로 반영** — 고른 링크가 화면에만 있고
   서버로 가지 않아 "링크만 선택"하면 400이 나던 문제. SSRF 가드 포함.
2. **GitHub 저장소 목록 401을 재연결 안내로 구분** — provider 토큰은 메모리에만
   있어 새로고침하면 사라집니다. "재로그인"이 아니라 "GitHub 연결 한 번 더"로
   풀리는 문제라 일반 오류와 분리했습니다.
3. **프로젝트 추가·삭제, 직무·직무색 편집** — 프로젝트 행이 AI 초안 경로로만
   생기던 것, 직무 배지가 클릭해도 반응 없던 것, 색상 모달이 저장해도 남지
   않던 것을 모두 실제 동작으로.
4. **영문 내보내기** — 위 "영문 내보내기가 동작하는 방식" 참고.
5. **홈 가독성·책장 확대** — 홈 카드마다 같은 brand 아이콘 원이 반복돼 구획이
   안 보이던 것을 accent 색으로 분리. 책등 38→54px, 높이 164→224px.

그 이전: DB 스키마 + 마법사/서재의 실제 테이블 연동, 에디터 재설계, 커버
이미지 저장, PDF 내보내기, 라우트 코드 스플리팅, Supabase 인증 연동.

---

## 남은 할 일

| 항목 | 메모 |
|---|---|
| **AI 사용 횟수 제한** | 화면의 "3/5회"가 아직 가짜입니다. `draft_generations` 테이블에 호출 기록은 이미 쌓이니, 이걸 세서 Edge Function에서 막으면 됩니다 |
| **`/terms`, `/privacy`** | 푸터 링크는 주석으로 준비만 해둔 상태. 개인정보처리방침은 법적 의무입니다 |
| **FAQ 답변** | `landingContent.ts` 의 데이터 정책·가격 답변이 `TODO` 로 비어 있습니다. 특히 "제 자료가 AI 학습에 사용되나요?"는 잘못 쓰면 문제가 됩니다 |
| 랜딩 카피 | 개발자 관점으로 다시 쓰기 — 생성 파이프라인이 실제로 돈 뒤에 하기로 했고, 이제 돕니다 |
| 목업 섹션 복구 | 에디터의 "AI 근거 확인"·"이력서 불일치 확인" 이 렌더링만 막힌 상태입니다(코드는 보존) |
| AI 문장 다듬기 | 초안을 받은 뒤 문장 단위로 고쳐 쓰는 기능 |
| 프리렌더 | CSR 전용이라 네이버·다음 색인이 안 됩니다. 전체 프리렌더보다 `index.html` 메타태그 + 랜딩 정적화 정도가 비용 대비 낫다고 판단 |
| 스크롤 초기화 | `ScrollToTop` 을 넣었지만 완전히 해결되지 않았습니다. GSAP ScrollTrigger 충돌 의심 |
| 웹 형식 내보내기 | Export의 "웹" 버튼은 `disabled` 이고 구현이 없습니다 |

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
