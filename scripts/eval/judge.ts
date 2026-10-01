/**
 * LLM 판정. 평가 대상(Claude)과 다른 계열 모델(기본 Gemini Flash)이 채점합니다.
 * 같은 계열이 자기 글을 채점하면 너그러워질 수 있어서입니다.
 *
 *   npm run eval:judge -- --run=<eval/runs 아래 이름>
 *
 * 판정은 세 가지입니다.
 *   J1 재작성 문장: 원문에 없는 사실(날조)이 있는가 + 인용한 근거가 그 문장을 뒷받침하는가
 *   J2 매칭: full/partial 로 단 근거가 그 요구사항을 실제로 뒷받침하는가
 *   J3 (E2E 만) 모델이 뽑은 요구사항 ↔ 정답 요구사항 대응
 *
 * [데이터] Gemini 무료 등급은 입력을 Google 이 모델 개선에 쓸 수 있습니다.
 * 그래서 가상 샘플만 보냅니다 — eval/private/ 의 케이스는 판정하지 않습니다.
 *
 * 판정기 자체의 정확도는 사람 검수 표본(eval:sample)으로 따로 잽니다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIELDS } from "../../supabase/functions/_shared/evidence.ts";
import { loadEnv } from "./config.ts";
import { arg, EVAL, loadCase } from "./data.ts";
import type { RunResult } from "./pipeline.ts";

loadEnv();
const KEY = process.env.GEMINI_API_KEY;
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gemini-2.5-flash";
const MIN_INTERVAL_MS = Number(process.env.JUDGE_INTERVAL_MS ?? 4500); // 무료 등급 분당 한도 여유

let last = 0;
async function gemini(prompt: string): Promise<unknown> {
  if (!KEY) throw new Error("GEMINI_API_KEY 가 없습니다(.env.eval.local)");
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      }
    );
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    try {
      return JSON.parse(text);
    } catch {
      continue; // 한 번 더
    }
  }
  throw new Error("Gemini 판정 실패(재시도 초과)");
}

/* ------------------------------------------------------------------ */
/* 판정 프롬프트                                                        */
/* ------------------------------------------------------------------ */

export const RUBRIC_J1 = [
  "당신은 채용 서류 검수자입니다. 지원자의 원문 프로젝트 설명과, AI 가 채용 공고에 맞춰 다시 쓴 문장들이 있습니다.",
  "다시 쓴 문장마다 두 가지를 판정하세요.",
  "",
  "1) fabricated: 원문 전체 어디에도 없는 사실이 들어갔는가.",
  "   - 날조로 보는 것: 원문에 없는 숫자·규모, 원문에 없는 도구·기술명, 원문에 없는 업계·도메인 경험,",
  "     원문보다 부풀린 역할(팀원 → 리드/총괄/주도), 원문에 없는 성과나 행동, 원문에 없는 방법론(예: 원문은 '두 시안 비교'인데 'A/B 테스트')",
  "   - 날조가 아닌 것: 같은 사실을 다른 말로 바꾼 것, 원문 두 문장을 합친 것, 직무 용어로 옮긴 것(사실 범위 안에서)",
  "   - 애매하면 fabricated=true 로 두고 reason 에 이유를 쓰세요. 지원자가 면접에서 해명할 수 없는 문장은 날조입니다.",
  "   - category: number | tool | domain | role | method | outcome | other (날조가 아니면 none)",
  "   - span: 날조된 부분을 문장에서 그대로 옮겨 적기(없으면 빈 문자열)",
  "2) citation: 이 문장이 인용한 원문 문장들(cited)이 문장 내용을 뒷받침하는가.",
  "   - yes: 문장의 주요 내용이 인용 문장에 있음 / partial: 일부만 / no: 관련 없음 / none: 인용이 없음",
  "",
  "출력은 JSON 만:",
  '{ "items": [{ "key": "<입력의 key 그대로>", "fabricated": false, "category": "none", "span": "", "citation": "yes", "reason": "한 문장" }] }',
].join("\n");

function j1Prompt(source: string, items: { key: string; field: string; text: string; cited: string[] }[]) {
  return [
    RUBRIC_J1,
    "",
    "## 원문 프로젝트 (id: 문장)",
    source,
    "",
    "## 다시 쓴 문장",
    JSON.stringify(items, null, 1),
  ].join("\n");
}

export const RUBRIC_J2 = [
  "채용 공고 요구사항과, AI 가 그 요구사항의 근거로 고른 지원자 원문 문장들이 있습니다.",
  "근거 문장들이 요구사항을 실제로 뒷받침하는지 판정하세요.",
  "- yes: 요구사항이 묻는 경험을 직접 보여 줌 / weak: 관련은 있으나 약하거나 일부 / no: 비슷한 단어만 있고 실제로는 다른 경험",
  "- 스택·도구 이름만 같은 것은 no 입니다. 요구사항이 특정 방법(예: A/B 테스트, 정량 분석)을 요구하면 그 방법이 원문에 있어야 yes.",
  "",
  "출력은 JSON 만:",
  '{ "items": [{ "requirementId": "r1", "support": "yes", "reason": "한 문장" }] }',
].join("\n");

