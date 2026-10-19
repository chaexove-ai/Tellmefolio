/**
 * 대화로 만들기의 서버 규칙 — LLM 없는 부분. 설계는 docs/chat-builder-design.md.
 *
 * 모델은 "다음에 뭘 물을지"와 "방금 답이 어느 칸을 채우는지"를 제안만
 * 합니다. 받아들일지는 여기서 정합니다.
 *   · 칸을 채우려면 실제 답변 문장 id 를 대야 한다 (없는 id → 채우지 않음)
 *   · 요약에 답변에 없는 숫자가 있으면 요약 대신 답변 원문을 쓴다
 *   · 되묻기는 칸당 1번
 *   · 이미 찬 칸을 다시 묻지 않는다
 *   · 질문은 모두 12개까지
 *
 * index.ts 와 나눈 이유는 _shared/evidence.ts 와 같습니다 — 배포 없이 시험할
 * 수 있어야 합니다.
 */

import { FIELDS, numbersIn, splitSentences, type Field } from "../_shared/evidence.ts";

export const MAX_QUESTIONS = 12;
/** 이만큼 차면 "초안 만들기"를 열어 줍니다 */
export const MIN_FILLED_FOR_DRAFT = 4;

export interface FieldState {
  /** existing: 대화 전부터 프로젝트에 적혀 있던 칸(묻지 않고, 초안에서도 고치지 않음) */
  state: "filled" | "skipped" | "existing";
  summary: string;
  answerIds: string[];
}

export type Fields = Partial<Record<Field, FieldState>>;

export interface Answer {
  no: number;
  text: string;
}

/** 답변을 근거 문장으로. a{답변 순번}:{문장 순번} */
export function answerEvidence(answers: Answer[]): Array<{ id: string; text: string }> {
  return answers.flatMap((a) => splitSentences(a.text).map((text, i) => ({ id: `a${a.no}:${i}`, text })));
}

/** 질문 순서. 비어 있는 칸 중 가장 앞의 것을 묻습니다. */
export const ORDER: Field[] = ["context", "role", "problem", "execution", "outcome", "reflection"];

export const FIELD_LABEL: Record<Field, string> = {
  context: "맥락 및 배경",
  role: "역할",
  problem: "문제 정의",
  execution: "실행 내용",
  outcome: "핵심 성과",
  reflection: "배운 점",
};

/**
 * 모델이 규칙을 어겼을 때 대신 내보낼 질문. 모델이 늘 좋은 질문을 만들지는
 * 않지만, 이 질문들만으로도 인터뷰는 끝까지 굴러가야 합니다.
 */
export const FALLBACK_QUESTION: Record<Field, string> = {
  context: "어떤 프로젝트였는지, 왜 시작하게 됐는지 편하게 말해 주세요.",
  role: "그 프로젝트에서 직접 맡은 부분은 어디까지였어요?",
  problem: "해결하려던 문제가 뭐였어요? 사용자나 팀이 어디서 막혀 있었는지요.",
  execution: "그 문제를 풀려고 실제로 무엇을 했어요? 어떻게 확인하고 무엇을 바꿨는지요.",
  outcome: "하고 나서 달라진 게 있었나요? 숫자가 있으면 좋고, 없으면 체감한 변화도 괜찮아요.",
  reflection: "이 프로젝트에서 배운 점이나, 다시 한다면 바꿀 점이 있을까요?",
};

export function firstEmpty(fields: Fields): Field | null {
  return ORDER.find((f) => !fields[f]) ?? null;
}

export function filledCount(fields: Fields): number {
  return ORDER.filter((f) => fields[f]?.state === "filled").length;
}

/**
 * 초안을 만들 수 있는가. 새 프로젝트는 4칸, 기존 프로젝트의 빈 칸을
 * 채우는 대화("대화로 채우기")는 1칸이면 됩니다 — 나머지는 이미 있으니까요.
 */
export function canDraft(fields: Fields, forExistingProject: boolean): boolean {
  return filledCount(fields) >= (forExistingProject ? 1 : MIN_FILLED_FOR_DRAFT);
}

