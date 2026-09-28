import { getSupabase } from "./supabase";
import {
  COVER_IMAGE_BUCKET,
  type PortfolioProjectRow,
  type PortfolioRow,
} from "./portfolios";

/**
 * 직무 전환 재구성. 설계는 docs/job-switch-design.md,
 * 무거운 일은 Edge Function(supabase/functions/job-switch)이 합니다.
 *
 * 이 파일이 하는 일은 셋입니다.
 *  1. 함수를 부르고 runId 를 받는다
 *  2. job_switch_runs / job_switch_projects 를 읽어 결과 화면에 넘긴다
 *  3. "이대로 저장"을 누르면 새 portfolios 행으로 복사한다
 *     (원본은 건드리지 않습니다)
 */

export class JobSwitchError extends Error {}

/* ------------------------------------------------------------------ */
/* 타입 — Edge Function 의 logic.ts 와 같은 모양입니다                  */
/* 프런트와 함수는 빌드가 따로라 import 로 나눌 수 없어 옮겨 적었습니다. */
/* 한쪽을 바꾸면 다른 쪽도 바꾸세요.                                    */
/* ------------------------------------------------------------------ */

export const REWRITE_FIELDS = ["context", "role", "problem", "execution", "outcome", "reflection"] as const;
export type RewriteField = (typeof REWRITE_FIELDS)[number];

export const LEAD_FIELDS = ["context", "problem", "execution", "outcome"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export const FIELD_NAMES: Record<RewriteField, string> = {
  context: "맥락 및 배경",
  role: "역할",
  problem: "문제 정의",
  execution: "실행 내용",
  outcome: "핵심 성과",
  reflection: "배운 점",
};

/** 결과 화면의 "이 공고는 ○○를 가장 먼저 봅니다" 에 들어가는 말 */
export const LEAD_NAMES: Record<LeadField, string> = {
  context: "맥락과 협업",
  problem: "문제 정의",
  execution: "구현 역량",
  outcome: "성과",
};

/** 본문 5필드의 순서. lead 하나만 맨 앞으로, 나머지는 기본 순서 그대로. */
export function orderedFields(lead: string | null | undefined): Exclude<RewriteField, "role">[] {
  const base = ["context", "problem", "execution", "outcome", "reflection"] as const;
  if (!lead || !(base as readonly string[]).includes(lead)) return [...base];
  return [lead as (typeof base)[number], ...base.filter((f) => f !== lead)];
}

export interface Evidence {
  id: string;
  projectIndex: number;
  field: RewriteField;
  text: string;
}

export interface Requirement {
  id: string;
  text: string;
  kind: "must" | "nice";
  keywords: string[];
}

export interface Match {
  requirementId: string;
  level: "full" | "partial" | "none";
  evidenceIds: string[];
  why: string;
  downgraded?: boolean;
}

export interface Sentence {
  text: string;
  evidence: string[];
  requirements: string[];
}

export interface Flag {
  projectIndex: number;
  field: RewriteField;
  sentenceIndex: number;
  kind: "no_evidence" | "number" | "term";
  detail: string;
  sentence: string;
  sources: string[];
}

export interface JobSwitchRun {
  id: string;
  portfolio_id: string;
  target_job: string;
  jd_url: string | null;
  role: string;
  requirements: Requirement[];
  vocabulary: string[];
  evidence: Evidence[];
  matches: Match[];
  flags: Flag[];
  lead: LeadField;
  lead_reason: string;
  saved_portfolio_id: string | null;
  created_at: string;
}

export interface JobSwitchProject {
  id: string;
  source_project_id: string | null;
  position: number;
  name: string;
  stack: string[];
  context: string;
  role: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
  sentences: Record<RewriteField, Sentence[]>;
}

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new JobSwitchError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

/* ------------------------------------------------------------------ */
/* 실행                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 함수가 실패하면 본문에 { error } 를 담아 4xx/5xx 로 답합니다.
 * supabase-js 는 그때 data 를 비우고 error.context(Response)에 본문을
 * 넣어두므로, 거기서 사람이 읽을 문장을 꺼냅니다. 이걸 안 하면 "공고
 * 링크를 읽지 못했습니다. 붙여넣어 주세요" 같은 안내가 전부 "실패"
 * 한 마디로 뭉개집니다.
 */
async function messageFrom(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      // 본문이 JSON 이 아니면 아래 기본 문구로
    }
  }
  return null;
}

