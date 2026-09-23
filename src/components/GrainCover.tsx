import type { ReactNode } from "react";

interface GrainCoverProps {
  /** 같은 값이면 항상 같은 그림이 나옵니다. 포트폴리오 id 등을 넣으세요. */
  seed: string;
  /**
   * 이 표지가 따를 색(예: 직무 색 `#c2703d`). 주면 **색조만** 가져다
   * 씁니다 — 채도와 명도는 CSS 가 정합니다(index.css `.is-tinted`).
   *
   * 사용자가 컬러피커로 형광색을 고를 수 있기 때문에 그렇게 합니다.
   * 색을 그대로 칠하면 그 표지 하나가 목록 전체를 먹습니다. 색조만
   * 받으면 "무슨 색 계열인지"는 읽히면서 화면은 우리가 정한 톤으로
   * 유지됩니다.
   *
   * 회색처럼 채도가 거의 없는 색은 색조에 의미가 없어서 무시하고,
   * seed 로 만든 기본(살구·앰버) 표지로 돌아갑니다.
   */
  tint?: string | null;
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
 * - **tint 를 주면 색조가 그 색을 따라갑니다(2026-09-23).** 전에는 씨앗이
 *   포트폴리오 id 라 표지 색에 아무 이유가 없었습니다 — 여섯 장이 거의
 *   같아 보이는데 다른 건 무늬뿐이고, 그 다름이 아무 정보도 아니었습니다.
 *   직무 색을 따르면 목록에서 직무가 색으로 읽힙니다. 위치·크기는 여전히
 *   seed 가 정하므로 같은 직무끼리도 같은 그림이 되지는 않습니다.
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

/**
 * `#rrggbb` 에서 색조(0~359)와 채도를 꺼냅니다.
 * 채도가 너무 낮으면(회색 계열) 색조가 의미 없으므로 null 을 돌려줍니다.
 */
function hueOf(color: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return null; // 사실상 무채색

  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  h = Math.round(h * 60);
  return ((h % 360) + 360) % 360;
}

function coverStyle(seed: string, tint?: string | null): React.CSSProperties {
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

  // tint 가 있으면 네 블롭의 색조를 그 색 주변으로 옮깁니다. 넷을 정확히
  // 같은 값으로 두면 깊이가 사라져 단색 판처럼 보이므로, seed 로 정해진
  // 만큼만 서로 벌려 둡니다.
  const base = tint ? hueOf(tint) : null;
  const hues =
    base === null
      ? H
      : [base, base + 10 + (b(0) % 8), base - 8 - (b(3) % 8), base + 18 + (b(6) % 10)].map(
          (v) => ((Math.round(v) % 360) + 360) % 360
        );

  const vars: Record<string, string> = {
    "--bh": String(base === null ? 34 + (b(3) % 12) : base),
  };
  hues.forEach((v, i) => (vars[`--h${i + 1}`] = String(v)));
  P.forEach((v, i) => {
    vars[`--x${i + 1}`] = `${v[0]}%`;
    vars[`--y${i + 1}`] = `${v[1]}%`;
  });
  W.forEach((v, i) => (vars[`--w${i + 1}`] = `${v}%`));
  V.forEach((v, i) => (vars[`--v${i + 1}`] = `${v}%`));
  return vars as React.CSSProperties;
}

export default function GrainCover({
  seed,
  tint = null,
  className = "",
  children,
}: GrainCoverProps) {
  // 채도·명도를 낮추는 건 CSS 쪽 클래스입니다. 색조만 넘어오므로
  // 형광색을 골라도 표지가 형광이 되지 않습니다.
  const tinted = tint !== null && hueOf(tint) !== null;
  return (
    <div
      className={`grain-cover ${tinted ? "is-tinted " : ""}${className}`}
      style={coverStyle(seed, tint)}
    >
      {children}
    </div>
  );
}
