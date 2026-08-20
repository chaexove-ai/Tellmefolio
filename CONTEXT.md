# Tellmefolio — 작업 컨텍스트

새 세션에서 이 프로젝트를 이어받을 때 이 파일부터 읽으면 됩니다.
사람이 읽어도 되고, AI 에이전트에게 "repo의 CONTEXT.md 읽어줘"라고 해도 됩니다.

> 마지막 갱신: 2026-08-20 (커밋 `5615425`)

---

## 무엇을 만드는가

AI 포트폴리오 제작 서비스. 한 줄 요약은 **"이야기하면 포트폴리오가 됩니다"** 입니다.

원본 자료(GitHub 저장소, PDF, 링크, 메모)를 넣으면 AI가 케이스 스터디 구조로
초안을 만들고, 채용 공고를 넣으면 **그 직무의 언어로 다시 씁니다.**
같은 프로젝트를 프론트엔드 / UX / 기획 관점으로 각각 재해석하는 것이
이 서비스의 유일한 차별점이고, 랜딩의 "차별점 몰입 구간"이 그것을 보여줍니다.

---

## 기술 스택

```
Vite + React 18 + TypeScript
Tailwind CSS 3
GSAP (ScrollTrigger)      — 랜딩 모션
react-router-dom          — 라우팅
lucide-react              — 아이콘
```

**Next.js 가 아닙니다.** 빌드는 `tsc -b && vite build` 라 타입 에러가 있으면
빌드가 멈춥니다. CSR 전용입니다.

---

## 어디에 있는가

| | |
|---|---|
| 로컬 (집 맥) | `~/Projects/tellmefolio-app` |
| GitHub | `github.com/chaexove-ai/Tellmefolio` (Public, SSH 인증) |
| Vercel | `vercel.com/tellmefolio/tellmefolio-app` |
| 배포 URL | `tellmefolio-app.vercel.app` |

### 배포 방식 — 중요

**Vercel 프로젝트가 GitHub repo에 연결돼 있습니다. `git push` 하면 자동 배포됩니다.**

`vercel --prod` 를 손으로 칠 필요가 없습니다. (현재 로컬 Vercel CLI 인증은
깨져 있고, 고칠 필요도 없습니다)

### 노트북 두 대로 작업합니다

오전엔 회사 노트북, 저녁엔 집 노트북을 씁니다. 예전에는 zip 파일로 코드를
주고받다가 버전이 뒤섞여 어느 쪽이 최신인지 알 수 없게 된 적이 있습니다.
지금은 GitHub으로 동기화합니다.

```bash
git pull      # 작업 시작할 때
git push      # 작업 끝낼 때 (= 배포)
```

**패치 zip을 새로 만들어 주고받는 방식은 쓰지 않습니다.** repo가 Public이니
소스가 필요하면 clone 해서 보면 됩니다.

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

### 폰트

- 제목 — **Gowun Batang** (serif, 획이 가늘고 손글씨 느낌)
- 본문 — **Pretendard** (dynamic-subset 로드, 풀셋 쓰면 2MB 넘어감)

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
├── index.css                     테마 변수 + @layer components (.btn-*, .sec-*, .step-*)
├── landingContent.ts             랜딩 문구를 한곳에. 카피만 고칠 땐 이 파일만 열면 됨
├── mockData.ts                   갤러리·버전 목업 데이터
├── pages/
│   ├── Landing.tsx               랜딩 조립 (섹션 순서, 대상 목록)
│   ├── Login.tsx                 소셜 로그인 (목업 — 아래 TODO 참고)
│   ├── gallery/  wizard/  account/  jobswitch/
│   ├── Dashboard.tsx  PortfolioList.tsx  VersionHistory.tsx
└── components/
    ├── Steps.tsx                 "어떻게 만들어지나요" 3단계 세로 연결선
    ├── PerspectiveScroller.tsx   차별점 몰입 구간 (스크롤 = 직무 전환)
    ├── BeforeAfterDemo.tsx       위 구간의 모바일·모션감소 대체 탭 위젯
    ├── BrandIcons.tsx            Google/GitHub/Figma 공식 로고 SVG
    ├── SocialLoginButtons.tsx    소셜 버튼 3종
    ├── GrainCover.tsx            이미지 없는 그라디언트+그레인 커버 (파일 0개)
    ├── Bookshelf.tsx  HeroRewrite.tsx  Reveal.tsx  Faq.tsx
    └── ScrollProgress.tsx  ThemeToggle.tsx
