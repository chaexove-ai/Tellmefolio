import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GraduationCap, Layers, Shuffle, Sparkles } from "lucide-react";
import HeroRewrite from "../components/HeroRewrite";
import Reveal from "../components/Reveal";
import PerspectiveScroller from "../components/PerspectiveScroller";
import Faq from "../components/Faq";
import Steps from "../components/Steps";
import ScrollProgress from "../components/ScrollProgress";
import { scheduleScrollRefresh } from "../lib/scrollRefresh";
import GrainCover from "../components/GrainCover";
import MarqueeRail from "../components/MarqueeRail";
import { sampleWorks } from "../landingContent";

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
          {/* 다크 테마를 감추면서 토글을 내렸습니다 — index.html 주석 참고 */}
          <Link to="/login" className="btn-primary text-xs sm:text-sm px-3 sm:px-4">
            지금 시작하기
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* ── 히어로 (기본 면) ───────────────────────────────── */}
        <section
          id="hero-section"
          className="relative overflow-hidden px-4 sm:px-8 pt-20 sm:pt-24 lg:pt-32 pb-20 lg:pb-28"
        >
          {/* [2026-09] 장식용 배경. 히어로가 텍스트 두 줄 + 버튼뿐이라 첫
              화면이 밋밋하다는 피드백을 받았습니다. 이미지 대신 --brand 토큰
              기반의 은은한 글로우와 큰 아이콘 워터마크로 채웠습니다 — 새
              이미지 자산을 늘리지 않고, 라이트/다크 양쪽에서 저절로
              맞는 색을 씁니다. 순수 장식이라 aria-hidden 과
              pointer-events-none 을 둡니다. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-brand/15 blur-[110px]" />
            <Sparkles
              size={340}
              strokeWidth={0.75}
              className="absolute -right-14 -top-10 hidden text-brand/[0.08] sm:block"
            />
          </div>

          {/* [2026-09] 데스크탑에서 히어로가 672px 안에 갇혀 있어 화면
              대부분이 빈 여백이었습니다. 큰 화면에서만 넓힙니다. */}
          <div className="relative z-10 max-w-2xl lg:max-w-3xl mx-auto text-center">
            <p className="hero-eyebrow sec-eyebrow">Tellmefolio</p>
            <h1 className="hero-title text-3xl sm:text-4xl lg:text-[52px] font-heading leading-[1.4] sm:leading-[1.5] lg:leading-[1.35]">
              내 경험을 직무 언어로,
              <br />
              AI 포트폴리오 제작 도구
            </h1>
            <p className="hero-sub text-sm lg:text-base text-neutral-400 mt-6 lg:mt-8">
              이야기하면 포트폴리오가 됩니다 — 원본 자료를 케이스 스터디로, 같은 프로젝트를
              여러 직무 관점으로.
            </p>
            <Link to="/login" className="hero-cta btn-primary inline-block mt-10">
              지금 시작하기
            </Link>
          </div>
          <div className="hero-motion relative z-10 mt-14">
            <HeroRewrite />
          </div>
        </section>

        {/* ── 차별점 (밝은 면 · 스크롤 몰입 구간) ────────────────
            탭 위젯으로 두면 대부분 누르지 않고 지나갑니다.
            스크롤 동작 자체를 직무 전환에 묶어, 차별점을 읽는 게 아니라
            겪게 만듭니다. 모바일·모션 감소 환경에서는 자동으로 탭 위젯으로
            대체됩니다(컴포넌트 안에서 분기). */}
        {/* [2026-09] 이 한 구역만 완전히 뒤집습니다.
            차별점("GitHub에는 코드가 있지만 이야기는 없다")은 이 서비스가
            파는 주장이고, 스크롤 잠금으로 이미 시간을 가장 오래 붙잡는
            구간입니다. 화면이 어두워지면 그 멈춤이 의도한 것으로 읽힙니다.
            다른 구역까지 뒤집으면 쉼표가 아니라 또 다른 반복이 됩니다. */}
        <section className="surface-brand-bright">
          <PerspectiveScroller />
        </section>

        {/* ── 작동 방식 (기본 면 · 세로 연결선) ─────────────────── */}
        <section id="how" className="px-4 sm:px-8 py-24 scroll-mt-20">
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
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
              {/* 커뮤니티는 로그인 뒤 영역이라, 여기서 링크를 걸면
                  방문자가 로그인 화면으로 튕깁니다. 카드도 링크를 뗐습니다.
                  보여주되 클릭을 유도하지는 않습니다.

                  [2026-09] "다른 사람들이 만든" → "예시". 내용을 실제
                  작업물로 바꿨으니 문구도 사실에 맞춥니다. 사용자가
                  여럿인 것처럼 읽히게 두면, 눌러 들어가 빈 커뮤니티를
                  본 사람에게는 거짓말이 됩니다. */}
              <div>
                <p className="sec-eyebrow">결과물</p>
                <h2 className="sec-title">이렇게 만들어집니다</h2>
                <p className="sec-sub !mb-0">직무에 따라 이런 포트폴리오가 만들어집니다.</p>
              </div>
            </Reveal>
            <div className="mt-10">
              <MarqueeRail>
                {sampleWorks.map((w) => (
                  <div key={w.id} className="entry !p-4">
                    <GrainCover seed={w.id} className="aspect-[4/3] rounded-xl mb-3.5" />
                    <span className="badge bg-brand/10 text-brand mb-3">{w.job}</span>
                    <h3 className="entry-title">{w.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {w.sub}
                    </p>
                  </div>
                ))}
              </MarqueeRail>
            </div>
          </div>
        </section>

        {/* ── 대상 (기본 면 · 정의 목록) ──────────────────────── */}
        <section className="px-4 sm:px-8 py-24">
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
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
                    <dt className="font-heading pt-5 sm:border-t border-neutral-800 flex items-center gap-2.5">
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
        <section id="faq" className="scroll-mt-20 surface-alt px-4 sm:px-8 py-24">
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

        {/* ── 최종 CTA (반전 배너) ────────────────────────────
            [2026-09] 마지막 CTA 를 화면 폭을 다 쓰는 어두운 배너로
            바꿨습니다. 크림 면이 이어지다 끝나면 페이지가 흐지부지
            멈춘 것처럼 보이는데, 어두운 띠가 들어오면 "여기가 끝이고
            할 일은 이것"이라는 마침표가 생깁니다.

            [2026-09] 어두운 면에서 짙은 테라코타(.surface-brand)로
            바꿨습니다. 여기는 제목 한 줄·설명 한 줄·버튼 하나라 글자
            단계가 애초에 필요 없어서, 글자 단계가 하나로 줄어드는 주황
            면의 약점이 드러나지 않습니다. 오히려 마지막에 브랜드색이
            한 번 크게 나오는 편이 기억에 남습니다.
            차별점 구역은 어둠 그대로 둡니다 — 거기는 카드와 여러 단계의
            글이 있고 스크롤 잠금으로 오래 머무는 구간이라 채도 높은
            면이면 눈이 지칩니다. */}
        <section className="surface-brand px-4 sm:px-8 py-28 lg:py-36 text-center">
          <h2 className="font-heading text-2xl lg:text-[36px] leading-snug mb-3 lg:mb-4">
            지금 바로 첫 포트폴리오를 만들어 보세요
          </h2>
          <p className="text-sm lg:text-base text-neutral-400 mb-9 lg:mb-10">
            Google, GitHub, Figma 계정으로 3초 만에 시작할 수 있습니다.
          </p>
          <Link to="/login" className="btn-primary inline-block lg:px-7 lg:py-3.5 lg:text-base">
            시작하기
          </Link>
        </section>
      </main>

      {/* [2026-09] 푸터를 늘리면서 배경을 다시 아이보리로 되돌렸습니다.
          CTA 배너와 붙여 어둡게 뒀던 것은 배너가 얇을 때의 선택이었는데,
          푸터가 길어지면 어두운 면이 화면 절반을 먹어 배너의 마침표
          효과가 사라집니다. 어두운 띠는 한 덩어리로 짧게 끝나는 편이
          강합니다.

          ⚠️ /terms, /privacy 링크는 아직 주석입니다. 페이지가 없는데
          링크만 걸면 404 로 보내는 셈이고, 그건 링크가 없는 것보다
          나쁩니다. 로그인 화면이 이미 "계속 진행하면 이용약관과
          개인정보처리방침에 동의합니다"라고 말하고 있어서, 두 문서는
          있어야 합니다 — 개인정보처리방침은 법적 의무이기도 합니다. */}
      <footer className="px-4 sm:px-8 py-14 border-t border-neutral-800 text-sm text-neutral-500">
        <div className="max-w-4xl lg:max-w-5xl mx-auto grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-heading text-lg text-neutral-100">Tellmefolio</p>
            <p className="mt-2.5 leading-relaxed">
              이야기하면 포트폴리오가 됩니다.
              <br />
              GitHub 저장소와 메모를 케이스 스터디로 바꿉니다.
            </p>
          </div>

          <nav aria-label="서비스">
            <p className="text-neutral-300 mb-3">서비스</p>
            <ul className="space-y-2">
              <li>
                <Link to="/login" className="hover:text-brand transition-colors">
                  로그인
                </Link>
              </li>
              <li>
                <a href="#how" className="hover:text-brand transition-colors">
                  작동 방식
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brand transition-colors">
                  자주 묻는 질문
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="정책">
            <p className="text-neutral-300 mb-3">정책</p>
            <ul className="space-y-2">
              {/*
              <li><Link to="/terms" className="hover:text-brand transition-colors">이용약관</Link></li>
              <li><Link to="/privacy" className="hover:text-brand transition-colors">개인정보처리방침</Link></li>
              */}
              <li className="text-neutral-600">준비 중</li>
            </ul>
          </nav>
        </div>

        <div className="max-w-4xl lg:max-w-5xl mx-auto mt-12 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <span className="text-neutral-600">© 2026 Tellmefolio</span>
          <span className="text-neutral-600">
            공개 저장소만 읽습니다. 비공개 코드에 접근하는 권한은 요청하지 않습니다.
          </span>
        </div>
      </footer>
    </div>
  );
}
