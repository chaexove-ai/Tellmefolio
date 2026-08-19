import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scheduleScrollRefresh } from "../lib/scrollRefresh";

gsap.registerPlugin(ScrollTrigger);

/**
 * 페이지 최상단 진행 바.
 *
 * 랜딩이 길어지면서 "지금 어디쯤인지" 감이 없어졌습니다.
 * 2px 짜리 얇은 선 하나가 그 감각을 만들어 줍니다.
 * 읽기를 방해하지 않는 선에서 가장 값싼 방향 감각입니다.
 */
export default function ScrollProgress() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.to("#scroll-progress", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    });
    scheduleScrollRefresh();
    return () => ctx.revert();
  }, []);

  return (
    <div
      id="scroll-progress"
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand origin-left scale-x-0 z-[100]"
    />
  );
}