export const RUBRIC_J3 = [
  "같은 채용 공고를 두 사람이 요구사항 목록으로 정리했습니다. A(정답)와 B(AI)의 항목을 대응시키세요.",
  "- B 의 각 항목에 대해, 같은 요구사항을 가리키는 A 의 id 를 matches 에 적습니다(없으면 null).",
  "- 하나의 B 항목이 A 여러 개를 합친 것이면 가장 가까운 하나만 적습니다.",
  "",
  "출력은 JSON 만:",
  '{ "items": [{ "modelId": "r1", "goldId": "r3" }] }',
].join("\n");

/* ------------------------------------------------------------------ */

export interface JudgeOut {
  judgeModel: string;
  j1: { key: string; project: number; field: string; index: number; fabricated: boolean; category: string; span: string; citation: string; reason: string }[];
  j2: { requirementId: string; support: string; reason: string }[];
  j3: { modelId: string; goldId: string | null }[];
}

async function judgeRun(r: RunResult): Promise<JudgeOut> {
  const c = loadCase(r.case);
  const textById = new Map(c.evidence.map((e) => [e.id, e.text]));
  const out: JudgeOut = { judgeModel: JUDGE_MODEL, j1: [], j2: [], j3: [] };

  // J1 — 프로젝트마다 한 번
  for (let pi = 0; pi < r.rewrites.length; pi++) {
    const rw = r.rewrites[pi];
    const items = FIELDS.flatMap((f) =>
      rw[f].map((s, si) => ({ key: `p${pi}:${f}:${si}`, field: f, text: s.text, cited: s.evidence.map((id) => `${id}: ${textById.get(id) ?? ""}`) }))
    );
    if (items.length === 0) continue;
    const p = c.portfolio.projects[pi];
    const source = [
      `이름: ${p.name}`,
      `스택: ${p.stack.join(", ")}`,
      ...c.evidence.filter((e) => e.projectIndex === pi).map((e) => `${e.id}: ${e.text}`),
    ].join("\n");
    const res = (await gemini(j1Prompt(source, items))) as { items?: Record<string, unknown>[] };
    const byKey = new Map((res.items ?? []).map((x) => [String(x.key), x]));
    for (const it of items) {
      const x = byKey.get(it.key) ?? {};
      const [, field, idx] = it.key.split(":");
      out.j1.push({
        key: it.key,
        project: pi,
        field,
        index: Number(idx),
        fabricated: x.fabricated === true,
        category: String(x.category ?? "none"),
        span: String(x.span ?? ""),
        citation: String(x.citation ?? (it.cited.length ? "unknown" : "none")),
        reason: String(x.reason ?? (byKey.has(it.key) ? "" : "판정 누락")),
      });
    }
  }

  // J2 — 근거를 단 매칭만
  const withEv = r.matches.filter((m) => m.level !== "none");
  if (withEv.length && r.analysis) {
    const items = withEv.map((m) => ({
      requirementId: m.requirementId,
      requirement: r.analysis!.requirements.find((q) => q.id === m.requirementId)?.text ?? "",
      level: m.level,
      evidence: m.evidenceIds.map((id) => textById.get(id) ?? ""),
    }));
    const res = (await gemini(`${RUBRIC_J2}\n\n${JSON.stringify(items, null, 1)}`)) as { items?: Record<string, unknown>[] };
    out.j2 = (res.items ?? []).map((x) => ({ requirementId: String(x.requirementId), support: String(x.support), reason: String(x.reason ?? "") }));
  }

  // J3 — E2E 만
  if (r.mode === "e2e" && r.analysis) {
    const A = c.label.requirements.map((q) => `${q.id}: ${q.text}`).join("\n");
    const B = r.analysis.requirements.map((q) => `${q.id}: ${q.text}`).join("\n");
    const res = (await gemini(`${RUBRIC_J3}\n\n## A (정답)\n${A}\n\n## B (AI)\n${B}`)) as { items?: Record<string, unknown>[] };
    out.j3 = (res.items ?? []).map((x) => ({ modelId: String(x.modelId), goldId: x.goldId ? String(x.goldId) : null }));
  }
  return out;
}

async function main() {
  const name = arg("run");
  if (!name) throw new Error("--run=<이름> 이 필요합니다");
  const dir = join(EVAL, "runs", name);
  if (!existsSync(join(dir, "manifest.json"))) {
    throw new Error(`실행 결과가 없습니다: eval/runs/${name} — 먼저 npm run eval -- --name=${name} ... 로 실행하세요`);
  }
  if (!KEY) throw new Error("GEMINI_API_KEY 가 없습니다(.env.eval.local)");
  const jdir = join(dir, "judge");
  mkdirSync(jdir, { recursive: true });
  const files = readdirSync(dir).filter((f) => /\.r\d+\.json$/.test(f));
  let i = 0;
  for (const f of files) {
    i++;
    const target = join(jdir, f);
    if (existsSync(target) && !process.argv.includes("--force")) continue;
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as RunResult;
    if (r.error) continue;
    try {
      writeFileSync(target, JSON.stringify(await judgeRun(r), null, 2));
      console.log(`[${i}/${files.length}] ${f}`);
    } catch (e) {
      console.log(`[${i}/${files.length}] ${f} 실패: ${(e as Error).message}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