/** 기존 프로젝트의 칸 상태. 글이 있는 칸은 existing, 빈 칸은 비워 둡니다. */
export function fieldsFromProject(project: Partial<Record<Field, string | null>>): Fields {
  const out: Fields = {};
  for (const f of ORDER) {
    const text = (project[f] ?? "").trim();
    if (text) out[f] = { state: "existing", summary: text.slice(0, 200), answerIds: [] };
  }
  return out;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function isField(v: unknown): v is Field {
  return typeof v === "string" && (FIELDS as readonly string[]).includes(v);
}

export interface TurnInput {
  fields: Fields;
  questionCount: number;
  followUps: Partial<Record<Field, number>>;
  /** 모든 답변의 근거 (id → 문장) */
  evidence: Map<string, string>;
  /** 모든 답변을 합친 원문. 요약의 숫자를 대조하는 데 씁니다 */
  wholeAnswers: string;
}

export interface TurnResult {
  fields: Fields;
  /** 이번 턴에 새로 채워진 칸 (화면의 "✓ ○○에 저장" 표시) */
  filledNow: Field[];
  next: { field: Field; question: string; followUp: boolean } | null;
  done: boolean;
  questionCount: number;
  followUps: Partial<Record<Field, number>>;
  title: string;
}

/**
 * 모델 응답을 규칙에 맞게 받아들입니다.
 *
 * 모델 응답 모양:
 * { title?, fills: [{ field, summary, answerIds }], next: { field, question, followUp }, done }
 */
export function applyTurn(raw: unknown, input: TurnInput): TurnResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fields: Fields = { ...input.fields };
  const filledNow: Field[] = [];
  const wholeNumbers = new Set(numbersIn(input.wholeAnswers));

  // ── 칸 채우기 ────────────────────────────────────────────
  for (const f of Array.isArray(r.fills) ? r.fills : []) {
    const fill = f as Record<string, unknown>;
    if (!isField(fill.field)) continue;
    if (fields[fill.field]) continue; // 이미 찬(또는 건너뛴) 칸은 덮어쓰지 않습니다
    const ids = [...new Set((Array.isArray(fill.answerIds) ? fill.answerIds : []).map((x) => str(x, 20)))].filter(
      (id) => input.evidence.has(id)
    );
    if (ids.length === 0) continue; // 근거 없는 채움은 받지 않습니다

    const cited = ids.map((id) => input.evidence.get(id)!).join(" ");
    let summary = str(fill.summary, 200);
    // 요약이 비었거나 답에 없는 숫자를 만들었으면 답변 원문을 그대로 씁니다.
    if (!summary || numbersIn(summary).some((n) => !wholeNumbers.has(n))) summary = cited.slice(0, 200);

    fields[fill.field] = { state: "filled", summary, answerIds: ids };
    filledNow.push(fill.field);
  }

  const title = str(r.title, 60);

  // ── 다음 질문 ────────────────────────────────────────────
  const questionCount = input.questionCount;
  const followUps = { ...input.followUps };
  const empty = firstEmpty(fields);

  if (!empty || questionCount >= MAX_QUESTIONS || (r.done === true && filledCount(fields) >= MIN_FILLED_FOR_DRAFT)) {
    return { fields, filledNow, next: null, done: true, questionCount, followUps, title };
  }

  const n = (r.next && typeof r.next === "object" ? r.next : {}) as Record<string, unknown>;
  let field: Field = isField(n.field) && !fields[n.field] ? n.field : empty;
  let followUp = n.followUp === true && field === n.field;
  let question = str(n.question, 400);

  if (followUp && (followUps[field] ?? 0) >= 1) {
    // 되묻기는 칸당 한 번. 이미 되물었으면 다음 빈 칸으로 넘어갑니다.
    followUp = false;
    const after = ORDER.slice(ORDER.indexOf(field) + 1).find((f) => !fields[f]);
    field = after ?? empty;
    question = "";
  }
  if (field !== n.field || !question) question = FALLBACK_QUESTION[field];
  if (followUp) followUps[field] = (followUps[field] ?? 0) + 1;

  return {
    fields,
    filledNow,
    next: { field, question, followUp },
    done: false,
    questionCount: questionCount + 1,
    followUps,
    title,
  };
}

