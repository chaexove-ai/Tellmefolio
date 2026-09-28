/**
 * 분위기 바꾸기 — "따뜻한 베이지에 세리프"처럼 말하면 테마 값을 고릅니다. [2026-09-28]
 *
 * v0 처럼 말로 디자인을 바꾸는 첫 단계입니다. AI 는 값 다섯 개만 고릅니다:
 * 바탕색·강조색(#rrggbb), 제목·본문 서체(주어진 목록 중), 모서리.
 * 글자색·선·면 색은 화면에서 대비를 계산해 만듭니다(src/lib/themeRules.ts) —
 * AI 에게 색을 전부 고르게 하면 안 읽히는 조합이 나옵니다.
 *
 * 포트폴리오 내용(글)은 보내지 않습니다. 디자인만 바꿉니다.
 *
 * 요청: { prompt, current?, job?, fonts: [{ id, label, kind }] }
 *   fonts 는 화면이 쓰는 서체 목록을 그대로 보냅니다 — 목록을 두 곳에 두면 어긋납니다.
 * 응답: { theme: { bg, accent, titleFont, bodyFont, radius }, note }
 */

import { callModelJson, ModelError } from "../_shared/model.ts";
import { AuthError, QuotaError, assertQuota, recordUsage, requireUser } from "../_shared/usage.ts";

const MODEL = Deno.env.get("THEME_MODEL") ?? Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const HEX = /^#[0-9a-f]{6}$/i;
const RADII = ["none", "soft", "round"];

interface FontInfo {
  id: string;
  label: string;
  kind: string;
}

export function buildPrompt(input: { prompt: string; current: Record<string, unknown>; job: string; fonts: FontInfo[] }): string {
  const fontList = input.fonts.map((f) => `- ${f.id} (${f.label}, ${f.kind})`).join("\n");
  const hasCurrent = Object.keys(input.current).length > 0;
  return `당신은 포트폴리오 웹페이지의 시각 디자이너입니다. 사용자가 원하는 분위기를 듣고 테마 값을 고릅니다.

## 사용자 요청
${input.prompt}
${input.job ? `\n(지원 직무: ${input.job})` : ""}${hasCurrent ? `\n\n## 지금 테마 — 요청이 "더 ~하게" 같은 수정이면 이것을 기준으로 바꾸세요\n${JSON.stringify(input.current)}` : ""}

## 고를 값
- bg: 페이지 바탕색 #rrggbb
- accent: 강조색 #rrggbb (버튼·번호·포인트). 바탕과 뚜렷하게 구분되게.
- titleFont, bodyFont: 아래 목록의 id 중에서만. 제목용은 성격이 드러나게, 본문용은 읽기 편하게.
${fontList}
- radius: none(각지게) | soft(부드럽게) | round(둥글게)

## 지킬 것
- 채용 담당자가 보는 포트폴리오입니다. 요청이 강렬해도 글이 읽혀야 합니다.
- 글자색은 따로 계산하니 고르지 마세요.

## 출력
JSON 하나만, 설명 없이:
{"bg":"#…","accent":"#…","titleFont":"…","bodyFont":"…","radius":"…","note":"고른 이유를 한 문장(존댓말, 40자 이내)"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST 만 지원합니다." }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "서버에 API 키가 설정되지 않았습니다." }, 500);

  try {
    const { sb, user } = await requireUser(req);

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
    }
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim().slice(0, 300) : "";
    if (prompt.length < 2) return json({ error: "원하는 분위기를 한두 단어라도 적어 주세요." }, 400);
    const job = typeof payload.job === "string" ? payload.job.trim().slice(0, 60) : "";
    const current =
      payload.current && typeof payload.current === "object" ? (payload.current as Record<string, unknown>) : {};
    const fonts = (Array.isArray(payload.fonts) ? payload.fonts : [])
      .filter(
        (f): f is FontInfo =>
          !!f && typeof f === "object" && typeof (f as FontInfo).id === "string" && typeof (f as FontInfo).label === "string"
      )
      .slice(0, 30)
      .map((f) => ({ id: f.id.slice(0, 40), label: f.label.slice(0, 40), kind: String(f.kind ?? "").slice(0, 20) }));
    if (fonts.length === 0) return json({ error: "서체 목록이 없습니다." }, 400);

    await assertQuota(sb, user.id, "theme");

    const { data, usage } = await callModelJson(MODEL, buildPrompt({ prompt, current, job, fonts }), 400, {
      stage: "분위기 고르기",
      timeoutMs: 25_000,
    });
    const d = (data ?? {}) as Record<string, unknown>;
    const ids = new Set(fonts.map((f) => f.id));
    const theme: Record<string, string> = {};
    if (typeof d.bg === "string" && HEX.test(d.bg)) theme.bg = d.bg.toLowerCase();
    if (typeof d.accent === "string" && HEX.test(d.accent)) theme.accent = d.accent.toLowerCase();
    if (typeof d.titleFont === "string" && ids.has(d.titleFont)) theme.titleFont = d.titleFont;
    if (typeof d.bodyFont === "string" && ids.has(d.bodyFont)) theme.bodyFont = d.bodyFont;
    if (typeof d.radius === "string" && RADII.includes(d.radius)) theme.radius = d.radius;
    if (!theme.bg && !theme.accent) return json({ error: "분위기를 고르지 못했어요. 조금 다르게 적어 주세요." }, 502);
    const note = typeof d.note === "string" ? d.note.trim().slice(0, 80) : "";

    await recordUsage(sb, { user_id: user.id, kind: "theme", ...usage });
    return json({ theme, note });
  } catch (e) {
    if (e instanceof AuthError || e instanceof QuotaError || e instanceof ModelError)
      return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "분위기를 고르는 중 문제가 생겼습니다." }, 500);
  }
});
