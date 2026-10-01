/**
 * 직무 전환 파이프라인을 운영과 같은 순서·같은 함수로 돌립니다.
 *
 * 프롬프트(prompts.ts), 응답 정리·검증(_shared/evidence.ts), 모델 호출과
 * 재시도(_shared/model.ts)는 운영 파일을 그대로 import 합니다. 이 파일에 있는
 * 것은 index.ts 의 Deno.serve 본문 중 "단계를 잇는 순서"뿐입니다(DB 읽기·저장·
 * 사용량 기록·한도 확인은 뺐습니다). index.ts 의 순서가 바뀌면 여기도 맞춰야
 * 합니다 — 그 동기화가 이 평가의 가장 약한 고리입니다.
 *
 * 운영과 다른 점은 두 가지이고, 둘 다 측정을 위한 것입니다.
 *  - 단계마다 시간·토큰을 따로 잽니다(운영은 합계만 남김).
 *  - 정리하기 전 모델의 원시 응답도 남깁니다(서버가 버린 가짜 근거 id 를 세기 위해).
 */
import type { Usage } from "../../supabase/functions/_shared/model.ts";
import {
  fillMissingFields,
  normalizeAnalysis,
  normalizeMatches,
  normalizeRewrite,
  verifyProject,
  type Analysis,
  type FieldSentences,
  type Flag,
  type Match,
} from "../../supabase/functions/_shared/evidence.ts";
import { analyzePrompt, matchPrompt, rewritePrompt } from "../../supabase/functions/job-switch/prompts.ts";
import type { StageModels } from "./config.ts";
import type { LoadedCase } from "./data.ts";

/** job-switch/index.ts 와 같은 값 */
const CALL_TIMEOUT_MS = 55_000;
const MAX_TOKENS = { s1: 3000, s2: 6000, s3: 8000 };

type CallModelJson = (
  model: string,
  prompt: string,
  maxTokens: number,
  opts: { stage: string; timeoutMs: number }
) => Promise<{ data: unknown; usage: Usage }>;

let callModelJson: CallModelJson | null = null;

/**
 * model.ts 는 Deno.env 로 키를 읽습니다. Node 에서 쓰려고 Deno.env 만
 * process.env 로 잇는 얇은 심을 둡니다. 모듈을 읽는 시점에 키를 읽으므로
 * import 전에 심을 깔아야 합니다.
 */
export async function initModel(fake?: CallModelJson) {
  if (fake) {
    // selftest 전용: 돈 들이지 않고 실행기·채점기 배선을 확인합니다
    callModelJson = fake;
    return;
  }
  const g = globalThis as unknown as { Deno?: unknown };
  if (!g.Deno) g.Deno = { env: { get: (k: string) => process.env[k] } };
  const mod = await import("../../supabase/functions/_shared/model.ts");
  callModelJson = mod.callModelJson as CallModelJson;
}

export interface StageRecord {
  model: string;
  ms: number;
  usage: Usage;
  raw: unknown;
}

export interface RunResult {
  case: string;
  rep: number;
  mode: "isolated" | "e2e";
  models: StageModels;
  analysis: Analysis | null;
  matches: Match[];
  rewrites: FieldSentences[];
  flags: Flag[];
  stages: {
    s1?: StageRecord;
    s2?: StageRecord;
    s3: (StageRecord & { project: number })[];
  };
  /** 3단계는 병렬이라 벽시계 시간이 합계보다 짧습니다 */
  wallMs: number;
  error?: string;
}

/** 격리 모드: 사람이 만든 정답 요구사항을 1단계 결과 자리에 넣습니다 */
export function goldAnalysis(c: LoadedCase): Analysis {
  return {
    role: c.label.target_job,
    requirements: c.label.requirements.map((r) => ({
      id: r.id,
      text: r.text,
      kind: r.kind,
      keywords: r.keywords ?? [],
      label: r.label,
      scope: r.scope,
    })),
    vocabulary: c.label.vocabulary ?? [],
    lead: c.label.lead,
    leadReason: "",
  };
}

async function timed(model: string, prompt: string, maxTokens: number, stage: string): Promise<StageRecord> {
  if (!callModelJson) throw new Error("initModel() 을 먼저 부르세요");
  const t = Date.now();
  const { data, usage } = await callModelJson(model, prompt, maxTokens, { stage, timeoutMs: CALL_TIMEOUT_MS });
  return { model, ms: Date.now() - t, usage, raw: data };
}

export async function runCase(
  c: LoadedCase,
  rep: number,
  mode: "isolated" | "e2e",
  models: StageModels
): Promise<RunResult> {
  const out: RunResult = {
    case: c.label.case,
    rep,
    mode,
    models,
    analysis: null,
    matches: [],
    rewrites: [],
    flags: [],
    stages: { s3: [] },
    wallMs: 0,
  };
  const started = Date.now();
  const projects = c.portfolio.projects;
  const evidence = c.evidence;
  const targetJob = c.label.target_job;

  try {
    // ── 1단계 ──
    let analysis: Analysis | null;
    if (mode === "e2e") {
      const s1 = await timed(models.s1, analyzePrompt(targetJob, c.jd), MAX_TOKENS.s1, "1단계 공고 분석");
      out.stages.s1 = s1;
      analysis = normalizeAnalysis(s1.raw, targetJob);
      if (!analysis) throw new Error("1단계: 요구사항을 찾지 못함");
    } else {
      analysis = goldAnalysis(c);
    }
    out.analysis = analysis;

    // ── 2단계 ──
    const s2 = await timed(models.s2, matchPrompt(analysis, evidence, projects), MAX_TOKENS.s2, "2단계 근거 매칭");
    out.stages.s2 = s2;
    const matches = normalizeMatches(
      s2.raw,
      analysis.requirements.filter((r) => r.scope !== "profile"),
      evidence
    );
    out.matches = matches;

    // ── 3단계 (프로젝트별 병렬) ──
    const reqIds = analysis.requirements.map((r) => r.id);
    out.rewrites = await Promise.all(
      projects.map(async (project, pi) => {
        const hasText = evidence.some((e) => e.projectIndex === pi);
        if (!hasText) return normalizeRewrite(null, pi, evidence, reqIds);
        const s3 = await timed(
          models.s3,
          rewritePrompt(targetJob, analysis!, matches, pi, project, evidence),
          MAX_TOKENS.s3,
          `3단계 재작성 · ${project.name || `프로젝트 ${pi + 1}`}`
        );
        out.stages.s3.push({ ...s3, project: pi });
        return fillMissingFields(normalizeRewrite(s3.raw, pi, evidence, reqIds), pi, evidence);
      })
    );

    // ── 4단계 ──
    out.flags = projects.flatMap((p, pi) => verifyProject(pi, p, out.rewrites[pi], evidence));
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  out.wallMs = Date.now() - started;
  return out;
}
