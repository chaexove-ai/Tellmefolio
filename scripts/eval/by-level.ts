/**
 * 재작성 문장을 "어떤 근거 수준의 요구사항에 대응하는가"로 나눠 봅니다(4단계 전후 비교용).
 *
 *   npm run eval:by-level -- --runs=base-iso,graded-iso
 *
 * 문장 분류: 대응 요구사항 중 하나라도 2단계 partial 이면 partial, 아니면 full 이 있으면
 * full, 둘 다 없으면 "대응 없음". 실행마다 그 실행의 2단계 결과로 나눕니다.
 *
 *  - 날조율      [LLM 판정] judge/ 결과가 있는 반복만. 사람 검수 결과 판정기 정밀도는
 *                69%, 놓친 비율은 10% 였습니다(eval:agreement). 절대값보다 전후 차이를 봅니다.
 *  - 금지어 포함 [자동] 라벨의 must_not_appear
 *  - 공고 어휘   [자동] 1단계 vocabulary 를 한 개 이상 쓴 문장 비율. 너무 떨어지면
 *                "날조는 줄었지만 직무 언어로 옮기지도 못한" 것이라 함께 봅니다.
 *  - 서버 경고   [자동] verifyProject 가 낸 경고 수
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FIELDS } from "../../supabase/functions/_shared/evidence.ts";
import { EVAL, arg, loadCase } from "./data.ts";
import { hits } from "./score.ts";

type Kind = "partial" | "full" | "none";
interface Cell { n: number; fab: number; judged: number; forb: number; voc: number }
const empty = (): Cell => ({ n: 0, fab: 0, judged: 0, forb: 0, voc: 0 });

export function byLevel(run: string) {
  const dir = join(EVAL, "runs", run);
  const t: Record<Kind | "all", Cell> = { partial: empty(), full: empty(), none: empty(), all: empty() };
  let files = 0, flags = 0, failed = 0;
  for (const f of readdirSync(dir).filter((x) => /\.r\d+\.json$/.test(x)).sort()) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (r.error) { failed++; continue; }
    files++;
    flags += r.flags.length;
    const jf = join(dir, "judge", f);
    const j = existsSync(jf) ? JSON.parse(readFileSync(jf, "utf8")) : null;
    const c = loadCase(r.case);
    const lv = new Map<string, string>(r.matches.map((m: any) => [m.requirementId, m.level]));
    const voc = (r.analysis?.vocabulary ?? []) as string[];
    r.rewrites.forEach((rw: any, pi: number) =>
      FIELDS.forEach((fl) =>
        rw[fl].forEach((s: any, si: number) => {
          const levels = (s.requirements as string[]).map((id) => lv.get(id));
          const k: Kind = levels.includes("partial") ? "partial" : levels.includes("full") ? "full" : "none";
          for (const cell of [t[k], t.all]) {
            cell.n++;
            if (hits(s.text, c.label.must_not_appear ?? []).length) cell.forb++;
            if (hits(s.text, voc).length) cell.voc++;
            if (j) {
              const jj = j.j1.find((x: any) => x.key === `p${pi}:${fl}:${si}`);
              if (jj) { cell.judged++; if (jj.fabricated) cell.fab++; }
            }
          }
        })
      )
    );
  }
  return { run, files, failed, flags, t };
}

const p = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}% (${a}/${b})` : "—");

function main() {
  const runs = (arg("runs") ?? arg("run") ?? "").split(",").filter(Boolean);
  if (!runs.length) throw new Error("--runs=이름1,이름2");
  const res = runs.map(byLevel);
  const L: string[] = [];
  L.push(`| 지표 | ${res.map((r) => `${r.run} (${r.files}회분${r.failed ? `, 실패 ${r.failed}` : ""})`).join(" | ")} |`);
  L.push(`|---|${res.map(() => "---").join("|")}|`);
  const row = (name: string, f: (r: (typeof res)[number]) => string) => L.push(`| ${name} | ${res.map(f).join(" | ")} |`);
  row("문장 수 (partial / full / 대응 없음)", (r) => `${r.t.all.n} (${r.t.partial.n} / ${r.t.full.n} / ${r.t.none.n})`);
  row("[LLM 판정] 날조율 · 전체", (r) => p(r.t.all.fab, r.t.all.judged));
  row("[LLM 판정] 날조율 · partial 대응", (r) => p(r.t.partial.fab, r.t.partial.judged));
  row("[LLM 판정] 날조율 · full 대응", (r) => p(r.t.full.fab, r.t.full.judged));
  row("[LLM 판정] 날조율 · 대응 없음", (r) => p(r.t.none.fab, r.t.none.judged));
  row("[자동] 금지어 포함 · 전체", (r) => p(r.t.all.forb, r.t.all.n));
  row("[자동] 금지어 포함 · partial 대응", (r) => p(r.t.partial.forb, r.t.partial.n));
  row("[자동] 금지어 포함 · full 대응", (r) => p(r.t.full.forb, r.t.full.n));
  row("[자동] 공고 어휘 사용 · full 대응 (지켜야 할 것)", (r) => p(r.t.full.voc, r.t.full.n));
  row("[자동] 공고 어휘 사용 · partial 대응", (r) => p(r.t.partial.voc, r.t.partial.n));
  row("[자동] 서버 경고 수", (r) => `${r.flags} (회당 ${(r.flags / Math.max(r.files, 1)).toFixed(1)})`);
  console.log(L.join("\n"));
  const unjudged = res.filter((r) => r.t.all.judged < r.t.all.n);
  if (unjudged.length) console.log(`\n판정 안 된 문장 있음: ${unjudged.map((r) => `${r.run} ${r.t.all.n - r.t.all.judged}개`).join(", ")} — eval:judge 를 먼저 돌리세요.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
