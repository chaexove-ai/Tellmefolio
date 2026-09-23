#!/usr/bin/env node
/**
 * 디자인한 HTML 을 템플릿으로 정리합니다.
 *
 *   npm run tpl:prepare -- <입력.html> <템플릿-id>
 *
 * [왜 필요한가]
 * 디자인 도구에서 받은 HTML 은 그대로 쓸 수 없습니다. 저장하면서 붙은
 * 절대 주소, 편집기 식별자, 외부 스크립트, CDN 의존이 섞여 있고, 그걸
 * 매번 손으로 걷어내면 템플릿이 늘지 않습니다. 템플릿 품질이 이 제품의
 * 전부인데 템플릿 만드는 비용이 높으면 앞뒤가 안 맞습니다.
 *
 * [이 스크립트가 하는 일]
 *   1. 저장 찌꺼기 제거 (data-sd-id, 절대 앵커, 로컬 파일 경로)
 *   2. iconify-icon → 안에 들어 있던 인라인 SVG 만 남김
 *   3. Tailwind 를 썼으면 실제 쓰인 클래스만 뽑아 CSS 를 인라인
 *   4. 스크립트 태그 전부 제거
 *   5. @media print 가 없으면 기본 규칙을 넣어줌
 *
 * [이 스크립트가 하지 않는 일]
 * data-tf 를 달지 않습니다. 어느 요소가 제목이고 어디가 반복인지는
 * 판단이 필요한 일이라 사람이 합니다. 정리가 끝난 파일에 속성만 달면
 * 됩니다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const [input, id] = process.argv.slice(2);
if (!input || !id) {
  console.error(`
  사용법:  npm run tpl:prepare  파일경로  템플릿이름

  예:      npm run tpl:prepare ~/Downloads/Portfolio.html doc-clean

  파일 경로는 파인더에서 파일을 터미널 창으로 끌어다 놓으면 들어갑니다.
  (경로 앞뒤에 꺾쇠나 따옴표를 직접 넣지 마세요)
`);
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(id)) {
  console.error(`
  템플릿 이름 "${id}" 은(는) 쓸 수 없습니다.
  소문자·숫자·하이픈만 됩니다 — 파일 이름이 되고 주소에 들어갑니다.
  예: doc-clean, minimal-serif, bold-dev
`);
  process.exit(1);
}

const root = process.cwd();
const outPath = path.join(root, "public", "templates", `${id}.html`);

if (!existsSync(input)) {
  console.error(`\n  파일이 없습니다: ${input}`);
  console.error("  경로를 확인하세요. 파인더에서 파일을 터미널로 끌어다 놓으면 경로가 들어갑니다.\n");
  process.exit(1);
}

let s = readFileSync(input, "utf-8");
const before = s.length;
const report = [];

const note = (msg) => report.push(msg);
const count = (re) => (s.match(re) || []).length;

// ── 1. 저장 찌꺼기 ────────────────────────────────────────────
let n = count(/\sdata-sd-id="\d+"/g);
if (n) { s = s.replace(/\s+data-sd-id="\d+"/g, ""); note(`편집기 식별자 ${n}개 제거`); }

n = count(/https:\/\/p\.superdesign\.dev\/site\/[0-9a-f-]+\/#/g);
if (n) {
  s = s.replace(/https:\/\/p\.superdesign\.dev\/site\/[0-9a-f-]+\/#/g, "#");
  note(`미리보기 절대 주소 ${n}개 → 문서 내 앵커`);
}

n = count(/(src|href)="\.\/[^"]*_files\/[^"]*"/g);
if (n) {
  s = s.replace(/src="\.\/[^"]*_files\/[^"]*"/g, 'src=""');
  s = s.replace(/<link[^>]*href="\.\/[^"]*"[^>]*>/g, "");
  note(`로컬 저장 파일 참조 ${n}개 제거 (이미지는 data-tf 로 채우세요)`);
}

// ── 2. iconify ───────────────────────────────────────────────
n = count(/<iconify-icon\b/g);
if (n) {
  s = s.replace(/<iconify-icon\b[\s\S]*?<\/iconify-icon>/g, (m) => {
    const svg = m.match(/<svg\b[\s\S]*?<\/svg>/);
    return svg ? svg[0] : "";
  });
  s = s.replace(/<template shadowrootmode="open">[\s\S]*?<\/template>/g, "");
  note(`iconify-icon ${n}개 → 인라인 SVG (없으면 제거)`);
  const left = count(/<iconify-icon\b/g);
  if (left) note(`⚠️  인라인 SVG 가 없던 아이콘 ${left}개는 사라졌습니다 — 직접 넣으세요`);
}

// ── 3. Tailwind ──────────────────────────────────────────────
const usedTailwindCdn = /cdn\.tailwindcss\.com/.test(s);
if (usedTailwindCdn) {
  const tmp = path.join(root, ".tpl-tmp");
  mkdirSync(tmp, { recursive: true });
  const scan = path.join(tmp, "scan.html");
  writeFileSync(scan, s);
  writeFileSync(path.join(tmp, "in.css"), "@tailwind base;@tailwind components;@tailwind utilities;");
  writeFileSync(
    path.join(tmp, "tw.config.js"),
    `module.exports={content:[${JSON.stringify(scan)}],theme:{extend:{}}};`
  );
  try {
    execSync(
      `npx tailwindcss -c ${JSON.stringify(path.join(tmp, "tw.config.js"))} -i ${JSON.stringify(
        path.join(tmp, "in.css")
      )} -o ${JSON.stringify(path.join(tmp, "out.css"))} --minify`,
      { stdio: "pipe" }
    );
    const css = readFileSync(path.join(tmp, "out.css"), "utf-8");
    const head = s.indexOf("</head>");
    s = s.slice(0, head) + `<style>\n${css}\n</style>\n` + s.slice(head);
    note(`Tailwind CSS 인라인 (${Math.round(css.length / 1024)}KB — 실제 쓰인 클래스만)`);
  } catch (e) {
    note("⚠️  Tailwind CSS 생성 실패 — tailwindcss 가 설치돼 있는지 확인하세요");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── 4. 스크립트 ──────────────────────────────────────────────
n = count(/<script\b/g);
if (n) {
  s = s.replace(/<script[\s\S]*?<\/script>/g, "");
  s = s.replace(/<script[^>]*\/>/g, "");
  note(`스크립트 ${n}개 제거 — 템플릿은 스크립트 없이 동작해야 합니다`);
}

// ── 5. 인쇄 규칙 ─────────────────────────────────────────────
if (!/@media\s+print/.test(s)) {
  const PRINT = `
/* ── 인쇄(PDF) — 자동 생성된 기본값 ─────────────────────────
   웹용 레이아웃을 그대로 인쇄하면 어두운 배경이 종이에 그대로 찍힙니다.
   아래는 최소한의 안전장치입니다. 템플릿에 맞게 손보세요 —
   특히 고정 내비와 장식 요소는 템플릿마다 클래스가 다릅니다. */
