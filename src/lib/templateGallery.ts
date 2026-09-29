/**
 * [2026-09-29] 템플릿 갤러리(/templates)에 보여 줄 디자인 목록과 예시 데이터.
 *
 * 템플릿이 아직 셋뿐이라 그대로 깔면 텅 빕니다. 그래서 "템플릿 × 분위기"
 * 조합을 한 장씩 보여 줍니다 — 고르면 그 조합 그대로 시작합니다.
 *
 * 예시 데이터는 지어낸 사람의 지어낸 프로젝트입니다(실존 인물·회사 아님).
 * 이미지는 외부 사진을 쓰지 않고 SVG 로 그린 화면 모형입니다 — 템플릿
 * 검사기가 외부 예시 이미지를 막는 것과 같은 이유(오프라인·저작권).
 */
import { htmlTemplates } from "./htmlTemplates";
import { THEME_PRESETS, type PortfolioTheme } from "./themeRules";
import type { LibraryPortfolio, PortfolioProjectRow, PortfolioRow, ProjectImageMap } from "./portfolios";

export type GalleryUse = "resume" | "design" | "dev";

export const USE_LABEL: Record<GalleryUse, string> = {
  resume: "이력서·PDF 제출",
  design: "디자인·기획",
  dev: "개발",
};

/** 템플릿마다 누구에게 맞는지. htmlTemplates 에 없는 새 템플릿은 "디자인·기획"으로. */
const TEMPLATE_USE: Record<string, GalleryUse> = {
  resume: "resume",
  "minimal-serif": "design",
  devcore: "dev",
};

/** 템플릿마다 어울리는 분위기 예시(순서대로 보여 줌) */
const TEMPLATE_PRESETS: Record<string, string[]> = {
  resume: ["paper", "navy", "lavender"],
  "minimal-serif": ["beige", "paper", "forest", "lavender"],
  devcore: ["lime", "navy", "forest"],
};

export interface GalleryItem {
  /** 주소에 쓰는 id: 템플릿 또는 템플릿--분위기 */
  id: string;
  templateId: string;
  templateName: string;
  presetLabel: string | null;
  theme: PortfolioTheme;
  use: GalleryUse;
  desc: string;
}

export const GALLERY: GalleryItem[] = htmlTemplates.flatMap((t) => {
  const use = TEMPLATE_USE[t.id] ?? "design";
  const base: GalleryItem = {
    id: t.id,
    templateId: t.id,
    templateName: t.name,
    presetLabel: null,
    theme: {},
    use,
    desc: t.desc,
  };
  const variants = (TEMPLATE_PRESETS[t.id] ?? [])
    .map((pid) => THEME_PRESETS.find((p) => p.id === pid))
    .filter((p): p is (typeof THEME_PRESETS)[number] => Boolean(p))
    .map((p) => ({
      ...base,
      id: `${t.id}--${p.id}`,
      presetLabel: p.label,
      theme: { ...p.theme },
    }));
  return [base, ...variants];
});

export function itemLabel(item: GalleryItem): string {
  return item.presetLabel ? `${item.templateName} · ${item.presetLabel}` : item.templateName;
}

/* ------------------------------------------------------------------ */
/* 예시 사람                                                           */
/* ------------------------------------------------------------------ */

const PERSONA: Record<GalleryUse, { title: string; job: string; summary: string; color: string }> = {
  design: {
    title: "윤서진 프로덕트 디자인",
    job: "프로덕트 디자이너",
    summary: "사람들이 헤매는 지점을 찾아 덜 헤매게 만드는 일을 합니다. 리서치로 문제를 좁히고, 화면과 숫자로 확인합니다.",
    color: "#a85c30",
  },
  dev: {
    title: "한도윤 프론트엔드",
    job: "프론트엔드 개발자",
    summary: "빠르고 접근하기 쉬운 웹을 만듭니다. 디자이너와 같은 언어로 이야기하고, 측정한 것만 믿습니다.",
    color: "#3b6e8f",
  },
  resume: {
    title: "정하린",
    job: "서비스 기획자",
    summary: "커머스·교육 서비스에서 4년간 기획을 맡았습니다. 데이터로 문제를 찾고, 작은 실험으로 확인한 뒤 넓힙니다.",
    color: "#6b5a8e",
  },
};

