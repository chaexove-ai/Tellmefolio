import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Sparkles, Palette, Repeat, GraduationCap, Compass, Code2 } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import HeroGlobe from "../components/HeroGlobe";
import Reveal from "../components/Reveal";

const features = [
  {
    icon: Sparkles,
    title: "AI 포트폴리오 초안 생성",
    desc: "GitHub, PDF, 링크, 메모를 분석해 구조화된 초안을 만들어줍니다.",
  },
  {
    icon: Palette,
    title: "템플릿 전환 및 자유 편집",
    desc: "여러 디자인 템플릿을 실시간으로 전환하며 편집할 수 있습니다.",
  },
  {
    icon: Repeat,
    title: "직무 관점 재구성",
    desc: "채용 공고 링크를 입력하면 AI가 요구 역량을 분석하고 결과 중심형 또는 문제-실행-결과형 구조로 포트폴리오를 재구성해 제안합니다.",
  },
];

const audiences = [
  { icon: GraduationCap, title: "취업 준비생", desc: "여러 직무에 맞춰 같은 경험을 다양한 언어로 재해석하고 싶은 분" },
  { icon: Compass, title: "커리어 전환자", desc: "기존 프로젝트 경험을 새 직무 관점에서 설득력 있게 정리하고 싶은 분" },
  { icon: Code2, title: "개발자·디자이너", desc: "GitHub 리포지토리, Figma 작업물을 포트폴리오로 빠르게 구조화하고 싶은 분" },
];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = [".hero-eyebrow", ".hero-title", ".hero-sub", ".hero-cta", ".hero-globe"];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
        return;
      }
      gsap.set(targets, { opacity: 0 });
      gsap
        .timeline({ defaults: { ease: "power2.out" } })
        .to(".hero-eyebrow", { opacity: 1, y: 0, duration: 0.5 }, 0.1)
        .fromTo(".hero-title", { y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 0.2)
        .fromTo(".hero-sub", { y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.45)
        .fromTo(".hero-cta", { y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55)
        .fromTo(".hero-globe", { scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.9 }, 0.35);
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100" ref={heroRef}>
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-neutral-800">
        <span className="text-base sm:text-lg font-heading">Tellmefolio</span>
        <div className="flex items-center gap-2 sm:gap-6">
          <ThemeToggle />
          <Link to="/login" className="btn-primary text-xs sm:text-sm px-3 sm:px-4">
            지금 시작하기
          </Link>
        </div>
      </header>

      <section className="px-4 sm:px-8 pt-16 sm:pt-20 pb-4 max-w-2xl mx-auto text-center">
        <p className="hero-eyebrow text-xs tracking-[0.2em] text-brand uppercase mb-6">Tellmefolio</p>
        <h1 className="hero-title text-3xl sm:text-4xl font-heading leading-[1.4] sm:leading-[1.5]">
          내 경험을 직무 언어로,
          <br />
          AI 포트폴리오 제작 도구
        </h1>
        <p className="hero-sub text-sm text-neutral-500 mt-6">
          이야기하면 포트폴리오가 됩니다 — 원본 자료를 케이스 스터디로, 같은 프로젝트를
          여러 직무 관점으로.
        </p>
        <Link to="/login" className="hero-cta btn-primary inline-block mt-10">
          지금 시작하기
        </Link>
      </section>

      <section className="px-4 sm:px-8 pb-16 hero-globe">
        <HeroGlobe />
        <p className="text-center text-xs text-neutral-600 mt-2">
          드래그해서 돌려보세요 — 같은 이야기가 어디서든 포트폴리오가 됩니다
        </p>
      </section>

      <section className="px-4 sm:px-8 py-16 max-w-4xl mx-auto">
        <h2 className="text-sm text-neutral-500 mb-6">핵심 기능</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="entry h-full">
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
                  <f.icon size={18} strokeWidth={2} />
                </div>
                <h3 className="entry-title">{f.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-8 py-16 max-w-4xl mx-auto">
        <h2 className="text-sm text-neutral-500 mb-6">이런 분께 맞습니다</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.08}>
              <div className="entry h-full">
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
                  <a.icon size={18} strokeWidth={2} />
                </div>
                <h3 className="entry-title">{a.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-8 py-24 text-center border-t border-neutral-800">
        <h2 className="text-xl font-heading mb-2">
          지금 바로 첫 포트폴리오를 만들어 보세요
        </h2>
        <p className="text-sm text-neutral-500 mb-8">
          Google, GitHub, Figma 계정으로 3초 만에 시작할 수 있습니다.
        </p>
        <Link to="/login" className="btn-primary inline-block">
          시작하기
        </Link>
      </section>
    </div>
  );
}
