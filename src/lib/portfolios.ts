import { getSupabase } from "./supabase";
import type { Draft } from "./draft";

/**
 * portfolios / portfolio_projects 테이블을 다루는 곳입니다.
 * (스키마: supabase/migrations/20260918_portfolios_schema.sql)
 *
 * 지금까지 마법사 각 단계는 mock 배열이나 location.state, localStorage 를
 * 썼습니다. 이 파일부터는 실제 테이블에 읽고 씁니다.
 */

export type TemplateId = "research" | "live" | "minimal" | "magazine";
export type ColorTheme = "dark" | "light";
export type LayoutDirection = "1col" | "2col";

export interface PortfolioRow {
  id: string;
  user_id: string;
  title: string;
  job: string | null;
  job_color: string;
  year: string | null;
  visibility: "private" | "public";
  template_id: TemplateId;
  color_theme: ColorTheme;
  font: string;
  layout: LayoutDirection;
  cover_image_path: string | null;
  summary: string | null;
  gaps: string[];
  created_at: string;
  updated_at: string;
}

export interface PortfolioProjectRow {
  id: string;
  portfolio_id: string;
  position: number;
  name: string;
  context: string;
  role: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
  stack: string[];
  created_at: string;
  updated_at: string;
}

export class PortfolioError extends Error {}

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new PortfolioError("Supabase 설정이 없어 저장할 수 없습니다.");
  return sb;
}

/**
 * AI 초안(Draft)으로 포트폴리오 한 건과 그 안의 프로젝트들을 한 번에 만듭니다.
 *
 * Draft.projects 의 { name, oneLiner, body, highlights } 는 portfolio_projects
 * 의 { name, context, execution, outcome } 에 대응합니다. role·problem·
 * reflection 은 AI 응답에 없는 항목이라 빈 문자열로 시작하고, 편집기에서
 * 직접 채우게 됩니다(PortfolioEditor.tsx 의 기존 안내와 동일한 이유).
 */
export async function createPortfolioFromDraft(input: {
  userId: string;
  title: string;
  job: string;
  draft: Draft;
}): Promise<{ portfolio: PortfolioRow; projects: PortfolioProjectRow[] }> {
  const sb = await requireClient();

  const { data: portfolio, error: portfolioError } = await sb
    .from("portfolios")
    .insert({
      user_id: input.userId,
      title: input.title.trim() || input.draft.title.trim() || "제목 없음",
      job: input.job.trim() || null,
      summary: input.draft.summary ?? null,
      gaps: input.draft.gaps ?? [],
    })
    .select()
    .single();

  if (portfolioError || !portfolio) {
    throw new PortfolioError("포트폴리오를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const rows = input.draft.projects.map((p, i) => ({
    portfolio_id: portfolio.id,
    position: i,
    name: p.name ?? "",
    context: p.oneLiner ?? "",
    execution: p.body ?? "",
    outcome: p.highlights?.length ? p.highlights.join("\n") : "",
    stack: p.stack ?? [],
  }));

  let projects: PortfolioProjectRow[] = [];
  if (rows.length > 0) {
    const { data, error } = await sb.from("portfolio_projects").insert(rows).select();
    if (error) {
      throw new PortfolioError("포트폴리오는 만들어졌지만 프로젝트 저장에 실패했습니다.");
    }
    projects = ((data ?? []) as PortfolioProjectRow[]).sort((a, b) => a.position - b.position);
  }

  return { portfolio: portfolio as PortfolioRow, projects };
}

/** TemplateStyle / Export 처럼 프로젝트 목록 없이 포트폴리오 한 건만 필요할 때. */
export async function getPortfolio(id: string): Promise<PortfolioRow> {
  const sb = await requireClient();
  const { data, error } = await sb.from("portfolios").select().eq("id", id).single();
  if (error || !data) {
    throw new PortfolioError("포트폴리오를 찾을 수 없습니다.");
  }
  return data as PortfolioRow;
}

/** PortfolioEditor 처럼 프로젝트 목록까지 같이 필요할 때. */
export async function getPortfolioWithProjects(
  id: string
): Promise<{ portfolio: PortfolioRow; projects: PortfolioProjectRow[] }> {
  const sb = await requireClient();

  const [{ data: portfolio, error: portfolioError }, { data: projects, error: projectsError }] =
    await Promise.all([
      sb.from("portfolios").select().eq("id", id).single(),
      sb.from("portfolio_projects").select().eq("portfolio_id", id).order("position", { ascending: true }),
    ]);

  if (portfolioError || !portfolio) {
    throw new PortfolioError("포트폴리오를 찾을 수 없습니다.");
  }
  if (projectsError) {
    throw new PortfolioError("프로젝트 목록을 불러오지 못했습니다.");
  }

  return { portfolio: portfolio as PortfolioRow, projects: (projects ?? []) as PortfolioProjectRow[] };
}

export async function updatePortfolioProject(
  id: string,
  patch: Partial<
    Pick<PortfolioProjectRow, "name" | "context" | "role" | "problem" | "execution" | "outcome" | "reflection">
  >
): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolio_projects").update(patch).eq("id", id);
  if (error) {
    throw new PortfolioError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export async function updatePortfolioStyle(
  id: string,
  patch: Partial<Pick<PortfolioRow, "template_id" | "color_theme" | "font" | "layout">>
): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolios").update(patch).eq("id", id);
  if (error) {
    throw new PortfolioError("스타일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
