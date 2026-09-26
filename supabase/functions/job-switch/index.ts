/**
 * 직무 전환 재구성 Edge Function. 설계는 docs/job-switch-design.md.
 *
 * 한 번의 프롬프트로 "새로 써줘"를 하지 않습니다. 그건 사용자가 ChatGPT 에
 * 붙여넣어도 되는 일입니다. 이 함수가 파는 것은 "안심하고 제출할 수 있는
 * 문서"라서, 네 단계로 나누고 날조를 서버가 기계적으로 막습니다.
 *
 *   0. 근거 쪼개기     서버. 원본 6필드를 문장 단위로 자르고 id 를 붙임
 *   1. 공고 해부       LLM(가벼운 모델). 요구사항·어휘·맨 앞에 둘 필드
 *   2. 근거 매칭       LLM(상위 모델). 요구사항마다 근거 id — 없는 id 는 서버가 버림
 *   3. 재작성          LLM(상위 모델, 프로젝트별 병렬). 문장마다 근거 id
 *   4. 검증            서버. 원문에 없는 숫자·영문 용어, 근거 없는 문장
 *
 * [원본은 서버가 직접 읽습니다]
 * 클라이언트가 보낸 포트폴리오 내용을 믿지 않습니다. 포트폴리오 id 만 받고,
 * 요청자의 JWT 로 DB 에서 읽습니다. 그리고 **본인 것인지 한 번 더 봅니다** —
 * RLS 는 공개된 남의 포트폴리오도 읽게 해주기 때문에, 그것만 믿으면 남의
 * 공개 포트폴리오를 원본으로 재구성할 수 있습니다.
 *
 * [모델]
 * 2·3단계는 체급을 탑니다(근거 추적과 날조 억제가 작은 모델에서 먼저
 * 무너집니다). 그래서 모델을 둘로 나눴고, 둘 다 시크릿으로 바꿀 수 있습니다.
 *   JOB_SWITCH_LIGHT_MODEL   1단계. 없으면 MODEL, 그것도 없으면 Haiku
 *   JOB_SWITCH_STRONG_MODEL  2·3단계. 없으면 Sonnet
 *
 * [시간]
 * Edge Function 은 첫 응답까지 150초입니다. 3단계를 프로젝트별로 병렬
 * 호출해서 프로젝트 수와 무관하게 한 번의 호출 시간에 끝나게 합니다.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { QuotaError, assertQuota } from "../_shared/usage.ts";
import {
  buildEvidence,
  fillMissingFields,
  joinField,
  normalizeAnalysis,
  normalizeMatches,
  normalizeRewrite,
  parseJson,
  verifyProject,
  FIELDS,
  type Analysis,
  type Evidence,
  type FieldSentences,
  type Match,
  type SourceProject,
} from "../_shared/evidence.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LIGHT_MODEL =
  Deno.env.get("JOB_SWITCH_LIGHT_MODEL") ?? Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";
const STRONG_MODEL = Deno.env.get("JOB_SWITCH_STRONG_MODEL") ?? "claude-sonnet-5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_PROJECTS = 10;
const MAX_JD = 8000;
const MIN_JD = 80;
const JD_FETCH_TIMEOUT_MS = 8000;
/** 모델 호출 하나가 이보다 길면 끊습니다. 세 번 부르니 150초 안에 들어와야 합니다. */
const CALL_TIMEOUT_MS = 55_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** 사용자에게 그대로 보여줄 수 있는 실패. 나머지 예외는 뭉뚱그립니다. */
class UserFacingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* 공고 URL 가져오기                                                    */
/* generate-draft 의 isSafeUrl·htmlToText 와 같은 규칙입니다. 함수끼리  */
/* 코드를 나누려면 _shared 폴더로 빼고 generate-draft 도 다시 배포해야  */
/* 해서, 이번엔 옮겨 적었습니다. 한쪽을 고치면 다른 쪽도 고치세요.      */
/* ------------------------------------------------------------------ */

function isSafeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "169.254.169.254") return false;
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (host.endsWith(".local")) return false;
  return true;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJobPosting(url: string): Promise<string> {
  if (!isSafeUrl(url)) throw new UserFacingError("허용되지 않는 주소입니다. 공고 내용을 직접 붙여넣어 주세요.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JD_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TellmefolioBot/1.0)" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) throw new Error("not text");
    return htmlToText(await res.text()).slice(0, MAX_JD);
  } catch {
    // 조용히 넘어가지 않습니다. 빈 공고로 돌리면 모델이 공고를 상상합니다.
    throw new UserFacingError(
      "공고 링크를 읽지 못했습니다. 로그인이 필요하거나 화면을 자바스크립트로 그리는 사이트일 수 있습니다. 공고 내용을 직접 붙여넣어 주세요."
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 모델 호출                                                            */
/* ------------------------------------------------------------------ */

interface Usage {
  input_tokens: number;
  output_tokens: number;
}

async function callModel(model: string, prompt: string, maxTokens: number): Promise<{ data: unknown; usage: Usage }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("Anthropic 오류", model, res.status, await res.text());
      throw new UserFacingError(
        res.status === 429 ? "요청이 몰렸습니다. 잠시 후 다시 시도해 주세요." : "AI 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        502
      );
    }
    const body = await res.json();
    const text = (body.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    const data = parseJson(text);
    if (!data) {
      console.error("JSON 파싱 실패", model, text.slice(0, 500));
      throw new UserFacingError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.", 502);
    }
    return {
      data,
      usage: {
        input_tokens: body.usage?.input_tokens ?? 0,
        output_tokens: body.usage?.output_tokens ?? 0,
      },
    };
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    const timedOut = e instanceof Error && e.name === "AbortError";
    throw new UserFacingError(
      timedOut ? "AI 응답이 너무 오래 걸립니다. 프로젝트 수를 줄이거나 잠시 후 다시 시도해 주세요." : "AI 호출 중 문제가 생겼습니다.",
      502
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 프롬프트                                                             */
/* ------------------------------------------------------------------ */

function analyzePrompt(targetJob: string, jd: string) {
  return [
    `목표 직무: ${targetJob}`,
    "",
    "아래 채용 공고를 해부해 주세요.",
    "",
    "## 공고",
    jd,
    "",
    "## 지켜야 할 것",
    "- requirements 는 공고가 실제로 요구하는 역량·경험만. 8~12개. 중복은 합치세요.",
    '- kind 는 필수 자격이면 "must", 우대 사항이면 "nice".',
    "- keywords 는 그 요구사항을 가리키는 공고 속 표현 2~5개.",
    "- vocabulary 는 이 공고와 업계가 실제로 쓰는 어휘 10개 안팎(예: 그로스, 리텐션).",
    "- lead 는 이 공고가 포트폴리오에서 가장 먼저 보고 싶어 할 것 하나:",
    '  "outcome"(지표·성과·임팩트), "execution"(특정 기술·구현 역량), "problem"(문제 정의·기획·가설), "context"(도메인 이해·협업·조직 맥락)',
    "- leadReason 은 그렇게 판단한 근거를 공고 내용으로 한 문장. 예: 필수 요건 5개 중 3개가 지표를 요구합니다",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    '{ "role": "공고의 직무명", "requirements": [{ "text": "...", "kind": "must", "keywords": ["..."] }], "vocabulary": ["..."], "lead": "outcome", "leadReason": "..." }',
  ].join("\n");
}

function evidenceLines(evidence: Evidence[]) {
  return evidence.map((e) => `${e.id}: ${e.text}`).join("\n");
}

function matchPrompt(analysis: Analysis, evidence: Evidence[], projects: SourceProject[]) {
  return [
    "채용 공고의 요구사항마다, 지원자 포트폴리오에서 그것을 뒷받침하는 근거 문장을 찾아 주세요.",
    "",
    "## 요구사항",
    analysis.requirements.map((r) => `${r.id} [${r.kind}] ${r.text}`).join("\n"),
    "",
    "## 포트폴리오 근거 문장 (id: 문장)",
    `프로젝트: ${projects.map((p, i) => `p${i}=${p.name || "(이름 없음)"}`).join(", ")}`,
    evidenceLines(evidence),
    "",
    "## 지켜야 할 것",
    "- evidenceIds 에는 위 목록에 **있는 id 만** 쓰세요. 새 id 를 만들지 마세요.",
    '- level: 근거가 요구사항을 직접 보여주면 "full", 관련은 있지만 약하면 "partial", 없으면 "none".',
    '- 근거가 없으면 억지로 찾지 말고 "none" 으로 두세요. 비슷한 단어가 있다는 것만으로는 근거가 아닙니다.',
    "- why 는 판단 이유를 한 문장으로.",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이. 모든 요구사항에 대해 하나씩.",
    '{ "matches": [{ "requirementId": "r1", "level": "full", "evidenceIds": ["p0:outcome:0"], "why": "..." }] }',
  ].join("\n");
}

function rewritePrompt(
  targetJob: string,
  analysis: Analysis,
  matches: Match[],
  projectIndex: number,
  project: SourceProject,
  evidence: Evidence[]
) {
  const mine = evidence.filter((e) => e.projectIndex === projectIndex);
  const mineIds = new Set(mine.map((e) => e.id));
  const related = matches
    .filter((m) => m.level !== "none" && m.evidenceIds.some((id) => mineIds.has(id)))
    .map((m) => {
      const req = analysis.requirements.find((r) => r.id === m.requirementId)!;
      return `${req.id} ${req.text} ← 근거: ${m.evidenceIds.filter((id) => mineIds.has(id)).join(", ")}`;
    });

  return [
    `지원자의 프로젝트 하나를 "${targetJob}" 직무 공고에 맞게 다시 써 주세요.`,
    "새로 쓰는 것이 아니라 **같은 사실을 그 직무의 언어로 옮기는 것**입니다.",
    "",
    `## 프로젝트: ${project.name || "(이름 없음)"}`,
    "원문 문장 (id: 문장). id 의 가운데 부분이 필드입니다.",
    evidenceLines(mine),
    "",
    "## 이 프로젝트로 대응할 수 있는 공고 요구사항",
    related.length > 0 ? related.join("\n") : "(없음 — 그래도 공고 어휘로 옮겨 쓰세요)",
    "",
    "## 공고가 쓰는 어휘",
    analysis.vocabulary.join(", ") || "(없음)",
    "",
    "## 반드시 지킬 것",
    "- **사실을 더하지 마세요.** 원문에 없는 성과·기능·도구·역할을 쓰지 않습니다. 어휘와 강조만 바꿉니다.",
    "- **숫자는 원문에 있는 것만.** 새 숫자를 만들거나 반올림하지 마세요.",
    "- **원문에 없는 기술·제품 이름을 쓰지 마세요.** 공고에 나온 도구라도 원문에 없으면 쓰지 않습니다.",
    "- 위 목록에 없는 요구사항은 채우려 하지 마세요. 그건 부족한 부분으로 따로 알립니다.",
    "- 문장마다 evidence 에 근거 원문 id 를 1개 이상 답니다. 위 목록의 id 만 쓰세요.",
    "- 문장이 특정 요구사항에 대응하면 requirements 에 그 id(r1 등)를 답니다.",
    "- 각 사실은 원래 필드에 둡니다. 원문에서 비어 있는 필드는 빈 배열로 둡니다.",
    "- role 은 한 문장, 나머지 필드는 원문과 비슷한 분량으로.",
    "- 한국어, 채용 담당자가 읽는 담백한 문체.",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    `{ "fields": { ${FIELDS.map((f) => `"${f}": [{ "text": "...", "evidence": ["p${projectIndex}:${f}:0"], "requirements": ["r1"] }]`).join(", ")} } }`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* 본체                                                                 */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST 만 지원합니다." }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "서버에 API 키가 설정되지 않았습니다." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  try {
    const { data: userData } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    const user = userData?.user;
    if (!user) throw new UserFacingError("로그인이 필요합니다.", 401);

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      throw new UserFacingError("요청 형식이 올바르지 않습니다.");
    }

    const portfolioId = typeof payload.portfolioId === "string" ? payload.portfolioId : "";
    const targetJob = typeof payload.targetJob === "string" ? payload.targetJob.trim().slice(0, 100) : "";
    const jdUrl = typeof payload.jdUrl === "string" ? payload.jdUrl.trim().slice(0, 1000) : "";
    const jdPasted = typeof payload.jdText === "string" ? payload.jdText.trim().slice(0, MAX_JD) : "";
    if (!portfolioId) throw new UserFacingError("재구성할 포트폴리오를 골라 주세요.");
    if (!targetJob) throw new UserFacingError("목표 직무를 적어 주세요.");
    if (!jdPasted && !jdUrl) throw new UserFacingError("채용 공고 링크나 내용을 넣어 주세요.");

    // ── 원본 읽기 (본인 것만) ───────────────────────────────────────
    const { data: portfolio } = await sb
      .from("portfolios")
      .select("id, user_id, title")
      .eq("id", portfolioId)
      .maybeSingle();
    if (!portfolio || portfolio.user_id !== user.id) {
      throw new UserFacingError("포트폴리오를 찾을 수 없습니다.", 404);
    }

    const { data: projectRows } = await sb
      .from("portfolio_projects")
      .select("id, name, stack, context, role, problem, execution, outcome, reflection, position")
      .eq("portfolio_id", portfolioId)
      .order("position", { ascending: true });

    const projects: SourceProject[] = (projectRows ?? []).slice(0, MAX_PROJECTS).map((p) => ({
      id: p.id,
      name: p.name ?? "",
      stack: p.stack ?? [],
      context: p.context ?? "",
      role: p.role ?? "",
      problem: p.problem ?? "",
      execution: p.execution ?? "",
      outcome: p.outcome ?? "",
      reflection: p.reflection ?? "",
    }));

    // 하루 한도 — Sonnet 을 쓰는 가장 비싼 기능이라 모델을 부르기 전에 확인합니다.
    await assertQuota(sb, user.id, "job_switch");

    // ── 0단계 ────────────────────────────────────────────────────
    const evidence = buildEvidence(projects);
    if (evidence.length === 0) {
      throw new UserFacingError("원본 포트폴리오에 내용이 없습니다. 편집기에서 프로젝트를 먼저 채워 주세요.");
    }

    // ── 공고 ────────────────────────────────────────────────────
    // 붙여넣은 내용이 있으면 그걸 씁니다. 사용자가 직접 넣은 것이 가장 정확합니다.
    const jd = jdPasted || (await fetchJobPosting(jdUrl));
    if (jd.length < MIN_JD) {
      throw new UserFacingError("공고 내용이 너무 짧습니다. 자격 요건·우대 사항이 들어간 본문을 붙여넣어 주세요.");
    }

    const usage: Usage = { input_tokens: 0, output_tokens: 0 };
    const add = (u: Usage) => {
      usage.input_tokens += u.input_tokens;
      usage.output_tokens += u.output_tokens;
    };

    // ── 1단계 ────────────────────────────────────────────────────
    const step1 = await callModel(LIGHT_MODEL, analyzePrompt(targetJob, jd), 2000);
    add(step1.usage);
    const analysis = normalizeAnalysis(step1.data, targetJob);
    if (!analysis) throw new UserFacingError("공고에서 요구사항을 찾지 못했습니다. 공고 본문을 붙여넣어 주세요.", 422);

    // ── 2단계 ────────────────────────────────────────────────────
    const step2 = await callModel(STRONG_MODEL, matchPrompt(analysis, evidence, projects), 4000);
    add(step2.usage);
    const matches = normalizeMatches(step2.data, analysis.requirements, evidence);

    // ── 3단계 (프로젝트별 병렬) ──────────────────────────────────
    const reqIds = analysis.requirements.map((r) => r.id);
    const rewrites: FieldSentences[] = await Promise.all(
      projects.map(async (project, pi) => {
        const hasText = evidence.some((e) => e.projectIndex === pi);
        if (!hasText) return normalizeRewrite(null, pi, evidence, reqIds);
        const step3 = await callModel(
          STRONG_MODEL,
          rewritePrompt(targetJob, analysis, matches, pi, project, evidence),
          4000
        );
        add(step3.usage);
        return fillMissingFields(normalizeRewrite(step3.data, pi, evidence, reqIds), pi, evidence);
      })
    );

    // ── 4단계 ────────────────────────────────────────────────────
    const flags = projects.flatMap((p, pi) => verifyProject(pi, p, rewrites[pi], evidence));

    // ── 저장 ────────────────────────────────────────────────────
    // 요청자의 JWT 로 씁니다. RLS 가 "본인 것 + 본인 포트폴리오"를 한 번 더 확인합니다.
    const { data: run, error: runError } = await sb
      .from("job_switch_runs")
      .insert({
        user_id: user.id,
        portfolio_id: portfolioId,
        target_job: targetJob,
        jd_url: jdUrl || null,
        jd_text: jd,
        requirements: {
          role: analysis.role,
          requirements: analysis.requirements,
          vocabulary: analysis.vocabulary,
          evidence,
        },
        matches,
        flags,
        lead: analysis.lead,
        lead_reason: analysis.leadReason,
      })
      .select("id")
      .single();
    if (runError || !run) {
      console.error("run 저장 실패", runError);
      throw new UserFacingError("결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }

    const rows = projects.map((p, pi) => ({
      run_id: run.id,
      source_project_id: p.id,
      position: pi,
      name: p.name,
      stack: p.stack,
      sentences: rewrites[pi],
      ...Object.fromEntries(FIELDS.map((f) => [f, joinField(rewrites[pi][f])])),
    }));
    if (rows.length > 0) {
      const { error } = await sb.from("job_switch_projects").insert(rows);
      if (error) {
        console.error("프로젝트 저장 실패", error);
        await sb.from("job_switch_runs").delete().eq("id", run.id);
        throw new UserFacingError("결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
      }
    }

    // 사용량 기록. 사용자 눈에는 1회입니다(내부 호출이 여러 번인 것은 우리 사정).
    // 실패해도 결과는 돌려줍니다 — 기록 실패로 사용자의 결과를 버리지 않습니다.
    await sb
      .from("draft_generations")
      .insert({ user_id: user.id, portfolio_id: portfolioId, kind: "job_switch", ...usage })
      .then(({ error }) => error && console.error("사용량 기록 실패", error));

    return json({ runId: run.id });
  } catch (e) {
    if (e instanceof UserFacingError || e instanceof QuotaError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "재구성 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
