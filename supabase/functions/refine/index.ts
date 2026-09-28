/**
 * AI 문장 다듬기 — 편집기의 각 칸(맥락·역할·문제·실행·성과·배운 점) 옆 "다듬기".
 *
 * 편집기 "준비 중인 기능" 카드에 있던 목업(입력한 문장 뒤에 고정 문구를
 * 붙여 보여 주던 것)을 대신합니다.
 *
 * [원칙] 이 서비스의 약속은 "없는 사실을 만들지 않는다"입니다. 다듬기는
 * 표현만 바꿉니다. 모델에게 그렇게 시키고, 믿지 않고 확인합니다:
 *   · 결과에 원문(이 프로젝트의 모든 칸)에 없는 숫자가 있으면 표시
 *   · 원문에 없는 영문 용어(툴·기술명)가 있으면 표시
 * 표시된 제안도 보여 주되, 적용할지는 사용자가 정합니다.
 *
 * 요청: { projectId, field, text, direction? }
 *   direction: "default" | "shorter" | "impact" | "plain"
 * 응답: { text, notes: string[], flags: [{ kind: "number"|"term", detail }] }
 */

import { callModelJson, ModelError } from "../_shared/model.ts";
import { AuthError, QuotaError, assertQuota, recordUsage, requireUser } from "../_shared/usage.ts";
import { numbersIn, termsIn } from "../_shared/evidence.ts";

const MODEL = Deno.env.get("REFINE_MODEL") ?? Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";
const MAX_TEXT = 3000;
const CALL_TIMEOUT_MS = 40_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export const FIELD_LABEL: Record<string, string> = {
  context: "맥락 및 배경",
  role: "담당 역할",
  problem: "문제 정의",
  execution: "실행 내용",
  outcome: "핵심 성과",
  reflection: "배운 점 및 회고",
};

export const DIRECTION: Record<string, string> = {
  default: "읽는 사람이 한 번에 이해하도록 다듬어 주세요. 문장을 짧게 끊고, 주어·동사를 분명히, 군더더기 표현(~하게 되었습니다, ~할 수 있었습니다 등)을 줄이세요.",
  shorter: "뜻은 그대로 두고 분량을 절반 가까이로 줄여 주세요. 가장 중요한 내용만 남기세요.",
  impact: "무엇을 했고 그 결과 무엇이 달라졌는지가 먼저 보이도록 순서와 동사를 바꿔 주세요. 원문에 있는 결과·수치를 앞으로 가져오되, 없는 결과는 만들지 마세요.",
  plain: "전문 용어나 딱딱한 한자어를 쉬운 말로 바꿔, 이 분야를 모르는 채용 담당자도 이해하게 해 주세요.",
};

