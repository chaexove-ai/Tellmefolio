/**
 * 계정 데이터의 내보내기와 삭제.
 *
 * [왜 별도 파일인가]
 * portfolios.ts 는 "포트폴리오 한 건을 읽고 쓴다"가 주제입니다. 여기는
 * "이 계정의 전부를 꺼내거나 지운다"가 주제라 성격이 다릅니다. 무엇보다
 * 이 파일의 함수들은 전부 되돌릴 수 없어서, 한 군데 모아두고 호출부를
 * 눈으로 셀 수 있게 하는 편이 안전합니다.
 *
 * [2026-09] 그 전까지 데이터 관리 화면의 버튼 세 개는 모달만 닫고
 * 아무 일도 하지 않았습니다. "계정 삭제" 는 navigate("/") 만 했습니다.
 * 사용자가 지웠다고 믿는데 그대로 남아 있는 상태였습니다.
 */

import { getSupabase } from "./supabase";
import { COVER_IMAGE_BUCKET, PortfolioError } from "./portfolios";
import type { PortfolioRow, PortfolioProjectRow } from "./portfolios";

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new PortfolioError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

/* ------------------------------------------------------------------ */
/* 내보내기                                                            */
/* ------------------------------------------------------------------ */

export interface ExportedData {
  exportedAt: string;
  account: {
    id: string;
    email: string | null;
    createdAt: string | null;
    providers: string[];
  };
  portfolios: Array<PortfolioRow & { projects: PortfolioProjectRow[] }>;
  draftGenerations: unknown[];
  /** [2026-09-23] 닉네임·프로필 사진 경로. 내보내기는 "내 데이터 전부"라고
   *  적혀 있으니, 새로 생긴 데이터도 같이 나가야 합니다. */
  profile: unknown | null;
  /** [2026-09-25] 제출 기록(어디에 무엇을 냈는지). 결과물 HTML 파일은
   *  빼고 행만 담습니다 — 파일은 제출 기록 화면에서 하나씩 받을 수 있습니다. */
  submissions: unknown[];
}

/**
 * 계정의 전체 데이터를 한 덩어리로 모읍니다.
 *
 * 전에 화면은 "최대 24시간 이내 이메일 발송" 이라고 안내했는데, 그런
 * 파이프라인은 없었습니다. 데이터 양이 포트폴리오 몇 건 수준이라 그
 * 자리에서 만들어 내려주면 됩니다 — 기다릴 이유가 없습니다.
 *
 * RLS 가 전부 `user_id = auth.uid()` 라서, 여기서 굳이 user_id 로
 * 거르지 않아도 남의 행은 애초에 내려오지 않습니다. 그래도 명시적으로
 * 겁니다 — 정책이 바뀌었을 때 조용히 새는 것보다 낫습니다.
 */
export async function exportMyData(userId: string): Promise<ExportedData> {
  const sb = await requireClient();

  const [{ data: user }, portfolioRes, projectRes, draftRes, profileRes, submissionRes] = await Promise.all([
    sb.auth.getUser(),
    sb.from("portfolios").select().eq("user_id", userId).order("created_at"),
    sb.from("portfolio_projects").select().order("position"),
    sb.from("draft_generations").select().eq("user_id", userId).order("created_at"),
    sb.from("profiles").select().eq("id", userId).maybeSingle(),
    sb.from("portfolio_submissions").select().eq("user_id", userId).order("submitted_on"),
  ]);

  if (portfolioRes.error || projectRes.error) {
    throw new PortfolioError("데이터를 모으지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  const portfolios = (portfolioRes.data ?? []) as PortfolioRow[];
  const projects = (projectRes.data ?? []) as PortfolioProjectRow[];

  const authUser = user?.user ?? null;

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: userId,
      email: authUser?.email ?? null,
      createdAt: authUser?.created_at ?? null,
      providers: (authUser?.identities ?? []).map((i) => i.provider),
    },
    portfolios: portfolios.map((p) => ({
      ...p,
      projects: projects.filter((pr) => pr.portfolio_id === p.id),
    })),
    // draft_generations 는 실패해도 내보내기 전체를 막지 않습니다 —
    // 호출 기록은 부가 정보이고, 본문인 포트폴리오가 더 중요합니다.
    draftGenerations: draftRes.error ? [] : (draftRes.data ?? []),
    profile: profileRes.error ? null : (profileRes.data ?? null),
    submissions: submissionRes.error ? [] : (submissionRes.data ?? []),
  };
}

