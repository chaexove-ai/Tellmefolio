/**
 * 템플릿이 쓸 만한 상태인지 기계가 봅니다.
 *
 *   npm run tpl:check -- <템플릿-id>        한 장
 *   npm run tpl:check                        전부
 *
 * [왜 필요한가]
 * 템플릿을 사람이 눈으로 확인하면 확장되지 않습니다. 그리고 눈으로는
 * 놓치는 것들이 있습니다 — data-tf 키를 하나 빠뜨리면 그 내용이
 * 화면에서 **조용히 사라집니다**. 에러도 안 나고, 빈 칸도 안 보이고,
 * 그냥 없습니다. 사용자가 쓴 글이 결과물에서 빠지는 게 이 제품에서
 * 가장 나쁜 실패입니다.
 *
 * 실제 채우기 엔진(src/lib/htmlTemplate.ts)을 그대로 씁니다. 검증기가
 * 따로 구현을 갖고 있으면, 검증은 통과하는데 화면에서는 깨지는 일이
 * 생깁니다.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

// 엔진은 브라우저 DOMParser 를 씁니다. Node 에는 없으므로 jsdom 것을 빌려줍니다.
const dom = new JSDOM("<!DOCTYPE html><html></html>");
(globalThis as unknown as { DOMParser: unknown }).DOMParser = dom.window.DOMParser;
(globalThis as unknown as { NodeFilter: unknown }).NodeFilter = dom.window.NodeFilter;

const { fillTemplate } = await import("../src/lib/htmlTemplate.js");

/** 빠지면 사용자 내용이 사라지는 키들. */
const REQUIRED = ["title", "summary", "projects"];
/** 반복 안에 있어야 하는 키들. */
const REQUIRED_IN_PROJECT = ["name"];

/** 실제로 나올 법한 데이터. 빈 값·긴 글·특수문자를 일부러 섞었습니다. */
const SAMPLE = {
  title: "올리브영 UX/UI 디자인 포트폴리오",
  summary:
    "QUT 인터랙션 디자인 전공자로, 3년간 제주와 호주에서 브랜드·웹·마케팅을 주도하며 사용자 경험을 실제 성과로 연결해온 올라운더입니다.",
  job: "UX/UI 디자이너",
  year: "2026",
  cover: "https://example.com/cover.jpg",
  projectCount: "3",
  stack: ["Figma", "Illustrator", "Wix", "React"],
  email: "test@example.com",
  emailHref: "mailto:test@example.com",
  github: "https://github.com/example",
  site: "",
  projects: [
    {
      name: "도틀왓제주",
      lead: "제주 풀빌라 브랜드 전 채널 총괄",
      stack: ["Figma", "Illustrator"],
      image: "https://example.com/a.jpg",
      images: [{ url: "https://example.com/a.jpg", caption: "메인 화면" }],
      fields: [
        { label: "맥락 및 배경", value: "제주 풀빌라 브랜드 전 채널 총괄" },
        { label: "핵심 성과", value: "3년 장기 운영으로 브랜드 아이덴티티 지속 관리\n웹·SNS 단독 주도" },
      ],
      blocks: [{ label: "수상", text: "QUT Visualization Award" }],
    },
    // 이미지도 케이스 스터디도 없는 프로젝트 — 템플릿이 빈 자리를 남기지
    // 않는지 보기 위한 것입니다.
    { name: "Lumoji", lead: "", stack: [], image: "", images: [], fields: [], blocks: [] },
  ],
};

interface Result {
  id: string;
  errors: string[];
  warns: string[];
}

