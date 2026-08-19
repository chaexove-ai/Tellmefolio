import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
 */
export default function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
          },
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [delay, y]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
