# Tellmefolio

**Tell it your story, get a portfolio.** — AI 포트폴리오 생성 서비스

> **한 줄 요약** — GitHub 저장소와 짧은 메모를 읽어 포트폴리오 초안을 만들어 주는 웹 서비스입니다.
> **제 역할** — 기획, UX 흐름, 디자인 시스템, 화면 구현, Supabase 연동까지 직접 했습니다.
> **실행** — `npm install && npm run dev` (Vite + React + TypeScript + Tailwind + Supabase)

**Live:** [tellmefolio-app.vercel.app](https://tellmefolio-app.vercel.app)

---

## What it is

Most people have the material for a portfolio but not the writing. Their work
already exists — in repositories, in project notes, in things they half-remember
doing. What's missing is the narrative.

Tellmefolio reads what you already have (public GitHub repositories, plus
anything you type in) and drafts a portfolio from it: context, your role, the
problem, what you did, the outcome, what you'd do differently. You then edit the
draft, pick a layout, and publish or export it.

The AI never invents credentials. If the source material doesn't support a
section, the draft returns it as a **gap** for you to fill in, rather than
writing something plausible and false.

## What I did

I took this over after the initial scaffold was set up by someone else, and have
built everything since:

- **Product direction.** Repositioned the service from designers to *anyone who
  needs a portfolio*. The reasoning: a GitHub profile is already text — READMEs,
  language breakdowns, commit history — so it can be fed to a model directly,
  while Behance and Dribbble already own the visual-portfolio space. The gap is
  the layer on top of GitHub: "there's code, but no story."
- **UX flow.** Restructured the generation wizard so style selection comes
  *before* the AI draft rather than after, since asking someone to choose a look
  for content they haven't seen yet doesn't work. Consolidated two duplicate
  job-switch screens into one and moved the format choice ahead of the AI
  request.
- **Design system.** Dark-first, with a light theme via a `:root.light` class.
  Every colour is a CSS variable (`--n50`…`--n950`, `--brand`); components only
  use Tailwind classes and never hard-code a hex value, so both themes stay in
  sync. Type is Gowun Batang for headings, Pretendard for body.
- **Auth.** Supabase Auth with Google, GitHub and Figma. GitHub reading is
  limited to **public repositories only** — I deliberately did not request the
  `repo` scope, which would grant full read and write access to private code for
  a feature that doesn't need it. The provider token stays in memory, purely to
  raise the API rate limit, and falls back to unauthenticated calls when absent.
- **Generation pipeline.** The draft is produced by a Supabase Edge Function
  (`supabase/functions/generate-draft`), so the API key stays on the server and
  never reaches the browser. The editor's input fields were redesigned around
  what the draft actually returns.
- **Performance.** Route-level code splitting took the main chunk from 385 kB to
  321 kB (128 kB → 114 kB gzipped). The landing page stays statically imported
  because of GSAP ScrollTrigger timing; the other 20 routes are lazy.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

The app runs without any configuration — without Supabase environment variables
it falls back to a mock login so the screens are all reachable.

For the real backend, copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Note that Vite inlines environment variables at build time, so adding a variable
without rebuilding has no effect.

```bash
npm run build        # tsc -b && vite build
npm run preview
```

Edge Functions deploy separately from the app:

```bash
supabase functions deploy generate-draft
supabase secrets set ANTHROPIC_API_KEY=... MODEL=...
```

## Stack

| | |
|---|---|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS 3 |
| Motion | GSAP (ScrollTrigger) |
| Backend | Supabase — Auth, Postgres, Edge Functions (Deno) |
| Export | jsPDF + html2canvas |
| Hosting | Vercel (deploys on push to `main`) |

```
src/
  pages/wizard/      generation flow — source input, draft, editor, export
  pages/gallery/     community, share settings, visit stats
  pages/account/     settings, connected accounts, data management
  components/portfolio-templates/   Minimal, Magazine, Research, live editor
  lib/               Supabase client, GitHub reader, draft, blocks, PDF export
  theme/             dark / light context
supabase/
  migrations/        portfolios, blocks, images, covers
  functions/         generate-draft, translate-portfolio, delete-account
```

## Roadmap

- Per-user limits on AI generation are not enforced yet (the counter on screen
  is currently cosmetic).
- The app is client-rendered, so Korean search engines don't index it. Adding
  meta tags to `index.html` and pre-rendering the landing page is a better
  cost-to-benefit trade than pre-rendering everything.
