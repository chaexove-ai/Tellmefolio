/**
 * 포트폴리오 초안 생성 Edge Function.
 *
 * [왜 서버가 필요한가]
 * AI API 키는 브라우저에 둘 수 없습니다. 배포된 자바스크립트에서 그대로
 * 읽히고, 그 순간 남의 카드로 요금이 나갑니다. 키는 여기에만 있습니다.
 *
 * [인증]
 * Supabase Edge Function 은 기본적으로 JWT 를 검증합니다. 로그인하지 않은
 * 요청은 이 코드에 닿기 전에 막힙니다. 그래도 사용자별 사용 횟수 제한은
 * 아직 없습니다 — DB 테이블이 있어야 세는데 그건 다음 단계입니다.
 * 그전까지는 Anthropic 콘솔에서 월 한도를 걸어두는 것이 유일한 방어선입니다.
 *
 * [모델]
 * 기본값은 Haiku 입니다. 초안 생성에는 충분하고 Sonnet 대비 3분의 1 값입니다.
 * 결과가 부족하면 MODEL 시크릿만 바꾸면 되고 코드는 그대로입니다.
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";

/** 입력 폭주를 막는 상한. 프런트에서도 자르지만 서버가 최종 방어선입니다. */
const MAX_MATERIALS = 8;
const MAX_README = 4000;
const MAX_NOTE = 4000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Material {
  name: string;
  description?: string | null;
  languages?: string[];
  readme?: string | null;
  readmeTruncated?: boolean;
}

interface Payload {
  materials?: Material[];
  note?: string;
  job?: string;
  structure?: string;
  extra?: string;
  title?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** 저장소 재료를 프롬프트에 넣을 텍스트로 만듭니다. */
function renderMaterials(materials: Material[]) {
  return materials
    .slice(0, MAX_MATERIALS)
    .map((m, i) => {
      const parts = [`### 저장소 ${i + 1}: ${m.name}`];
      if (m.description) parts.push(`설명: ${m.description}`);
      if (m.languages?.length) parts.push(`사용 언어: ${m.languages.join(", ")}`);
      if (m.readme) {
        parts.push("README:");
        parts.push(m.readme.slice(0, MAX_README));
        if (m.readmeTruncated) parts.push("(README 는 앞부분만 포함되어 있습니다)");
      } else {
        parts.push("README 없음");
      }
      return parts.join("\n");
    })
    .join("\n\n");
}

function buildPrompt(p: Payload) {
  const materials = p.materials ?? [];
  const sections: string[] = [];

  sections.push(
    "아래는 한 개발자의 GitHub 공개 저장소에서 가져온 자료입니다. 이를 바탕으로 채용 담당자가 읽을 포트폴리오 초안을 작성해 주세요."
  );

  if (materials.length > 0) {
    sections.push("## 저장소 자료\n\n" + renderMaterials(materials));
  }

  if (p.note?.trim()) {
    sections.push("## 본인이 직접 작성한 메모\n\n" + p.note.trim().slice(0, MAX_NOTE));
  }

  sections.push(
    [
      "## 작성 조건",
      `- 목표 직무: ${p.job ?? "개발자"}`,
      `- 구성 방식: ${p.structure ?? "결과 중심형"}`,
      p.extra?.trim() ? `- 추가 요청: ${p.extra.trim().slice(0, 1000)}` : "",
      "",
      "## 지켜야 할 것",
      "- 자료에 없는 성과나 수치를 지어내지 마세요. README 에 근거가 없으면 쓰지 않습니다.",
      "- 근거가 부족한 항목은 생략하고, 무엇이 부족한지 gaps 에 적으세요.",
      "- 문장은 한국어로, 채용 담당자가 30초 안에 파악할 수 있게 씁니다.",
      "- 기술 나열이 아니라 무엇을 왜 만들었고 무엇이 나아졌는지를 씁니다.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  sections.push(
    [
      "## 출력 형식",
      "설명이나 인사말 없이 아래 JSON 만 출력하세요. 마크다운 코드펜스도 붙이지 마세요.",
      "{",
      '  "title": "포트폴리오 제목",',
      '  "summary": "3~4문장의 전체 소개",',
      '  "projects": [',
      '    { "name": "프로젝트명", "oneLiner": "한 줄 설명", "body": "3~5문장 설명", "highlights": ["핵심 포인트"], "stack": ["기술"] }',
      "  ],",
      '  "gaps": ["자료가 부족해 쓰지 못한 부분"]',
      "}",
    ].join("\n")
  );

  return sections.join("\n\n");
}

/** 모델이 코드펜스를 붙이는 경우가 있어 벗겨낸 뒤 파싱합니다. */
function parseDraft(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 앞뒤에 설명이 붙은 경우를 대비해 가장 바깥 중괄호만 잘라 재시도합니다.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST 만 지원합니다." }, 405);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "서버에 API 키가 설정되지 않았습니다." }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const hasMaterial =
    (payload.materials?.length ?? 0) > 0 || Boolean(payload.note?.trim());
  if (!hasMaterial) {
    return json({ error: "초안을 만들 자료가 없습니다." }, 400);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: buildPrompt(payload) }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic 오류", res.status, detail);
      // 원문을 그대로 내보내면 키 관련 정보가 새어 나갈 수 있어 상태만 전달합니다.
      return json(
        {
          error:
            res.status === 429
              ? "요청이 몰렸습니다. 잠시 후 다시 시도해 주세요."
              : "초안 생성에 실패했습니다.",
        },
        502
      );
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const draft = parseDraft(text);
    if (!draft) {
      console.error("JSON 파싱 실패", text.slice(0, 500));
      return json({ error: "생성 결과를 해석하지 못했습니다. 다시 시도해 주세요." }, 502);
    }

    return json({ draft, usage: data.usage ?? null });
  } catch (e) {
    console.error(e);
    return json({ error: "초안 생성 중 문제가 생겼습니다." }, 500);
  }
});