/** "넘어가기" — 모델을 부르지 않고 지금 칸을 건너뜀으로 둡니다. */
export function skipField(fields: Fields, field: Field | null): Fields {
  if (!field || fields[field]) return fields;
  return { ...fields, [field]: { state: "skipped", summary: "", answerIds: [] } };
}

/* ------------------------------------------------------------------ */
/* 채용 공고 붙여넣기 막기                                              */
/* ------------------------------------------------------------------ */

/**
 * [2026-10-19] 사용자가 "이 공고에 맞춰 만들어 줘"라며 채용 공고를 붙여 넣으면,
 * 그 문장이 답변 근거로 잡혀 "맥락 및 배경" 칸에 들어갔습니다(실사용에서 확인).
 * 서버는 "근거 id 가 실제 답변 문장인가"만 보고 "그 문장이 사용자의 경험인가"는
 * 보지 않기 때문입니다. 그대로 초안을 만들면 공고 요구사항이 본인 경험처럼
 * 쓰입니다 — 평가(eval/REPORT.md)에서 막으려던 날조가 이 경로로 들어옵니다.
 *
 * 그래서 공고로 보이는 답은 근거에서 뺍니다. 모델에게 부탁만 하면 어길 수 있어서
 * 프롬프트 규칙과 별도로 여기서 막습니다.
 *
 * 판정은 보수적으로: 공고에만 나오는 표지어가 2종 이상이거나, 목록 기호가 3개
 * 이상이면서 표지어가 1종 이상. "필수로 해야 했던 일" 같은 경험 서술 한 문장이
 * 걸리지 않도록 표지어 1종만으로는 걸지 않습니다.
 */
const POSTING_MARKERS: RegExp[] = [
  /우대\s*(사항|조건)?/,
  /자격\s*요건|지원\s*자격|필수\s*요건/,
  /필수\s*제출|제출\s*필수|포트폴리오\s*(필수|제출)/,
  /모집\s*(부문|분야|요강)?|채용\s*(공고|절차|형태)?/,
  /경력\s*\d+\s*년\s*(이상|↑)|\d+\s*년\s*이상\s*(의\s*)?경력/,
  /주요\s*업무|담당\s*업무|근무\s*(지|조건|형태)/,
  /능력\s*우수|우수자|전공자?\s*(우대)?$/m,
];

export function looksLikeJobPosting(text: string): boolean {
  const hits = POSTING_MARKERS.filter((re) => re.test(text)).length;
  const bullets = (text.match(/(^|\s)[•·▪■◦\-\*]\s?\S/gm) ?? []).length;
  return hits >= 2 || (bullets >= 3 && hits >= 1);
}

/** 근거로 쓸 답변 — 공고로 보이는 답은 뺍니다(답변 번호는 그대로) */
export function experienceAnswers(answers: Answer[]): Answer[] {
  return answers.filter((a) => !looksLikeJobPosting(a.text));
}

/**
 * 근거가 모두 사라진 칸은 비웁니다. 이미 공고로 채워진 칸이 있는 대화(이 가드 전에
 * 시작한 대화)도 다음 턴에 그 칸을 다시 묻게 됩니다. existing(원래 프로젝트 글)과
 * skipped 는 건드리지 않습니다.
 */
export function dropUnsupportedFields(fields: Fields, evidenceIds: Set<string>): Fields {
  const out: Fields = {};
  for (const f of ORDER) {
    const st = fields[f];
    if (!st) continue;
    if (st.state === "filled") {
      const ids = st.answerIds.filter((id) => evidenceIds.has(id));
      if (ids.length === 0) continue;
      out[f] = { ...st, answerIds: ids };
    } else out[f] = st;
  }
  return out;
}

/** 공고를 붙여 넣었을 때 질문 앞에 붙이는 안내 */
export const POSTING_NOTICE =
  "붙여 주신 건 채용 공고라서 경험 칸에는 넣지 않았어요. 공고에 맞춰 고치는 건 포트폴리오를 만든 뒤 ‘직무 전환’에서 할 수 있어요.";
