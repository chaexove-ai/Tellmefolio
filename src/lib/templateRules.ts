/**
 * 템플릿 데이터 규칙 — 순수 함수만 둡니다(네트워크·Supabase 없음).
 *
 * buildTemplateData 와 템플릿 검사기(scripts/check-template.ts)가 같이
 * 씁니다. 검사기는 Node 에서 돌아서 Supabase 를 부르는 모듈을 import 할 수
 * 없습니다. 그래서 여기에는 다른 모듈을 값으로 import 하지 않습니다.
 *
 * [보여주기 방식 — 2026-09-28]
 * 프로젝트마다 어떻게 보여줄지 고릅니다. 테마(템플릿)는 색·글꼴이고,
 * 이건 한 프로젝트의 배치입니다. 한 포트폴리오 안에 앱·브랜딩·웹이 섞여
 * 있어서, 포트폴리오 전체에 하나를 고르게 하면 어딘가는 어색해집니다.
 *
 *   case     케이스 스터디 — 대표 이미지 + 칸별 글 + 갤러리 (기본)
 *   mobile   모바일 화면 — 세로 스크린숏을 폰 틀에 넣어 나란히
 *   visual   비주얼 — 글은 짧게, 이미지를 크게 (패키지·패션·브랜딩)
 *   compare  전후 비교 — 이전/이후 이미지를 나란히
 *   metrics  성과 지표 — 성과 칸의 숫자를 크게
 *
 * "auto" 는 자료를 보고 고릅니다(resolveDisplay). 판단 근거는 사용자가
 * 넣은 것뿐입니다 — 성과 지표도 사용자가 쓴 줄에서 숫자를 찾을 뿐, 숫자를
 * 만들거나 고치지 않습니다.
 */

export type ProjectDisplay = "auto" | "case" | "mobile" | "visual" | "compare" | "metrics";
export type ResolvedDisplay = Exclude<ProjectDisplay, "auto"> | "brief";

export const DISPLAY_OPTIONS: Array<{ id: ProjectDisplay; label: string; hint: string }> = [
  { id: "auto", label: "자동", hint: "자료를 보고 골라요" },
  { id: "case", label: "케이스 스터디", hint: "대표 이미지 + 칸별 글" },
  { id: "mobile", label: "모바일 화면", hint: "세로 스크린숏을 폰 틀에 나란히" },
  { id: "visual", label: "비주얼", hint: "이미지를 크게, 글은 짧게" },
  { id: "compare", label: "전후 비교", hint: "이전·이후 이미지를 나란히" },
  { id: "metrics", label: "성과 지표", hint: "성과 칸의 숫자를 크게" },
];

export function displayLabel(id: ResolvedDisplay | ProjectDisplay): string {
  if (id === "brief") return "짧은 작업";
  return DISPLAY_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** 본문 5필드의 순서. lead 하나만 맨 앞으로, 나머지는 기본 순서 그대로. */
export function orderedFields(
  lead: string | null | undefined
): Array<"context" | "problem" | "execution" | "outcome" | "reflection"> {
  const base = ["context", "problem", "execution", "outcome", "reflection"] as const;
  if (!lead || !(base as readonly string[]).includes(lead)) return [...base];
  return [lead as (typeof base)[number], ...base.filter((f) => f !== lead)];
}

export function blockHasContent(b: { content: { kind: string; label?: string; text?: string } }): boolean {
  if (b.content.kind === "divider") return true;
  return Boolean((b.content.text ?? "").trim() || (b.content.label ?? "").trim());
}

/* ------------------------------------------------------------------ */
/* 이미지                                                              */
/* ------------------------------------------------------------------ */

export interface ImageSize {
  w: number;
  h: number;
}

/** 폰 화면 비율(세로가 가로의 1.6배 이상 — 9:16, 9:19.5 등) */
export function isPhoneShot(s: ImageSize | undefined): boolean {
  return Boolean(s && s.w > 0 && s.h / s.w >= 1.6);
}

const BEFORE_RE = /(before|as[\s-]?is|이전|기존|개선\s*전|변경\s*전|리뉴얼\s*전|리디자인\s*전)/i;
const AFTER_RE = /(after|to[\s-]?be|이후|개선\s*후|변경\s*후|리뉴얼\s*후|리디자인\s*후|개선안)/i;

/** 설명에 "이전/이후(before/after)"가 적힌 이미지 한 쌍. 없으면 null. */
export function findComparePair<T extends { caption: string }>(
  images: T[]
): { before: T; after: T; rest: T[] } | null {
  const before = images.find((i) => BEFORE_RE.test(i.caption) && !AFTER_RE.test(i.caption));
  const after = images.find((i) => AFTER_RE.test(i.caption) && !BEFORE_RE.test(i.caption));
  if (!before || !after) return null;
  return { before, after, rest: images.filter((i) => i !== before && i !== after) };
}

/* ------------------------------------------------------------------ */
/* 성과 지표                                                           */
/* ------------------------------------------------------------------ */

export interface Metric {
  /** 크게 보여줄 값 — 사용자가 쓴 글자 그대로("18%p", "2,000명") */
  value: string;
  /** 그 숫자가 나온 줄 전체 — 숫자만 떼어 보여주면 뜻이 달라질 수 있어서 */
  label: string;
}

// 단위가 붙은 숫자만 봅니다. 맨 숫자("2")는 순번·개수인지 성과인지 알 수 없습니다.
const METRIC_RE =
  /([+\-−]?\d[\d,]*(?:\.\d+)?)\s*(%p|%|배|x(?![a-z])|명|건|개|곳|원|만\s?원|억|만|시간|분|초|일|주|개월|점|위|회|pt|ms)/i;

/** 사용자가 쓴 글에서 "단위가 붙은 숫자가 있는 줄"을 찾습니다. 최대 4개. */
export function extractMetrics(text: string): Metric[] {
  const out: Metric[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/^[\s•·\-–*]+/, "").trim();
    if (!line) continue;
    const m = METRIC_RE.exec(line);
    if (!m) continue;
    out.push({ value: `${m[1]}${m[2]}`.replace(/\s+/g, ""), label: line });
    if (out.length >= 4) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 보여주기 방식 고르기                                                */
/* ------------------------------------------------------------------ */

export function resolveDisplay(input: {
  display: ProjectDisplay | null | undefined;
  /** 케이스 스터디 칸·블록 중 내용이 있는 게 있나 */
  hasText: boolean;
  /** 본문 글자 수(칸 + 블록) */
  textLength: number;
  images: Array<{ url: string; caption: string }>;
  sizes: Record<string, ImageSize>;
  outcome: string;
}): ResolvedDisplay {
  const { hasText, textLength, images, sizes, outcome } = input;
  const display = input.display ?? "auto";
  const fallback: ResolvedDisplay = hasText ? "case" : "brief";

  const phones = images.filter((i) => isPhoneShot(sizes[i.url]));
  const metrics = extractMetrics(outcome);

  if (display !== "auto") {
    // 고른 방식에 필요한 게 없으면 기본으로 — 빈 틀만 보이면 안 됩니다.
    if (display === "compare" && images.length < 2) return fallback;
    if ((display === "mobile" || display === "visual") && images.length === 0) return fallback;
    if (display === "metrics" && metrics.length === 0) return fallback;
    return display;
  }

  if (findComparePair(images)) return "compare";
  if (phones.length >= 2 && phones.length * 2 >= images.length) return "mobile";
  if (hasText && metrics.length >= 2) return "metrics";
  if (images.length >= 3 && textLength < 400) return "visual";
  return fallback;
}
