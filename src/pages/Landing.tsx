import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, GraduationCap, Layers, Shuffle } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import HeroRewrite from "../components/HeroRewrite";
import Reveal from "../components/Reveal";
import PerspectiveScroller from "../components/PerspectiveScroller";
import Faq from "../components/Faq";
import Steps from "../components/Steps";
import ScrollProgress from "../components/ScrollProgress";
import { scheduleScrollRefresh } from "../lib/scrollRefresh";
import GrainCover from "../components/GrainCover";
import { galleryItems } from "../mockData";

gsap.registerPlugin(ScrollTrigger);

/**
 * [2026-08-20] 대상 목록에 아이콘 추가.
 *
 * 정의 목록(dl/dt/dd)은 형태 반복을 피하는 데는 성공했지만,
 * 세 항목이 전부 같은 크기의 회색 텍스트라 훑어볼 때 구분이 안 됐습니다.
 * 각 항목 앞에 아이콘 하나를 두면 "나는 어디에 해당하나"를
 * 문장을 다 읽지 않고도 찾을 수 있습니다.
 *
 * 아이콘은 모양만 lucide 를 쓰고 색은 text-brand — 즉 index.css 의
 * --brand 변수를 그대로 상속받습니다. strokeWidth 1.5 로 얇게 가서
 * Gowun Batang 제목의 가는 획과 무게를 맞췄습니다.
 */
const audiences = [
  {
    icon: GraduationCap,
    title: "취업 준비생",
    desc: "여러 직무에 맞춰 같은 경험을 다양한 언어로 재해석하고 싶은 분",
  },
  {
    icon: Shuffle,
    title: "커리어 전환자",
    desc: "기존 프로젝트 경험을 새 직무 관점에서 설득력 있게 정리하고 싶은 분",
  },
  {
    icon: Layers,
    title: "개발자·디자이너",
    desc: "GitHub 리포지토리, Figma 작업물을 포트폴리오로 빠르게 구조화하고 싶은 분",
  },
];

const gallerySample = galleryItems.slice(0, 6);

/**
 * [2026-08 랜딩 리듬 재설계]
 *
 * 문제
 *   3열 카드 그리드가 연속으로 세 번(3단계 / 갤러리 / 대상) 나오고,
 *   섹션 제목이 전부 `text-sm text-neutral-500` 로 동일했습니다.
 *   여백도 py-16 로 균일해서 스크롤해도 섹션이 바뀐 게 느껴지지 않았습니다.
 *   "단조롭다"의 원인은 모션 부재가 아니라 이 형태 반복이었습니다.
 *
 * 해결 — 리듬 먼저, 모션은 그 위에
 *   ① 배경 면 교차       기본 면 ↔ .surface-alt
 *   ② 제목 위계          .sec-eyebrow + .sec-title + .sec-sub
 *   ③ 레이아웃 형태 변화  3단계=세로 연결선 / 갤러리=가로 스크롤 / 대상=정의 목록
 *   ④ 절제된 모션 3가지   진행 바, 연결선 그리기, 히어로 전환
 *
 * 모션을 3개로 제한한 이유: 카드가 아래에서 올라오는 리빌(Reveal)이
 * 이미 있습니다. 여기에 모션을 더 얹으면 산만해지기만 합니다.
 * 남은 셋은 각각 "방향 감각", "순서", "장면 전환"이라는 역할이 분명합니다.
 */
