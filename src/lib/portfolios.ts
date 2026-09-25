import { getSupabase } from "./supabase";
import type { Draft } from "./draft";

/**
 * portfolios / portfolio_projects 테이블을 다루는 곳입니다.
 * (스키마: supabase/migrations/20260918_portfolios_schema.sql)
 *
 * 지금까지 마법사 각 단계는 mock 배열이나 location.state, localStorage 를
 * 썼습니다. 이 파일부터는 실제 테이블에 읽고 씁니다.
 */

/**
 * [2026-09-23] 네 가지 고정 값에서 문자열로 넓혔습니다.
 *
 * 템플릿이 React 컴포넌트에서 HTML 파일(public/templates/<id>.html)로
 * 바뀌면서, id 는 파일 이름이 됩니다. 새 템플릿을 넣을 때마다 타입을
 * 고쳐야 한다면 템플릿이 늘지 않습니다 — 그게 정형화의 원인이었습니다.
 *
 * 대신 모르는 id 가 들어올 수 있습니다. 화면(TemplateFrame)이 목록에
 * 없는 id 를 기본 템플릿으로 떨어뜨립니다 — 예전 값(research/live/
 * minimal/magazine)이 남아 있는 행도 그래서 그냥 열립니다.
 */
export type TemplateId = string;
export type ColorTheme = "dark" | "light";
/** 프로젝트를 몇 개씩 나열할지. 문서 전체의 단 수가 아니라 "프로젝트
 *  카드가 한 줄에 몇 개 오는가" 입니다 — 전에는 매거진형 템플릿만 이
 *  값을 읽었고 나머지 셋은 무시했습니다. */
export type LayoutDirection = "1col" | "2col";

/** 여백. PDF가 한 장 넘치거나 반대로 휑할 때 실제로 만지게 되는 값이라
 *  1단/2단과 별개 축으로 뒀습니다. 템플릿 4종 전부에 적용됩니다. */
export type Density = "roomy" | "normal" | "tight";

export interface PortfolioRow {
  id: string;
  user_id: string;
  title: string;
  job: string | null;
  job_color: string;
  year: string | null;
  visibility: "private" | "public";
  /** 커뮤니티 목록 노출 여부. visibility 와 별개입니다 — 자세한 이유는
   *  20260922090000_portfolio_listed.sql 주석 참고. */
  listed: boolean;
  template_id: TemplateId;
  color_theme: ColorTheme;
  font: string;
  layout: LayoutDirection;
  density: Density;
  cover_image_path: string | null;
  summary: string | null;
  gaps: string[];
  /** 맨 앞에 둘 본문 필드(context/problem/execution/outcome). null 이면 기본 순서.
   *  직무 전환 재구성으로 만든 포트폴리오에 들어갑니다(20260925100000_job_switch.sql).
   *  마이그레이션 전 행에는 아예 없어서 optional 입니다. */
  lead_field?: string | null;
  created_at: string;
  updated_at: string;
}

/** 프로젝트를 얼마나 깊게 보여줄지. 설계는 docs/editor-redesign.md 3절.
 *  brief = 제목 + 한 줄 설명(context) + 이미지 + 스택.
 *  full  = 5필드 전부 + 이미지. */
export type ProjectDepth = "brief" | "full";

export interface PortfolioProjectRow {
  id: string;
  portfolio_id: string;
  position: number;
  depth: ProjectDepth;
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
    Pick<
      PortfolioProjectRow,
      | "name"
      | "context"
      | "role"
      | "problem"
      | "execution"
      | "outcome"
      | "reflection"
      | "stack"
      | "depth"
    >
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
      depth: "full",
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

  // [2026-09-22] 이미지 파일을 먼저 챙깁니다. 행을 지우면 cascade 로
  // portfolio_project_images 도 따라 지워지는데, 그러면 어떤 파일이
  // 이 프로젝트 것이었는지 알 방법이 없어져 버킷에 영원히 남습니다.
  const { data: images } = await sb
    .from("portfolio_project_images")
    .select("storage_path")
    .eq("project_id", id);
  const paths = ((images ?? []) as Array<{ storage_path: string }>).map((i) => i.storage_path);

