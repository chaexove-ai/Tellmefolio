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
 *
 * [2026-09 추가] 웹 링크 자료.
 * 지금까지 SourceInput 에서 고른 "웹 링크"는 화면에 목록으로만 보이고
 * 실제로는 이 함수에 전혀 전달되지 않았습니다 — 웹 링크만 고르면
 * materials·note 가 둘 다 비어서 400("초안을 만들 자료가 없습니다")이
 * 났습니다. 이제 links 를 받아 서버에서 직접 fetch 해 본문 텍스트를
 * 뽑아 프롬프트에 넣습니다. 브라우저에서 임의 외부 사이트로 fetch하면
 * 그 사이트가 CORS 를 열어두지 않는 한 대부분 막히기 때문에, 이 작업은
 * 브라우저가 아니라 서버가 해야 합니다.
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";

/** 입력 폭주를 막는 상한. 프런트에서도 자르지만 서버가 최종 방어선입니다. */
const MAX_MATERIALS = 8;
const MAX_README = 4000;
const MAX_NOTE = 4000;
const MAX_LINKS = 3;
const MAX_LINK_CONTENT = 4000;
const LINK_FETCH_TIMEOUT_MS = 8000;

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
  links?: string[];
  job?: string;
  structure?: string;
  extra?: string;
  title?: string;
}

interface LinkContent {
  url: string;
  text: string | null;
  error?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * 사설·루프백 주소로의 요청을 막습니다(SSRF 방지). 이 함수가 사용자가
 * 입력한 임의의 URL을 서버에서 직접 fetch 하기 때문에, 내부 네트워크나
 * 클라우드 메타데이터 엔드포인트를 가리키는 주소는 애초에 요청하지
 * 않습니다.
 */
function isSafeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "169.254.169.254") return false;
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (host.endsWith(".local")) return false;
  return true;
}

/** 아주 단순한 HTML → 텍스트 변환. 별도 파싱 라이브러리를 넣지 않으려고
 *  정규식으로 script/style/태그를 벗겨내고 공백만 정리합니다. 마크업이
 *  복잡한 SPA는 껍데기만 남을 수 있는데, 그건 숨기지 않고 결과가 짧은
 *  채로 그대로 넘깁니다 — AI 쪽 gaps 안내로 이어지게 됩니다. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** <title>·설명 메타 태그만 따로 뽑습니다.
 *
 *  [왜 필요한가] Vite/React 같은 SPA로 배포된 개인 사이트(정확히 이
 *  프로젝트 같은 구조)는 서버가 돌려주는 HTML의 <body>가 빈 div 하나와
 *  <script> 태그뿐이고, 실제 내용은 브라우저에서 JS가 그립니다. Edge
 *  Function은 헤드리스 브라우저가 아니라 그 JS를 실행할 수 없어서,
 *  htmlToText만 쓰면 SPA 링크는 거의 항상 빈 텍스트가 됩니다. 대신
 *  <title>과 description/OG 메타 태그는 정적 HTML에도 보통 박혀 있어서
 *  (배포 도구가 공유 미리보기용으로 넣어두는 경우가 많음), 최소한의
 *  신호로 같이 뽑아 붙입니다. */
function extractMeta(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1];
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1];
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1];

  const parts: string[] = [];
  if (title) parts.push(`페이지 제목: ${title}`);
  if (ogTitle && ogTitle !== title) parts.push(`OG 제목: ${ogTitle}`);
  if (desc) parts.push(`설명: ${desc}`);
  if (ogDesc && ogDesc !== desc) parts.push(`OG 설명: ${ogDesc}`);
  return parts.join("\n");
}

async function fetchLinkContent(url: string): Promise<LinkContent> {
  if (!isSafeUrl(url)) {
    return { url, text: null, error: "허용되지 않는 주소입니다." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TellmefolioBot/1.0)" },
    });
    if (!res.ok) {
      return { url, text: null, error: `요청 실패 (${res.status})` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return { url, text: null, error: "텍스트 콘텐츠가 아닙니다." };
    }
    const raw = await res.text();
    const meta = extractMeta(raw);
    const bodyText = htmlToText(raw);
    // SPA라 bodyText가 거의 비어도 meta만으로 조금이나마 신호를 줍니다.
    const combined = [meta, bodyText].filter(Boolean).join("\n\n").slice(0, MAX_LINK_CONTENT);
    if (!combined) return { url, text: null, error: "본문을 추출하지 못했습니다." };
    return { url, text: combined };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { url, text: null, error: timedOut ? "응답 시간이 초과됐습니다." : "가져오지 못했습니다." };
  } finally {
    clearTimeout(timeout);
  }
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

