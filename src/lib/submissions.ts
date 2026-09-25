import { getSupabase } from "./supabase";
import { PortfolioError, type PortfolioProjectRow, type PortfolioRow } from "./portfolios";
import type { BlockMap } from "./blocks";

/**
 * 제출 기록. 설계는 docs/submission-history-design.md.
 *
 * 내보낼 때 "어디에 제출하나요?"를 받아 그 순간을 남깁니다. 목업이던
 * "버전 관리"를 대체합니다 — 목록의 한 줄 한 줄이 "카카오 · 프로덕트
 * 디자이너 · 9/25" 라서, 목록 자체가 지원 기록이 됩니다.
 *
 * 두 가지를 같이 남깁니다.
 *   · 결과물 HTML  — "무엇을 냈는가"의 정답. 비공개 버킷 submissions 에
 *   · 데이터 JSON — "이 버전으로 새 포트폴리오 만들기"에
 */

export const SUBMISSIONS_BUCKET = "submissions";
/** 이미지를 넣은 결과물이 이보다 크면 이미지를 빼고 저장합니다 */
const MAX_HTML_BYTES = 10 * 1024 * 1024;

export class SubmissionError extends Error {}

export type SubmissionFormat = "pdf" | "html" | "link";

export interface Submission {
  id: string;
  portfolio_id: string | null;
  portfolio_title: string;
  company: string;
  position: string;
  jd_url: string | null;
  submitted_on: string;
  note: string;
  format: SubmissionFormat;
  lang: "ko" | "en";
  html_path: string | null;
  created_at: string;
}

interface Snapshot {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  blocks: BlockMap;
}

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new SubmissionError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

const LIST_COLUMNS =
  "id, portfolio_id, portfolio_title, company, position, jd_url, submitted_on, note, format, lang, html_path, created_at";

/* ------------------------------------------------------------------ */
/* 이미지 넣기                                                          */
/* ------------------------------------------------------------------ */

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * 결과물 속 이미지 주소를 이미지 자체(data URI)로 바꿉니다.
 *
 * 주소로 두면 나중에 편집기에서 이미지를 지우는 순간 옛 제출본이 깨집니다
 * (deleteProjectImage 가 파일까지 지웁니다). 업로드 때 이미 줄여 두었으니
 * (shrinkImage) 장당 수백 KB 수준입니다.
 *
 * 못 가져온 이미지는 주소 그대로 둡니다. 결과물 저장 자체를 막을 이유는
 * 아닙니다.
 */
export async function inlineImages(html: string): Promise<{ html: string; inlined: boolean }> {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<img\b[^>]*?\ssrc=["'](https?:\/\/[^"']+)["']/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+\.(?:png|jpe?g|webp|gif|avif)(?:\?[^"')]*)?)["']?\s*\)/gi)) urls.add(m[1]);
  if (urls.size === 0) return { html, inlined: true };

  const map = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (u) => {
      try {
        const res = await fetch(u);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) return;
        map.set(u, await blobToDataUri(blob));
      } catch {
        // 위 주석대로 넘어갑니다
      }
    })
  );

  let out = html;
  for (const [u, data] of map) out = out.split(u).join(data);
  if (new Blob([out]).size > MAX_HTML_BYTES) return { html, inlined: false };
  return { html: out, inlined: true };
}

/* ------------------------------------------------------------------ */
/* 쓰기                                                                 */
/* ------------------------------------------------------------------ */

