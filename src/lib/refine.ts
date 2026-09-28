import { getSupabase } from "./supabase";

/**
 * AI 문장 다듬기 — supabase/functions/refine.
 * 표현만 바꾸고, 원문에 없는 숫자·영문 용어가 생기면 서버가 flags 로 알려 줍니다.
 */
export class RefineError extends Error {}

export type RefineDirection = "default" | "shorter" | "impact" | "plain";

export const DIRECTION_LABEL: Record<Exclude<RefineDirection, "default">, string> = {
  shorter: "더 짧게",
  impact: "성과 먼저",
  plain: "쉬운 말로",
};

export interface RefineResult {
  text: string;
  notes: string[];
  flags: Array<{ kind: "number" | "term"; detail: string }>;
}

export async function refineText(input: {
  projectId: string;
  field: string;
  text: string;
  direction?: RefineDirection;
}): Promise<RefineResult> {
  const sb = await getSupabase();
  if (!sb) throw new RefineError("서버 연결이 설정되지 않았습니다.");
  const { data, error } = await sb.functions.invoke("refine", { body: { ...input, direction: input.direction ?? "default" } });
  if (error) {
    let detail: string | null = null;
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = await ctx.clone().json().catch(() => null);
      if (body && typeof body.error === "string") detail = body.error;
    }
    throw new RefineError(detail ?? "다듬기 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (data?.error) throw new RefineError(String(data.error));
  return data as RefineResult;
}
