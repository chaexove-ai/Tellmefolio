import { getSupabase } from "./supabase";

/**
 * 대화로 만들기. 설계는 docs/chat-builder-design.md,
 * 규칙과 모델 호출은 Edge Function(supabase/functions/interview)이 합니다.
 *
 * 이 파일은 함수를 부르고, 대화를 다시 열 때 DB 에서 읽기만 합니다.
 * 칸을 채울지·무엇을 물을지는 전부 서버가 정합니다 — 브라우저가 정하면
 * 근거 없는 칸 채우기를 막을 수 없습니다.
 */

export class InterviewError extends Error {}

export const INTERVIEW_FIELDS = ["context", "role", "problem", "execution", "outcome", "reflection"] as const;
export type InterviewField = (typeof INTERVIEW_FIELDS)[number];

export const INTERVIEW_FIELD_NAMES: Record<InterviewField, string> = {
  context: "맥락 및 배경",
  role: "내 역할",
  problem: "문제 정의",
  execution: "실행 내용",
  outcome: "핵심 성과",
  reflection: "배운 점",
};

/** 이만큼 차면 초안을 만들 수 있습니다. 서버(rules.ts)와 같은 값. */
export const MIN_FILLED_FOR_DRAFT = 4;
export const MAX_QUESTIONS = 12;

export interface FieldState {
  /** existing: 대화 전부터 프로젝트에 적혀 있던 칸("대화로 채우기"에서만). 묻지도 고치지도 않습니다 */
  state: "filled" | "skipped" | "existing";
  summary: string;
  answerIds: string[];
}

export interface InterviewMessage {
  position: number;
  role: "ai" | "user";
  text: string;
  answer_no: number | null;
  target_field: InterviewField | null;
  follow_up: boolean;
  skipped: boolean;
}

export interface InterviewFlag {
  field: InterviewField;
  kind: "no_evidence" | "number" | "term";
  detail: string;
  sentence: string;
  sources: string[];
}

export interface InterviewState {
  session: {
    id: string;
    title: string;
    status: "open" | "drafted";
    fields: Partial<Record<InterviewField, FieldState>>;
    currentField: InterviewField | null;
    questionCount: number;
    portfolioId: string | null;
    projectId: string | null;
    flags: InterviewFlag[];
    canDraft: boolean;
  };
  messages: InterviewMessage[];
}

export function filledCount(fields: InterviewState["session"]["fields"]) {
  return INTERVIEW_FIELDS.filter((f) => fields[f]?.state === "filled").length;
}

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new InterviewError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

/** lib/jobSwitch.ts 의 messageFrom 과 같은 이유 — 함수가 준 안내 문장을 살립니다. */
async function messageFrom(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      // 아래 기본 문구로
    }
  }
  return null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const sb = await requireClient();
  const { data, error } = await sb.functions.invoke("interview", { body });
  if (error) throw new InterviewError((await messageFrom(error)) ?? "요청이 실패했습니다. 다시 보내 주세요.");
  if (data?.error) throw new InterviewError(String(data.error));
  return data as T;
}

export function startInterview(text: string, portfolioId?: string | null) {
  return invoke<InterviewState>({ mode: "start", text, portfolioId: portfolioId ?? null });
}

/**
 * "대화로 채우기" — 이미 있는 프로젝트의 빈 칸만 묻는 대화를 엽니다.
 * 첫 질문은 서버가 바로 만들어 줍니다(모델 호출 없음).
 */
export function startFillInterview(projectId: string) {
  return invoke<InterviewState>({ mode: "start", projectId });
}

/** 기존 프로젝트의 빈 칸을 채우는 대화인가 */
export function isFillSession(session: InterviewState["session"]) {
  return Boolean(session.projectId) && session.status === "open";
}

export function sendAnswer(sessionId: string, text: string) {
  return invoke<InterviewState>({ mode: "answer", sessionId, text });
}

export function skipQuestion(sessionId: string) {
  return invoke<InterviewState>({ mode: "answer", sessionId, skip: true });
}

export function draftInterview(sessionId: string, portfolioId: string | null) {
  return invoke<{ portfolioId: string; flags: InterviewFlag[] }>({ mode: "draft", sessionId, portfolioId });
}

/** 대화를 다시 열 때. 함수를 거치지 않고 RLS 로 본인 것만 읽습니다. */
export async function getInterview(sessionId: string): Promise<InterviewState> {
  const sb = await requireClient();
  const [{ data: s, error }, { data: messages }] = await Promise.all([
    sb.from("interview_sessions").select().eq("id", sessionId).maybeSingle(),
    sb.from("interview_messages").select().eq("session_id", sessionId).order("position", { ascending: true }),
  ]);
  if (error || !s) throw new InterviewError("대화를 찾을 수 없습니다.");
  const fields = (s.fields ?? {}) as InterviewState["session"]["fields"];
  return {
    session: {
      id: s.id,
      title: s.title ?? "",
      status: s.status,
      fields,
      currentField: s.current_field,
      questionCount: s.question_count ?? 0,
      portfolioId: s.portfolio_id,
      projectId: s.project_id,
      flags: (s.flags ?? []) as InterviewFlag[],
      canDraft:
        s.status === "open" && filledCount(fields) >= (s.project_id ? 1 : MIN_FILLED_FOR_DRAFT),
    },
    messages: (messages ?? []) as InterviewMessage[],
  };
}

export interface InterviewSummary {
  id: string;
  title: string;
  updatedAt: string;
  filled: number;
}

/** 이어서 할 수 있는(아직 초안을 안 만든) 대화들 */
export async function listOpenInterviews(limit = 5): Promise<InterviewSummary[]> {
  const sb = await getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("interview_sessions")
    .select("id, title, updated_at, fields")
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    title: String(r.title || "제목 없는 대화"),
    updatedAt: String(r.updated_at),
    filled: filledCount((r.fields ?? {}) as InterviewState["session"]["fields"]),
  }));
}
