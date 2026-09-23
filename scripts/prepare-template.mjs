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

/**
 * [2026-09-23] 디자인 도구에서 "페이지 저장"을 하면 도구의 앱 껍데기가
 * 저장되고, 정작 디자인은 그 안 iframe 에 들어 있습니다. 껍데기를 그냥
 * 변환하면 디자인은 한 줄도 없는 빈 템플릿이 나오는데, 파일 크기는
 * 멀쩡해서 알아채기 어렵습니다. 여기서 잡아 실제 파일 경로를 알려줍니다.
 */
const wrapper = s.match(/<iframe[^>]*\ssrc="(\.\/[^"]+\.html)"[^>]*>/i);
if (wrapper && !/data-tf/.test(s)) {
  const inner = path.resolve(path.dirname(input), decodeURIComponent(wrapper[1]));
  console.error(`
  이 파일은 디자인이 아니라 디자인 도구의 화면 껍데기입니다.
  실제 디자인은 iframe 안에 따로 저장돼 있습니다.

  이걸 쓰세요:
    ${inner}

  (파일이 안 보이면 저장한 폴더 옆의 _files 폴더를 확인하세요)
`);
  process.exit(1);
}

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

// 같은 폴더에 저장된 CSS 는 읽어서 인라인합니다. 디자인 도구가
// "페이지 저장"을 하면 Google Fonts CSS 가 ./css2 같은 이름으로
// 떨어지는데, 링크만 지우면 서체가 통째로 사라집니다.
s = s.replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (m, name) => {
  const local = path.resolve(path.dirname(input), decodeURIComponent(name));
  if (!existsSync(local)) return "";
  const css = readFileSync(local, "utf-8");
  note(`로컬 스타일시트 ${name} 인라인 (${Math.round(css.length / 1024)}KB)`);
  return `<style>\n${css}\n</style>`;
});
s = s.replace(/<link[^>]*href="\.\/([^"]+)"[^>]*rel="stylesheet"[^>]*>/g, (m, name) => {
  const local = path.resolve(path.dirname(input), decodeURIComponent(name));
  if (!existsSync(local)) return "";
  const css = readFileSync(local, "utf-8");
  note(`로컬 스타일시트 ${name} 인라인 (${Math.round(css.length / 1024)}KB)`);
  return `<style>\n${css}\n</style>`;
});

n = count(/(src|href)="\.\/[^"]*_files\/[^"]*"/g);
if (n) {
  s = s.replace(/src="\.\/[^"]*_files\/[^"]*"/g, 'src=""');
  s = s.replace(/<link[^>]*href="\.\/[^"]*"[^>]*>/g, "");
  note(`로컬 저장 파일 참조 ${n}개 제거 (이미지는 data-tf 로 채우세요)`);
}

// 브라우저 확장이 끼워 넣은 조각.
//
// [2026-09-23] 데브코어 템플릿에 Glasp 확장의 떠 있는 버튼이 통째로
// 딸려 왔습니다. `</body>` **뒤에** 있어서 눈에 안 띄었는데, 브라우저는
// 그걸 본문 안으로 끌어올려 그립니다 — 내보낸 포트폴리오 오른쪽 아래에
// 남의 서비스 버튼이 떠 있게 됩니다. 저장된 페이지에는 이런 게 딸려
// 오는 게 정상이라고 보고 늘 털어냅니다.
n = count(/glasp|grammarly|data-lastpass/gi);
if (n) {
  s = s.replace(/<div[^>]*(?:class|id)="[^"]*glasp[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi, "");
  s = s.replace(/<style[^>]*data-glasp[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\s*data-glasp-print="[^"]*"/g, "");
  s = s.replace(/<[^>]*(?:grammarly|data-lastpass)[^>]*>/gi, "");
  note(`브라우저 확장 흔적 ${n}군데 제거`);
}

// `</body>` 뒤에 남은 것도 같은 부류입니다. 여기까지 왔으면 본문은
// 이미 끝났으니, 뒤에 붙은 건 전부 남의 것입니다.
{
  const at = s.indexOf("</body>");
  if (at !== -1) {
    const rest = s.slice(at + 7).replace(/<\/html>/gi, "").trim();
    if (rest.length > 0) {
      s = s.slice(0, at) + "</body>\n</html>\n";
      note(`</body> 뒤 찌꺼기 ${rest.length}자 제거`);
    }
  }
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
/**
 * Tailwind 를 썼는지.
 *
 * cdn.tailwindcss.com 문자열만 보면 놓칩니다 — "페이지 저장"을 하면
 * 그 스크립트가 ./saved_resource 같은 로컬 이름으로 바뀌어 있습니다.
 * 그러면 유틸리티 클래스는 그대로인데 그걸 정의하는 CSS 가 없는,
 * 겉보기엔 멀쩡하고 열면 스타일이 다 죽은 파일이 나옵니다.
 *
 * 그래서 클래스 쪽을 봅니다: 전형적인 유틸리티가 여러 개 보이는데
 * 그걸 정의하는 규칙이 문서 안에 없으면 Tailwind 가 필요한 상태입니다.
 */
const looksTailwind = /class="[^"]*\b(flex|grid|hidden|absolute|relative)\b[^"]*"/.test(s)
  && /class="[^"]*\b(px-\d|py-\d|mb-\d|mt-\d|gap-\d|text-\[|text-(xs|sm|lg|xl|\d))\b/.test(s);
const hasUtilityCss = /\.(flex|grid)\s*\{[^}]*display\s*:/.test(s);
const usedTailwindCdn = /cdn\.tailwindcss\.com|window\.tailwind/.test(s) || (looksTailwind && !hasUtilityCss);

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

// ── 5. 스크립트에 기대던 규칙 ────────────────────────────────
//
// 디자인 도구는 로딩 중 깜빡임을 막으려고 "스크립트가 클래스를 붙이기
// 전까지 숨김" 같은 규칙을 넣습니다. 그 스크립트를 우리가 지웠으므로,
// 규칙만 남으면 페이지가 통째로 안 보일 수 있습니다.
const HIDE_UNTIL_READY = /(html|body):not\(\.[a-z-]*ready\)\s*\{[^}]*opacity:\s*0[^}]*\}/gi;
if (HIDE_UNTIL_READY.test(s)) {
  s = s.replace(HIDE_UNTIL_READY, "");
  note("'준비되기 전까지 숨김' 규칙 제거 — 그 클래스를 붙이던 스크립트가 없습니다");
}

// ── 6. 인쇄 규칙 ─────────────────────────────────────────────
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
