import { useEffect, useRef, useState } from "react";
import BeforeAfterDemo from "./BeforeAfterDemo";
import { demoSource, demoViews } from "../landingContent";

/**
 * 차별점 몰입 구간 — 스크롤이 곧 직무 전환.
 *
 * [왜 만들었나]
 * "같은 경험을 여러 직무 언어로 다시 쓴다"는 이 서비스의 전부인데,
 * 탭 위젯으로 두면 대부분 누르지 않고 지나갑니다. 차별점이 안 읽힙니다.
 * 그래서 **스크롤 동작 자체를 직무 전환에 묶었습니다.**
 * 구간에 들어서면 화면이 잠기고, 스크롤을 내릴수록 같은 원본 메모가
 * 프론트엔드 → UX → 기획 순으로 다시 쓰이는 것을 직접 겪게 됩니다.
 * 모션이 장식이 아니라 메시지 그 자체가 됩니다.
 *
 * [구현: GSAP pin 대신 position: sticky]
 * ScrollTrigger 의 pin 은 스페이서 DOM 을 주입하고 레이아웃을 다시 계산해서
 * SPA 라우팅·폰트 지연 로드와 얽히면 어긋나기 쉽습니다.
 * 바깥 래퍼에 높이를 주고 안쪽을 sticky 로 붙이면 브라우저가 알아서
 * 처리하므로 훨씬 안정적입니다. 진행도만 스크롤 위치로 계산합니다.
 *
 * [빠져나가는 경우]
 * - 모바일(<768px): 화면이 잠기는 경험은 작은 화면에서 답답합니다
 * - prefers-reduced-motion: 스크롤 잠금은 전정기관에 부담을 줍니다
 * 두 경우 모두 기존 탭 위젯(BeforeAfterDemo)으로 대체됩니다.
 *
 * [접근성]
 * 세 패널을 모두 DOM 에 두고 시각적으로만 전환합니다.
 * 스크린리더는 세 관점을 순서대로 다 읽게 되므로 정보 손실이 없습니다.
 * 패널 안에는 포커스 가능한 요소가 없어 숨은 초점 문제도 없습니다.
 */

// 관점 하나당 배정하는 스크롤 길이(뷰포트 높이 배수). 늘리면 더 천천히 넘어갑니다.
const VH_PER_VIEW = 1;

export default function PerspectiveScroller() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [immersive, setImmersive] = useState(false);

  // 몰입 구간을 쓸 수 있는 환경인지 판단 (창 크기·모션 설정 변화도 따라갑니다)
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setImmersive(wide.matches && !reduce.matches);
    decide();
    wide.addEventListener("change", decide);
    reduce.addEventListener("change", decide);
    return () => {
      wide.removeEventListener("change", decide);
      reduce.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    let raf = 0;
    let currentIdx = -1;
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

    const update = () => {
      raf = 0;
      const r = wrap.getBoundingClientRect();
      const vh = window.innerHeight;

      // 구간 진행도 0 → 1
      const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);

      // 빨려들어가는 진입 / 빠져나가는 퇴장
      const enter = clamp((vh - r.top) / (vh * 0.9), 0, 1);
      const exit = clamp(-(r.bottom - vh) / (vh * 0.6), 0, 1);
      inner.style.transform = `scale(${(0.94 + 0.06 * enter).toFixed(4)})`;
      inner.style.opacity = String((enter * (1 - 0.7 * exit)).toFixed(3));
      inner.style.filter = `blur(${((1 - enter) * 4).toFixed(2)}px)`;

      // 진행 막대 + 활성 관점
      const n = demoViews.length;
      const seg = 1 / n;
      barRefs.current.forEach((b, i) => {
        if (b) b.style.width = `${clamp((p - i * seg) / seg, 0, 1) * 100}%`;
      });
      const next = clamp(Math.floor(p / seg), 0, n - 1);
      if (next !== currentIdx) {
        currentIdx = next;
        setIdx(next);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [immersive]);

  // 모바일 · 모션 감소: 기존 탭 위젯으로
  if (!immersive) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="sec-eyebrow">차별점</p>
        <h2 className="sec-title">같은 경험, 다른 직무 언어</h2>
        <p className="sec-sub">
          하나의 프로젝트를 지원하는 직무에 맞춰 다시 씁니다. 탭을 눌러 비교해 보세요.
        </p>
        <BeforeAfterDemo />
      </div>
    );
  }

  const view = demoViews[idx];

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{ height: `${100 + demoViews.length * VH_PER_VIEW * 100}vh` }}
    >
      <div
        ref={innerRef}
        className="sticky top-0 h-screen flex flex-col justify-center px-4 sm:px-8 overflow-hidden will-change-transform"
      >
        <div className="max-w-2xl mx-auto w-full">
          <p className="sec-eyebrow">차별점</p>
          <h2 className="sec-title mb-6">같은 경험, 다른 직무 언어</h2>

          {/* 원본 — 계속 화면에 남아 "하나뿐"임을 상기시킵니다 */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3.5 mb-6">
            <p className="text-[10.5px] tracking-[0.14em] text-brand mb-1.5">
              {demoSource.label} — 하나뿐입니다
            </p>
            <p className="text-[13px] text-neutral-400 leading-relaxed">“{demoSource.text}”</p>
          </div>

          {/* 진행 막대 — 관점 개수만큼 */}
          <div className="flex items-center gap-2 mb-4" aria-hidden="true">
            {demoViews.map((v, i) => (
              <span key={v.key} className="h-[3px] flex-1 rounded bg-neutral-800 overflow-hidden">
                <span
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  className="block h-full w-0 rounded bg-brand"
                />
              </span>
            ))}
          </div>
          {/* [2026-08-20] 현재 관점 표시 — 아이콘 배지를 앞에 둡니다.
              스크롤로 관점이 넘어갈 때 글자만 바뀌면 변화가 눈에 안 띕니다.
              아이콘은 글자보다 먼저 읽히므로 전환이 즉시 감지됩니다.
              색은 text-brand 로 상속받아 라이트/다크에서 자동으로 맞습니다. */}
          <div className="flex items-center gap-2 mb-3.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand/10 text-brand shrink-0">
              <view.icon size={15} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-xs text-brand">{view.job} 관점</p>
          </div>

          {/* 세 관점을 겹쳐 두고 시각적으로만 전환합니다 */}
          <div className="relative min-h-[230px]">
            {demoViews.map((v, i) => (
              <div
                key={v.key}
                className={
                  i === idx
                    ? "absolute inset-0 opacity-100 translate-y-0 transition-[opacity,transform] duration-300"
                    : "absolute inset-0 opacity-0 translate-y-3 pointer-events-none transition-[opacity,transform] duration-300"
                }
              >
                <p className="text-xs text-brand mb-2.5">{v.lens}</p>
                <h3 className="font-heading text-lg mb-2.5">{v.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">{v.summary}</p>
                <ul className="space-y-2">
                  {v.bullets.map((b) => (
                    <li key={b} className="text-sm text-neutral-400 leading-relaxed flex gap-2.5">
                      <span className="text-brand shrink-0" aria-hidden="true">
                        —
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p
            className={
              idx === 0
                ? "mt-6 text-[11.5px] text-neutral-600 transition-opacity duration-300"
                : "mt-6 text-[11.5px] text-neutral-600 opacity-0 transition-opacity duration-300"
            }
          >
            스크롤하면 같은 경험이 다른 직무의 언어로 다시 쓰입니다
          </p>
        </div>
      </div>
    </div>
  );
}
