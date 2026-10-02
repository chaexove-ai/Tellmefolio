/**
 * LLM 판정. 평가 대상(Claude)과 다른 계열 모델(기본 gemini-3.8-flash)이 채점합니다.
 * [10-01] gemini-2.5-flash 는 신규 사용자에게 404("no longer available")라 바꿨습니다.
 * 같은 계열이 자기 글을 채점하면 너그러워질 수 있어서입니다.
 *
 *   npm run eval:judge -- --run=<eval/runs 아래 이름>
 *   npm run eval:judge -- --list-models        # 이 키로 쓸 수 있는 Gemini 모델 목록
 *
 * [서버 과부하 대응 — 10-01 맥 실행에서 3.8 Flash 가 503 을 연달아 냄]
 *  - 판정 호출마다 결과를 judge/.cache 에 저장합니다. 다시 돌리면 성공한 호출은
 *    건너뛰고 실패한 것만 다시 부릅니다(케이스 하나가 실패해도 앞 호출을 버리지 않음).
 *  - 503·시간 초과는 20→40→80→120초로 늘려 가며 재시도합니다.
 *  - JUDGE_FALLBACK_MODELS=모델1,모델2 를 주면 앞 모델이 끝내 실패할 때 다음 모델로
 *    넘어갑니다. 어느 모델이 판정했는지 항목마다 기록하고 리포트에 적습니다.
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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIELDS } from "../../supabase/functions/_shared/evidence.ts";
import { loadEnv } from "./config.ts";
import { arg, EVAL, loadCase } from "./data.ts";
import type { RunResult } from "./pipeline.ts";

loadEnv();
const KEY = process.env.GEMINI_API_KEY;
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gemini-3.8-flash";
const MODELS = [JUDGE_MODEL, ...(process.env.JUDGE_FALLBACK_MODELS ?? "").split(",").map((x) => x.trim()).filter(Boolean)];
const MIN_INTERVAL_MS = Number(process.env.JUDGE_INTERVAL_MS ?? 4000); // 무료 등급 분당 한도 여유
const CALL_TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS ?? 90_000);
const TRIES_PER_MODEL = 5;
/** J1 한 번에 보낼 문장 수 */
const BATCH = Math.max(1, Number(process.env.JUDGE_BATCH ?? 4));
const BACKOFF_S = (process.env.JUDGE_BACKOFF_S ?? "20,40,80,120,120").split(",").map(Number);

/** main 이 정합니다. 없으면(테스트) 캐시 없이 동작 */
let CACHE_DIR: string | null = null;

/** 하루 한도에 걸린 모델. 이 실행 동안 다시 부르지 않습니다 */
const exhausted = new Set<string>();

export class QuotaExhausted extends Error {}

let last = 0;
let callNo = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 판정 호출 하나. 무엇을 기다리는지 늘 출력합니다(조용히 멈춘 것처럼 보이지 않게).
 * 같은 프롬프트의 성공 결과가 캐시에 있으면 부르지 않습니다.
 */
