import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scheduleScrollRefresh } from "../lib/scrollRefresh";
import { steps } from "../landingContent";

gsap.registerPlugin(ScrollTrigger);

/**
 * "어떻게 만들어지나요" — 3단계.
 *
 * [왜 카드 그리드를 버렸나]
 * 이전 랜딩은 3열 카드 그리드가 연속으로 세 번 나왔습니다
 * (3단계 / 갤러리 / 대상). 같은 형태가 반복되니 스크롤해도 섹션이
 * 바뀐 게 느껴지지 않았습니다. 단조로움의 실제 원인은 모션 부재가
 * 아니라 이 형태 반복이었습니다.
 *
 * 3단계는 본래 "순서"가 있는 정보라 나란한 카드보다 세로 연결선이
 * 의미에 맞습니다. 스크롤에 따라 선이 그어지고 각 마디가 켜집니다 —
 * 모션이 장식이 아니라 "순서"라는 의미를 그대로 표현합니다.
 */
export default function Steps() {
  const root = useRef<HTMLOListElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }

    const ctx = gsap.context(() => {
      // 연결선이 스크롤에 맞춰 그어집니다
      gsap.to(".step-rail-fill", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top 70%",
          end: "bottom 75%",
          scrub: 0.4,
        },
      });

      // 각 마디가 순서대로 켜집니다
      gsap.utils.toArray<HTMLElement>(".step-item").forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 72%",
          onEnter: () => el.classList.add("is-on"),
          onLeaveBack: () => el.classList.remove("is-on"),
        });
      });
    }, root);

    scheduleScrollRefresh();
    return () => ctx.revert();
  }, []);

  return (
    <ol ref={root} className="relative pl-[52px] list-none">
      {/* 연결선 */}
      <span
        aria-hidden="true"
        className="absolute left-[19px] top-2 bottom-2 w-[2px] rounded bg-neutral-800"
      >
        <span
          className={
            reduced
              ? "block w-full h-full rounded bg-brand"
              : "step-rail-fill block w-full h-full rounded bg-brand origin-top scale-y-0"
          }
        />
      </span>

      {steps.map((s) => (
        <li
          key={s.n}
          className={reduced ? "step-item is-on relative pb-11 last:pb-0" : "step-item relative pb-11 last:pb-0"}
        >
          <span
            aria-hidden="true"
            className="step-dot absolute -left-[52px] -top-0.5 w-10 h-10 rounded-full border-2 border-neutral-800
              bg-neutral-950 text-neutral-700 flex items-center justify-center font-heading text-sm
              transition-[border-color,color,background-color] duration-300"
          >
            {s.n}
          </span>
          <h3 className="font-heading text-[17px] mb-1.5">{s.title}</h3>
          <p className="text-sm text-neutral-400 max-w-[520px] leading-relaxed">{s.desc}</p>
        </li>
      ))}
    </ol>
  );
}
