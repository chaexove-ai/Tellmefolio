/**
 * 대화로 만들기 Edge Function. 설계는 docs/chat-builder-design.md.
 *
 * 겉은 챗봇, 속은 인터뷰. 한 번 부를 때 한 턴입니다.
 *
 *   mode "start"   첫 문장으로 대화를 엽니다. 제목을 뽑고 첫 칸을 채우고 첫 질문
 *   mode "answer"  답 하나를 받아 칸을 채우고 다음 질문 (skip 이면 모델 없이 건너뜀)
 *   mode "draft"   답변만으로 케이스 스터디 6칸을 쓰고 포트폴리오에 저장
 *
 * [2026-09-25] "대화로 채우기" — start 에 projectId 를 주면 이미 있는 프로젝트의
 * **빈 칸만** 묻습니다. 글이 있는 칸은 existing 으로 두고 묻지도, 고치지도
 * 않습니다. draft 는 새로 채운 칸만 그 프로젝트에 써 넣습니다.
 *
 * [날조 방지] 사용자의 답이 유일한 재료입니다. 답을 문장 단위로 쪼개
 * a{답변 순번}:{문장 순번} id 를 붙이고, 칸 요약·초안 문장은 반드시 이 id 를
 * 대야 합니다. 초안은 직무 전환과 같은 기계 검증(_shared/evidence.ts)을
 * 거칩니다.
 *
 * [비용] 질문은 가벼운 모델(INTERVIEW_MODEL, 기본 Haiku), 초안만 상위 모델
 * (JOB_SWITCH_STRONG_MODEL 과 같은 값, 기본 Sonnet). 질문 프롬프트에는 최근
 * 6개 메시지만 넣습니다 — 대화가 길어질수록 비용이 쌓이는 것을 막습니다.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { QuotaError, assertQuota } from "../_shared/usage.ts";
import { ModelError, callModelJson, type Usage } from "../_shared/model.ts";
import {
  joinField,
  normalizeSentences,
  parseJson,
  termsIn,
  verifySentences,
  FIELDS,
  type Field,
  type FieldSentences,
} from "../_shared/evidence.ts";
import {
  answerEvidence,
  applyTurn,
  canDraft,
  fieldsFromProject,
  filledCount,
  firstEmpty,
  skipField,
  FIELD_LABEL,
  FALLBACK_QUESTION,
  MIN_FILLED_FOR_DRAFT,
  type Answer,
  type Fields,
} from "./rules.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LIGHT_MODEL =
  Deno.env.get("INTERVIEW_MODEL") ?? Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";
const STRONG_MODEL = Deno.env.get("JOB_SWITCH_STRONG_MODEL") ?? "claude-sonnet-5";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_ANSWER = 2000;
const RECENT_MESSAGES = 6;
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

class UserFacingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}


async function callModel(
  model: string,
  prompt: string,
  maxTokens: number,
  stage = "AI 호출"
): Promise<{ data: unknown; usage: Usage }> {
  // 실제 호출·재시도·JSON 해석은 _shared/model.ts. 여기서는 오류 모양만 맞춥니다.
  try {
    return await callModelJson(model, prompt, maxTokens, { stage, timeoutMs: CALL_TIMEOUT_MS });
  } catch (e) {
    if (e instanceof ModelError) throw new UserFacingError(e.message, e.status);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* 세션 읽기·쓰기                                                        */
/* ------------------------------------------------------------------ */

interface Session {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  project_id: string | null;
  title: string;
  status: "open" | "drafted";
  fields: Fields;
  current_field: Field | null;
  question_count: number;
  follow_ups: Partial<Record<Field, number>>;
  flags: unknown[];
  input_tokens: number;
  output_tokens: number;
}

interface Message {
  position: number;
  role: "ai" | "user";
  text: string;
  answer_no: number | null;
  target_field: string | null;
  follow_up: boolean;
  skipped: boolean;
}

