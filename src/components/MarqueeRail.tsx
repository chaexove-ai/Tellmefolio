import type { ReactNode } from "react";

/**
 * [2026-09] 끝없이 흐르는 가로 띠.
 *
 * 정지된 그리드보다 "여기 결과물이 계속 있다"는 인상을 줍니다. 구현은
 * 같은 목록을 두 벌 이어 붙이고 -50% 까지 밀어내는 방식입니다 — 두 벌째의
 * 첫 칸이 첫 벌의 첫 칸 자리에 정확히 닿는 순간 원점으로 되돌리면
 * 이음매가 보이지 않습니다.
 *
 * 속도를 느리게(기본 한 바퀴 50초) 잡은 이유: 바로 위 차별점 구역이
 * 스크롤 잠금으로 이미 움직입니다. 두 구역이 연달아 빠르게 움직이면
 * 산만해서 둘 다 안 읽힙니다.
 *
 * 커서를 올리면 멈춥니다. 흘러가는 것을 읽으려면 눈이 따라가야 하는데,
 * 멈출 방법이 없으면 읽기를 포기하게 됩니다.
 *
 * 모션 감소 설정에서는 애니메이션 없이 평범한 가로 스크롤이 됩니다
 * (index.css 의 @media prefers-reduced-motion).
 */

interface Props {
  children: ReactNode;
  /** 한 바퀴 도는 시간(초). 항목이 많을수록 길게. */
  duration?: number;
}

export default function MarqueeRail({ children, duration = 50 }: Props) {
  return (
    <div className="marquee" aria-label="포트폴리오 예시">
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {children}
        {/* 두 벌째는 같은 그림이라 보조기술에는 숨깁니다 — 읽어주면
            같은 목록을 두 번 듣게 됩니다. */}
        <div className="marquee-copy" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