  const { error } = await sb.from("portfolio_projects").delete().eq("id", id);
  if (error) {
    throw new PortfolioError("프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  if (paths.length > 0) {
    await sb.storage.from(COVER_IMAGE_BUCKET).remove(paths);
  }
}

export async function updatePortfolioStyle(
  id: string,
  patch: Partial<
    Pick<
      PortfolioRow,
      "template_id" | "color_theme" | "font" | "layout" | "density" | "cover_image_path"
    >
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

  // [2026-09] 같은 자리를 덮어쓰는 건 확장자가 같을 때뿐입니다. 업로드 전
  // 축소가 들어오면서 jpg 가 webp 로 바뀌는 일이 생겼고, 그러면 예전
  // cover.jpg 가 아무도 안 보는 채로 버킷에 남습니다. 이 포트폴리오 폴더에서
  // 방금 올린 것 말고는 지웁니다.
  //
  // 실패해도 예외를 던지지 않습니다 — 새 표지는 이미 올라갔고, 정리에
  // 실패했다고 업로드를 실패로 보고하면 사용자가 다시 올리게 됩니다.
  try {
    const folder = `${input.userId}/${input.portfolioId}`;
    const { data: existing } = await sb.storage.from(COVER_IMAGE_BUCKET).list(folder);
    const stale = (existing ?? [])
      .map((f) => `${folder}/${f.name}`)
      .filter((p) => p !== path);
    if (stale.length > 0) {
      await sb.storage.from(COVER_IMAGE_BUCKET).remove(stale);
    }
  } catch {
    // 위 주석대로 넘어갑니다.
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
  /** 만든 사람. 커뮤니티에서 작성자 프로필을 붙일 때 씁니다. */
  userId: string;
  title: string;
  job: string;
  year: string;
  visibility: "공개" | "비공개";
  /** 커뮤니티 목록에 올렸는지. 공개(visibility)와 별개입니다. */
  listed: boolean;
  updatedAt: string;
  jobColor: string;
}

function toLibraryPortfolio(p: PortfolioRow): LibraryPortfolio {
  return {
    id: p.id,
    userId: p.user_id,
    title: p.title,
    job: p.job?.trim() || "직무 미지정",
    // year 컬럼은 아직 어디서도 채우지 않아 보통 null 입니다 — 만들어진
    // 해로 대신 보여줍니다(없는 것보다는 낫습니다).
    year: p.year?.trim() || String(new Date(p.created_at).getFullYear()),
    visibility: p.visibility === "public" ? "공개" : "비공개",
    // 컬럼이 없던 시절 행은 undefined 로 옵니다 — 프런트는 자동 배포되고
    // 마이그레이션은 손으로 돌리니, 그 틈에 죽지 않게 false 로 봅니다.
    listed: p.listed ?? false,
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

/**
 * [2026-09] 책장에서 책 한 권의 제목을 바로 고칩니다.
 *
 * 전에는 제목을 바꾸려면 편집기까지 들어가야 했는데, 책장은 제목이 가장
 * 잘 보이는 자리라 거기서 고치는 게 자연스럽습니다.
 */
export async function updatePortfolioTitle(id: string, title: string): Promise<void> {
  const sb = await requireClient();
  const trimmed = title.trim();
  if (!trimmed) {
    throw new PortfolioError("제목을 입력해 주세요.");
  }
  const { error } = await sb.from("portfolios").update({ title: trimmed }).eq("id", id);
  if (error) {
    throw new PortfolioError("제목을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * [2026-09] 포트폴리오 한 건의 색만 바꿉니다.
 *
 * updateJobColor 와 대상이 다릅니다 — 그쪽은 "같은 직무를 가진 포트폴리오
 * 전부"를 한 번에 칠하는 도구이고, 이건 이 책 한 권입니다. 같은 컬럼을
 * 쓰기 때문에 둘 중 나중에 한 쪽이 이깁니다. 직무 색상은 "기본값을
 * 일괄로 정하는 수단", 책 색은 "그 책만 예외로 두는 수단"으로 씁니다.
 */
export async function updatePortfolioColor(id: string, color: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolios").update({ job_color: color }).eq("id", id);
  if (error) {
    throw new PortfolioError("색상을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * [2026-09] 연도를 직접 지정합니다.
 *
 * year 컬럼은 지금까지 아무 데서도 채우지 않아서, 화면에는 늘 생성
 * 연도가 나왔습니다(toLibraryPortfolio 의 폴백). 대부분은 그게 맞지만
 * 어긋나는 경우가 있습니다 — 2023년 프로젝트를 지금 정리하면 라벨은
 * 2023 이어야 하고, "2025 버전"처럼 판을 구분하는 용도로도 쓰입니다.
 *
 * 빈 값을 넘기면 null 로 저장해 다시 자동(생성 연도)으로 돌아갑니다.
 * "지웠더니 사라짐"이 아니라 "지웠더니 기본값으로 돌아감"이 이 칸에
 * 맞는 동작입니다.
 */
export async function updatePortfolioYear(id: string, year: string): Promise<void> {
  const sb = await requireClient();
  const trimmed = year.trim();
  if (trimmed && !/^\d{4}$/.test(trimmed)) {
    throw new PortfolioError("연도는 네 자리 숫자로 입력해 주세요.");
  }
  const { error } = await sb
    .from("portfolios")
    .update({ year: trimmed || null })
    .eq("id", id);
  if (error) {
    throw new PortfolioError("연도를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/* ------------------------------------------------------------------ */
/* 프로젝트별 이미지                                                    */
/* ------------------------------------------------------------------ */

export interface ProjectImageRow {
  id: string;
  project_id: string;
  storage_path: string;
  caption: string;
  position: number;
  created_at: string;
}

/**
 * 프로젝트 id → 그 프로젝트의 이미지들(공개 URL + 설명).
 *
 * 템플릿은 경로가 아니라 이미 URL 로 바뀐 값을 받습니다 — getPublicUrl
 * 이 비동기라 렌더링 중에 부를 수 없기 때문입니다.
 *
 * [2026-09-23] portfolio-templates/types.ts 에 있던 것을 여기로 옮겼습니다.
 * React 템플릿이 사라지면서 그 폴더가 통째로 없어졌습니다.
 */
export type ProjectImageMap = Record<
  string,
  Array<{ id: string; url: string; caption: string }>
>;

/** 프로젝트당 상한. 그 이상은 포트폴리오가 아니라 갤러리입니다. */
export const MAX_PROJECT_IMAGES = 8;

/**
 * 파일은 기존 portfolio-covers 버킷에 넣습니다 — 새 버킷을 만들지 않습니다.
 * 그 버킷의 Storage 정책이 (storage.foldername(name))[1] = auth.uid() 라서,
 * 경로 첫 칸만 userId 로 맞추면 정책을 새로 쓸 필요가 없습니다. 버킷
 * 이름이 내용과 어긋나는 것은 감수합니다(버킷 이름은 나중에 못 바꿉니다).
 */
function projectImageFolder(userId: string, portfolioId: string, projectId: string) {
  return `${userId}/${portfolioId}/projects/${projectId}`;
}

export async function listProjectImages(projectIds: string[]): Promise<ProjectImageRow[]> {
  if (projectIds.length === 0) return [];
  const sb = await getSupabase();
  if (!sb) return [];

  const { data } = await sb
    .from("portfolio_project_images")
    .select()
    .in("project_id", projectIds)
    .order("position", { ascending: true });

  return (data ?? []) as ProjectImageRow[];
}

export async function uploadProjectImage(input: {
  userId: string;
  portfolioId: string;
  projectId: string;
  file: File;
  position: number;
}): Promise<ProjectImageRow> {
  const sb = await requireClient();

  // 파일명은 시각 + 난수입니다. 사용자가 올린 이름을 그대로 쓰면 한글이나
  // 공백 때문에 경로가 깨지고, 같은 이름을 두 번 올리면 덮어씁니다.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = input.file.type === "image/webp" ? "webp" : (input.file.name.split(".").pop()?.toLowerCase() || "jpg");
  const path = `${projectImageFolder(input.userId, input.portfolioId, input.projectId)}/${stamp}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(COVER_IMAGE_BUCKET)
    .upload(path, input.file, { upsert: false, cacheControl: "3600" });
  if (uploadError) {
    throw new PortfolioError("이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const { data, error } = await sb
    .from("portfolio_project_images")
    .insert({ project_id: input.projectId, storage_path: path, position: input.position })
    .select()
    .single();

  if (error || !data) {
    // 행을 못 만들면 올린 파일은 아무도 참조하지 않는 쓰레기가 됩니다.
    await sb.storage.from(COVER_IMAGE_BUCKET).remove([path]);
    throw new PortfolioError("이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return data as ProjectImageRow;
}

/**
 * 행과 파일을 함께 지웁니다.
 *
 * 행만 지우면 파일이 버킷에 영원히 남습니다 — 테이블의 cascade 는
 * Storage 까지 닿지 않습니다. 표지에서 이미 한 번 겪은 함정입니다.
 */
export async function deleteProjectImage(image: ProjectImageRow): Promise<void> {
  const sb = await requireClient();

  const { error } = await sb.from("portfolio_project_images").delete().eq("id", image.id);
  if (error) {
    throw new PortfolioError("이미지를 삭제하지 못했습니다.");
  }
  // 파일 삭제가 실패해도 화면에서는 이미 사라졌습니다. 여기서 예외를
  // 던지면 "삭제 실패"로 보이는데 사실은 삭제된 상태라 더 혼란스럽습니다.
  await sb.storage.from(COVER_IMAGE_BUCKET).remove([image.storage_path]);
}

/** 끌어서 순서를 바꾼 뒤 한 번에 반영합니다. */
export async function reorderProjectImages(ordered: ProjectImageRow[]): Promise<void> {
  const sb = await requireClient();
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i].position === i) continue;
    const { error } = await sb
      .from("portfolio_project_images")
      .update({ position: i })
      .eq("id", ordered[i].id);
    if (error) {
      throw new PortfolioError("이미지 순서를 저장하지 못했습니다.");
    }
  }
}

export async function updateProjectImageCaption(id: string, caption: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb
    .from("portfolio_project_images")
    .update({ caption })
    .eq("id", id);
  if (error) {
    throw new PortfolioError("설명을 저장하지 못했습니다.");
  }
}

/**
 * [2026-09] 공개/비공개 전환.
 *
 * visibility 컬럼과 RLS 는 처음부터 있었습니다 — `portfolios_select` 가
 * `auth.uid() = user_id or visibility = 'public'` 이라, public 으로 바꾸면
 * 로그인하지 않은 사람도 읽을 수 있습니다. 그런데 **값을 바꾸는 함수가
 * 없었습니다.** 그래서 모든 포트폴리오가 기본값 private 에 영구히 고정돼
 * 있었고, 대시보드의 "공개 N건"은 항상 0이었습니다. 갤러리에 실제
 * 데이터가 없던 것도 결과지 원인이 아니었습니다.
 *
 * 되돌릴 수 있는 동작입니다 — 비공개로 바꾸면 RLS 가 즉시 막으므로
 * 공유 링크도 그 순간부터 열리지 않습니다.
 */
export async function updatePortfolioVisibility(
  id: string,
  visibility: "private" | "public"
): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolios").update({ visibility }).eq("id", id);
  if (error) {
    throw new PortfolioError("공개 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * [2026-09-22] 커뮤니티 목록 노출 전환.
 *
 * 공개(visibility)와 나눠둔 이유는 마이그레이션 주석에 적었습니다 —
 * 요약하면, 재직 중 이직 준비가 이 서비스의 주 사용처라 링크는 조용해야
 * 합니다. 커뮤니티에 올리는 것은 그와 별개의 결정입니다.
 */
export async function updatePortfolioListed(id: string, listed: boolean): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolios").update({ listed }).eq("id", id);
  if (error) {
    throw new PortfolioError("커뮤니티 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * 공개된 포트폴리오를 **로그인 없이** 읽습니다.
 *
 * getPortfolioWithProjects 와 갈라놓은 이유는 실패했을 때 할 말이 다르기
 * 때문입니다. 본인 것을 못 읽으면 "찾을 수 없습니다"가 맞지만, 여기서는
 * 없는 것인지 비공개인지 호출자가 구분할 수 없습니다 — RLS 가 비공개 행을
 * 아예 없는 것처럼 돌려주기 때문입니다. 그게 옳은 동작입니다(비공개
 * 포트폴리오의 존재 여부조차 알려줄 이유가 없습니다). 대신 사용자에게는
 * 두 경우를 합쳐 "공개되지 않았습니다"로 말합니다.
 */
export async function getPublicPortfolio(
  id: string
): Promise<{ portfolio: PortfolioRow; projects: PortfolioProjectRow[] } | null> {
  const sb = await getSupabase();
  if (!sb) return null;

  const { data: portfolio } = await sb
    .from("portfolios")
    .select()
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();

  if (!portfolio) return null;

  const { data: projects } = await sb
    .from("portfolio_projects")
    .select()
    .eq("portfolio_id", id)
    .order("position", { ascending: true });

  return {
    portfolio: portfolio as PortfolioRow,
    projects: (projects ?? []) as PortfolioProjectRow[],
  };
}

/** 공개된 포트폴리오 목록 — 커뮤니티 갤러리용. */
export async function listPublicPortfolios(limit = 60): Promise<LibraryPortfolio[]> {
  const sb = await getSupabase();
  if (!sb) return [];

  const { data } = await sb
    .from("portfolios")
    .select()
    .eq("visibility", "public")
    .eq("listed", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as PortfolioRow[]).map(toLibraryPortfolio);
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