function check(id: string): Result {
  const file = path.join(process.cwd(), "public", "templates", `${id}.html`);
  const html = readFileSync(file, "utf-8");
  // 주석은 채울 때 지워지므로 사용자에게 닿지 않습니다. "지어낸 숫자"
  // 같은 검사는 실제 내용만 봐야 합니다 — 안 그러면 "왜 이걸 뺐는지"
  // 적어둔 주석 때문에 그 템플릿이 실패합니다.
  const visible = html.replace(/<!--[\s\S]*?-->/g, "");
  const errors: string[] = [];
  const warns: string[] = [];

  // ── 1. 필수 바인딩 ──
  for (const key of REQUIRED) {
    const re = new RegExp(`data-tf(?:-repeat|-if)?="${key}"`);
    if (!re.test(html)) errors.push(`data-tf="${key}" 가 없습니다 — 그 내용이 결과물에서 사라집니다`);
  }
  if (/data-tf-repeat="projects"/.test(html)) {
    for (const key of REQUIRED_IN_PROJECT) {
      if (!new RegExp(`data-tf="${key}"`).test(html)) {
        errors.push(`프로젝트 반복 안에 data-tf="${key}" 가 없습니다`);
      }
    }
  }
  for (const key of ["fields", "blocks"]) {
    if (!new RegExp(`data-tf-repeat="${key}"`).test(html)) {
      warns.push(`data-tf-repeat="${key}" 가 없습니다 — ${
        key === "fields" ? "케이스 스터디로 쓴 5필드" : "사용자가 직접 추가한 블록"
      }이 안 나옵니다`);
    }
  }

  // ── 2. 바깥 의존 ──
  if (/<script\b/.test(html)) errors.push("스크립트 태그가 있습니다 — 미리보기 iframe 은 스크립트를 막습니다");
  if (/cdn\.tailwindcss\.com/.test(html)) errors.push("Tailwind CDN 의존 — 오프라인에서 스타일이 전부 죽습니다");
  if (/iconify/.test(html)) errors.push("iconify 의존이 남아 있습니다");
  if (/images\.unsplash\.com|placehold\.co/.test(html)) {
    errors.push("외부 예시 이미지가 남아 있습니다 — 사용자 이미지로 바꾸거나 지우세요");
  }
  if (/\.\/[^"']*_files\//.test(html)) errors.push("로컬 저장 파일 경로가 남아 있습니다");
  const fonts = /fonts\.googleapis\.com/.test(html);
  if (fonts) warns.push("Google Fonts 를 씁니다 — 오프라인에서는 대체 서체로 보입니다(치명적이지는 않음)");

  // ── 3. 인쇄 ──
  if (!/@media\s+print/.test(html)) errors.push("@media print 가 없습니다 — PDF 가 웹 화면 그대로 찍힙니다");
  else if (!/@media\s+print[\s\S]{0,600}background:\s*#fff/i.test(html)) {
    warns.push("인쇄 규칙에 흰 배경 지정이 안 보입니다 — 어두운 템플릿이면 종이가 검게 나옵니다");
  }

  // ── 4. 지어낸 내용 ──
  const FABRICATED = [
    [/\d+\+\s*(Projects|Years|Clients)/i, "지어낸 실적 숫자"],
    [/\d{2,3}%\s*(Client|Success|만족)/i, "지어낸 비율"],
    [/(Airbnb|Monzo|Headspace|Google|Samsung)\b/, "지어낸 고객사·회사 이름"],
    [/<form\b/, "입력 폼 — 내보낸 파일에는 받아줄 서버가 없습니다"],
  ] as const;
  for (const [re, label] of FABRICATED) {
    if (re.test(visible)) errors.push(`${label}이(가) 남아 있습니다`);
  }

  // ── 5. 실제로 채워보기 ──
  let filled = "";
  try {
    filled = fillTemplate(html, SAMPLE as never);
  } catch (e) {
    errors.push(`채우기 실패: ${e instanceof Error ? e.message : String(e)}`);
    return { id, errors, warns };
  }

  // 사용자 내용이 실제로 들어갔는지
  const mustAppear: Array<[string, string]> = [
    [SAMPLE.title, "제목"],
    [SAMPLE.summary.slice(0, 20), "요약"],
    ["도틀왓제주", "프로젝트 이름"],
  ];
  for (const [needle, label] of mustAppear) {
    if (!filled.includes(needle)) errors.push(`채운 뒤 ${label}이(가) 결과물에 없습니다`);
  }
  if (/data-tf-repeat="fields"/.test(html) && !filled.includes("3년 장기 운영으로")) {
    errors.push("케이스 스터디 내용이 결과물에 없습니다");
  }
  if (/data-tf-repeat="blocks"/.test(html) && !filled.includes("QUT Visualization Award")) {
    errors.push("직접 추가한 블록이 결과물에 없습니다");
  }
  // 채운 뒤에 표시가 남았는지 — 문자열이 아니라 실제 요소로 봅니다.
  // 인쇄 규칙의 [data-tf-noprint] 같은 CSS 선택자는 남아도 정상인데,
  // 문자열로 찾으면 그것까지 걸립니다.
  const filledDoc = new JSDOM(filled).window.document;
  const leftover = filledDoc.querySelectorAll("[data-tf],[data-tf-repeat],[data-tf-if]").length;
  if (leftover > 0) warns.push(`채운 뒤에도 data-tf 표시가 ${leftover}개 남아 있습니다`);

  return { id, errors, warns };
}

const arg = process.argv[2];
const ids = arg
  ? [arg]
  : readdirSync(path.join(process.cwd(), "public", "templates"))
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, ""));

let failed = 0;
for (const id of ids) {
  const r = check(id);
  const ok = r.errors.length === 0;
  if (!ok) failed += 1;
  console.log(`\n${ok ? "✓" : "✗"} ${id}`);
  for (const e of r.errors) console.log(`   오류  ${e}`);
  for (const w of r.warns) console.log(`   주의  ${w}`);
  if (ok && r.warns.length === 0) console.log("   문제 없음");
}

console.log(
  `\n${ids.length}장 중 ${ids.length - failed}장 통과${failed ? ` · ${failed}장 실패` : ""}\n`
);
console.log("  기계가 못 보는 것: 폰 폭에서의 모양, 실제 인쇄 결과, 디자인 자체.");
console.log("  이 셋은 브라우저로 열어 직접 확인하세요.\n");

process.exit(failed > 0 ? 1 : 0);
