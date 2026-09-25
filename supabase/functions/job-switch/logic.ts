/**
 * 직무 전환의 "LLM 없는" 부분 — 근거 쪼개기(0단계), 모델 응답 정리,
 * 기계 검증(4단계).
 *
 * index.ts 와 나눈 이유: 이 파일은 네트워크도 Deno API 도 쓰지 않아서
 * 함수 배포 없이 로컬에서 바로 시험할 수 있습니다. 날조를 막는 장치가
 * 전부 여기 있으니, 여기가 틀리면 이 기능의 존재 이유가 무너집니다.
 */

/** 재작성 대상 필드. 원본 portfolio_projects 컬럼과 같은 이름입니다. */
export const FIELDS = ["context", "role", "problem", "execution", "outcome", "reflection"] as const;
export type Field = (typeof FIELDS)[number];

/** 맨 앞으로 올릴 수 있는 필드. role 은 한 줄짜리라 순서 대상이 아닙니다. */
export const LEAD_FIELDS = ["context", "problem", "execution", "outcome"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export interface SourceProject {
  id: string;
  name: string;
  stack: string[];
  context: string;
  role: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
}

export interface Evidence {
  /** p{프로젝트 순번}:{필드}:{문장 순번}. 예) p0:outcome:2 */
  id: string;
  projectIndex: number;
  field: Field;
  text: string;
}

export interface Requirement {
  id: string;
  text: string;
  kind: "must" | "nice";
  keywords: string[];
}

export interface Analysis {
  role: string;
  requirements: Requirement[];
  vocabulary: string[];
  lead: LeadField;
  leadReason: string;
}

export type MatchLevel = "full" | "partial" | "none";

export interface Match {
  requirementId: string;
  level: MatchLevel;
  evidenceIds: string[];
  why: string;
  /** 모델이 근거를 댔지만 전부 가짜 id 여서 서버가 none 으로 내린 경우 */
  downgraded?: boolean;
}

export interface Sentence {
  text: string;
  evidence: string[];
  requirements: string[];
}

export type FieldSentences = Record<Field, Sentence[]>;

export interface Flag {
  projectIndex: number;
  field: Field;
  sentenceIndex: number;
  kind: "no_evidence" | "number" | "term";
  /** 문제가 된 숫자·용어. no_evidence 면 빈 문자열 */
  detail: string;
  sentence: string;
  /** 비교용 원본 문장들 (인용한 근거, 없으면 같은 필드의 원문) */
  sources: string[];
}

/* ------------------------------------------------------------------ */
/* 0단계 — 근거 쪼개기                                                  */
/* ------------------------------------------------------------------ */

/**
 * 문장 단위로 자릅니다. 줄바꿈과 문장부호 뒤 공백을 경계로 봅니다.
 * 한국어 문장 끝("~했습니다.")도 마침표라 같은 규칙으로 잘립니다.
 * 소수점("3.5배")은 뒤에 공백이 없어서 잘리지 않습니다.
 */
export function splitSentences(text: string): string[] {
  return (text ?? "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?。])\s+/))
    .map((s) => s.replace(/^\s*(?:[-•·*]|\d+[.)])\s+/, "").trim())
    .filter((s) => s.length > 0);
}

export function buildEvidence(projects: SourceProject[]): Evidence[] {
  const out: Evidence[] = [];
  projects.forEach((p, pi) => {
    for (const field of FIELDS) {
      splitSentences(p[field]).forEach((text, si) => {
        out.push({ id: `p${pi}:${field}:${si}`, projectIndex: pi, field, text });
      });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* 모델 응답 정리 — 바깥에서 온 것을 믿지 않습니다                      */
/* ------------------------------------------------------------------ */

/** 코드펜스나 앞뒤 설명이 붙어 와도 가장 바깥 JSON 을 꺼냅니다. */
export function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function strList(v: unknown, maxItems = 20, maxLen = 60): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

export const MAX_REQUIREMENTS = 12;

export function normalizeAnalysis(raw: unknown, fallbackRole: string): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const requirements: Requirement[] = (Array.isArray(r.requirements) ? r.requirements : [])
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      text: str(x.text, 200),
      kind: (x.kind === "nice" ? "nice" : "must") as "must" | "nice",
      keywords: strList(x.keywords, 8, 40),
    }))
    .filter((x) => x.text)
    .slice(0, MAX_REQUIREMENTS)
    // id 는 모델이 준 값을 쓰지 않고 우리가 다시 붙입니다. 중복이나 빈 id 가
    // 오면 2단계 매칭이 어긋납니다.
    .map((x, i) => ({ id: `r${i + 1}`, ...x }));

  if (requirements.length === 0) return null;

  const lead = (LEAD_FIELDS as readonly string[]).includes(r.lead as string)
    ? (r.lead as LeadField)
    : "context";

  return {
    role: str(r.role, 100) || fallbackRole,
    requirements,
    vocabulary: strList(r.vocabulary, 20, 40),
    lead,
    leadReason: str(r.leadReason, 300),
  };
}

/**
 * 2단계 결과 정리.
 *
 * 설계의 기계적 방어 장치가 여기입니다: evidenceIds 는 0단계에서 만든 id
 * 만 남깁니다. 근거가 하나도 남지 않은 항목은 모델이 뭐라고 했든 none
 * 으로 내립니다. 모델이 근거를 지어내도 표에는 "근거 없음"으로 나옵니다.
 */
export function normalizeMatches(
  raw: unknown,
  requirements: Requirement[],
  evidence: Evidence[]
): Match[] {
  const known = new Set(evidence.map((e) => e.id));
  const list = raw && typeof raw === "object" ? (raw as Record<string, unknown>).matches : null;
  const byReq = new Map<string, Record<string, unknown>>();
  for (const m of Array.isArray(list) ? list : []) {
    const rec = m as Record<string, unknown>;
    const rid = str(rec.requirementId, 10);
    if (rid && !byReq.has(rid)) byReq.set(rid, rec);
  }

  return requirements.map((req) => {
    const m = byReq.get(req.id);
    if (!m) return { requirementId: req.id, level: "none", evidenceIds: [], why: "" };

    const claimed = strList(m.evidenceIds, 12, 40);
    const evidenceIds = [...new Set(claimed.filter((id) => known.has(id)))];
    let level: MatchLevel = m.level === "full" || m.level === "partial" ? m.level : "none";
    let downgraded = false;
    if (level !== "none" && evidenceIds.length === 0) {
      level = "none";
      downgraded = claimed.length > 0;
    }
    return {
      requirementId: req.id,
      level,
      evidenceIds: level === "none" ? [] : evidenceIds,
      why: str(m.why, 300),
      ...(downgraded ? { downgraded } : {}),
    };
  });
}

/** 3단계 결과 정리. 이 프로젝트의 근거 id 와 요구사항 id 만 남깁니다. */
export function normalizeRewrite(
  raw: unknown,
  projectIndex: number,
  evidence: Evidence[],
  requirementIds: string[]
): FieldSentences {
  const known = new Set(evidence.filter((e) => e.projectIndex === projectIndex).map((e) => e.id));
  const reqs = new Set(requirementIds);
  const fields =
    raw && typeof raw === "object" ? ((raw as Record<string, unknown>).fields as Record<string, unknown>) : null;

  const out = {} as FieldSentences;
  for (const f of FIELDS) {
    const list = fields && Array.isArray(fields[f]) ? (fields[f] as unknown[]) : [];
    out[f] = list
      .map((s) => s as Record<string, unknown>)
      .map((s) => ({
        text: str(s.text, 600),
        evidence: [...new Set(strList(s.evidence, 8, 40).filter((id) => known.has(id)))],
        requirements: [...new Set(strList(s.requirements, 8, 10).filter((id) => reqs.has(id)))],
      }))
      .filter((s) => s.text)
      .slice(0, 12);
  }
  return out;
}

/**
 * 모델이 필드 하나를 통째로 빠뜨리면 그 필드는 원문을 그대로 둡니다.
 * 재구성에서 빠진 것이 결과물에서 "사라지는" 것이 이 제품에서 가장 나쁜
 * 실패라서, 원문을 근거로 붙여 되살립니다.
 */
export function fillMissingFields(
  rewritten: FieldSentences,
  projectIndex: number,
  evidence: Evidence[]
): FieldSentences {
  const out = { ...rewritten };
  for (const f of FIELDS) {
    if (out[f].length > 0) continue;
    const src = evidence.filter((e) => e.projectIndex === projectIndex && e.field === f);
    out[f] = src.map((e) => ({ text: e.text, evidence: [e.id], requirements: [] }));
  }
  return out;
}

/** 문장들을 한 문단으로 되돌립니다. 저장되는 5필드 값이 이것입니다. */
export function joinField(sentences: Sentence[]): string {
  return sentences.map((s) => s.text).join(" ").trim();
}

/* ------------------------------------------------------------------ */
/* 4단계 — 기계 검증 (LLM 없음)                                         */
/* ------------------------------------------------------------------ */

/** 숫자 토큰. 1,200 과 1200 을 같게 봅니다. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/**
 * 영문 용어(기술명·제품명). 두 글자 이상만 봅니다 — 한 글자는 "A/B"의
 * 조각 같은 것이라 소음입니다.
 */
export function termsIn(text: string): string[] {
  return (text.match(/[A-Za-z][A-Za-z0-9+#.\-]*[A-Za-z0-9+#]/g) ?? [])
    .map((t) => t.replace(/\.+$/, ""))
    .filter((t) => t.length >= 2);
}

/**
 * 숫자와 용어는 "그 프로젝트 원문 어딘가에" 있으면 통과입니다. 인용한
 * 근거 문장으로만 좁히면, 같은 사실을 두 문장에서 합쳐 쓴 정상적인
 * 경우까지 걸려 경고가 소음이 됩니다. 걸린 문장은 지우지 않고 원문과
 * 나란히 보여줍니다 — 오탐일 수 있고 판단은 사용자 몫입니다.
 */
export function verifyProject(
  projectIndex: number,
  source: SourceProject,
  rewritten: FieldSentences,
  evidence: Evidence[]
): Flag[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const whole = [source.name, ...source.stack, ...FIELDS.map((f) => source[f])].join("\n");
  const wholeNumbers = new Set(numbersIn(whole));
  const wholeLower = whole.toLowerCase();

  const flags: Flag[] = [];
  for (const field of FIELDS) {
    rewritten[field].forEach((s, si) => {
      const cited = s.evidence.map((id) => byId.get(id)?.text ?? "").filter(Boolean);
      const sources =
        cited.length > 0
          ? cited
          : evidence.filter((e) => e.projectIndex === projectIndex && e.field === field).map((e) => e.text);
      const base = { projectIndex, field, sentenceIndex: si, sentence: s.text, sources };

      if (s.evidence.length === 0) flags.push({ ...base, kind: "no_evidence", detail: "" });

      for (const n of new Set(numbersIn(s.text))) {
        if (!wholeNumbers.has(n)) flags.push({ ...base, kind: "number", detail: n });
      }
      for (const t of new Set(termsIn(s.text))) {
        if (!wholeLower.includes(t.toLowerCase())) flags.push({ ...base, kind: "term", detail: t });
      }
    });
  }
  return flags;
}

/** 필드 순서. lead 하나만 맨 앞으로, 나머지는 기본 순서 그대로. */
export function orderedFields(lead: string | null | undefined): Field[] {
  const base: Field[] = ["context", "problem", "execution", "outcome", "reflection"];
  if (!lead || !(base as string[]).includes(lead)) return base;
  return [lead as Field, ...base.filter((f) => f !== lead)];
}