export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = [".hero-eyebrow", ".hero-title", ".hero-sub", ".hero-cta", ".hero-motion"];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let failsafe: number | undefined;

    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
        return;
      }
      gsap.set(targets, { opacity: 0 });

      // 백그라운드 탭처럼 rAF 가 멈춘 상태로 열리면 타임라인이 진행되지 않습니다.
      failsafe = window.setTimeout(() => {
        gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
      }, 2500);

      gsap
        .timeline({
          defaults: { ease: "power2.out" },
          onComplete: () => window.clearTimeout(failsafe),
        })
        .to(".hero-eyebrow", { opacity: 1, y: 0, duration: 0.5 }, 0.1)
        .fromTo(".hero-title", { y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 0.2)
        .fromTo(".hero-sub", { y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.45)
        .fromTo(".hero-cta", { y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55)
        .fromTo(".hero-motion", { y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 0.35);

      // 히어로 스크롤 전환 — 다음 섹션에 자리를 내줍니다.
      gsap.to("#hero-section", {
        opacity: 0.28,
        scale: 0.975,
        ease: "none",
        transformOrigin: "50% 20%",
        scrollTrigger: {
          trigger: "#hero-section",
          start: "bottom 90%",
          end: "bottom 30%",
          scrub: 0.5,
        },
      });
    }, heroRef);

    scheduleScrollRefresh();

    return () => {
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100" ref={heroRef}>
      <ScrollProgress />

      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>

      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md supports-[backdrop-filter]:bg-neutral-950/70">
        <span className="text-base sm:text-lg font-heading">Tellmefolio</span>
        <nav className="flex items-center gap-2 sm:gap-6" aria-label="주요 메뉴">
          <Link
            to="/gallery"
            className="hidden sm:inline text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            갤러리
          </Link>
          <ThemeToggle />
          <Link to="/login" className="btn-primary text-xs sm:text-sm px-3 sm:px-4">
            지금 시작하기
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* ── 히어로 (기본 면) ───────────────────────────────── */}
        <section id="hero-section" className="px-4 sm:px-8 pt-20 sm:pt-24 pb-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="hero-eyebrow sec-eyebrow">Tellmefolio</p>
            <h1 className="hero-title text-3xl sm:text-4xl font-heading leading-[1.4] sm:leading-[1.5]">
              내 경험을 직무 언어로,
              <br />
              AI 포트폴리오 제작 도구
            </h1>
            <p className="hero-sub text-sm text-neutral-400 mt-6">
              이야기하면 포트폴리오가 됩니다 — 원본 자료를 케이스 스터디로, 같은 프로젝트를
              여러 직무 관점으로.
            </p>
            <Link to="/login" className="hero-cta btn-primary inline-block mt-10">
              지금 시작하기
            </Link>
          </div>
          <div className="hero-motion mt-14">
            <HeroRewrite />
          </div>
        </section>

        {/* ── 차별점 (밝은 면 · 스크롤 몰입 구간) ────────────────
            탭 위젯으로 두면 대부분 누르지 않고 지나갑니다.
            스크롤 동작 자체를 직무 전환에 묶어, 차별점을 읽는 게 아니라
            겪게 만듭니다. 모바일·모션 감소 환경에서는 자동으로 탭 위젯으로
            대체됩니다(컴포넌트 안에서 분기). */}
        <section className="surface-alt">
          <PerspectiveScroller />
        </section>

        {/* ── 작동 방식 (기본 면 · 세로 연결선) ─────────────────── */}
        <section className="px-4 sm:px-8 py-24">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <p className="sec-eyebrow">작동 방식</p>
              <h2 className="sec-title">어떻게 만들어지나요</h2>
              <p className="sec-sub">세 단계면 끝납니다.</p>
            </Reveal>
            <Steps />
          </div>
        </section>

        {/* ── 결과물 (밝은 면 · 가로 스크롤) ───────────────────── */}
        <section className="surface-alt px-4 sm:px-8 py-24">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="sec-eyebrow">결과물</p>
                  <h2 className="sec-title">이렇게 만들어집니다</h2>
                  <p className="sec-sub !mb-0">다른 사람들이 만든 포트폴리오를 먼저 보세요.</p>
                </div>
                <Link
                  to="/gallery"
                  className="shrink-0 text-sm text-brand hover:underline inline-flex items-center gap-1 pb-1"
                >
                  전체 보기
                  <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              {/* 3열 그리드 대신 가로 스크롤 — 형태 반복을 피하고
                  "더 있다"는 것을 잘린 카드로 보여줍니다. */}
              <div className="h-rail mt-10">
                {gallerySample.map((g) => (
                  <Link
                    key={g.id}
                    to={`/gallery/${g.id}`}
                    className="entry !p-4 hover:border-brand/50 hover:-translate-y-0.5"
                  >
                    <GrainCover seed={g.id} className="aspect-[4/3] rounded-xl mb-3.5" />
                    <span className="badge bg-brand/10 text-brand mb-3">{g.job}</span>
                    <h3 className="entry-title">{g.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {g.structure} · {g.author} · {g.year}
                    </p>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── 대상 (기본 면 · 정의 목록) ──────────────────────── */}
        <section className="px-4 sm:px-8 py-24">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <p className="sec-eyebrow">대상</p>
              <h2 className="sec-title">이런 분께 맞습니다</h2>
              <div className="mb-8" />
            </Reveal>
            <Reveal delay={0.06}>
              {/* 카드 대신 정의 목록 — 세 번째 카드 그리드를 없앱니다 */}
              {/* 첫 열을 170px → 190px 로 넓혔습니다. 아이콘이 앞에 붙으면서
                  "개발자·디자이너" 가 두 줄로 깨지는 것을 막습니다.
                  map 변수는 aud — <a.icon /> 은 앵커 태그와 헷갈립니다. */}
              <dl className="grid grid-cols-1 sm:grid-cols-[190px_1fr] sm:gap-x-7">
                {audiences.map((aud) => (
                  <div key={aud.title} className="contents">
                    <dt className="font-heading text-[15px] pt-5 sm:border-t border-neutral-800 flex items-center gap-2.5">
                      <aud.icon
                        size={17}
                        strokeWidth={1.5}
                        className="text-brand shrink-0"
                        aria-hidden="true"
                      />
                      {aud.title}
                    </dt>
                    <dd className="text-sm text-neutral-400 pb-5 sm:pt-5 sm:border-t border-neutral-800 leading-relaxed">
                      {aud.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ (밝은 면 · 좁은 폭) ─────────────────────────── */}
        <section className="surface-alt px-4 sm:px-8 py-24">
          <div className="max-w-2xl mx-auto">
            <Reveal>
              <p className="sec-eyebrow">FAQ</p>
              <h2 className="sec-title">자주 묻는 질문</h2>
              <div className="mb-8" />
            </Reveal>
            <Reveal delay={0.06}>
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* ── 최종 CTA (기본 면) ──────────────────────────────── */}
        <section className="px-4 sm:px-8 py-28 text-center">
          <h2 className="font-heading text-2xl mb-3">지금 바로 첫 포트폴리오를 만들어 보세요</h2>
          <p className="text-sm text-neutral-400 mb-9">
            Google, GitHub, Figma 계정으로 3초 만에 시작할 수 있습니다.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            시작하기
          </Link>
        </section>
      </main>

      {/* TODO: /terms, /privacy 페이지를 만든 뒤 아래 주석을 풀어주세요. */}
      <footer className="px-4 sm:px-8 py-10 border-t border-neutral-800 text-sm text-neutral-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="font-heading text-neutral-100">Tellmefolio</span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="푸터 메뉴">
            <Link to="/gallery" className="hover:text-neutral-100 transition-colors">
              갤러리
            </Link>
            <Link to="/login" className="hover:text-neutral-100 transition-colors">
              로그인
            </Link>
            {/*
            <Link to="/terms" className="hover:text-neutral-100 transition-colors">이용약관</Link>
            <Link to="/privacy" className="hover:text-neutral-100 transition-colors">개인정보처리방침</Link>
            */}
          </nav>
        </div>
      </footer>
    </div>
  );
}