export async function startJobSwitch(input: {
  portfolioId: string;
  targetJob: string;
  jdUrl: string;
  jdText: string;
}): Promise<string> {
  const sb = await requireClient();
  const { data, error } = await sb.functions.invoke("job-switch", { body: input });
  if (error) {
    throw new JobSwitchError(
      (await messageFrom(error)) ?? "재구성 요청이 실패했습니다. 잠시 후 다시 시도해 주세요."
    );
  }
  if (data?.error) throw new JobSwitchError(String(data.error));
  if (!data?.runId) throw new JobSwitchError("재구성 결과를 받지 못했습니다.");
  return String(data.runId);
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                 */
/* ------------------------------------------------------------------ */

interface RunRow {
  id: string;
  portfolio_id: string;
  target_job: string;
  jd_url: string | null;
  requirements: {
    role?: string;
    requirements?: Requirement[];
    vocabulary?: string[];
    evidence?: Evidence[];
  } | null;
  matches: Match[] | null;
  flags: Flag[] | null;
  lead: string;
  lead_reason: string;
  saved_portfolio_id: string | null;
  created_at: string;
}

function toRun(r: RunRow): JobSwitchRun {
  const req = r.requirements ?? {};
  return {
    id: r.id,
    portfolio_id: r.portfolio_id,
    target_job: r.target_job,
    jd_url: r.jd_url,
    role: req.role ?? r.target_job,
    requirements: req.requirements ?? [],
    vocabulary: req.vocabulary ?? [],
    evidence: req.evidence ?? [],
    matches: r.matches ?? [],
    flags: r.flags ?? [],
    lead: (LEAD_FIELDS as readonly string[]).includes(r.lead) ? (r.lead as LeadField) : "context",
    lead_reason: r.lead_reason ?? "",
    saved_portfolio_id: r.saved_portfolio_id,
    created_at: r.created_at,
  };
}

export async function getJobSwitchRun(runId: string): Promise<{
  run: JobSwitchRun;
  projects: JobSwitchProject[];
  source: { title: string; projects: PortfolioProjectRow[] } | null;
}> {
  const sb = await requireClient();
  const { data: runRow, error } = await sb.from("job_switch_runs").select().eq("id", runId).maybeSingle();
  if (error || !runRow) throw new JobSwitchError("재구성 결과를 찾을 수 없습니다.");
  const run = toRun(runRow as RunRow);

  const [{ data: rows }, { data: srcPortfolio }, { data: srcProjects }] = await Promise.all([
    sb.from("job_switch_projects").select().eq("run_id", runId).order("position", { ascending: true }),
    sb.from("portfolios").select("title").eq("id", run.portfolio_id).maybeSingle(),
    sb.from("portfolio_projects").select().eq("portfolio_id", run.portfolio_id).order("position"),
  ]);

  return {
    run,
    projects: ((rows ?? []) as JobSwitchProject[]).map((p) => ({
      ...p,
      sentences: (p.sentences ?? {}) as JobSwitchProject["sentences"],
    })),
    source: srcPortfolio
      ? { title: (srcPortfolio as { title: string }).title, projects: (srcProjects ?? []) as PortfolioProjectRow[] }
      : null,
  };
}

export interface JobSwitchRunSummary {
  id: string;
  targetJob: string;
  sourceTitle: string;
  createdAt: string;
  saved: boolean;
}

export async function listJobSwitchRuns(limit = 10): Promise<JobSwitchRunSummary[]> {
  const sb = await getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("job_switch_runs")
    .select("id, target_job, created_at, saved_portfolio_id, portfolios!job_switch_runs_portfolio_id_fkey(title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const p = r.portfolios as { title?: string } | Array<{ title?: string }> | null;
    const title = Array.isArray(p) ? p[0]?.title : p?.title;
    return {
      id: String(r.id),
      targetJob: String(r.target_job ?? ""),
      sourceTitle: title ?? "",
      createdAt: String(r.created_at),
      saved: Boolean(r.saved_portfolio_id),
    };
  });
}

