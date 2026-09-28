import { getSupabase } from "./supabase";
import { THEME_FONTS, normalizeTheme, type PortfolioTheme } from "./themeRules";

/**
 * 분위기 바꾸기 — supabase/functions/theme. [2026-09-28]
 * 말로 적은 분위기를 테마 값(바탕·강조색·서체·모서리)으로 바꿉니다. 글 내용은 보내지 않습니다.
 */
export class ThemeError extends Error {}

export async function suggestTheme(input: {
  prompt: string;
  current: PortfolioTheme;
  job?: string | null;
}): Promise<{ theme: PortfolioTheme; note: string }> {
  const sb = await getSupabase();
  if (!sb) throw new ThemeError("서버 연결이 설정되지 않았습니다.");
  const { prompt: _p, ...current } = input.current;
  void _p;
  const { data, error } = await sb.functions.invoke("theme", {
    body: {
      prompt: input.prompt,
      current,
      job: input.job ?? "",
      fonts: THEME_FONTS.map((f) => ({ id: f.id, label: f.label, kind: f.kind })),
    },
  });
  if (error) {
    let detail: string | null = null;
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = await ctx.clone().json().catch(() => null);
      if (body && typeof body.error === "string") detail = body.error;
    }
    throw new ThemeError(detail ?? "분위기를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (data?.error) throw new ThemeError(String(data.error));
  return { theme: normalizeTheme({ ...data.theme, prompt: input.prompt }), note: String(data.note ?? "") };
}
