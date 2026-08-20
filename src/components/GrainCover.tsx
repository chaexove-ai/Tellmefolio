import type { ReactNode } from "react";

interface GrainCoverProps {
  /** 같은 값이면 항상 같은 그림이 나옵니다. 포트폴리오 id 등을 넣으세요. */
  seed: string;
  /** 크기·모서리를 지정합니다. 예: "aspect-[4/3] rounded-xl" */
  className?: string;
  /** 위에 얹을 라벨 등 */
  children?: ReactNode;
}

/**
 * 그라디언트 + 그레인 커버.
 *
 * 비어 있던 이미지 자리(갤러리 썸네일, 대표 이미지, 미리보기 영역)를
 * 채우는 절차적 배경입니다.
 *
 * - **이미지 파일이 없습니다.** CSS 그라디언트 + SVG 노이즈뿐이라
 *   전송량이 0이고 어떤 크기에서도 깨지지 않습니다.
 * - **seed 로 결정됩니다.** 같은 포트폴리오는 언제 봐도 같은 커버를 갖고,
 *   서로 다른 항목은 서로 다른 그림이 됩니다. 목록이 단조롭지 않습니다.
 * - 크림 바탕에 살구·앰버빛 블롭이 가장자리 밖으로 번지고,
 *   그 위에 두 겹의 고운 그레인이 얹힙니다.
 *
 * 실제 썸네일 기능이 생기면 이 컴포넌트를 `<img>` 의 폴백으로 두면 됩니다.
 */

// FNV-1a — 짧고 분포가 고른 해시
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function coverStyle(seed: string): React.CSSProperties {
  const h = hash(seed);
  const b = (n: number) => (h >> n) & 255;

  // 색조: 살구 · 앰버 · 연노랑 · 복숭아
  const H = [24 + (b(0) % 14), 34 + (b(3) % 12), 42 + (b(6) % 10), 14 + (b(9) % 12)];
  // 중심 위치 — 일부러 요소 밖으로도 나가게 해서 잘린 느낌을 만듭니다
  const P: [number, number][] = [
    [-8 + (b(12) % 52), -10 + (b(15) % 48)],
    [48 + (b(18) % 58), -12 + (b(21) % 46)],
    [26 + (b(6) % 70), 46 + (b(9) % 58)],
    [-14 + (b(0) % 46), 48 + (b(3) % 58)],
  ];
  // 블롭 반지름(가로/세로)
  const W = [52 + (b(12) % 34), 44 + (b(15) % 30), 38 + (b(18) % 26), 46 + (b(21) % 30)];
  const V = [46 + (b(15) % 34), 40 + (b(18) % 28), 36 + (b(21) % 24), 42 + (b(12) % 28)];

  const vars: Record<string, string> = { "--bh": String(34 + (b(3) % 12)) };
  H.forEach((v, i) => (vars[`--h${i + 1}`] = String(v)));
  P.forEach((v, i) => {
    vars[`--x${i + 1}`] = `${v[0]}%`;
    vars[`--y${i + 1}`] = `${v[1]}%`;
  });
  W.forEach((v, i) => (vars[`--w${i + 1}`] = `${v}%`));
  V.forEach((v, i) => (vars[`--v${i + 1}`] = `${v}%`));
  return vars as React.CSSProperties;
}

export default function GrainCover({ seed, className = "", children }: GrainCoverProps) {
  return (
    <div className={`grain-cover ${className}`} style={coverStyle(seed)}>
      {children}
    </div>
  );
}
