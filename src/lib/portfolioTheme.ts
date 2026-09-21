import type { ColorTheme, Density } from "./portfolios";

/**
 * Export 템플릿(연구노트/라이브에디터/클린 미니멀/매거진형)이 공통으로 쓰는
 * 색상·서체 값입니다.
 *
 * [왜 Tailwind의 neutral-* 클래스를 그대로 안 쓰는가]
 * 앱 전체 UI는 `:root`/`:root.light` 토글로 다크·라이트를 바꾸는데, 이건
 * "지금 내가 에디터를 보고 있는 테마"입니다. 반면 여기서 다루는
 * `colorTheme` 은 "이 포트폴리오 결과물 자체가 다크로 보일지 라이트로
 * 보일지" — 완전히 다른 값입니다(사용자가 앱은 라이트로 켜두고 포트폴리오는
 * 다크로 내보낼 수 있음). neutral-* 클래스를 쓰면 두 테마가 뒤섞이므로,
 * Export 렌더러는 index.css의 :root/:root.light 값과 같은 색을 리터럴로
 * 복제해 독립적으로 씁니다.
 */
export interface PortfolioPalette {
  bg: string;
  bgAlt: string;
  bgRaised: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  accent: string;
  accentSolid: string;
}

export function getPortfolioPalette(colorTheme: ColorTheme): PortfolioPalette {
  if (colorTheme === "light") {
    return {
      bg: "#faf7f1",
      bgAlt: "#f4efe6",
      bgRaised: "#ffffff",
      text: "#171310",
      textMuted: "#564d3f",
      textFaint: "#7a6f5d",
      border: "#e5ddc9",
      accent: "#a05829",
      accentSolid: "#a85c30",
    };
  }
  return {
    bg: "#0a0a0a",
    bgAlt: "#141414",
    bgRaised: "#1a1a1a",
    text: "#fafafa",
    textMuted: "#d4d4d4",
    textFaint: "#a3a3a3",
    border: "#262626",
    accent: "#c2703d",
    accentSolid: "#a85c30",
  };
}

/** 서체 목록의 원본. StylePanel(선택 UI)과 템플릿 렌더링이
 *  같은 이름·같은 CSS 값을 보게 합니다(전에 Export.tsx가 템플릿 이름을
 *  따로 하드코딩해서 어긋났던 것과 같은 이유로 분리 대신 공유). */
export const FONT_STACKS: Record<string, string> = {
  Pretendard: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif",
  "Noto Sans KR": "'Noto Sans KR', sans-serif",
  "Spoqa Han Sans": "'Spoqa Han Sans Neo', 'Noto Sans KR', sans-serif",
  "IBM Plex Sans KR": "'IBM Plex Sans KR', sans-serif",
  "Gothic A1": "'Gothic A1', sans-serif",
  "Nanum Gothic": "'Nanum Gothic', sans-serif",
  "Gowun Batang (세리프)": "'Gowun Batang', serif",
};

export const DEFAULT_FONT = "Pretendard";

/** 라이브에디터 템플릿 전용. 코드 스타일이라는 정체성이 서체 선택과
 *  무관하게 항상 있어야 해서, 별도 구글 폰트 없이 시스템 모노스페이스
 *  스택만 씁니다(html2canvas가 웹폰트 로딩 타이밍에 취약해서, 새 폰트를
 *  더 불러오지 않는 선택이기도 합니다). */
export const MONO_STACK =
  "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace";

/** 연구노트 템플릿 전용 제목 서체. 앱 자체가 이미 index.html에서 로드해
 *  둔 서체라 추가 네트워크 요청이 없습니다. */
export const SERIF_STACK = "'Gowun Batang', serif";

/**
 * [2026-09] 여백 단계를 고르는 도우미.
 *
 * 템플릿마다 기본 간격이 다릅니다(연구노트 py-16, 미니멀 py-20, 라이브
 * 에디터 py-10 …). 공통 클래스 하나를 내려주면 어느 한 템플릿에는 반드시
 * 안 맞기 때문에, 고르는 방법만 공유하고 실제 값은 각 템플릿이 자기
 * 기준으로 셋을 적습니다. Tailwind JIT 이 클래스를 찾으려면 소스에 완성된
 * 문자열이 있어야 한다는 제약과도 맞습니다(문자열을 조립하지 않습니다).
 *
 * ?? v.normal 이 있는 이유: 프런트엔드는 git push 로 자동 배포되지만
 * DB 마이그레이션은 손으로 실행합니다. 새 코드가 먼저 올라가고 density
 * 컬럼이 아직 없으면 d 가 undefined 로 들어오는데, 그대로 두면 간격
 * 클래스가 통째로 빠져 레이아웃이 무너집니다. 기본값으로 떨어뜨려
 * "마이그레이션 전에는 기존 간격 그대로"가 되게 합니다.
 */
export function byDensity<T>(d: Density, v: { roomy: T; normal: T; tight: T }): T {
  return v[d] ?? v.normal;
}