export async function createSubmission(input: {
  userId: string;
  snapshot: Snapshot;
  /** 내보낸 그 HTML. 링크만 보낸 기록이면 null */
  html: string | null;
  company: string;
  position: string;
  jdUrl?: string | null;
  jobSwitchRunId?: string | null;
  note?: string;
  format: SubmissionFormat;
  lang: "ko" | "en";
}): Promise<{ submission: Submission; imagesInlined: boolean }> {
  const sb = await requireClient();
  const id = crypto.randomUUID();

  // 파일을 먼저 올리고 행을 만듭니다. 행이 먼저 생기면 파일 업로드가
  // 실패했을 때 "열어도 비어 있는 기록"이 남습니다.
  let htmlPath: string | null = null;
  let imagesInlined = true;
  if (input.html) {
    const { html, inlined } = await inlineImages(input.html);
    imagesInlined = inlined;
    htmlPath = `${input.userId}/${id}.html`;
    const { error } = await sb.storage
      .from(SUBMISSIONS_BUCKET)
      .upload(htmlPath, new Blob([html], { type: "text/html;charset=utf-8" }), {
        contentType: "text/html;charset=utf-8",
        upsert: false,
      });
    if (error) throw new SubmissionError("제출 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const { data, error } = await sb
    .from("portfolio_submissions")
    .insert({
      id,
      user_id: input.userId,
      portfolio_id: input.snapshot.portfolio.id,
      portfolio_title: input.snapshot.portfolio.title,
      company: input.company.trim().slice(0, 80),
      position: input.position.trim().slice(0, 80),
      jd_url: input.jdUrl?.trim() || null,
      job_switch_run_id: input.jobSwitchRunId ?? null,
      note: (input.note ?? "").trim().slice(0, 500),
      format: input.format,
      lang: input.lang,
      html_path: htmlPath,
      snapshot: input.snapshot,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error || !data) {
    if (htmlPath) await sb.storage.from(SUBMISSIONS_BUCKET).remove([htmlPath]);
    throw new SubmissionError("제출 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return { submission: data as Submission, imagesInlined };
}

export async function deleteSubmission(sub: Submission): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolio_submissions").delete().eq("id", sub.id);
  if (error) throw new SubmissionError("삭제하지 못했습니다.");
  if (sub.html_path) await sb.storage.from(SUBMISSIONS_BUCKET).remove([sub.html_path]);
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                 */
/* ------------------------------------------------------------------ */

/** portfolioId 를 주면 그 포트폴리오 것만, 아니면 전부 */
export async function listSubmissions(portfolioId?: string | null, limit = 200): Promise<Submission[]> {
  const sb = await getSupabase();
  if (!sb) return [];
  let q = sb
    .from("portfolio_submissions")
    .select(LIST_COLUMNS)
    .order("submitted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (portfolioId) q = q.eq("portfolio_id", portfolioId);
  const { data } = await q;
  return (data ?? []) as Submission[];
}

/** 내 서재 카드의 "제출 기록 N" */
export async function countSubmissionsByPortfolio(): Promise<Record<string, number>> {
  const sb = await getSupabase();
  if (!sb) return {};
  const { data } = await sb.from("portfolio_submissions").select("portfolio_id");
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ portfolio_id: string | null }>) {
    if (r.portfolio_id) out[r.portfolio_id] = (out[r.portfolio_id] ?? 0) + 1;
  }
  return out;
}

/** 그때 낸 결과물 HTML. 비공개 버킷이라 로그인한 본인만 받을 수 있습니다. */
export async function downloadSubmissionHtml(sub: Submission): Promise<string | null> {
  if (!sub.html_path) return null;
  const sb = await requireClient();
  const { data, error } = await sb.storage.from(SUBMISSIONS_BUCKET).download(sub.html_path);
  if (error || !data) throw new SubmissionError("결과물을 불러오지 못했습니다.");
  return await data.text();
}

/**
 * 직무 전환으로 만든 포트폴리오면 그 공고의 직무·링크로 입력칸을 미리 채웁니다.
 * 회사명은 공고 해부 결과에 따로 없어서 비워 둡니다.
 */
export async function suggestFromJobSwitch(
  portfolioId: string
): Promise<{ position: string; jdUrl: string | null; runId: string } | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("job_switch_runs")
    .select("id, target_job, jd_url")
    .eq("saved_portfolio_id", portfolioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { position: data.target_job ?? "", jdUrl: data.jd_url ?? null, runId: data.id };
}

/* ------------------------------------------------------------------ */
/* 이 버전으로 새 포트폴리오                                             */
/* ------------------------------------------------------------------ */

/**
 * 그때의 글로 새 포트폴리오를 만듭니다. 지금 포트폴리오는 건드리지 않습니다
 * — "되돌리기"가 아니라 "복제"인 이유는, 그 뒤에 고친 것들도 대개 버리기
 * 아깝기 때문입니다.
 *
 * 이미지는 옮기지 않습니다. 그때 이미지는 결과물 HTML 안에만 있고, 파일은
 * 이미 지워졌을 수 있습니다. 새 포트폴리오에서 다시 올립니다.
 */
export async function duplicateFromSubmission(sub: Submission, userId: string): Promise<string> {
  const sb = await requireClient();
  const { data, error } = await sb
    .from("portfolio_submissions")
    .select("snapshot")
    .eq("id", sub.id)
    .single();
  if (error || !data) throw new SubmissionError("그때의 내용을 찾지 못했습니다.");
  const snap = data.snapshot as Snapshot;
  const p = snap.portfolio;
  if (!p) throw new SubmissionError("이 기록에는 되살릴 내용이 없습니다.");

  const label = [sub.company, sub.position].filter(Boolean).join(" ");
  const { data: created, error: createError } = await sb
    .from("portfolios")
    .insert({
      user_id: userId,
      title: `${p.title}${label ? ` (${label} 제출본)` : " (제출본)"}`.slice(0, 120),
      job: p.job,
      job_color: p.job_color,
      template_id: p.template_id,
      color_theme: p.color_theme,
      font: p.font,
      layout: p.layout,
      density: p.density,
      summary: p.summary,
      gaps: p.gaps ?? [],
      lead_field: p.lead_field ?? null,
    })
    .select("id")
    .single();
  if (createError || !created) throw new PortfolioError("새 포트폴리오를 만들지 못했습니다.");

  const idMap = new Map<string, string>();
  const projects = snap.projects ?? [];
  if (projects.length > 0) {
    const { data: rows, error: projError } = await sb
      .from("portfolio_projects")
      .insert(
        projects.map((pr, i) => ({
          portfolio_id: created.id,
          position: i,
          depth: pr.depth ?? "full",
          name: pr.name,
          context: pr.context,
          role: pr.role,
          problem: pr.problem,
          execution: pr.execution,
          outcome: pr.outcome,
          reflection: pr.reflection,
          stack: pr.stack ?? [],
        }))
      )
      .select("id, position");
    if (projError) {
      await sb.from("portfolios").delete().eq("id", created.id);
      throw new SubmissionError("새 포트폴리오를 만들지 못했습니다.");
    }
    for (const r of (rows ?? []) as Array<{ id: string; position: number }>) {
      const src = projects[r.position];
      if (src) idMap.set(src.id, r.id);
    }
  }

  const blockRows = Object.entries(snap.blocks ?? {}).flatMap(([projectId, list]) =>
    idMap.has(projectId)
      ? list.map((b) => ({
          portfolio_id: created.id,
          project_id: idMap.get(projectId),
          position: b.position,
          span: b.span,
          kind: b.content.kind,
          data: b.content.kind === "text" ? { label: b.content.label, text: b.content.text, style: b.content.style } : {},
        }))
      : []
  );
  if (blockRows.length > 0) await sb.from("portfolio_blocks").insert(blockRows);

  return created.id as string;
}