/** 이번 달에 돌린 재구성 수 — 홈 현황 띠의 "직무 전환 생성" 칸 */
export async function countJobSwitchRunsThisMonth(): Promise<number> {
  const sb = await getSupabase();
  if (!sb) return 0;
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from("job_switch_runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* 쓰기                                                                 */
/* ------------------------------------------------------------------ */

/** 순서 바꾸기. 내용은 그대로라 모델을 다시 부르지 않습니다. */
export async function updateRunLead(runId: string, lead: LeadField): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("job_switch_runs").update({ lead }).eq("id", runId);
  if (error) throw new JobSwitchError("순서를 저장하지 못했습니다.");
}

export async function deleteJobSwitchRun(runId: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("job_switch_runs").delete().eq("id", runId);
  if (error) throw new JobSwitchError("삭제하지 못했습니다.");
}

/**
 * 재구성본을 새 포트폴리오로 저장합니다. 원본은 그대로입니다.
 *
 * 옮기는 것:
 *   · 스타일(템플릿·색·서체·레이아웃·여백) — 같은 사람의 같은 작업이니까
 *   · 프로젝트 5필드 + 역할(재작성본), 이름·스택·깊이(원본 그대로)
 *   · 요약 문단(원본 그대로 — 재작성 대상이 아닙니다. 편집기에서 고칩니다)
 *   · 근거 없음으로 나온 요구사항 → gaps. 편집기의 "자료가 부족했던 부분"에 뜹니다
 *   · 표지·프로젝트 이미지, 자유 블록
 *
 * [이미지는 파일째 복사합니다]
 * 행만 복사해 같은 파일을 가리키게 하면, 한쪽에서 이미지를 지울 때
 * 파일이 지워져 다른 쪽이 깨집니다(deletePortfolioProject 가 파일까지
 * 지웁니다). 그래서 새 경로로 파일을 복사합니다.
 */
export async function saveRunAsPortfolio(input: {
  userId: string;
  run: JobSwitchRun;
  projects: JobSwitchProject[];
}): Promise<string> {
  const sb = await requireClient();
  const { run, projects, userId } = input;

  const { data: srcRaw, error: srcError } = await sb
    .from("portfolios")
    .select()
    .eq("id", run.portfolio_id)
    .single();
  if (srcError || !srcRaw) throw new JobSwitchError("원본 포트폴리오를 찾을 수 없습니다.");
  const src = srcRaw as PortfolioRow;

  const gaps = run.matches
    .filter((m) => m.level === "none")
    .map((m) => run.requirements.find((r) => r.id === m.requirementId)?.text ?? "")
    .filter(Boolean)
    .map((t) => `공고 요구사항 — ${t}`);

  const { data: created, error: createError } = await sb
    .from("portfolios")
    .insert({
      user_id: userId,
      title: `${src.title} · ${run.target_job}`.slice(0, 120),
      job: run.target_job,
      job_color: src.job_color,
      template_id: src.template_id,
      color_theme: src.color_theme,
      font: src.font,
      layout: src.layout,
      density: src.density,
      summary: src.summary,
      gaps,
      lead_field: run.lead,
    })
    .select()
    .single();
  if (createError || !created) {
    throw new JobSwitchError("새 포트폴리오를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const target = created as PortfolioRow;

  // 여기부터 실패하면 반쯤 만들어진 포트폴리오가 남습니다. 지우고 알립니다.
  try {
    const { data: srcProjectsRaw } = await sb
      .from("portfolio_projects")
      .select()
      .eq("portfolio_id", src.id);
    const srcProjects = new Map(
      ((srcProjectsRaw ?? []) as PortfolioProjectRow[]).map((p) => [p.id, p])
    );

    const rows = projects.map((p, i) => ({
      portfolio_id: target.id,
      position: i,
      depth: (p.source_project_id && srcProjects.get(p.source_project_id)?.depth) || "full",
      name: p.name,
      stack: p.stack,
      context: p.context,
      role: p.role,
      problem: p.problem,
      execution: p.execution,
      outcome: p.outcome,
      reflection: p.reflection,
    }));

    const { data: newProjectsRaw, error: projError } = rows.length
      ? await sb.from("portfolio_projects").insert(rows).select()
      : { data: [], error: null };
    if (projError) throw new Error("projects");
    const newProjects = ((newProjectsRaw ?? []) as PortfolioProjectRow[]).sort((a, b) => a.position - b.position);

    // 원본 프로젝트 id → 새 프로젝트 id
    const idMap = new Map<string, string>();
    projects.forEach((p, i) => {
      if (p.source_project_id && newProjects[i]) idMap.set(p.source_project_id, newProjects[i].id);
    });

    const bucket = sb.storage.from(COVER_IMAGE_BUCKET);

    // 표지
    if (src.cover_image_path) {
      const ext = src.cover_image_path.split(".").pop() || "jpg";
      const to = `${userId}/${target.id}/cover.${ext}`;
      const { error } = await bucket.copy(src.cover_image_path, to);
      if (!error) await sb.from("portfolios").update({ cover_image_path: to }).eq("id", target.id);
    }

    // 프로젝트 이미지
    if (idMap.size > 0) {
      const { data: imgs } = await sb
        .from("portfolio_project_images")
        .select()
        .in("project_id", [...idMap.keys()]);
      for (const img of (imgs ?? []) as Array<{ project_id: string; storage_path: string; caption: string; position: number }>) {
        const newProjectId = idMap.get(img.project_id)!;
        const name = img.storage_path.split("/").pop();
        const to = `${userId}/${target.id}/projects/${newProjectId}/${name}`;
        const { error } = await bucket.copy(img.storage_path, to);
        if (error) continue; // 이미지 한 장 실패로 저장 전체를 버리지 않습니다
        await sb.from("portfolio_project_images").insert({
          project_id: newProjectId,
          storage_path: to,
          caption: img.caption,
          position: img.position,
        });
      }

      // 자유 블록 — 사용자가 직접 쓴 글이라 그대로 옮깁니다
      const { data: blocks } = await sb
        .from("portfolio_blocks")
        .select("project_id, position, kind, span, data")
        .eq("portfolio_id", src.id);
      const blockRows = ((blocks ?? []) as Array<Record<string, unknown>>)
        .filter((b) => b.project_id && idMap.has(String(b.project_id)))
        .map((b) => ({
          portfolio_id: target.id,
          project_id: idMap.get(String(b.project_id)),
          position: b.position,
          kind: b.kind,
          span: b.span,
          data: b.data,
        }));
      if (blockRows.length > 0) await sb.from("portfolio_blocks").insert(blockRows);
    }
  } catch {
    await sb.from("portfolios").delete().eq("id", target.id);
    throw new JobSwitchError("재구성본을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  await sb.from("job_switch_runs").update({ saved_portfolio_id: target.id }).eq("id", run.id);
  return target.id;
}

