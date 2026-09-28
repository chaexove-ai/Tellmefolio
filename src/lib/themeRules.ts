/**
 * 포트폴리오 분위기(테마) — 순수 함수만 둡니다. [2026-09-28]
 *
 * v0 처럼 "말로 바꾸는" 첫 단계입니다. 사용자가 "따뜻한 베이지, 세리프"라고
 * 적으면 AI 가 아래 몇 개 값만 고르고(supabase/functions/theme), 나머지 색은
 * 여기서 계산합니다. AI 에게 색 12개를 고르게 하면 글자와 바탕이 안 읽히는
 * 조합이 나옵니다 — 바탕·강조색 두 개만 받고, 글자색은 대비를 계산해 정합니다.
 *
 * 템플릿은 이 값을 CSS 변수(--tf-*)로 받습니다. 어느 클래스가 어느 변수를
 * 쓰는지는 템플릿이 정합니다(템플릿 안의 "분위기 층" <style>). 그래서
 * 템플릿을 추가해도 이 파일은 그대로입니다.
 *
 * [안전] 결과 CSS 는 템플릿 문서에 그대로 들어갑니다. 값은 전부 여기서
 * 검사합니다 — 색은 #rrggbb 만, 서체는 아래 목록의 것만.
 */

export type ThemeRadius = "none" | "soft" | "round";

export interface PortfolioTheme {
  /** 바탕색 #rrggbb */
  bg?: string;
  /** 강조색 #rrggbb */
  accent?: string;
  /** THEME_FONTS 의 id */
  titleFont?: string;
  bodyFont?: string;
  radius?: ThemeRadius;
  /** 사용자가 적은 분위기 문장(다시 열었을 때 보여 주려고) */
  prompt?: string;
}

export interface ThemeFont {
  id: string;
  label: string;
  family: string;
  /** Google Fonts css2 의 family 파라미터 */
  query: string;
  kind: "sans" | "serif" | "display" | "mono";
}

/** 한글이 되는 서체 위주. 영문 전용 서체는 한글이 시스템 서체로 떨어져 어색합니다. */
export const THEME_FONTS: ThemeFont[] = [
  { id: "noto-sans", label: "본고딕", family: "'Noto Sans KR', sans-serif", query: "Noto+Sans+KR:wght@300;400;500;700;900", kind: "sans" },
  { id: "ibm-plex", label: "IBM Plex 산스", family: "'IBM Plex Sans KR', sans-serif", query: "IBM+Plex+Sans+KR:wght@300;400;500;700", kind: "sans" },
  { id: "gothic-a1", label: "고딕 A1", family: "'Gothic A1', sans-serif", query: "Gothic+A1:wght@300;400;600;800", kind: "sans" },
  { id: "gowun-dodum", label: "고운돋움", family: "'Gowun Dodum', sans-serif", query: "Gowun+Dodum", kind: "sans" },
  { id: "noto-serif", label: "본명조", family: "'Noto Serif KR', serif", query: "Noto+Serif+KR:wght@300;400;600;900", kind: "serif" },
  { id: "nanum-myeongjo", label: "나눔명조", family: "'Nanum Myeongjo', serif", query: "Nanum+Myeongjo:wght@400;700;800", kind: "serif" },
  { id: "gowun-batang", label: "고운바탕", family: "'Gowun Batang', serif", query: "Gowun+Batang:wght@400;700", kind: "serif" },
  { id: "hahmlet", label: "함렛", family: "'Hahmlet', serif", query: "Hahmlet:wght@300;500;700;900", kind: "serif" },
  { id: "black-han-sans", label: "검은고딕", family: "'Black Han Sans', sans-serif", query: "Black+Han+Sans", kind: "display" },
  { id: "do-hyeon", label: "도현", family: "'Do Hyeon', sans-serif", query: "Do+Hyeon", kind: "display" },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: "'JetBrains Mono', 'Noto Sans KR', monospace", query: "JetBrains+Mono:wght@400;700", kind: "mono" },
];

export const RADIUS_OPTIONS: Array<{ id: ThemeRadius; label: string }> = [
  { id: "none", label: "각지게" },
  { id: "soft", label: "부드럽게" },
  { id: "round", label: "둥글게" },
];

