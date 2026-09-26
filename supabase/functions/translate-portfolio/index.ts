/**
 * 포트폴리오 영어 번역 Edge Function.
 *
 * Export 화면의 "영어 버전" 선택이 지금까지는 라벨만 있고 실제로는 아무
 * 일도 하지 않았습니다(항상 원문 한국어 그대로 내보냄). 이 함수는 그
 * 자리를 실제로 채웁니다 — title/summary/job과 각 프로젝트의 name/role/
 * stack/서술형 필드(맥락/문제/실행/성과/회고)를 전부 영어로 번역해
 * 돌려줍니다.
 *
 * [2026-09 수정] 처음엔 job/role/stack을 "짧은 고유명사"로 보고 번역
 * 대상에서 뺐는데, 이 서비스를 실제로 쓰는 디자이너 사용자들은 stack에
 * "React" 대신 "UX 리서치"/"와이어프레임" 같은 한국어 서술형 스킬을
 * 적는 경우가 많아서, 영어로 내보내도 직무명·역할·스택만 한국어로
 * 남는 문제가 있었습니다. 프롬프트에서 "이미 영어인 고유명사는 그대로
 * 두라"고 지시해 React/Figma 같은 진짜 툴 이름은 보존하면서 나머지는
 * 번역하도록 했습니다.
 *
 * [정확성] AI 번역이라 미묘한 뉘앙스 오류가 있을 수 있습니다 — 이 사실은
 * 화면(Export.tsx)에서 사용자에게 그대로 안내합니다.
 *
 * generate-draft/index.ts 와 같은 인증·CORS·모델 패턴을 그대로 씁니다.
 * 로그인 확인과 하루 한도는 _shared/usage.ts.
 */

import { AuthError, QuotaError, assertQuota, recordUsage, requireUser } from "../_shared/usage.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";

const MAX_FIELD = 4000;
const MAX_PROJECTS = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProjectInput {
  id: string;
  name: string;
  role: string;
  stack: string[];
  context: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
}

/** [2026-09-22] 자유 블록. 사용자가 다섯 칸 밖에 직접 쓴 글이라,
 *  번역에서 빠지면 영어 PDF 가운데만 한국어로 남습니다. */
interface BlockInput {
  id: string;
  label: string;
  text: string;
}

interface Payload {
  title?: string;
  summary?: string | null;
  job?: string | null;
  projects?: ProjectInput[];
  blocks?: BlockInput[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function trim(s: unknown, max = MAX_FIELD): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

function buildPrompt(title: string, summary: string, job: string, projects: ProjectInput[], blocks: BlockInput[]) {
  const payload = {
    title,
    summary,
    job,
    projects: projects.map((p) => ({
      id: p.id,
      name: trim(p.name, 200),
      role: trim(p.role, 300),
      stack: (p.stack ?? []).slice(0, 30).map((s) => trim(s, 100)),
      context: trim(p.context),
      problem: trim(p.problem),
      execution: trim(p.execution),
      outcome: trim(p.outcome),
      reflection: trim(p.reflection),
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      label: trim(b.label, 200),
      text: trim(b.text),
    })),
  };

  return [
    "다음은 한국어로 작성된 채용용 포트폴리오 내용입니다. 채용 담당자가 읽는 자연스러운 영어(비즈니스 영어, 이력서/포트폴리오 톤)로 번역해 주세요.",
    "",
    "## 지켜야 할 것",
    "- 원문에 없는 내용을 새로 지어내지 마세요. 번역만 하세요.",
    "- 빈 문자열(\"\")은 빈 문자열로, 빈 배열([])은 빈 배열로 그대로 두세요.",
    "- 과장하지 말고 원문의 어조와 사실 관계를 그대로 유지하세요.",
    "- 프로젝트명(name)은 고유명사면 그대로 두되, 설명형 이름이면 자연스러운 영어로 옮기세요.",
    "- job(직무명)과 role(프로젝트 내 역할)은 채용 시장에서 쓰이는 자연스러운 영어 직함/역할 표현으로 옮기세요 (예: \"UX/UI 디자이너\" → \"UX/UI Designer\").",
    "- stack 배열은 각 항목을 자연스러운 영어로 옮기되, 이미 영어인 도구·기술 고유명사(React, Figma 등)는 그대로 두세요. 배열의 개수와 순서는 원문과 동일하게 유지하세요.",
    "- 각 프로젝트의 id는 절대 바꾸지 말고 그대로 돌려주세요.",
    "- blocks 는 사용자가 직접 추가한 글입니다. label(소제목)과 text(본문)를 같은 기준으로 번역하고, id 는 그대로 돌려주세요. blocks 가 빈 배열이면 빈 배열로 두세요.",
    "",
    "## 원문 (JSON)",
    JSON.stringify(payload, null, 2),
    "",
    "## 출력 형식",
    "설명이나 인사말 없이 아래와 같은 JSON만 출력하세요. 마크다운 코드펜스도 붙이지 마세요. 구조와 키는 원문과 동일하게 유지하세요.",
    "{",
    '  "title": "...",',
    '  "summary": "...",',
    '  "job": "...",',
    '  "projects": [',
    '    { "id": "...", "name": "...", "role": "...", "stack": ["..."], "context": "...", "problem": "...", "execution": "...", "outcome": "...", "reflection": "..." }',
    "  ],",
    '  "blocks": [',
    '    { "id": "...", "label": "...", "text": "..." }',
    "  ]",
    "}",
  ].join("\n");
}

function parseResult(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
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

  let who: Awaited<ReturnType<typeof requireUser>>;
  try {
    who = await requireUser(req);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    throw e;
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const title = trim(payload.title, 300);
  const summary = trim(payload.summary ?? "", MAX_FIELD);
  const job = trim(payload.job ?? "", 200);
  const projects = (payload.projects ?? []).slice(0, MAX_PROJECTS);
  // 블록은 프로젝트마다 몇 개씩 붙을 수 있어 상한을 넉넉히 둡니다.
  const blocks = (payload.blocks ?? []).slice(0, MAX_PROJECTS * 8);

  if (!title && !summary && !job && projects.length === 0 && blocks.length === 0) {
    return json({ error: "번역할 내용이 없습니다." }, 400);
  }

  try {
    await assertQuota(who.sb, who.user.id, "translate");
  } catch (e) {
    if (e instanceof QuotaError) return json({ error: e.message }, e.status);
    throw e;
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
        messages: [{ role: "user", content: buildPrompt(title, summary, job, projects, blocks) }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic 오류", res.status, detail);
      return json(
        {
          error:
            res.status === 429
              ? "요청이 몰렸습니다. 잠시 후 다시 시도해 주세요."
              : "번역에 실패했습니다.",
        },
        502
      );
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const parsed = parseResult(text);
    if (!parsed || typeof parsed !== "object") {
      console.error("JSON 파싱 실패", text.slice(0, 500));
      return json({ error: "번역 결과를 해석하지 못했습니다. 다시 시도해 주세요." }, 502);
    }

    await recordUsage(who.sb, {
      user_id: who.user.id,
      kind: "translate",
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    });
    return json({ translation: parsed });
  } catch (e) {
    console.error(e);
    return json({ error: "번역 중 문제가 생겼습니다." }, 500);
  }
});