export function buildPrompt(input: {
  field: string;
  text: string;
  direction: string;
  job: string;
  projectName: string;
  others: Array<{ label: string; text: string }>;
}): string {
  const others = input.others
    .filter((o) => o.text.trim())
    .map((o) => `[${o.label}]\n${o.text.trim()}`)
    .join("\n\n");
  return `당신은 채용 포트폴리오의 문장을 다듬는 편집자입니다.

아래 "다듬을 글"은 프로젝트 「${input.projectName || "이름 없음"}」의 "${FIELD_LABEL[input.field]}" 칸입니다.${
    input.job ? ` 지원 직무는 "${input.job}"입니다.` : ""
  }

## 다듬는 방향
${DIRECTION[input.direction] ?? DIRECTION.default}

## 반드시 지킬 것
- 표현만 바꿉니다. 원문에 없는 사실·숫자·툴 이름·성과·인원·기간을 새로 넣지 마세요.
- 원문에 있는 숫자와 고유명사는 그대로 옮기세요(바꾸거나 반올림하지 마세요).
- "~했습니다" 체의 자연스러운 한국어로 씁니다. 과장된 표현(혁신적, 획기적, 극대화 등)은 쓰지 마세요.
- 이 칸의 역할("${FIELD_LABEL[input.field]}")에 맞는 내용만 남기세요. 다른 칸 내용은 참고만 하고 가져오지 마세요.

## 다듬을 글
${input.text}
${others ? `\n## 참고 — 같은 프로젝트의 다른 칸(사실 확인용, 가져오지 마세요)\n${others}\n` : ""}
## 출력
JSON 하나만, 설명 없이:
{"text": "다듬은 글", "notes": ["무엇을 바꿨는지 짧게", "최대 3개"]}`;
}

/** 원문에 없는 숫자·영문 용어를 찾습니다. 순수 함수 — 따로 시험합니다. */
export function checkFacts(result: string, source: string): Array<{ kind: "number" | "term"; detail: string }> {
  const srcNums = new Set(numbersIn(source));
  const srcLower = source.toLowerCase();
  const flags: Array<{ kind: "number" | "term"; detail: string }> = [];
  for (const n of new Set(numbersIn(result))) if (!srcNums.has(n)) flags.push({ kind: "number", detail: n });
  for (const t of new Set(termsIn(result))) if (!srcLower.includes(t.toLowerCase())) flags.push({ kind: "term", detail: t });
  return flags;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST 만 지원합니다." }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "서버에 API 키가 설정되지 않았습니다." }, 500);

  try {
    const { sb, user } = await requireUser(req);

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
    }
    const projectId = typeof payload.projectId === "string" ? payload.projectId : "";
    const field = typeof payload.field === "string" ? payload.field : "";
    const text = typeof payload.text === "string" ? payload.text.trim().slice(0, MAX_TEXT) : "";
    const direction = typeof payload.direction === "string" && DIRECTION[payload.direction] ? payload.direction : "default";
    if (!FIELD_LABEL[field]) return json({ error: "다듬을 칸을 알 수 없습니다." }, 400);
    if (text.length < 5) return json({ error: "다듬을 글이 너무 짧아요. 한두 문장 이상 적어 주세요." }, 400);

    // 본인 프로젝트인지 — 공개 포트폴리오는 RLS 로 남도 읽을 수 있어서 따로 확인합니다.
    const { data: project } = await sb
      .from("portfolio_projects")
      .select("id, name, context, role, problem, execution, outcome, reflection, stack, portfolios!inner(user_id, job)")
      .eq("id", projectId)
      .maybeSingle();
    const owner = (project as unknown as { portfolios?: { user_id: string; job: string | null } } | null)?.portfolios;
    if (!project || owner?.user_id !== user.id) return json({ error: "프로젝트를 찾을 수 없습니다." }, 404);

    await assertQuota(sb, user.id, "refine");

    const p = project as unknown as Record<string, unknown>;
    const others = Object.keys(FIELD_LABEL)
      .filter((f) => f !== field)
      .map((f) => ({ label: FIELD_LABEL[f], text: String(p[f] ?? "") }));

    const { data, usage } = await callModelJson(
      MODEL,
      buildPrompt({ field, text, direction, job: owner?.job ?? "", projectName: String(p.name ?? ""), others }),
      2000,
      { stage: "문장 다듬기", timeoutMs: CALL_TIMEOUT_MS }
    );

    const d = (data ?? {}) as Record<string, unknown>;
    const result = typeof d.text === "string" ? d.text.trim() : "";
    if (!result) return json({ error: "다듬은 글을 받지 못했어요. 다시 시도해 주세요." }, 502);
    const notes = (Array.isArray(d.notes) ? d.notes : [])
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim().slice(0, 80))
      .slice(0, 3);

    // 확인 기준: 지금 칸의 글(아직 저장 안 됐을 수 있음) + 저장된 다른 칸 + 스택
    const source = [text, ...others.map((o) => o.text), ...((p.stack as string[] | null) ?? []), String(p.name ?? "")].join("\n");
    const flags = checkFacts(result, source);

    await recordUsage(sb, { user_id: user.id, kind: "refine", ...usage });
    return json({ text: result.slice(0, MAX_TEXT), notes, flags });
  } catch (e) {
    if (e instanceof AuthError || e instanceof QuotaError || e instanceof ModelError)
      return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "다듬는 중 문제가 생겼습니다." }, 500);
  }
});
