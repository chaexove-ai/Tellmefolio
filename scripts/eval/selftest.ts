/**
 * 실행기·채점기 자가 점검. 모델 대신 결과를 미리 아는 가짜 응답을 넣고,
 * 리포트 숫자가 손으로 계산한 값과 같은지 확인합니다. 비용 0.
 *
 *   npm run eval:selftest
 *
 * 가짜 모델의 행동 (케이스 3개, 각 1회)
 *  - 2단계: 정답 라벨대로 답하되, 함정 하나는 가짜 id 로 full(→ 서버가 none 으로 강등),
 *           다른 함정 하나는 진짜 id 로 full(→ 과대평가로 남음)
 *  - 3단계: 원문 문장을 그대로 돌려주고, 프로젝트 0 의 outcome 에 날조 문장 1개를 더함
 *           ("99%" + 그 케이스의 금지어 첫 번째)
 * 가짜 판정: "99%" 가 들어간 문장만 날조, 나머지는 인용 유효
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIGS } from "./config.ts";
import { EVAL, loadCase, type LoadedCase } from "./data.ts";
import type { JudgeOut } from "./judge.ts";
import { initModel, runCase } from "./pipeline.ts";
import { FIELDS } from "../../supabase/functions/_shared/evidence.ts";
import { execFileSync } from "node:child_process";

// 운영 model.ts 를 실제로 불러올 수 있는지 먼저 확인합니다. 아래 가짜 모델만 쓰면
// 이 파일을 한 번도 안 읽어서, Node 가 못 읽는 문법(parameter property)이 있어도
// 자가 점검이 통과해 버렸습니다(10-01 맥 첫 실행에서 발견).
{
  const g = globalThis as unknown as { Deno?: unknown };
  g.Deno ??= { env: { get: (k: string) => process.env[k] } };
  const m = await import("../../supabase/functions/_shared/model.ts");
  const ok = typeof m.callModelJson === "function" && new m.ModelError("x", 429).status === 429;
  console.log(`${ok ? "통과" : "실패"}  운영 model.ts 불러오기`);
  if (!ok) process.exit(1);
}

const CASES = ["dev-01b", "marketing-01b", "planning-03a"];
let current: LoadedCase;
const plan = new Map<string, { fakeFull: string; realFull: string }>();

await initModel(async (_model, prompt, _max, opts) => {
  const usage = { input_tokens: 1000, output_tokens: 500 };
  const L = current.label;
  if (opts.stage.startsWith("2단계")) {
    const traps = L.requirements.filter((q) => q.trap && q.trap !== "T6");
    const pl = { fakeFull: traps[0].id, realFull: traps[1].id };
    plan.set(L.case, pl);
    return {
      usage,
      data: {
        matches: L.requirements
          .filter((q) => q.scope === "project")
          .map((q) =>
            q.id === pl.fakeFull
              ? { requirementId: q.id, level: "full", evidenceIds: ["p9:outcome:0"], why: "" }
              : q.id === pl.realFull
              ? { requirementId: q.id, level: "full", evidenceIds: [current.evidence[0].id], why: "" }
              : { requirementId: q.id, level: q.level, evidenceIds: q.evidence, why: "" }
          ),
      },
    };
  }
  if (opts.stage.startsWith("3단계")) {
    const lines = [...prompt.matchAll(/^(p(\d+):(\w+):(\d+)): (.*)$/gm)];
    const pi = Number(lines[0][2]);
    const fields: Record<string, unknown[]> = Object.fromEntries(FIELDS.map((f) => [f, []]));
    for (const m of lines) fields[m[3]].push({ text: m[5], evidence: [m[1]], requirements: [] });
    if (pi === 0) {
      fields.outcome.push({
        text: `전환율을 99% 개선했고 ${L.must_not_appear[0]} 경험을 쌓았습니다.`,
        evidence: [`p0:outcome:0`],
        requirements: [plan.get(L.case)!.realFull],
      });
    }
    return { usage, data: { fields } };
  }
  throw new Error("selftest 는 격리 모드만");
});

const name = "_selftest";
const dir = join(EVAL, "runs", name);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, "judge"), { recursive: true });
writeFileSync(join(dir, "manifest.json"), JSON.stringify({ name, mode: "isolated", config: "baseline", models: CONFIGS.baseline, reps: 1, cases: CASES }));

const expect = { sentences: 0, fabricated: 0, projectReqs: 0, traps: 0 };
for (const id of CASES) {
  current = loadCase(id);
  const r = await runCase(current, 1, "isolated", CONFIGS.baseline);
  if (r.error) throw new Error(r.error);
  writeFileSync(join(dir, `${id}.r1.json`), JSON.stringify(r));
  const j: JudgeOut = { judgeModel: "fake", j1: [], j2: [], j3: [] };
  r.rewrites.forEach((rw, pi) =>
    FIELDS.forEach((f) =>
      rw[f].forEach((s, si) => {
        const fab = s.text.includes("99%");
        j.j1.push({ key: `p${pi}:${f}:${si}`, project: pi, field: f, index: si, fabricated: fab, category: fab ? "number" : "none", span: fab ? "99%" : "", citation: fab ? "no" : "yes", reason: "" });
        expect.sentences++;
        if (fab) expect.fabricated++;
      })
    )
  );
  writeFileSync(join(dir, "judge", `${id}.r1.json`), JSON.stringify(j));
  expect.projectReqs += current.label.requirements.filter((q) => q.scope === "project").length;
  expect.traps += current.label.requirements.filter((q) => q.trap && q.trap !== "T6").length;
}

execFileSync("node", ["--experimental-transform-types", "--no-warnings", "scripts/eval/score.ts", `--run=${name}`], { stdio: "ignore" });
const s = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));

const checks: [string, unknown, unknown][] = [
  ["문장 수", s.n.sentences, expect.sentences],
  ["날조율(LLM)", s.fabrication.judge, expect.fabricated / expect.sentences],
  ["운영 검증기 재현율 (99% 는 원문에 없으니 전부 경고)", s.serverRecall, 1],
  ["비교 요구사항 수", s.n.reqs, expect.projectReqs],
  // 케이스마다 함정 2개를 틀리게 답했지만 가짜 id 쪽은 서버가 none 으로 내림 → 케이스당 1개만 실패
  ["함정 통과율", s.trapPass, (expect.traps - CASES.length) / expect.traps],
  ["모델 스스로 none", s.trapPassByModel, (expect.traps - 2 * CASES.length) / expect.traps],
  ["가짜 id 비율 > 0", s.fakeIdRate > 0, true],
  ["함정 유출 = 케이스당 1", s.trapLeak, CASES.length / expect.traps],
  ["금지어 등장 문장 = 날조 문장 수", Math.round(s.fabrication.forbidden * s.n.sentences), expect.fabricated],
];
let ok = true;
for (const [what, got, want] of checks) {
  const pass = typeof want === "number" ? Math.abs((got as number) - want) < 1e-9 : got === want;
  ok &&= pass;
  console.log(`${pass ? "통과" : "실패"}  ${what}: ${got} (기대 ${want})`);
}
rmSync(dir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
