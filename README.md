# Tellmefolio

**이야기하면 포트폴리오가 됩니다** — AI 포트폴리오 생성 서비스
*An AI portfolio service — it reads your public GitHub repositories and drafts a portfolio from them.*

**배포:** [tellmefolio-app.vercel.app](https://tellmefolio-app.vercel.app)
**실행:** `npm install && npm run dev`

---

## 무엇을 만든 것인가

포트폴리오를 만들려는 사람에게 재료는 대개 이미 있습니다. 저장소에, 프로젝트 메모에,
반쯤 기억나는 작업들에 흩어져 있을 뿐입니다. 없는 것은 그것을 엮는 글입니다.

텔미폴리오는 이미 가지고 있는 것 — 공개 GitHub 저장소와 직접 입력한 메모 — 을 읽어
초안을 씁니다. 맥락, 맡은 역할, 문제, 실행, 성과, 회고 순으로 나오고, 사용자는 그
초안을 고쳐 공개하거나 PDF로 내보냅니다.

없는 경력을 지어내지 않습니다. 근거가 부족한 항목은 그럴듯한 문장으로 메우는 대신
**빈칸(gap)으로 돌려주어** 사용자가 직접 채우게 합니다.

## 내가 한 것

초기 스캐폴드는 다른 사람이 세팅했고, 그 이후를 제가 이어받아 만들었습니다.

**서비스 방향.** 타깃을 디자이너에서 포트폴리오가 필요한 모든 직무로 넓혔습니다.
판단 근거는 두 가지였습니다. GitHub 프로필은 README·언어 구성·커밋이 전부 텍스트라
모델에 그대로 넣을 수 있고, 디자이너 쪽은 Behance·Dribbble이 이미 두껍지만 GitHub
위에 얹는 자리는 비어 있습니다. 한 줄로 정리하면 "GitHub에는 코드가 있지만 이야기는
없다"입니다.

**UX 흐름.** 생성 위저드에서 스타일 선택을 AI 초안보다 **앞으로** 옮겼습니다. 아직
보지도 못한 내용에 어울리는 모양을 고르라는 요구는 성립하지 않기 때문입니다. 퀵
액션형과 상세 폼형으로 중복 설계돼 있던 직무 전환 화면은 하나로 합치고, 구성 방식
선택을 AI 요청 이전 단계로 배치했습니다.

**디자인 시스템.** 다크가 기본이고 `:root.light` 클래스로 라이트로 전환합니다. 모든
색은 CSS 변수(`--n50`~`--n950`, `--brand`)로 정의하고 컴포넌트는 Tailwind 클래스만
쓰게 해서, hex를 직접 박는 순간 두 테마가 어긋나는 문제를 구조적으로 막았습니다.
제목은 Gowun Batang, 본문은 Pretendard입니다.

**인증.** Supabase Auth로 Google·GitHub·Figma 로그인을 붙였습니다. GitHub 읽기는
**공개 저장소만** 지원합니다. `repo` 스코프를 요청하면 비공개 코드에 대한 읽기·쓰기
전권을 받게 되는데, 이 기능에는 필요 없는 권한이라 제외했습니다. 로그인 시 받은
공급자 토큰은 메모리에만 두어 API 호출 한도만 올리고, 없으면 미인증 호출로
넘어갑니다.

**생성 파이프라인.** 초안 생성은 Supabase Edge Function(`supabase/functions/generate-draft`)
에서 돕니다. API 키가 브라우저로 내려가지 않게 하기 위해서입니다. 편집기의 입력칸은
초안이 실제로 돌려주는 구조에 맞춰 다시 설계했습니다.

**성능.** 라우트 단위 코드 스플리팅으로 메인 청크를 385kB → 321kB(gzip 128 → 114kB)로
줄였습니다. 랜딩만 정적 import로 남겼는데, GSAP ScrollTrigger의 초기화 타이밍 때문입니다.
나머지 20개 라우트는 lazy입니다.

## 실행 방법

```bash
npm install
npm run dev          # http://localhost:5173
```

환경변수 없이도 실행됩니다. Supabase 변수가 없으면 로그인이 목업으로 폴백해서 모든
화면을 볼 수 있습니다.

실제 백엔드를 붙이려면 `.env.example`을 `.env.local`로 복사하고 채웁니다.

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Vite는 빌드 시점에 환경변수를 코드에 박으므로, 변수만 추가하고 다시 빌드하지 않으면
반영되지 않습니다.

```bash
npm run build        # tsc -b && vite build
npm run preview
```

Edge Function은 앱과 별도로 배포합니다.

```bash
supabase functions deploy generate-draft
supabase secrets set ANTHROPIC_API_KEY=... MODEL=...
```

## 스택

| | |
|---|---|
| 프런트엔드 | Vite, React 18, TypeScript, Tailwind CSS 3 |
| 모션 | GSAP (ScrollTrigger) |
| 백엔드 | Supabase — Auth, Postgres, Edge Functions (Deno) |
| 내보내기 | jsPDF + html2canvas |
| 배포 | Vercel (`main`에 push하면 자동 배포) |

```
src/
  pages/wizard/      생성 흐름 — 자료 입력, 초안, 편집, 내보내기
  pages/gallery/     커뮤니티, 공유 설정, 방문 통계
  pages/account/     계정 설정, 소셜 계정, 데이터 관리
  components/portfolio-templates/   Minimal · Magazine · Research · 라이브 편집기
  lib/               Supabase 클라이언트, GitHub 읽기, 초안, 블록, PDF 내보내기
  theme/             다크 / 라이트 컨텍스트
supabase/
  migrations/        portfolios, blocks, images, covers
  functions/         generate-draft, translate-portfolio, delete-account
```

## 남은 것

- 사용자별 AI 생성 횟수 제한이 아직 적용되지 않았습니다(화면의 카운터는 표시만 하는 상태).
- CSR 전용이라 네이버·다음에 색인되지 않습니다. 전체를 프리렌더하기보다 `index.html`
  메타태그 + 랜딩 정적화가 비용 대비 낫다고 보고 있습니다.