/** 누르면 바로 바뀌는 예시. AI 없이도 쓸 수 있게. */
export const THEME_PRESETS: Array<{ id: string; label: string; theme: PortfolioTheme }> = [
  { id: "paper", label: "흑백 신문", theme: { bg: "#f4f1ea", accent: "#111111", titleFont: "noto-serif", bodyFont: "noto-sans", radius: "none" } },
  { id: "beige", label: "따뜻한 베이지", theme: { bg: "#efe6d8", accent: "#a0522d", titleFont: "gowun-batang", bodyFont: "gowun-dodum", radius: "soft" } },
  { id: "navy", label: "딥 네이비", theme: { bg: "#0b1733", accent: "#f5c542", titleFont: "ibm-plex", bodyFont: "ibm-plex", radius: "soft" } },
  { id: "lime", label: "비비드 라임", theme: { bg: "#0d0d0d", accent: "#c6ff3d", titleFont: "black-han-sans", bodyFont: "noto-sans", radius: "none" } },
  { id: "lavender", label: "파스텔 라벤더", theme: { bg: "#f3effa", accent: "#6d4fd8", titleFont: "gothic-a1", bodyFont: "gothic-a1", radius: "round" } },
  { id: "forest", label: "숲", theme: { bg: "#11201a", accent: "#7fd1a8", titleFont: "hahmlet", bodyFont: "noto-sans", radius: "soft" } },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** 저장된 값·AI 응답을 믿지 않고 한 번 거릅니다. 모르는 값은 버립니다. */
export function normalizeTheme(raw: unknown): PortfolioTheme {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: PortfolioTheme = {};
  if (typeof r.bg === "string" && HEX.test(r.bg)) out.bg = r.bg.toLowerCase();
  if (typeof r.accent === "string" && HEX.test(r.accent)) out.accent = r.accent.toLowerCase();
  if (typeof r.titleFont === "string" && THEME_FONTS.some((f) => f.id === r.titleFont)) out.titleFont = r.titleFont;
  if (typeof r.bodyFont === "string" && THEME_FONTS.some((f) => f.id === r.bodyFont)) out.bodyFont = r.bodyFont;
  if (r.radius === "none" || r.radius === "soft" || r.radius === "round") out.radius = r.radius;
  if (typeof r.prompt === "string" && r.prompt.trim()) out.prompt = r.prompt.trim().slice(0, 200);
  return out;
}

export function isEmptyTheme(t: PortfolioTheme): boolean {
  return !t.bg && !t.accent && !t.titleFont && !t.bodyFont && !t.radius;
}

/* ------------------------------------------------------------------ */
/* 색 계산                                                             */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

function toRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}
/** a 를 t 만큼, b 를 1-t 만큼 섞습니다 */
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t), a[2] * t + b[2] * (1 - t)];
}
function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string): number {
  const la = luminance(toRgb(a));
  const lb = luminance(toRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function rotateHue([r, g, b]: RGB, deg: number): RGB {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

export interface ThemePalette {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  body: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accent2: string;
  accentInk: string;
  dark: boolean;
}

/** 바탕·강조색 두 개에서 나머지 색을 계산합니다. 글자는 늘 읽히게(대비). */
export function derivePalette(bgHex: string, accentHex: string): ThemePalette {
  const bg = toRgb(bgHex);
  const dark = luminance(bg) < 0.25;
  const ink = dark ? mix([255, 255, 255], bg, 0.92) : mix([10, 10, 12], bg, 0.9);
  const inkHex = toHex(ink);

  // 강조색이 바탕과 너무 비슷하면(대비 3 미만) 글자색 쪽으로 당깁니다.
  let accent = toRgb(accentHex);
  for (let i = 0; i < 10 && contrast(toHex(accent), bgHex) < 3; i++) accent = mix(ink, accent, 0.15 + i * 0.05);
  const accentOut = toHex(accent);

  return {
    bg: bgHex,
    surface: toHex(mix(ink, bg, 0.05)),
    surface2: toHex(mix(ink, bg, 0.09)),
    ink: inkHex,
    body: toHex(mix(ink, bg, 0.74)),
    muted: toHex(mix(ink, bg, 0.52)),
    faint: toHex(mix(ink, bg, 0.34)),
    line: toHex(mix(ink, bg, 0.12)),
    lineStrong: toHex(mix(ink, bg, 0.22)),
    accent: accentOut,
    accent2: toHex(rotateHue(accent, 40)),
    accentInk: contrast(accentOut, "#0a0a0a") >= contrast(accentOut, "#ffffff") ? "#0a0a0a" : "#ffffff",
    dark,
  };
}

const RADIUS: Record<ThemeRadius, [string, string]> = {
  none: ["0", "0"],
  soft: ["0.75rem", "0.4rem"],
  round: ["1.75rem", "999px"],
};

/**
 * 템플릿에 넣을 CSS 와 서체 주소. 무엇을 바꿨는지(flags)에 따라 템플릿의
 * 분위기 층이 켜집니다 — 색만 바꿨으면 서체 규칙은 가만히 둡니다.
 */
export function themeToCss(themeIn: PortfolioTheme): { css: string; fontHref: string; flags: string[] } | null {
  const theme = normalizeTheme(themeIn);
  if (isEmptyTheme(theme)) return null;
  const vars: string[] = [];
  const flags: string[] = [];

  if (theme.bg || theme.accent) {
    // 한쪽만 고른 경우의 기본값: 바탕은 거의 검정, 강조색은 청록
    const p = derivePalette(theme.bg ?? "#0a0a0a", theme.accent ?? "#22d3ee");
    vars.push(
      `--tf-bg:${p.bg}`, `--tf-surface:${p.surface}`, `--tf-surface-2:${p.surface2}`, `--tf-ink:${p.ink}`,
      `--tf-body:${p.body}`, `--tf-muted:${p.muted}`, `--tf-faint:${p.faint}`, `--tf-line:${p.line}`,
      `--tf-line-strong:${p.lineStrong}`, `--tf-accent:${p.accent}`, `--tf-accent-2:${p.accent2}`,
      `--tf-accent-ink:${p.accentInk}`
    );
    flags.push("colors");
  }
  const fonts = [theme.titleFont, theme.bodyFont]
    .map((id) => THEME_FONTS.find((f) => f.id === id))
    .filter((f): f is ThemeFont => Boolean(f));
  const title = THEME_FONTS.find((f) => f.id === theme.titleFont);
  const body = THEME_FONTS.find((f) => f.id === theme.bodyFont);
  if (title) {
    vars.push(`--tf-title-font:${title.family}`);
    flags.push("title-font");
  }
  if (body) {
    vars.push(`--tf-body-font:${body.family}`);
    flags.push("body-font");
  }
  if (theme.radius) {
    const [r, tag] = RADIUS[theme.radius];
    vars.push(`--tf-radius:${r}`, `--tf-radius-tag:${tag}`);
    flags.push("radius");
  }

  const unique = [...new Set(fonts.map((f) => f.query))];
  const fontHref = unique.length
    ? `https://fonts.googleapis.com/css2?${unique.map((q) => `family=${q}`).join("&")}&display=swap`
    : "";
  return { css: `:root{${vars.join(";")}}`, fontHref, flags };
}