@media print {
  nav, [data-tf-noprint] { display: none !important; }
  html, body { background: #fff !important; color: #111 !important; }
  section { padding: 14pt 0 !important; min-height: 0 !important; break-inside: avoid; }
  h1 { font-size: 26pt !important; }
  h2 { font-size: 17pt !important; }
  h3 { font-size: 12pt !important; }
  p, li, span { color: #333 !important; }
  img { filter: none !important; opacity: 1 !important; max-height: 60mm; object-fit: cover; }
  a { color: #111 !important; text-decoration: none; }
}
`;
  const head = s.indexOf("</head>");
  s = s.slice(0, head) + `<style>${PRINT}</style>\n` + s.slice(head);
  note("@media print 기본 규칙 추가 — 템플릿에 맞게 손보세요");
}

// ── 저장 ─────────────────────────────────────────────────────
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, s);

console.log(`\n  ${input}\n→ ${path.relative(root, outPath)}`);
console.log(`  ${Math.round(before / 1024)}KB → ${Math.round(s.length / 1024)}KB\n`);
for (const r of report) console.log("  ·", r);
console.log(`
  다음 할 일:
    1. 파일을 열어 data-tf 를 답니다 (규칙은 src/lib/htmlTemplate.ts 주석)
    2. npm run tpl:check ${id}
    3. 통과하면 src/lib/htmlTemplates.ts 에 한 줄 추가
`);