/** 모은 데이터를 파일로 내려받게 합니다. 브라우저에서만 호출하세요. */
export function downloadAsJson(data: ExportedData, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke 를 즉시 하면 사파리에서 다운로드가 취소되는 일이 있어 한 틱 둡니다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* 삭제                                                                */
/* ------------------------------------------------------------------ */

/**
 * 포트폴리오를 지웁니다.
 *
 * portfolio_projects 는 `on delete cascade` 라 DB 가 알아서 따라 지웁니다.
 * 반면 **Storage 의 표지 이미지는 따라 지워지지 않습니다** — 스토리지는
 * 테이블의 외래키와 무관한 별도 저장소입니다. 남겨두면 지웠다고 생각한
 * 이미지의 공개 URL 이 계속 살아 있게 되므로 여기서 직접 지웁니다.
 */
export async function deletePortfolios(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sb = await requireClient();

  // 표지 경로를 먼저 읽어둡니다 — 행을 지우고 나면 알 수 없습니다.
  const { data: rows } = await sb
    .from("portfolios")
    .select("cover_image_path")
    .in("id", ids);

  const coverPaths = ((rows ?? []) as Array<{ cover_image_path: string | null }>)
    .map((r) => r.cover_image_path)
    .filter((p): p is string => Boolean(p));

  // [2026-09-22] 프로젝트 이미지 파일도 같이 챙깁니다. 포트폴리오를 지우면
  // 프로젝트와 이미지 "행"은 cascade 로 따라가지만, Storage 파일은 그대로
  // 남습니다. 지우고 나면 어떤 파일이 그 포트폴리오 것이었는지 알 수
  // 없으므로 지우기 전에 읽어둬야 합니다.
  const { data: projects } = await sb
    .from("portfolio_projects")
    .select("id")
    .in("portfolio_id", ids);
  const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);

  let imagePaths: string[] = [];
  if (projectIds.length > 0) {
    const { data: images } = await sb
      .from("portfolio_project_images")
      .select("storage_path")
      .in("project_id", projectIds);
    imagePaths = ((images ?? []) as Array<{ storage_path: string }>).map((i) => i.storage_path);
  }

  const { error } = await sb.from("portfolios").delete().in("id", ids);
  if (error) {
    throw new PortfolioError("포트폴리오를 삭제하지 못했습니다.");
  }

  const allPaths = [...coverPaths, ...imagePaths];
  if (allPaths.length > 0) {
    // 이미지 삭제가 실패해도 본문은 이미 지워졌습니다. 여기서 예외를
    // 던지면 "삭제 실패" 로 보이는데 사실은 삭제된 상태라 더 혼란스럽습니다.
    await sb.storage.from(COVER_IMAGE_BUCKET).remove(allPaths);
  }
}

/**
 * 계정 자체를 지웁니다.
 *
 * [왜 서버가 필요한가]
 * auth.users 행은 브라우저에서 지울 수 없습니다. 지우려면 service_role
 * 키가 필요한데 그 키는 프런트에 둘 수 없습니다 — 있으면 누구나 남의
 * 계정을 지울 수 있습니다. 그래서 Edge Function 한 개를 둡니다.
 *
 * 함수는 JWT 로 본인 확인을 하고 본인 것만 지웁니다. 클라이언트는 어떤
 * id 도 넘기지 않습니다 — 넘길 수 있게 만들면 그 자체가 구멍입니다.
 */
export async function deleteMyAccount(): Promise<void> {
  const sb = await requireClient();

  const { data, error } = await sb.functions.invoke("delete-account");

  if (error) {
    throw new PortfolioError(
      "계정을 삭제하지 못했습니다. 문제가 계속되면 문의해주세요."
    );
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new PortfolioError(String((data as { error: unknown }).error));
  }

  // 계정은 사라졌지만 이 브라우저의 토큰은 남아 있습니다. 지우지 않으면
  // 다음 새로고침까지 로그인한 것처럼 보입니다.
  await sb.auth.signOut();
}