/* ------------------------------------------------------------------ */
/* 화면 모형 이미지(SVG)                                               */
/* ------------------------------------------------------------------ */

function svg(w: number, h: number, body: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' width='${w}' height='${h}'>${body}</svg>`
  )}`;
}

function phone(bg: string, accent: string, variant: number): string {
  const cards = [0, 1, 2]
    .map((i) => `<rect x='24' y='${250 + i * 150 + variant * 6}' width='342' height='128' rx='18' fill='white' opacity='.92'/>
      <rect x='44' y='${274 + i * 150}' width='${140 + ((i + variant) % 3) * 40}' height='14' rx='7' fill='#1b1b1f' opacity='.75'/>
      <rect x='44' y='${302 + i * 150}' width='220' height='10' rx='5' fill='#1b1b1f' opacity='.25'/>
      <rect x='44' y='${322 + i * 150}' width='160' height='10' rx='5' fill='#1b1b1f' opacity='.18'/>`)
    .join("");
  return svg(
    390,
    844,
    `<rect width='390' height='844' fill='${bg}'/>
     <rect x='24' y='70' width='120' height='16' rx='8' fill='#1b1b1f' opacity='.8'/>
     <rect x='24' y='110' width='342' height='112' rx='22' fill='${accent}'/>
     <rect x='44' y='136' width='150' height='18' rx='9' fill='white' opacity='.95'/>
     <rect x='44' y='168' width='96' height='30' rx='15' fill='white' opacity='.35'/>
     ${cards}
     <rect x='0' y='774' width='390' height='70' fill='white' opacity='.95'/>
     ${[0, 1, 2, 3].map((i) => `<circle cx='${63 + i * 88}' cy='806' r='11' fill='${i === variant % 4 ? accent : "#c9c9cf"}'/>`).join("")}`
  );
}

function web(bg: string, accent: string, ink: string, layout: "old" | "new" | "dash"): string {
  const nav = `<rect width='1440' height='72' fill='white'/><rect x='48' y='26' width='120' height='20' rx='10' fill='${ink}'/>
    ${[0, 1, 2].map((i) => `<rect x='${1000 + i * 110}' y='30' width='80' height='12' rx='6' fill='${ink}' opacity='.35'/>`).join("")}`;
  if (layout === "dash") {
    return svg(
      1440,
      900,
      `<rect width='1440' height='900' fill='${bg}'/>${nav}
       <rect x='48' y='112' width='260' height='740' rx='16' fill='white'/>
       ${[0, 1, 2, 3].map((i) => `<rect x='340' y='${112 + 0}' width='240' height='120' rx='16' fill='white' transform='translate(${i * 262} 0)'/><rect x='${364 + i * 262}' y='140' width='90' height='12' rx='6' fill='${ink}' opacity='.35'/><rect x='${364 + i * 262}' y='168' width='130' height='30' rx='8' fill='${i === 0 ? accent : ink}' opacity='${i === 0 ? 1 : 0.8}'/>`).join("")}
       <rect x='340' y='256' width='1052' height='360' rx='16' fill='white'/>
       <polyline points='380,560 520,500 660,520 800,430 940,450 1080,360 1220,380 1350,300' fill='none' stroke='${accent}' stroke-width='6' stroke-linejoin='round'/>
       <rect x='340' y='640' width='1052' height='212' rx='16' fill='white'/>`
    );
  }
  const heroH = layout === "old" ? 520 : 380;
  const grid = layout === "new"
    ? [0, 1, 2].map((i) => `<rect x='${48 + i * 456}' y='500' width='432' height='300' rx='16' fill='white'/><rect x='${72 + i * 456}' y='524' width='384' height='170' rx='10' fill='${accent}' opacity='${0.25 + i * 0.2}'/><rect x='${72 + i * 456}' y='714' width='220' height='14' rx='7' fill='${ink}' opacity='.7'/>`).join("")
    : `<rect x='48' y='640' width='1344' height='200' rx='4' fill='white'/><rect x='72' y='670' width='700' height='12' rx='6' fill='${ink}' opacity='.25'/><rect x='72' y='700' width='600' height='12' rx='6' fill='${ink}' opacity='.25'/>`;
  return svg(
    1440,
    900,
    `<rect width='1440' height='900' fill='${bg}'/>${nav}
     <rect x='48' y='96' width='1344' height='${heroH}' rx='${layout === "new" ? 24 : 4}' fill='${layout === "new" ? accent : "#d9d9de"}'/>
     <rect x='96' y='${96 + heroH / 2 - 40}' width='520' height='40' rx='10' fill='white' opacity='.95'/>
     <rect x='96' y='${96 + heroH / 2 + 16}' width='${layout === "new" ? 180 : 120}' height='${layout === "new" ? 48 : 30}' rx='24' fill='${layout === "new" ? ink : "#9a9aa2"}'/>
     ${grid}`
  );
}

function photo(bg: string, a: string, b: string, w: number, h: number, kind: number): string {
  const shapes = [
    `<rect x='${w * 0.22}' y='${h * 0.2}' width='${w * 0.22}' height='${h * 0.6}' rx='14' fill='${a}'/><rect x='${w * 0.52}' y='${h * 0.32}' width='${w * 0.26}' height='${h * 0.48}' rx='14' fill='${b}'/>`,
    `<circle cx='${w / 2}' cy='${h / 2}' r='${Math.min(w, h) * 0.28}' fill='${a}'/><rect x='${w * 0.36}' y='${h * 0.44}' width='${w * 0.28}' height='${h * 0.12}' rx='8' fill='${b}'/>`,
    `<rect x='${w * 0.3}' y='${h * 0.15}' width='${w * 0.4}' height='${h * 0.7}' rx='20' fill='${a}'/><rect x='${w * 0.36}' y='${h * 0.3}' width='${w * 0.28}' height='${h * 0.08}' rx='6' fill='${b}'/>`,
  ][kind % 3];
  return svg(w, h, `<rect width='${w}' height='${h}' fill='${bg}'/><ellipse cx='${w / 2}' cy='${h * 0.86}' rx='${w * 0.36}' ry='${h * 0.04}' fill='black' opacity='.08'/>${shapes}`);
}

/* ------------------------------------------------------------------ */
/* 예시 포트폴리오                                                     */
/* ------------------------------------------------------------------ */

let seq = 0;
function project(pid: string, o: Partial<PortfolioProjectRow>): PortfolioProjectRow {
  return {
    id: pid,
    portfolio_id: "sample",
    position: seq++,
    depth: "full",
    display: "auto",
    name: "",
    context: "",
    role: "",
    problem: "",
    execution: "",
    outcome: "",
    reflection: "",
    stack: [],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...o,
  };
}

export interface SampleData {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  images: ProjectImageMap;
}

const cache = new Map<string, SampleData>();

/** 갤러리 미리보기용 예시 포트폴리오 한 벌(템플릿·분위기를 입혀서) */
export function sampleFor(item: GalleryItem): SampleData {
  const hit = cache.get(item.id);
  if (hit) return hit;
  seq = 0;
  const p = PERSONA[item.use];
  const accent = item.theme.accent ?? p.color;
  const portfolio: PortfolioRow = {
    id: `sample-${item.id}`,
    user_id: "sample",
    title: p.title,
    job: p.job,
    job_color: p.color,
    year: "2026",
    visibility: "public",
    listed: false,
    template_id: item.templateId,
    color_theme: "dark",
    font: "Pretendard",
    layout: "1col",
    density: "normal",
    cover_image_path: null,
    summary: p.summary,
    gaps: [],
    theme: item.theme,
    copy: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  const projects: PortfolioProjectRow[] = [
    project("s1", {
      name: item.use === "dev" ? "배송 조회 페이지 성능 개선" : "여행 예약 앱 가입 흐름 개선",
      role: item.use === "dev" ? "프론트엔드 (3인 팀 중 1명)" : "UX 리서치 · UI 디자인",
      context: item.use === "dev" ? "배송 조회 페이지가 느려 고객 문의가 많았습니다." : "가입을 시작한 사람의 절반 가까이가 약관 화면에서 멈췄습니다.",
      execution: item.use === "dev"
        ? "번들을 나누고 이미지를 지연 로딩했습니다.\n느린 화면부터 측정해 우선순위를 정했습니다."
        : "사용자 인터뷰로 멈추는 지점을 찾고, 필수 약관만 먼저 묻도록 흐름을 바꿨습니다.",
      outcome: item.use === "dev"
        ? "첫 화면 표시 시간 3.1초 → 1.4초\n배송 문의 22% 감소"
        : "가입 완료율 18%p 상승\n약관 화면 이탈 40% 감소",
      stack: item.use === "dev" ? ["React", "TypeScript", "Vite", "Lighthouse"] : ["Figma", "Maze", "GA4"],
    }),
    project("s2", {
      name: item.use === "dev" ? "사내 관리 도구 리디자인" : "쇼핑몰 상세페이지 리디자인",
      role: item.use === "dev" ? "프론트엔드 · 디자인 시스템" : "UI 디자이너",
      context: "구매 버튼까지 스크롤이 너무 길었습니다.",
      execution: "정보 순서를 바꾸고 구매 버튼을 화면 아래에 고정했습니다.",
      stack: ["Figma"],
    }),
    project("s3", {
      name: item.use === "dev" ? "습관 기록 앱" : "식단 기록 앱",
      role: "1인 프로젝트",
      context: "하루 기록을 3초 안에 끝내게 만드는 모바일 앱입니다.",
      execution: "홈·기록·통계 세 화면으로 줄이고, 한 번 탭으로 기록하게 했습니다.",
      stack: item.use === "dev" ? ["React Native", "Expo"] : ["Figma", "Protopie"],
    }),
    project("s4", { name: "비건 화장품 패키지", depth: "brief", context: "재생지와 콩기름 잉크로 만든 패키지 시리즈입니다.", stack: ["Illustrator"] }),
    project("s5", { name: "지역 카페 브랜딩", depth: "brief", context: "로고와 메뉴판, SNS 템플릿을 만들었습니다.", stack: ["Illustrator", "Photoshop"] }),
  ];

  const ink = "#1b1b1f";
  const img = (id: string, url: string, caption = "") => ({ id, url, caption });
  const images: ProjectImageMap = {
    s1: [img("i1", web("#f3f1ee", accent, ink, item.use === "dev" ? "dash" : "new"), item.use === "dev" ? "개선 후 첫 화면" : "")],
    s2: [
      img("i2", web("#ececef", accent, ink, "old"), "기존 상세페이지"),
      img("i3", web("#f6f4f0", accent, ink, "new"), "개선안 — 구매 버튼 고정"),
    ],
    s3: [0, 1, 2].map((v) => img(`i4${v}`, phone("#f4f2ee", accent, v))),
    s4: [
      img("i5", photo("#eee7dc", "#8fa37a", "#e8d9c4", 1400, 900, 0)),
      img("i6", photo("#e9e2f0", "#c9a7d6", "#f4ecd9", 900, 1100, 1)),
      img("i7", photo("#e3ece4", "#7fa38d", "#f0e6d2", 900, 1100, 2)),
    ],
  };

  const data = { portfolio, projects, images };
  cache.set(item.id, data);
  return data;
}

/** 목록 카드(썸네일)에 쓰는 가벼운 모양 */
export function thumbFor(item: GalleryItem): LibraryPortfolio {
  const p = PERSONA[item.use];
  return {
    id: `sample-${item.id}`,
    userId: "sample",
    title: p.title,
    job: p.job,
    year: "2026",
    visibility: "공개",
    listed: false,
    updatedAt: "2026-09-01T00:00:00Z",
    jobColor: item.theme.accent ?? p.color,
    templateId: item.templateId,
    summary: p.summary,
    theme: item.theme,
  };
}