async function gemini(prompt: string, label: string): Promise<{ data: unknown; model: string }> {
  if (!KEY) throw new Error("GEMINI_API_KEY 가 없습니다(.env.eval.local)");
  const no = ++callNo;
  const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const cached = CACHE_DIR ? join(CACHE_DIR, `${hash}.json`) : null;
  if (cached && existsSync(cached)) {
    console.log(`  · 판정 #${no} ${label} … 저장된 결과 사용`);
    return JSON.parse(readFileSync(cached, "utf8"));
  }

  for (const model of MODELS) {
    if (exhausted.has(model)) continue;
    for (let attempt = 1; attempt <= TRIES_PER_MODEL; attempt++) {
      const wait = last + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const t = Date.now();
      const tag = `${MODELS.length > 1 ? `[${model}] ` : ""}${attempt > 1 ? `(재시도 ${attempt - 1}) ` : ""}`;
      process.stdout.write(`  · 판정 #${no} ${label} ${tag}… `);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
      let res: Response | null = null;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", "x-goog-api-key": KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        });
      } catch {
        res = null;
      } finally {
        clearTimeout(timer);
      }
      const sec = ((Date.now() - t) / 1000).toFixed(1);
      const backoff = BACKOFF_S[attempt - 1] * 1000;
      const last_ = attempt === TRIES_PER_MODEL;

      if (!res) {
        console.log(`${sec}초 · 시간 초과${last_ ? "" : ` → ${backoff / 1000}초 뒤 재시도`}`);
        if (!last_) await sleep(backoff);
        continue;
      }
      if (res.status === 429) {
        const body = await res.text();
        // 어떤 한도인지는 quotaId 로만 판단합니다. 예전에는 본문 전체에서 "day" 를 찾았는데,
        // 설명 문구나 링크에 섞인 단어로 분당 한도를 하루 한도로 오판할 수 있었습니다(10-02).
        const quotaIds = [...body.matchAll(/"quotaId":\s*"([^"]+)"/g)].map((m) => m[1]);
        const quotaValue = body.match(/"quotaValue":\s*"?(\d+)/)?.[1];
        const why = quotaIds.length ? ` [${quotaIds.join(", ")}${quotaValue ? ` 한도 ${quotaValue}` : ""}]` : "";
        if (quotaIds.some((q) => /PerDay/i.test(q))) {
          console.log(`${sec}초 · 하루 한도 초과${why} → 이 모델은 오늘 더 쓰지 않음`);
          if (quotaIds.some((q) => /FreeTier/i.test(q))) {
            console.log("    이 키는 무료 등급으로 처리되고 있습니다. 결제를 붙인 프로젝트의 키인지 AI Studio 에서 확인하세요.");
          }
          exhausted.add(model);
          break;
        }
        const hint = body.match(/"retryDelay":\s*"(\d+)s"/);
        const delay = (hint ? Number(hint[1]) : 30) * 1000;
        console.log(`${sec}초 · 429 요청 한도 초과${why} → ${delay / 1000}초 뒤 재시도`);
        await sleep(delay);
        continue;
      }
      if (res.status >= 500) {
        const body = await res.text();
        const msg = (body.match(/"message":\s*"([^"]{0,160})/)?.[1] ?? "").trim();
        console.log(`${sec}초 · ${res.status} 서버 과부하${msg ? ` (${msg})` : ""}${last_ ? "" : ` → ${backoff / 1000}초 뒤 재시도`}`);
        if (!last_) await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        console.log(`${sec}초 · 오류 ${res.status}`);
        const body = await res.text();
        if (res.status === 404) {
          console.log(`    모델 ${model} 을 쓸 수 없습니다 → npm run eval:judge -- --list-models`);
          break;
        }
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }
      const body = await res.json();
      const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      try {
        const out = { data: JSON.parse(text), model };
        console.log(`${sec}초`);
        if (cached) {
          mkdirSync(CACHE_DIR!, { recursive: true });
          writeFileSync(cached, JSON.stringify(out));
        }
        return out;
      } catch {
        console.log(`${sec}초 · JSON 해석 실패`);
      }
    }
    if (MODELS.indexOf(model) < MODELS.length - 1) console.log(`  · ${model} 포기 → 다음 판정 모델로`);
  }
  if (MODELS.every((m) => exhausted.has(m))) {
    throw new QuotaExhausted("모든 판정 모델이 하루 한도에 걸렸습니다");
  }
  throw new Error(`판정 #${no} 실패 — 모든 판정 모델이 응답하지 않음. 잠시 뒤 같은 명령을 다시 실행하면 성공한 호출은 건너뜁니다`);
}

async function listModels() {
  if (!KEY) throw new Error("GEMINI_API_KEY 가 없습니다(.env.eval.local)");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": KEY } });
  if (!res.ok) throw new Error(`목록 조회 실패 ${res.status}`);
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const names = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /gemini/i.test(n));
  console.log(names.join("\n"));
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

