import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scheduleScrollRefresh } from "../lib/scrollRefresh";

gsap.registerPlugin(ScrollTrigger);

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/**
 * 스크롤로 들어오면 옅게 페이드인 + 살짝 위로 슬라이드되는 절제된 리빌
 * 애니메이션. 카드 여러 개를 나란히 쓸 때는 delay를 인덱스에 비례해
 * 주면 자연스러운 순차 등장(stagger)이 됩니다.
 *
 * gsap.context로 스코프를 잡아 라우트 전환 시(cleanup 함수) 트윈과
 * ScrollTrigger를 확실히 제거합니다 — SPA에서 흔한 메모리·트리거 누수를
 * 방지합니다.
 *
 * [2026-08 수정 내역]
 * 1) 초기 opacity:0 을 인라인 style에서 제거했습니다.
 *    기존 <div style={{ opacity: 0 }}> 구조는 GSAP 번들이 실패하거나
 *    JS가 죽으면 해당 섹션이 영구히 보이지 않습니다. 초기 상태는
 *    fromTo가 잡아주므로 인라인 값은 불필요하고, 없는 편이 안전합니다.
 * 2) 웹폰트 로드로 레이아웃이 확정된 뒤 ScrollTrigger.refresh() 를 1회 호출합니다.
 *    ScrollTrigger는 마운트 시점 레이아웃으로 트리거 위치를 계산하는데,
 *    이 페이지는 폰트가 늦게 도착해 그 뒤로 레이아웃이 밀립니다.
 *    → 트리거 위치가 실제 위치와 어긋난 채 남아, 리빌이 늦거나 어긋나 보입니다.
 * 3) once: true 로 한 번만 재생하도록 명시했습니다.
 */

export default function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 모션 감소 설정: 애니메이션 없이 즉시 보이게. opacity 1 을 반드시 보장합니다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
            once: true,
          },
        }
      );
    }, ref);

    scheduleScrollRefresh();

    return () => ctx.revert();
  }, [delay, y]);

  // 인라인 opacity:0 제거 — 초기 상태는 GSAP fromTo 가 잡습니다.
  return (
    <div ref={ref} className={`reveal ${className ?? ""}`}>
      {children}
    </div>
  );
}
