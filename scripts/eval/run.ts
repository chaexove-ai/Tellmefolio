/**
 * 평가 실행기. 케이스를 운영과 같은 파이프라인으로 돌리고 원시 결과를 저장합니다.
 *
 *   npm run eval -- --mode=isolated --config=baseline --reps=1
 *   npm run eval -- --mode=e2e --cases=dev,design-01a --reps=3 --name=repro
 *   npm run eval -- --mode=isolated --config=s2-haiku --cases=@half
 *
 * --mode     isolated: 정답 요구사항을 2단계에 직접 넣음(2·3단계만 측정)
 *            e2e: 1→2→3단계 전부 모델(운영과 같은 조건)
 * --config   config.ts 의 CONFIGS 이름. 운영과 같은 조합은 baseline
 * --cases    케이스 id 또는 접두어를 쉼표로. @half 는 직무군×난이도마다 1개씩(12개)
 * --reps     반복 횟수(재현성)
 * --budget   이번 실행의 예상 비용 상한(USD). 넘으면 시작하지 않습니다. 기본 5
 * --yes      예상 비용을 보여 준 뒤 확인 없이 시작
 *
 * 결과: eval/runs/<이름>/<케이스>.r<회차>.json, manifest.json
 * eval/runs/ 는 커밋하지 않습니다(.gitignore). 요약 리포트만 커밋합니다.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIGS, loadEnv } from "./config.ts";
import { arg, EVAL, loadCase, selectCases, listCaseIds } from "./data.ts";
import { estimateRun } from "./estimate.ts";
import { initModel, runCase, type RunResult } from "./pipeline.ts";

loadEnv();

function pickCases(filter: string | undefined): string[] {
  if (filter === "@half") {
    // 직무군 4 × (sufficient 1, partial_gap 1, cross 1) = 12
    const out: string[] = [];
    for (const fam of ["dev", "design", "marketing", "planning"]) {
      out.push(`${fam}-01a`, `${fam}-02b`, `${fam}-03a`);
    }
    return out.filter((id) => listCaseIds().includes(id));
  }
  if (filter === "@repro") {
    // 재현성: 직무군마다 partial_gap 1, cross 1 = 8
    const out: string[] = [];
    for (const fam of ["dev", "design", "marketing", "planning"]) out.push(`${fam}-01b`, `${fam}-03b`);
    return out.filter((id) => listCaseIds().includes(id));
  }
  return selectCases(filter);
}

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

async function main() {
  const mode = (arg("mode", "isolated") as "isolated" | "e2e");
  const configName = arg("config", "baseline")!;
  const models = CONFIGS[configName];
  if (!models) throw new Error(`없는 config: ${configName} (있는 것: ${Object.keys(CONFIGS).join(", ")})`);
  const reps = Number(arg("reps", "1"));
  const budget = Number(arg("budget", "5"));
  const cases = pickCases(arg("cases"));
  if (cases.length === 0) throw new Error("고른 케이스가 없습니다");
  const name = arg("name") ?? `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}-${mode}-${configName}`;
  const dir = join(EVAL, "runs", name);

  const est = await estimateRun(cases, mode, models, reps);
  console.log(`케이스 ${cases.length}개 × ${reps}회 · ${mode} · ${configName}`);
  console.log(`예상 비용 약 $${est.usd.toFixed(2)} (호출 ${est.calls}회, ${est.method})`);
  if (est.usd > budget) {
    console.log(`상한 $${budget} 를 넘어 시작하지 않습니다. --budget 으로 올리거나 케이스를 줄이세요.`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 가 없습니다(.env.eval.local)");
  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question("시작할까요? (y/N) ");
    rl.close();
    if (a.trim().toLowerCase() !== "y") process.exit(0);
  }

  await initModel();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ name, mode, config: configName, models, reps, cases, startedAt: new Date().toISOString() }, null, 2)
  );

  const jobs = cases.flatMap((id) => Array.from({ length: reps }, (_, r) => ({ id, rep: r + 1 })));
  let done = 0;
  const results = await pool(jobs, Number(arg("concurrency", "3")), async ({ id, rep }) => {
    const file = join(dir, `${id}.r${rep}.json`);
    // 이어서 돌릴 때 성공한 것은 건너뛰고 실패한 것만 다시 돕니다
    if (existsSync(file) && !process.argv.includes("--force")) {
      const prev = JSON.parse(readFileSync(file, "utf8")) as RunResult;
      if (!prev.error) {
        done++;
        return prev;
      }
    }
    const res: RunResult = await runCase(loadCase(id), rep, mode, models);
    writeFileSync(file, JSON.stringify(res, null, 2));
    done++;
    console.log(`[${done}/${jobs.length}] ${id} r${rep} ${res.error ? "실패: " + res.error : `${(res.wallMs / 1000).toFixed(1)}초`}`);
    return res;
  });
  const failed = results.filter((r) => r?.error).length;
  console.log(`\n끝: ${dir}${failed ? ` (실패 ${failed}건 — 같은 명령을 다시 실행하면 실패한 것만 다시 돕니다)` : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