async function loadSession(sb: SupabaseClient, id: string, userId: string) {
  const { data: session } = await sb.from("interview_sessions").select().eq("id", id).maybeSingle();
  if (!session || session.user_id !== userId) throw new UserFacingError("대화를 찾을 수 없습니다.", 404);
  const { data: messages } = await sb
    .from("interview_messages")
    .select("position, role, text, answer_no, target_field, follow_up, skipped")
    .eq("session_id", id)
    .order("position", { ascending: true });
  return { session: session as Session, messages: (messages ?? []) as Message[] };
}

/** 기존 프로젝트의 빈 칸을 채우는 대화인가 (start 에서 project_id 를 받은 경우) */
function isFillMode(session: Session) {
  return Boolean(session.project_id) && session.status === "open";
}

function answersOf(messages: Message[]): Answer[] {
  return messages
    .filter((m) => m.role === "user" && !m.skipped && m.answer_no)
    .map((m) => ({ no: m.answer_no!, text: m.text }));
}

/** 화면이 그대로 그릴 수 있는 모양으로 돌려줍니다. */
async function snapshot(sb: SupabaseClient, id: string, userId: string) {
  const { session, messages } = await loadSession(sb, id, userId);
  return {
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      fields: session.fields,
      currentField: session.current_field,
      questionCount: session.question_count,
      portfolioId: session.portfolio_id,
      projectId: session.project_id,
      flags: session.flags,
      canDraft: session.status === "open" && canDraft(session.fields, isFillMode(session)),
    },
    messages,
  };
}

/* ------------------------------------------------------------------ */
/* 프롬프트                                                             */
/* ------------------------------------------------------------------ */

function fieldStateLines(fields: Fields) {
  return (Object.keys(FIELD_LABEL) as Field[])
    .map((f) => {
      const s = fields[f];
      const state = !s
        ? "비어 있음"
        : s.state === "skipped"
          ? "건너뜀"
          : s.state === "existing"
            ? `이미 적혀 있음(묻지 말 것) — ${s.summary}`
            : `채움 — ${s.summary}`;
      return `- ${f} (${FIELD_LABEL[f]}): ${state}`;
    })
    .join("\n");
}

