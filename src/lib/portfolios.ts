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

/** Export 처럼 프로젝트 목록 없이 포트폴리오 한 건만 필요할 때. */
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

/**
 * [2026-09] 빈 프로젝트 행을 하나 추가합니다.
 *
 * 지금까지 portfolio_projects 행은 createPortfolioFromDraft(AI 초안) 한
 * 경로로만 생겼습니다 — 실제 포트폴리오는 보통 프로젝트가 여러 개인데,
 * 에디터에서 사람이 직접 "이것도 하나 추가"할 방법이 없었습니다. name 등은
 * 전부 빈 문자열로 시작하고, PortfolioEditor 의 기존 필드 입력 흐름을
 * 그대로 타고 채워집니다.
 */
export async function createPortfolioProject(
  portfolioId: string,
  position: number
): Promise<PortfolioProjectRow> {
  const sb = await requireClient();
  const { data, error } = await sb
    .from("portfolio_projects")
    .insert({
      portfolio_id: portfolioId,
      position,
      name: "",
      context: "",
      role: "",
      problem: "",
      execution: "",
      outcome: "",
      reflection: "",
      stack: [],
    })
    .select()
    .single();

  if (error || !data) {
    throw new PortfolioError("프로젝트를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return data as PortfolioProjectRow;
}

export async function deletePortfolioProject(id: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolio_projects").delete().eq("id", id);
  if (error) {
    throw new PortfolioError("프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export async function updatePortfolioStyle(
  id: string,
  patch: Partial<
    Pick<PortfolioRow, "template_id" | "color_theme" | "font" | "layout" | "cover_image_path">
  >
): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolios").update(patch).eq("id", id);
  if (error) {
    throw new PortfolioError("스타일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * [2026-09] 대표 이미지 Storage 연결.
 *
 * cover_image_path 컬럼 자체는 처음 마이그레이션 때부터 있었지만 버킷이
 * 없어 여기까지는 늘 로컬 미리보기(object URL)로만 존재했습니다. 이제
 * `portfolio-covers` 버킷(supabase/migrations/20260921_portfolio_covers_storage.sql,
 * Supabase 대시보드에서 직접 실행 필요)에 올리고, 컬럼에는 공개 URL이
 * 아니라 "경로"만 저장합니다 — 버킷을 public→private 로 바꾸거나 CDN을
 * 앞에 붙이는 식의 변경이 나중에 생겨도 URL 계산 로직(getCoverImageUrl)
 * 한 곳만 고치면 되게 하려는 것입니다.
 *
 * 파일 이름은 항상 `${userId}/${portfolioId}/cover.<확장자>` 로 고정합니다.
 * 매번 다른 이름을 쓰면(예: 타임스탬프) 다시 올릴 때마다 이전 파일이
 * 버킷에 계속 쌓이기 때문에, upsert:true 로 같은 자리를 덮어씁니다.
 */
export const COVER_IMAGE_BUCKET = "portfolio-covers";

export async function uploadCoverImage(input: {
  userId: string;
  portfolioId: string;
  file: File;
}): Promise<string> {
  const sb = await requireClient();
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${input.userId}/${input.portfolioId}/cover.${ext}`;

  const { error } = await sb.storage.from(COVER_IMAGE_BUCKET).upload(path, input.file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) {
    throw new PortfolioError("대표 이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return path;
}

/** cover_image_path 에 저장된 경로를 실제로 <img src> 에 쓸 수 있는 공개
 *  URL로 바꿉니다. 네트워크 요청 없이(클라이언트가 URL 규칙을 알고 있어)
 *  동기적으로 계산되지만, 클라이언트를 얻는 과정(getSupabase)이 비동기라
 *  이 함수도 async 입니다. */
export async function getCoverImageUrl(path: string): Promise<string> {
  const sb = await requireClient();
  return sb.storage.from(COVER_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * 서재(Bookshelf/PortfolioList/Dashboard)가 쓰는 화면 전용 모양.
 *
 * [2026-09] 이 셋은 원래 mockData.ts 의 Portfolio 배열(고정 4건)을 그렸습니다.
 * 실제 테이블 컬럼과 화면이 기대하는 필드가 조금 달라서(visibility 는 DB에
 * "초안" 상태가 없고 private/public 뿐, year 는 아직 아무 데서도 채우지 않아
 * null 일 수 있음) 변환을 여기서 한 번에 해둡니다 — 화면 쪽 컴포넌트는 예전
 * mockData.Portfolio 와 거의 같은 모양을 그대로 받습니다.
 */
export interface LibraryPortfolio {
  id: string;
  title: string;
  job: string;
  year: string;
  visibility: "공개" | "비공개";
  updatedAt: string;
  jobColor: string;
}

function toLibraryPortfolio(p: PortfolioRow): LibraryPortfolio {
  return {
    id: p.id,
    title: p.title,
    job: p.job?.trim() || "직무 미지정",
    // year 컬럼은 아직 어디서도 채우지 않아 보통 null 입니다 — 만들어진
    // 해로 대신 보여줍니다(없는 것보다는 낫습니다).
    year: p.year?.trim() || String(new Date(p.created_at).getFullYear()),
    visibility: p.visibility === "public" ? "공개" : "비공개",
    updatedAt: p.updated_at,
    jobColor: p.job_color,
  };
}

/**
 * [2026-09] "직무 색상 설정"을 실제로 저장되게 합니다.
 *
 * 색상은 직무별로 따로 테이블을 두지 않고, 그 직무를 가진 포트폴리오들의
 * job_color 컬럼을 한 번에 같은 값으로 바꾸는 방식을 씁니다 — 애초에
 * job_color 가 포트폴리오마다 있는 컬럼이라, "직무 색상"이라는 개념은
 * "같은 job 값을 가진 포트폴리오들의 job_color 를 통일한다"와 같습니다.
 * 새 테이블 없이 기존 스키마로 됩니다.
 */
export async function updateJobColor(userId: string, job: string, color: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb
    .from("portfolios")
    .update({ job_color: color })
    .eq("user_id", userId)
    .eq("job", job);
  if (error) {
    throw new PortfolioError("직무 색상을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * [2026-09] "직무 태그는 수정 불가한거 같은데" — 서재 카드의 직무 배지가
 * 그냥 <span> 이라 클릭해도 아무 일도 없었습니다. 이 함수로 개별
 * 포트폴리오 한 건의 job 값만 바꿉니다(updateJobColor 는 "같은 job 이름을
 * 가진 모든 포트폴리오의 색"을 바꾸는 것과 대상이 다릅니다 — 이건 그
 * 포트폴리오 한 건의 직무 이름 자체를 바꿉니다). 빈 문자열을 넘기면
 * null 로 저장해 "직무 미지정" 표시로 돌아가게 합니다.
 */
export async function updatePortfolioJob(id: string, job: string): Promise<void> {
  const sb = await requireClient();
  const trimmed = job.trim();
  const { error } = await sb
    .from("portfolios")
    .update({ job: trimmed || null })
    .eq("id", id);
  if (error) {
    throw new PortfolioError("직무를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/** 로그인한 사용자의 포트폴리오 전체를 최근 수정순으로. */
export async function listMyPortfolios(userId: string): Promise<LibraryPortfolio[]> {
  const sb = await requireClient();
  const { data, error } = await sb
    .from("portfolios")
    .select()
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new PortfolioError("서재 목록을 불러오지 못했습니다.");
  }

  return ((data ?? []) as PortfolioRow[]).map(toLibraryPortfolio);
}
