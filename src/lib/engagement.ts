import { getSupabase } from "./supabase";
import type { LibraryPortfolio, PortfolioRow } from "./portfolios";
import { toLibraryPortfolio } from "./portfolios";

/**
 * 조회수 · "참고할게요" (09-28). 설계는 supabase/migrations/20260928100000_views_bookmarks.sql.
 * 숫자는 포트폴리오 주인에게만 보입니다.
 */

const VISITOR_KEY = "tf:visitor";

/** 로그인하지 않은 방문자를 하루 한 번만 세려고 브라우저에 두는 임의 id */
function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "no-storage";
  }
}

/** 공개 열람 페이지가 열릴 때. 실패해도 화면에는 아무 영향이 없습니다. */
export async function recordView(portfolioId: string): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.rpc("record_portfolio_view", { p_portfolio: portfolioId, p_visitor: visitorId() });
  if (error) console.warn("조회 기록 실패", error.message);
}

export interface PortfolioStats {
  views: number;
  views7d: number;
  bookmarks: number;
}

/** 내 포트폴리오들의 조회·참고 수. 테이블이 아직 없으면(마이그레이션 전) 빈 값. */
export async function getMyStats(): Promise<Record<string, PortfolioStats>> {
  const sb = await getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.rpc("my_portfolio_stats");
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, PortfolioStats> = {};
  for (const r of data as Array<{ portfolio_id: string; views: number; views_7d: number; bookmarks: number }>) {
    out[r.portfolio_id] = { views: r.views, views7d: r.views_7d, bookmarks: r.bookmarks };
  }
  return out;
}

/** 내가 "참고할게요"를 누른 포트폴리오 id */
export async function getMyBookmarkIds(): Promise<Set<string>> {
  const sb = await getSupabase();
  if (!sb) return new Set();
  const { data, error } = await sb
    .from("portfolio_bookmarks")
    .select("portfolio_id")
    .order("created_at", { ascending: false });
  if (error) return new Set();
  return new Set((data ?? []).map((r: { portfolio_id: string }) => r.portfolio_id));
}

export async function setBookmark(portfolioId: string, on: boolean): Promise<void> {
  const sb = await getSupabase();
  if (!sb) throw new Error("서버 연결이 설정되지 않았습니다.");
  const { error } = on
    ? await sb.from("portfolio_bookmarks").insert({ portfolio_id: portfolioId })
    : await sb.from("portfolio_bookmarks").delete().eq("portfolio_id", portfolioId);
  // 이미 눌려 있었으면(중복 키) 성공으로 봅니다
  if (error && error.code !== "23505") throw new Error(on ? "참고 표시를 하지 못했어요." : "참고 표시를 지우지 못했어요.");
}

/**
 * 참고한 포트폴리오 목록. 공개가 해제된 것은 RLS 로 빠집니다.
 * 커뮤니티 목록(최근 60)에 없는 오래된 것도 나와야 해서 따로 읽습니다.
 */
export async function listBookmarkedPortfolios(): Promise<LibraryPortfolio[]> {
  const sb = await getSupabase();
  if (!sb) return [];
  const ids = [...(await getMyBookmarkIds())];
  if (ids.length === 0) return [];
  const { data } = await sb.from("portfolios").select().in("id", ids).eq("visibility", "public");
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((data ?? []) as PortfolioRow[])
    .map(toLibraryPortfolio)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
