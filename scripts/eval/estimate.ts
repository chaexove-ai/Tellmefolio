/**
 * 예상 비용. 실제 프롬프트를 만들어 길이를 재고 단가를 곱합니다. 모델은 부르지 않습니다.
 *
 * 입력 토큰: ANTHROPIC_API_KEY 가 있으면 공식 count_tokens 로 정확히 셉니다(무료).
 *            없으면 한국어 기준 1.4자 ≈ 1토큰으로 어림합니다.
 * 출력 토큰: 실행 전에는 알 수 없어서 아래 가정으로 어림합니다.
 *   1단계  900
 *   2단계  요구사항당 160 + 100
 *   3단계  그 프로젝트 원문 글자 수 × 3.9 (근거 id·요구사항 id·JSON 껍데기 포함)
 *   [10-01 보정] 첫 실측(dev-01a, n=1)에서 2단계 1,704 / 3단계 3,379 토큰이 나와
 *   처음 가정(요구사항당 120, 원문 토큰의 1.8배)을 올렸습니다. 3단계는 처음 가정의
 *   약 3배였습니다 — 재작성 문장마다 근거·요구사항 id 를 다는 JSON 이 원문보다 깁니다.
 * 재시도(JSON 해석 실패)로 10% 더 든다고 봅니다.
 *
 *   npm run eval:estimate                 # 계획 전체(아래 PLAN)
 *   npm run eval:estimate -- --mode=e2e --config=baseline --cases=dev --reps=3
 */
import { CONFIGS, cost, loadEnv, PRICES, type StageModels } from "./config.ts";
import { arg, loadCase, selectCases, type LoadedCase } from "./data.ts";
import { goldAnalysis } from "./pipeline.ts";
import { analyzePrompt, matchPrompt, rewritePrompt } from "../../supabase/functions/job-switch/prompts.ts";
import type { Match } from "../../supabase/functions/_shared/evidence.ts";

const RETRY = 1.1;
const CHARS_PER_TOKEN = 1.4;

let exactWarned = false;
async function countTokens(model: string, text: string): Promise<{ n: number; exact: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: text }] }),
      });
      if (res.ok) return { n: (await res.json()).input_tokens, exact: true };
    } catch {
      /* 어림으로 */
    }
    if (!exactWarned) {
      exactWarned = true;
      console.error("count_tokens 실패 — 글자 수로 어림합니다");
    }
  }
  return { n: Math.ceil(text.length / CHARS_PER_TOKEN), exact: false };
}

/** 정답 라벨로 2단계 결과를 흉내 냅니다(3단계 프롬프트 길이를 재기 위해) */
function goldMatches(c: LoadedCase): Match[] {
  return c.label.requirements
    .filter((r) => r.scope !== "profile")
    .map((r) => ({ requirementId: r.id, level: r.level ?? "none", evidenceIds: r.evidence ?? [], why: "" }));
}

interface Est {
  usd: number;
  calls: number;
  method: string;
  byStage: Record<string, number>;
}

const cache = new Map<string, { n: number; exact: boolean }>();

export async function estimateRun(
  caseIds: string[],
  mode: "isolated" | "e2e",
  models: StageModels,
  reps: number,
  only?: "s1"
): Promise<Est> {
  loadEnv();
  let usd = 0;
  let calls = 0;
  let exact = true;
  const byStage: Record<string, number> = { s1: 0, s2: 0, s3: 0 };
  const tok = async (model: string, text: string) => {
    const k = model + "\u0000" + text;
    const r = cache.get(k) ?? (await countTokens(model, text));
    cache.set(k, r);
    exact &&= r.exact;
    return r.n;
  };

  for (const id of caseIds) {
    const c = loadCase(id);
    const analysis = goldAnalysis(c);
    const add = (stage: string, model: string, inT: number, outT: number) => {
      const u = cost(model, inT * RETRY, outT * RETRY) * reps;
      usd += u;
      byStage[stage] += u;
      calls += reps;
    };
    if (mode === "e2e") {
      add("s1", models.s1, await tok(models.s1, analyzePrompt(c.label.target_job, c.jd)), 900);
    }
    if (only === "s1") continue;
    const reqN = analysis.requirements.filter((r) => r.scope !== "profile").length;
    add("s2", models.s2, await tok(models.s2, matchPrompt(analysis, c.evidence, c.portfolio.projects)), reqN * 160 + 100);
    const matches = goldMatches(c);
    for (let pi = 0; pi < c.portfolio.projects.length; pi++) {
      const own = c.evidence.filter((e) => e.projectIndex === pi).map((e) => e.text).join("\n");
      if (!own) continue;
      const p = rewritePrompt(c.label.target_job, analysis, matches, pi, c.portfolio.projects[pi], c.evidence);
      add("s3", models.s3, await tok(models.s3, p), Math.ceil(own.length * 3.9));
    }
  }
  return { usd, calls, byStage, method: exact ? "입력 토큰 실측(count_tokens)" : "입력 토큰 글자 수 어림" };
}

