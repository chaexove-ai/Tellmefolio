/**
 * AI 호출의 로그인 확인과 사용자별 사용량 한도.
 *
 * [왜 필요한가]
 * Supabase 는 함수 앞에서 JWT 를 검증하지만, 사이트에 공개된 anon 키도
 * 올바른 JWT 입니다. 그래서 "JWT 검증"만으로는 로그인하지 않은 호출도
 * 통과합니다 — generate-draft, translate-portfolio 가 그랬습니다.
 * 여기서 auth.getUser 로 실제 사용자인지 확인합니다.
 *
 * 한도는 최근 24시간 동안의 성공한 호출 수로 셉니다(자정 기준이 아니라
 * 굴러가는 창). 기록은 draft_generations 에 kind 를 달아 남기고,
 * 대화로 만들기는 모델을 부르는 턴이 여러 번이라 "새로 연 대화 수"로
 * 셉니다(한 대화는 rules.ts 가 질문 12개로 이미 묶어 둡니다).
 *
 * 숫자는 시크릿으로 바꿀 수 있습니다(재배포 없이):
 *   npx supabase secrets set AI_LIMIT_JOB_SWITCH=10
 */

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export type UsageKind = "draft" | "translate" | "job_switch" | "interview";

const DEFAULT_LIMIT: Record<UsageKind, number> = {
  draft: 20,
  translate: 20,
  job_switch: 5,
  interview: 10,
};

const ENV_NAME: Record<UsageKind, string> = {
  draft: "AI_LIMIT_DRAFT",
  translate: "AI_LIMIT_TRANSLATE",
  job_switch: "AI_LIMIT_JOB_SWITCH",
  interview: "AI_LIMIT_INTERVIEW",
};

const WHAT: Record<UsageKind, string> = {
  draft: "AI 초안 생성",
  translate: "영어 번역",
  job_switch: "직무 전환 재구성",
  interview: "새 대화 시작",
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function limitFor(kind: UsageKind): number {
  const raw = Number(Deno.env.get(ENV_NAME[kind]));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LIMIT[kind];
}

export class QuotaError extends Error {
  status = 429;
}
export class AuthError extends Error {
  status = 401;
}

/** 요청의 JWT 로 사용자 클라이언트를 만들고, 실제 로그인한 사용자인지 확인합니다. */
export async function requireUser(req: Request): Promise<{ sb: SupabaseClient; user: User }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!data?.user) throw new AuthError("로그인이 필요합니다.");
  return { sb, user: data.user };
}

/** "3시간 뒤" / "40분 뒤" */
export function waitText(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return min >= 60 ? `${Math.ceil(min / 60)}시간 뒤` : `${min}분 뒤`;
}

/** 한도 안내 문장. 순수 함수라 따로 시험합니다. */
export function quotaMessage(kind: UsageKind, limit: number, oldestAt: string | null, now = Date.now()): string {
  const base = `${WHAT[kind]}은 하루 ${limit}번까지예요.`;
  if (!oldestAt) return `${base} 잠시 후 다시 시도해 주세요.`;
  const left = new Date(oldestAt).getTime() + WINDOW_MS - now;
  return `${base} ${waitText(left)}에 다시 쓸 수 있어요.`;
}

/**
 * 한도를 넘었으면 QuotaError. 모델을 부르기 전에 호출합니다.
 * 본인 행만 읽는 RLS 로 셉니다 — 서비스 키가 필요 없습니다.
 */
export async function assertQuota(sb: SupabaseClient, userId: string, kind: UsageKind): Promise<void> {
  const limit = limitFor(kind);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const query =
    kind === "interview"
      ? sb.from("interview_sessions").select("created_at").eq("user_id", userId)
      : sb.from("draft_generations").select("created_at").eq("user_id", userId).eq("kind", kind);

  const { data, error } = await query.gte("created_at", since).order("created_at", { ascending: true }).limit(limit);
  if (error) {
    // 셀 수 없으면 막지 않고 기록만 남깁니다. 세는 쪽 장애로 서비스 전체가 서지 않게.
    console.error("사용량 확인 실패", kind, error);
    return;
  }
  if ((data?.length ?? 0) >= limit) {
    throw new QuotaError(quotaMessage(kind, limit, data?.[0]?.created_at ?? null));
  }
}

/** 성공한 호출을 기록합니다. 실패해도 응답은 막지 않습니다. */
export async function recordUsage(
  sb: SupabaseClient,
  row: { user_id: string; kind: UsageKind; portfolio_id?: string | null; input_tokens?: number; output_tokens?: number }
): Promise<void> {
  const { error } = await sb.from("draft_generations").insert({ portfolio_id: null, ...row });
  if (error) console.error("사용량 기록 실패", error);
}