function turnPrompt(opts: {
  isStart: boolean;
  fields: Fields;
  recent: Message[];
  currentAnswer: Array<{ id: string; text: string }>;
  currentField: Field | null;
  followUps: Partial<Record<Field, number>>;
}) {
  const { isStart, fields, recent, currentAnswer, currentField, followUps } = opts;
  return [
    "당신은 채용용 포트폴리오를 함께 만드는 인터뷰어입니다. 글을 대신 쓰지 않고, 사용자가 자기 프로젝트를 말하도록 **묻습니다**.",
    "케이스 스터디 칸 6개를 채우는 것이 목표입니다: context(맥락 및 배경), role(역할), problem(문제 정의), execution(실행 내용), outcome(핵심 성과), reflection(배운 점).",
    "",
    "## 칸 상태",
    fieldStateLines(fields),
    "",
    recent.length ? "## 최근 대화" : "",
    recent.map((m) => `${m.role === "ai" ? "AI" : "사용자"}: ${m.skipped ? "(넘어가기)" : m.text}`).join("\n"),
    "",
    "## 방금 사용자 답 (문장 id: 문장)",
    currentAnswer.map((a) => `${a.id}: ${a.text}`).join("\n") || "(없음)",
    currentField ? `\n방금 질문은 ${currentField} 칸을 겨냥했습니다.` : "",
    "",
    "## 할 일",
    "1. 방금 답이 채우는 칸을 모두 fills 에 적으세요. 한 답이 여러 칸을 채울 수 있습니다. 이미 채움/건너뜀인 칸은 적지 마세요.",
    "   - summary 는 **사용자가 말한 사실만** 한 문장으로 요약. 답에 없는 숫자·이름·성과를 더하지 마세요.",
    "   - answerIds 에는 근거가 된 위 문장 id 를 적으세요. 위 목록에 없는 id 는 쓰지 마세요.",
    "   - 답이 모호해서 칸을 채우기엔 부족하면 fills 에 넣지 말고 되물으세요.",
    "2. 다음 질문 하나를 next 에 적으세요.",
    "   - 비어 있는 칸을 겨냥합니다. 되묻기라면 followUp: true (칸당 한 번만 가능. 이미 되물은 칸: " +
      (Object.entries(followUps).filter(([, n]) => (n ?? 0) >= 1).map(([f]) => f).join(", ") || "없음") +
      ").",
    "   - 성과(outcome)에서 '좋아졌다' 같은 답이면 숫자를 되물어도 좋습니다. 단 '정확하지 않으면 넘어가도 된다, 지어서 쓰지 않는다'는 말을 붙이세요.",
    "   - 짧고 편한 존댓말, 한두 문장. 칭찬·맞장구는 짧게. 질문은 하나만.",
    "   - 사용자가 포트폴리오와 상관없는 요청(자기소개서, 면접 질문 등)을 하면 그건 여기서 돕지 않는다고 한 문장으로 말하고 원래 질문을 다시 하세요.",
    "3. 모든 칸이 채움/건너뜀이면 done: true.",
    isStart ? "4. 첫 문장입니다. title 에 프로젝트 이름을 짧게(20자 안) 뽑으세요. 알 수 없으면 빈 문자열." : "",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    '{ "title": "", "fills": [{ "field": "context", "summary": "...", "answerIds": ["a1:0"] }], "next": { "field": "role", "question": "...", "followUp": false }, "done": false }',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function draftPrompt(
  title: string,
  fields: Fields,
  evidence: Array<{ id: string; text: string }>,
  /** 주면 이 칸들만 씁니다("대화로 채우기"). 나머지는 이미 적혀 있으니 고치지 않습니다. */
  only?: Field[]
) {
  return [
    only
      ? `"${title || "프로젝트"}" 케이스 스터디에서 비어 있던 칸(${only.join(", ")})만, 사용자가 인터뷰에서 답한 내용으로 써 주세요. "이미 적혀 있음" 칸은 흐름을 맞추는 참고용이며 출력하지 마세요.`
      : `사용자가 인터뷰에서 답한 내용만으로 "${title || "프로젝트"}" 케이스 스터디를 써 주세요.`,
    "",
    "## 사용자 답변 (문장 id: 문장)",
    evidence.map((e) => `${e.id}: ${e.text}`).join("\n"),
    "",
    "## 칸별로 모인 내용",
    fieldStateLines(fields),
    "",
    "## 반드시 지킬 것",
    "- **답변에 없는 사실을 더하지 마세요.** 성과·기능·도구·역할을 지어내지 않습니다. 말을 다듬고 순서를 정리하는 것만 합니다.",
    "- **숫자는 답변에 있는 것만.** 반올림하거나 새로 만들지 마세요.",
    "- **답변에 없는 기술·제품 이름을 쓰지 마세요.**",
    "- 건너뜀인 칸은 빈 배열로 둡니다. 채움인 칸은 그 칸의 근거를 중심으로 씁니다.",
    "- 문장마다 evidence 에 근거 답변 id 를 1개 이상 답니다. 위 목록의 id 만 쓰세요.",
    "- role 은 한 문장. 나머지는 칸마다 1~4문장.",
    "- 한국어, 채용 담당자가 30초 안에 파악할 수 있는 담백한 문체. 1인칭 주어(저는)는 생략합니다.",
    "- stack 에는 답변에 나온 도구·기술 이름만 (없으면 빈 배열).",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    `{ "fields": { ${FIELDS.map((f) => `"${f}": [{ "text": "...", "evidence": ["a1:0"] }]`).join(", ")} }, "stack": ["..."] }`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* 모드별                                                               */
/* ------------------------------------------------------------------ */

async function runTurn(
  sb: SupabaseClient,
  session: Session,
  messages: Message[],
  opts: { isStart: boolean; usage: Usage }
) {
  const answers = answersOf(messages);
  const all = answerEvidence(answers);
  const last = answers[answers.length - 1];
  const currentAnswer = last ? all.filter((e) => e.id.startsWith(`a${last.no}:`)) : [];

  const { data, usage } = await callModel(
    LIGHT_MODEL,
    turnPrompt({
      isStart: opts.isStart,
      fields: session.fields,
      // 방금 답은 아래에 따로 넣으므로 최근 대화에서는 뺍니다.
      recent: messages.slice(0, -1).slice(-RECENT_MESSAGES),
      currentAnswer,
      currentField: session.current_field,
      followUps: session.follow_ups,
    }),
    1200
  );
  opts.usage.input_tokens += usage.input_tokens;
  opts.usage.output_tokens += usage.output_tokens;

  const turn = applyTurn(data, {
    fields: session.fields,
    questionCount: session.question_count,
    followUps: session.follow_ups,
    evidence: new Map(all.map((e) => [e.id, e.text])),
    wholeAnswers: answers.map((a) => a.text).join("\n"),
  });
  return turn;
}

async function saveTurn(
  sb: SupabaseClient,
  session: Session,
  nextPosition: number,
  turn: ReturnType<typeof applyTurn>,
  titleFallback: string,
  usage: Usage
) {
  const doneText =
    "칸을 다 채웠어요. 오른쪽에서 확인하시고 ‘초안 만들기’를 누르면, 답해 주신 내용만으로 케이스 스터디를 써 드릴게요.";
  const aiText = turn.next ? turn.next.question : doneText;

  const { error: msgError } = await sb.from("interview_messages").insert({
    session_id: session.id,
    position: nextPosition,
    role: "ai",
    text: aiText,
    target_field: turn.next?.field ?? null,
    follow_up: turn.next?.followUp ?? false,
  });
  if (msgError) throw new UserFacingError("대화를 저장하지 못했습니다.", 500);

  const { error } = await sb
    .from("interview_sessions")
    .update({
      title: session.title || turn.title || titleFallback,
      fields: turn.fields,
      current_field: turn.next?.field ?? null,
      question_count: turn.questionCount,
      follow_ups: turn.followUps,
      input_tokens: (session.input_tokens ?? 0) + usage.input_tokens,
      output_tokens: (session.output_tokens ?? 0) + usage.output_tokens,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) throw new UserFacingError("대화를 저장하지 못했습니다.", 500);
}

async function modeStart(sb: SupabaseClient, userId: string, payload: Record<string, unknown>, usage: Usage) {
  // 하루에 새로 여는 대화 수("대화로 채우기" 포함). 한 대화 안의 턴은 rules.ts 가 12개로 묶습니다.
  await assertQuota(sb, userId, "interview");

  const projectId = typeof payload.projectId === "string" && payload.projectId ? payload.projectId : null;
  if (projectId) return await startFill(sb, userId, projectId);

  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, MAX_ANSWER) : "";
  if (!text) throw new UserFacingError("어떤 프로젝트인지 한 줄이라도 적어 주세요.");
  const portfolioId = typeof payload.portfolioId === "string" && payload.portfolioId ? payload.portfolioId : null;

  if (portfolioId) {
    const { data: p } = await sb.from("portfolios").select("user_id").eq("id", portfolioId).maybeSingle();
    if (!p || p.user_id !== userId) throw new UserFacingError("포트폴리오를 찾을 수 없습니다.", 404);
  }

  const { data: created, error } = await sb
    .from("interview_sessions")
    .insert({ user_id: userId, portfolio_id: portfolioId })
    .select()
    .single();
  if (error || !created) throw new UserFacingError("대화를 시작하지 못했습니다.", 500);

  const first: Message = {
    position: 0,
    role: "user",
    text,
    answer_no: 1,
    target_field: null,
    follow_up: false,
    skipped: false,
  };
  const { error: firstError } = await sb.from("interview_messages").insert({ session_id: created.id, ...first });
  if (firstError) throw new UserFacingError("대화를 시작하지 못했습니다.", 500);

  const session = created as Session;
  const turn = await runTurn(sb, session, [first], { isStart: true, usage });
  await saveTurn(sb, session, 1, turn, text.slice(0, 20), usage);
  return created.id as string;
}

/**
 * "대화로 채우기" 시작. 모델을 부르지 않습니다 — 첫 질문은 비어 있는 첫 칸의
 * 기본 질문이고, 어떤 칸이 비었는지 먼저 알려줍니다.
 */
async function startFill(sb: SupabaseClient, userId: string, projectId: string) {
  const { data: project } = await sb
    .from("portfolio_projects")
    .select("id, portfolio_id, name, context, role, problem, execution, outcome, reflection")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new UserFacingError("프로젝트를 찾을 수 없습니다.", 404);
  // RLS 는 공개된 남의 포트폴리오 프로젝트도 읽게 해 줍니다. 본인 것인지 따로 봅니다.
  const { data: owner } = await sb.from("portfolios").select("user_id").eq("id", project.portfolio_id).maybeSingle();
  if (!owner || owner.user_id !== userId) throw new UserFacingError("프로젝트를 찾을 수 없습니다.", 404);

  const fields = fieldsFromProject(project);
  const first = firstEmpty(fields);
  if (!first) throw new UserFacingError("이 프로젝트는 이미 모든 칸이 채워져 있어요.");

  const empties = (Object.keys(FIELD_LABEL) as Field[]).filter((f) => !fields[f]).map((f) => FIELD_LABEL[f]);
  const name = (project.name ?? "").trim();

  const { data: created, error } = await sb
    .from("interview_sessions")
    .insert({
      user_id: userId,
      portfolio_id: project.portfolio_id,
      project_id: project.id,
      title: name || "제목 없는 프로젝트",
      fields,
      current_field: first,
      question_count: 1,
    })
    .select("id")
    .single();
  if (error || !created) throw new UserFacingError("대화를 시작하지 못했습니다.", 500);

  const intro = `${name ? `「${name}」에서 ` : ""}비어 있는 칸은 ${empties.join(", ")}이에요. 이미 적힌 칸은 그대로 두고, 빈 칸만 하나씩 여쭤볼게요.\n\n${FALLBACK_QUESTION[first]}`;
  const { error: msgError } = await sb.from("interview_messages").insert({
    session_id: created.id,
    position: 0,
    role: "ai",
    text: intro,
    target_field: first,
  });
  if (msgError) throw new UserFacingError("대화를 시작하지 못했습니다.", 500);
  return created.id as string;
}

async function modeAnswer(sb: SupabaseClient, userId: string, payload: Record<string, unknown>, usage: Usage) {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const { session, messages } = await loadSession(sb, sessionId, userId);
  if (session.status !== "open") throw new UserFacingError("이미 초안을 만든 대화입니다.");

  const skip = payload.skip === true;
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, MAX_ANSWER) : "";
  if (!skip && !text) throw new UserFacingError("답을 적어 주세요. 모르면 ‘넘어가기’를 눌러도 됩니다.");

  const position = messages.length;
  const answerNo = answersOf(messages).length + 1;
  const userMsg: Message = {
    position,
    role: "user",
    text: skip ? "넘어가기" : text,
    answer_no: skip ? null : answerNo,
    target_field: session.current_field,
    follow_up: false,
    skipped: skip,
  };
  const { error } = await sb.from("interview_messages").insert({ session_id: session.id, ...userMsg });
  if (error) throw new UserFacingError("답을 저장하지 못했습니다.", 500);

  if (skip) {
    // 모델을 부르지 않습니다. 지금 칸을 건너뛰고 다음 빈 칸의 기본 질문으로.
    const fields = skipField(session.fields, session.current_field);
    const next = firstEmpty(fields);
    await saveTurn(
      sb,
      session,
      position + 1,
      {
        fields,
        filledNow: [],
        next: next ? { field: next, question: FALLBACK_QUESTION[next], followUp: false } : null,
        done: !next,
        questionCount: session.question_count + (next ? 1 : 0),
        followUps: session.follow_ups,
        title: "",
      },
      "",
      usage
    );
    return;
  }

  const turn = await runTurn(sb, session, [...messages, userMsg], { isStart: false, usage });
  await saveTurn(sb, session, position + 1, turn, "", usage);
}

async function modeDraft(sb: SupabaseClient, userId: string, payload: Record<string, unknown>, usage: Usage) {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const { session, messages } = await loadSession(sb, sessionId, userId);
  if (session.status === "drafted" && session.portfolio_id) {
    return { portfolioId: session.portfolio_id, flags: session.flags };
  }
  const fillMode = isFillMode(session);
  if (!canDraft(session.fields, fillMode)) {
    throw new UserFacingError(
      fillMode ? "한 칸 이상 답하면 채워 넣을 수 있어요." : `칸을 ${MIN_FILLED_FOR_DRAFT}개 이상 채우면 초안을 만들 수 있어요.`
    );
  }
  if (fillMode) return await draftFill(sb, userId, session, messages, usage);

  // 초안을 붙일 곳: 요청에 적힌 것 > 대화를 시작할 때 정한 것 > 새로 만들기
  const requested = typeof payload.portfolioId === "string" && payload.portfolioId ? payload.portfolioId : null;
  const targetId = requested ?? session.portfolio_id;
  if (targetId) {
    const { data: p } = await sb.from("portfolios").select("user_id").eq("id", targetId).maybeSingle();
    if (!p || p.user_id !== userId) throw new UserFacingError("포트폴리오를 찾을 수 없습니다.", 404);
  }

  const answers = answersOf(messages);
  const evidence = answerEvidence(answers);
  const known = new Set(evidence.map((e) => e.id));
  const textById = new Map(evidence.map((e) => [e.id, e.text]));
  const whole = answers.map((a) => a.text).join("\n");

  const { data, usage: u } = await callModel(STRONG_MODEL, draftPrompt(session.title, session.fields, evidence), 6000, "초안 만들기");
  usage.input_tokens += u.input_tokens;
  usage.output_tokens += u.output_tokens;

  const written: FieldSentences = normalizeSentences(data, known);
  // 건너뛴 칸은 비우고, 채운 칸을 모델이 빠뜨렸으면 그 칸의 답변 원문으로 되살립니다.
  for (const f of FIELDS) {
    const st = session.fields[f];
    if (!st || st.state === "skipped") written[f] = [];
    else if (written[f].length === 0)
      written[f] = st.answerIds.map((id) => ({ text: textById.get(id) ?? "", evidence: [id], requirements: [] }))
        .filter((s) => s.text);
  }
  const flags = verifySentences(written, textById, whole, (f) =>
    (session.fields[f]?.answerIds ?? []).map((id) => textById.get(id) ?? "").filter(Boolean)
  );

  // 스택: 답변에 실제로 나온 이름만
  const wholeLower = whole.toLowerCase();
  const rawStack = (data as Record<string, unknown>)?.stack;
  const stack = (Array.isArray(rawStack) ? rawStack : [])
    .map((s) => (typeof s === "string" ? s.trim().slice(0, 24) : ""))
    .filter((s) => s && (termsIn(s).length === 0 ? whole.includes(s) : wholeLower.includes(s.toLowerCase())))
    .slice(0, 12);

  // ── 저장 ──────────────────────────────────────────────────
  let portfolioId = targetId;
  let createdPortfolio = false;
  if (!portfolioId) {
    const { data: p, error } = await sb
      .from("portfolios")
      .insert({ user_id: userId, title: session.title || "제목 없음" })
      .select("id")
      .single();
    if (error || !p) throw new UserFacingError("포트폴리오를 만들지 못했습니다.", 500);
    portfolioId = p.id;
    createdPortfolio = true;
  }

  const { data: last } = await sb
    .from("portfolio_projects")
    .select("position")
    .eq("portfolio_id", portfolioId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: project, error: projError } = await sb
    .from("portfolio_projects")
    .insert({
      portfolio_id: portfolioId,
      position: (last?.position ?? -1) + 1,
      name: session.title,
      stack,
      ...Object.fromEntries(FIELDS.map((f) => [f, joinField(written[f])])),
    })
    .select("id")
    .single();
  if (projError || !project) {
    if (createdPortfolio) await sb.from("portfolios").delete().eq("id", portfolioId);
    throw new UserFacingError("초안을 저장하지 못했습니다.", 500);
  }

  await sb
    .from("interview_sessions")
    .update({
      status: "drafted",
      portfolio_id: portfolioId,
      project_id: project.id,
      flags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  await sb
    .from("draft_generations")
    .insert({
      user_id: userId,
      portfolio_id: portfolioId,
      // 대화 턴에서 모아 둔 것 + 초안 한 번
      input_tokens: (session.input_tokens ?? 0) + usage.input_tokens,
      output_tokens: (session.output_tokens ?? 0) + usage.output_tokens,
      kind: "interview",
    })
    .then(({ error }) => error && console.error("사용량 기록 실패", error));

  return { portfolioId, flags };
}

/**
 * "대화로 채우기"의 마무리. 새로 채운 칸만 그 프로젝트에 써 넣습니다.
 * 이미 적혀 있던 칸은 모델에게 참고로만 주고 결과에서 버립니다.
 */
async function draftFill(sb: SupabaseClient, userId: string, session: Session, messages: Message[], usage: Usage) {
  const answers = answersOf(messages);
  const evidence = answerEvidence(answers);
  const known = new Set(evidence.map((e) => e.id));
  const textById = new Map(evidence.map((e) => [e.id, e.text]));
  const filled = FIELDS.filter((f) => session.fields[f]?.state === "filled");

  const { data, usage: u } = await callModel(
    STRONG_MODEL,
    draftPrompt(session.title, session.fields, evidence, filled),
    4000,
    "빈 칸 채우기"
  );
  usage.input_tokens += u.input_tokens;
  usage.output_tokens += u.output_tokens;

  const written: FieldSentences = normalizeSentences(data, known);
  for (const f of FIELDS) {
    if (!filled.includes(f)) {
      written[f] = [];
      continue;
    }
    if (written[f].length === 0) {
      written[f] = (session.fields[f]?.answerIds ?? [])
        .map((id) => ({ text: textById.get(id) ?? "", evidence: [id], requirements: [] }))
        .filter((s) => s.text);
    }
  }
  // 숫자·이름은 답변과 이미 적혀 있던 글 어디든 있으면 통과. 칸 상태의
  // summary 는 200자로 잘려 있어서, 원문은 프로젝트에서 다시 읽습니다.
  const { data: project } = await sb
    .from("portfolio_projects")
    .select("name, stack, context, role, problem, execution, outcome, reflection")
    .eq("id", session.project_id!)
    .maybeSingle();
  const existingText = project
    ? [project.name ?? "", ...(project.stack ?? []), ...FIELDS.map((f) => project[f] ?? "")].join("\n")
    : "";
  const whole = [...answers.map((a) => a.text), existingText].join("\n");
  const flags = verifySentences(written, textById, whole, (f) =>
    (session.fields[f]?.answerIds ?? []).map((id) => textById.get(id) ?? "").filter(Boolean)
  );

  const patch = Object.fromEntries(filled.map((f) => [f, joinField(written[f])]).filter(([, v]) => v));
  if (Object.keys(patch).length > 0) {
    const { error } = await sb.from("portfolio_projects").update(patch).eq("id", session.project_id!);
    if (error) throw new UserFacingError("프로젝트에 저장하지 못했습니다.", 500);
  }

  await sb
    .from("interview_sessions")
    .update({ status: "drafted", flags, updated_at: new Date().toISOString() })
    .eq("id", session.id);

  await sb
    .from("draft_generations")
    .insert({
      user_id: userId,
      portfolio_id: session.portfolio_id,
      input_tokens: (session.input_tokens ?? 0) + usage.input_tokens,
      output_tokens: (session.output_tokens ?? 0) + usage.output_tokens,
      kind: "interview",
    })
    .then(({ error }) => error && console.error("사용량 기록 실패", error));

  return { portfolioId: session.portfolio_id!, flags };
}

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

    const usage: Usage = { input_tokens: 0, output_tokens: 0 };
    switch (payload.mode) {
      case "start": {
        const id = await modeStart(sb, user.id, payload, usage);
        return json(await snapshot(sb, id, user.id));
      }
      case "answer": {
        await modeAnswer(sb, user.id, payload, usage);
        return json(await snapshot(sb, String(payload.sessionId), user.id));
      }
      case "draft": {
        const result = await modeDraft(sb, user.id, payload, usage);
        return json(result);
      }
      default:
        throw new UserFacingError("알 수 없는 요청입니다.");
    }
  } catch (e) {
    if (e instanceof UserFacingError || e instanceof QuotaError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "대화 중 문제가 생겼습니다. 다시 보내 주세요." }, 500);
  }
});