```

### 랜딩 섹션 순서와 설계 의도

배경 면을 교차시키고(`.surface-alt`) 섹션마다 **레이아웃 형태를 바꿉니다.**
3열 카드 그리드가 연속으로 세 번 나오던 것이 "단조롭다"의 원인이었기 때문입니다.

```
히어로        기본 면   HeroRewrite 모션
차별점        밝은 면   스크롤 잠금 몰입 구간
작동 방식     기본 면   세로 연결선
결과물        밝은 면   가로 스크롤
대상          기본 면   정의 목록(dl)
FAQ           밝은 면   아코디언
최종 CTA      기본 면
```

---

## 최근 작업 (2026-08-20, 커밋 `5615425`)

1. **3단계 숫자가 연결선에 가려지던 버그 수정**
   z-index 문제가 아니라 알파 문제였습니다. `.step-item.is-on .step-dot` 이
   `background-color: rgb(var(--brand) / 0.1)` 로 불투명 배경을 덮어써서
   배지가 90% 투명해졌고, 뒤의 연결선이 숫자를 관통했습니다.
   → 불투명 바닥(`--n950`) + 브랜드 틴트를 `background-image` 로 한 겹.
   보이는 색은 동일하고 뒤만 안 비칩니다.

2. **차별점·대상 섹션에 아이콘 추가**
   `PerspectiveView` 에 `icon` 필드 추가 (Code / Compass / Target),
   대상 목록에 GraduationCap / Shuffle / Layers.

3. **소셜 로그인 버튼에 브랜드 로고**
   Google·Figma는 공식 색 고정(색 자체가 식별 정보), GitHub은 `currentColor`
   (원래 단색이라 다크에서 묻힘 → 버튼 글자색을 따라감).
   버튼 껍데기는 전부 우리 테마 변수. 로고는 왼쪽 20px에 고정하고 라벨만
   가운데 정렬 — 라벨 길이가 달라 로고 열이 어긋나면 탐색이 느려집니다.

4. **`Steps.tsx` 타입 에러 수정** — `useRef<HTMLDivElement>` 가 `<ol>` 에
   붙어 있어 `tsc -b` 가 멈췄습니다. `HTMLOListElement` 로 정정.

---

## 남은 할 일

| 항목 | 메모 |
|---|---|
| **실제 OAuth 연동** | 지금은 목업 — `navigate("/library")` 로 넘어갈 뿐입니다. 연동 시 `SocialLoginButtons` 에 `busy` prop 을 연결해 중복 클릭을 막으세요 |
| **`/terms`, `/privacy`** | 푸터 링크는 주석으로 준비만 해둔 상태. 개인정보처리방침은 법적 의무입니다 |
| **FAQ 답변** | `landingContent.ts` 의 데이터 정책·가격 답변이 `TODO` 로 비어 있습니다. 특히 "제 자료가 AI 학습에 사용되나요?"는 잘못 쓰면 문제가 됩니다 |
| 프리렌더 | CSR 전용이라 네이버·다음 색인이 안 됩니다 |
| 코드 스플리팅 | 라우트 20개가 단일 청크 372KB. `React.lazy` 분할 |
| Before-After 데모 | 직무별 재구성을 나란히 비교로 보여주는 섹션 |

### 건드리지 말 것

- **`public/og.png`** — 책 모양 등으로 바꾸는 안을 검토했지만 **현행 유지로 결정**했습니다.
- `.env`, `.env.local`, `.vercel/` — `.gitignore` 에 있습니다. repo가 Public이니
  절대 커밋되지 않도록 주의하세요. (`.env.local` 에 Vercel OIDC 토큰이 들어갑니다)

---

## 작업 방식

작업하다 궁금하거나 확인해야 할 것이 생기면 **먼저 물어보고 진행**해주세요.
추측으로 밀고 나가서 나중에 되돌리는 것보다 낫습니다.

파일을 고치기 전에는 커밋해서 되돌릴 지점을 만들고, 고친 뒤에는 `git diff` 로
의도한 변경만 들어갔는지 확인하는 습관을 지킵니다.