/** 2~4단계 전체 계획. 이 표가 "전체를 돌리기 전 예상 비용"입니다 */
const ALL = () => selectCases(undefined);
const HALF = () => ["dev", "design", "marketing", "planning"].flatMap((f) => [`${f}-01a`, `${f}-02b`, `${f}-03a`]);
const REPRO = () => ["dev", "design", "marketing", "planning"].flatMap((f) => [`${f}-01b`, `${f}-03b`]);

const PLAN: { step: string; what: string; cases: () => string[]; mode: "isolated" | "e2e"; config: string; reps: number; only?: "s1" }[] = [
  { step: "2단계", what: "기준선 · 격리", cases: ALL, mode: "isolated", config: "baseline", reps: 1 },
  { step: "2단계", what: "기준선 · E2E", cases: ALL, mode: "e2e", config: "baseline", reps: 1 },
  { step: "2단계", what: "재현성 추가 2회 · E2E", cases: REPRO, mode: "e2e", config: "baseline", reps: 2 },
  { step: "3단계", what: "2단계만 Haiku · 격리", cases: HALF, mode: "isolated", config: "s2-haiku", reps: 1 },
  { step: "3단계", what: "3단계만 Haiku · 격리", cases: HALF, mode: "isolated", config: "s3-haiku", reps: 1 },
  { step: "3단계", what: "1단계만 Sonnet · 1단계만 실행", cases: HALF, mode: "e2e", config: "s1-sonnet", reps: 1, only: "s1" },
  { step: "4단계", what: "개선 후 재측정 · 격리", cases: ALL, mode: "isolated", config: "baseline", reps: 1 },
];

async function main() {
  loadEnv();
  if (arg("mode") || arg("config") || arg("cases")) {
    const models = CONFIGS[arg("config", "baseline")!];
    const ids = selectCases(arg("cases"));
    const e = await estimateRun(ids, arg("mode", "isolated") as "isolated" | "e2e", models, Number(arg("reps", "1")));
    console.log(`케이스 ${ids.length} · 호출 ${e.calls} · 약 $${e.usd.toFixed(2)} (${e.method})`);
    return;
  }
  console.log("| 단계 | 실행 | 케이스 × 회 | 호출 | 일반 호출 | Batch(50%) |");
  console.log("|---|---|---|---|---|---|");
  let total = 0;
  let method = "";
  for (const p of PLAN) {
    const ids = p.cases();
    const e = await estimateRun(ids, p.mode, CONFIGS[p.config], p.reps, p.only);
    method = e.method;
    total += e.usd;
    console.log(`| ${p.step} | ${p.what} | ${ids.length} × ${p.reps} | ${e.calls} | $${e.usd.toFixed(2)} | $${(e.usd / 2).toFixed(2)} |`);
  }
  console.log(`| | **합계** | | | **$${total.toFixed(2)}** | **$${(total / 2).toFixed(2)}** |`);
  console.log(`\n${method}. 출력 토큰은 가정값, 재시도 10% 포함.`);
  const unverified = Object.entries(PRICES).filter(([, p]) => !p.verified).map(([m]) => m);
  if (unverified.length) console.log(`단가 미확인(가정): ${unverified.join(", ")} — config.ts`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