export async function judgeRun(r: RunResult): Promise<JudgeOut> {
  const c = loadCase(r.case);
  const textById = new Map(c.evidence.map((e) => [e.id, e.text]));
  const out: JudgeOut = { judgeModel: JUDGE_MODEL, j1: [], j2: [], j3: [] };
  const used = new Set<string>();

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
    // 한 번에 BATCH 문장씩. 무료 등급이 긴 요청(생각이 오래 걸리는 요청)을 503 으로
    // 거절해서 나눴습니다(10-01: 짧은 요청은 200, 12문장 판정은 503 반복).
    const byKey = new Map<string, Record<string, unknown>>();
    for (let b = 0; b < items.length; b += BATCH) {
      const chunk = items.slice(b, b + BATCH);
      const g1 = await gemini(
        j1Prompt(source, chunk),
        `${r.case} 재작성 p${pi} ${b + 1}~${b + chunk.length}/${items.length}문장`
      );
      used.add(g1.model);
      const res = g1.data as { items?: Record<string, unknown>[] };
      for (const x of res.items ?? []) byKey.set(String(x.key), x);
    }
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
    for (let b = 0; b < items.length; b += BATCH * 2) {
      const chunk = items.slice(b, b + BATCH * 2);
      const g2 = await gemini(`${RUBRIC_J2}\n\n${JSON.stringify(chunk, null, 1)}`, `${r.case} 매칭 근거 ${b + 1}~${b + chunk.length}/${items.length}개`);
      used.add(g2.model);
      const res = g2.data as { items?: Record<string, unknown>[] };
      out.j2.push(...(res.items ?? []).map((x) => ({ requirementId: String(x.requirementId), support: String(x.support), reason: String(x.reason ?? "") })));
    }
  }

  // J3 — E2E 만
  if (r.mode === "e2e" && r.analysis) {
    const A = c.label.requirements.map((q) => `${q.id}: ${q.text}`).join("\n");
    const B = r.analysis.requirements.map((q) => `${q.id}: ${q.text}`).join("\n");
    const g3 = await gemini(`${RUBRIC_J3}\n\n## A (정답)\n${A}\n\n## B (AI)\n${B}`, `${r.case} 요구사항 대응`);
    used.add(g3.model);
    const res = g3.data as { items?: Record<string, unknown>[] };
    out.j3 = (res.items ?? []).map((x) => ({ modelId: String(x.modelId), goldId: x.goldId ? String(x.goldId) : null }));
  }
  // 대체 모델로 넘어간 호출이 있으면 여기에 함께 남습니다(리포트에 그대로 표시)
  if (used.size) out.judgeModel = [...used].join(" + ");
  return out;
}

async function main() {
  if (process.argv.includes("--list-models")) return listModels();
  const name = arg("run");
  if (!name) throw new Error("--run=<이름> 이 필요합니다");
  const dir = join(EVAL, "runs", name);
  if (!existsSync(join(dir, "manifest.json"))) {
    throw new Error(`실행 결과가 없습니다: eval/runs/${name} — 먼저 npm run eval -- --name=${name} ... 로 실행하세요`);
  }
  if (!KEY) throw new Error("GEMINI_API_KEY 가 없습니다(.env.eval.local)");
  const jdir = join(dir, "judge");
  mkdirSync(jdir, { recursive: true });
  CACHE_DIR = join(jdir, ".cache");
  const files = readdirSync(dir).filter((f) => /\.r\d+\.json$/.test(f));
  let i = 0;
  for (const f of files) {
    i++;
    const target = join(jdir, f);
    if (existsSync(target) && !process.argv.includes("--force")) continue;
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as RunResult;
    if (r.error) continue;
    console.log(`[${i}/${files.length}] ${f} 판정 시작 (모델 ${MODELS.join(" → ")})`);
    try {
      writeFileSync(target, JSON.stringify(await judgeRun(r), null, 2));
      console.log(`[${i}/${files.length}] ${f} 완료`);
    } catch (e) {
      if (e instanceof QuotaExhausted) {
        // 남은 케이스도 전부 같은 이유로 실패하므로 여기서 멈춥니다(10-01: 24케이스를 다 돌며 같은 실패 반복)
        const done = files.filter((x) => existsSync(join(jdir, x))).length;
        console.log(`\n멈춤: ${e.message}. 판정 완료 ${done}/${files.length} 케이스, 성공한 호출은 저장돼 있습니다.`);
        console.log("무료 등급은 보통 한국 시간 오후 4~5시에 초기화됩니다. 결제를 연결했다면 바로 다시 실행하세요.");
        process.exit(2);
      }
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