function renderLinks(links: LinkContent[]) {
  return links
    .map((l, i) => {
      const parts = [`### 링크 ${i + 1}: ${l.url}`];
      parts.push(l.text ? l.text : `(가져오지 못했습니다: ${l.error ?? "알 수 없는 오류"})`);
      return parts.join("\n");
    })
    .join("\n\n");
}

function buildPrompt(p: Payload, linkContents: LinkContent[]) {
  const materials = p.materials ?? [];
  const sections: string[] = [];

  sections.push(
    "아래는 한 개발자의 GitHub 공개 저장소, 본인이 운영하는 웹사이트/링크, 직접 쓴 메모에서 가져온 자료입니다. 이를 바탕으로 채용 담당자가 읽을 포트폴리오 초안을 작성해 주세요."
  );

  if (materials.length > 0) {
    sections.push("## 저장소 자료\n\n" + renderMaterials(materials));
  }

  if (linkContents.length > 0) {
    sections.push("## 웹 링크 자료\n\n" + renderLinks(linkContents));
  }

  if (p.note?.trim()) {
    sections.push("## 본인이 직접 작성한 메모\n\n" + p.note.trim().slice(0, MAX_NOTE));
  }

  sections.push(
    [
      "## 작성 조건",
      `- 목표 직무: ${p.job ?? "개발자"}`,
      `- 구성 방식: ${p.structure ?? "결과 중심형"}`,
      // [2026-09-23] 라벨을 "추가 요청"에서 바꿨습니다.
      //
      // 이 칸에는 두 가지가 들어옵니다: 사용자가 직접 적은 요청과,
      // 앞선 생성에서 "자료가 부족했던 부분"으로 지적된 항목에 사용자가
      // 채워 넣은 사실입니다. 후자를 "요청"으로 읽으면 모델이 반영을
      // 망설이거나 문체 지시로 오해합니다. 사실로 읽어야 합니다.
      //
      // 길이도 1,000자에서 늘렸습니다 — 부족 항목이 네댓 개면 답만으로도
      // 1,000자를 넘기고, 그러면 뒤에 적은 것이 잘려 나갑니다.
      p.extra?.trim()
        ? `- 사용자가 추가로 알려준 내용(요청이거나 보완한 사실입니다. 사실로 적힌 것은 자료와 같은 근거로 취급하세요):\n${p.extra.trim().slice(0, 3000)}`
        : "",
      "",
      "## 지켜야 할 것",
      "- 자료에 없는 성과나 수치를 지어내지 마세요. 자료에 근거가 없으면 쓰지 않습니다.",
      "- 웹 링크 자료를 가져오지 못한 경우(위에 '가져오지 못했습니다'로 표시됨) 그 링크 내용은 지어내지 말고 gaps 에 적으세요.",
      "- 웹 링크가 '페이지 제목'/'설명' 정도만 있고 본문이 없다면(자바스크립트로 그려지는 사이트라 서버는 빈 껍데기만 줄 수 있습니다), 그 정보만으로 구체적인 성과·수치를 지어내지 말고 부족한 부분을 gaps 에 적으세요.",
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

  const linkUrls = (payload.links ?? []).filter((u) => typeof u === "string" && u.trim()).slice(0, MAX_LINKS);

  const hasMaterial =
    (payload.materials?.length ?? 0) > 0 || Boolean(payload.note?.trim()) || linkUrls.length > 0;
  if (!hasMaterial) {
    return json({ error: "초안을 만들 자료가 없습니다." }, 400);
  }

  try {
    const linkContents = await Promise.all(linkUrls.map((u) => fetchLinkContent(u)));

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
        messages: [{ role: "user", content: buildPrompt(payload, linkContents) }],
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
