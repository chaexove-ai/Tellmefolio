/**
 * 직무 전환 Edge Function.
 *
 * [무엇을 하는가]
 * 지금 포트폴리오의 프로젝트들을 **목표 직무의 말로 다시 씁니다.**
 *
 * 전에 이 기능은 "결과 중심형 / 문제-실행-결과형" 중 하나를 고르는
 * 화면이었습니다(그리고 전부 목업이었습니다). 그건 서술 순서를 묻는
 * 것인데, 순서는 이미 템플릿과 5필드가 정하고 있었습니다. 같은 걸 두
 * 군데서 정한 셈이고, 순서를 바꾼다고 마케터의 포트폴리오가 PM 것처럼
 * 읽히지도 않습니다.
 *
 * 직무를 바꿀 때 사람이 실제로 막히는 건 **"내 경험 중 무엇이 새 직무의
 * 무엇에 해당하는가"** 입니다. 숙소 운영 경험을 PM 지원에 쓸 때 필요한
 * 건 순서 바꾸기가 아니라 "예약 자동화 운영 → 요구사항 정의와 이해관계자
 * 조율" 로 번역하는 일입니다. 이 함수가 그 번역을 제안합니다.
 *
 * [지어내지 않는 것이 이 기능의 전부입니다]
 * 직무를 바꿔 쓰는 순간 "그 직무에 어울리는 말"을 지어내고 싶은 압력이
 * 최대가 됩니다. 채용 담당자는 면접에서 그 한 줄을 묻고, 없는 일이면
 * 그 자리에서 드러납니다. 한 줄이 들키면 나머지 전부를 의심받습니다.
 * 그래서 프롬프트의 절반이 "없는 것을 쓰지 말라" 입니다. 옮길 것이
 * 없는 프로젝트는 옮기지 않고 그렇다고 말합니다 — 억지로 채우는 것보다
 * 낫습니다.
 *
 * [왜 통째로가 아니라 프로젝트별인가]
 * 한 번에 다 바꿔놓으면 사용자는 무엇이 어떻게 바뀌었는지 모른 채
 * 받아들이거나 통째로 버려야 합니다. 프로젝트마다 제안을 따로 주면
 * 맞는 것만 취할 수 있습니다. 판단은 본인이 해야 합니다 — 자기 경험이
 * 실제로 무엇이었는지는 본인만 압니다.
 *
 * [원본은 건드리지 않습니다]
 * 이 함수는 제안만 돌려줍니다. 저장은 클라이언트가 **새 포트폴리오**로
 * 합니다. 되돌릴 수 없는 변환을 기존 포트폴리오에 덮어쓰면, 잘 나오지
 * 않았을 때 원래 것이 사라집니다.
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("MODEL") ?? "claude-haiku-4-5-20251001";

/** 입력 상한. 프런트에서도 자르지만 서버가 최종 방어선입니다. */
const MAX_PROJECTS = 10;
const MAX_FIELD = 2500;
const MAX_POSTING = 6000;
const MAX_JOB = 80;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProjectIn {
  id: string;
  name?: string;
  context?: string;
  problem?: string;
  execution?: string;
  outcome?: string;
  reflection?: string;
  stack?: string[];
}

interface Payload {
  targetJob?: string;
  currentJob?: string;
  posting?: string;
  projects?: ProjectIn[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const clip = (v: unknown, n: number) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";

function buildPrompt(p: Payload): string {
  const targetJob = clip(p.targetJob, MAX_JOB);
  const currentJob = clip(p.currentJob, MAX_JOB);
  const posting = clip(p.posting, MAX_POSTING);

  const projects = (p.projects ?? []).slice(0, MAX_PROJECTS).map((pr, i) => {
    const lines = [
      `### 프로젝트 ${i + 1} (id: ${pr.id})`,
      `이름: ${clip(pr.name, 200) || "(제목 없음)"}`,
      `맥락 및 배경: ${clip(pr.context, MAX_FIELD) || "(비어 있음)"}`,
      `문제 정의: ${clip(pr.problem, MAX_FIELD) || "(비어 있음)"}`,
      `실행 내용: ${clip(pr.execution, MAX_FIELD) || "(비어 있음)"}`,
      `핵심 성과: ${clip(pr.outcome, MAX_FIELD) || "(비어 있음)"}`,
      `배운 점: ${clip(pr.reflection, MAX_FIELD) || "(비어 있음)"}`,
      `사용 기술: ${(pr.stack ?? []).slice(0, 20).join(", ") || "(없음)"}`,
    ];
    return lines.join("\n");
  });

  return `당신은 경력 전환을 준비하는 사람의 포트폴리오를 다시 쓰는 일을 돕습니다.

# 상황
${currentJob ? `- 현재 직무: ${currentJob}\n` : ""}- 목표 직무: ${targetJob}
${posting ? `\n# 목표 공고\n${posting}\n` : ""}
# 지금 포트폴리오의 프로젝트
${projects.join("\n\n")}

# 할 일
프로젝트마다 다음을 판단하세요.

1. 이 경험이 **목표 직무의 어떤 역량**에 해당하는가.
2. 그 역량으로 읽히도록 각 항목을 **다시 쓴다면** 어떻게 쓸 것인가.

# 반드시 지킬 것

- **없는 사실을 쓰지 마세요.** 이것이 가장 중요합니다. 같은 사실을 목표
  직무의 언어로 바꿔 부르는 것까지가 허용 범위입니다. 하지 않은 일,
  쓰지 않은 도구, 측정하지 않은 숫자를 넣으면 안 됩니다. 채용 담당자는
  면접에서 그 한 줄을 묻고, 없는 일이면 그 자리에서 드러납니다. 한 줄이
  들키면 나머지 전부가 의심받습니다.
- **숫자를 새로 만들지 마세요.** 원문에 없는 수치·비율·기간은 금지입니다.
  원문에 있는 숫자는 그대로 옮기세요.
- **비어 있던 항목은 비워두세요.** "(비어 있음)" 인 항목은 빈 문자열로
  두세요. 채우지 마세요.
- **옮길 것이 없으면 그렇다고 하세요.** 목표 직무와 정말 연결되지 않는
  프로젝트는 skip 을 true 로 두고 이유를 한 문장으로 적으세요. 억지로
  연결하는 것보다 빼는 편이 낫습니다.
- 과장된 수식어("혁신적인", "탁월한")를 쓰지 마세요. 한 일을 그대로 적고
  목표 직무가 쓰는 용어로 부르기만 하세요.
- 한국어로 쓰세요. 원문의 어조를 유지하세요.

# 출력 형식
아래 JSON 만 출력하세요. 설명이나 코드펜스를 붙이지 마세요.

{
  "projects": [
    {
      "id": "입력에 있던 id 그대로",
      "skip": false,
      "competency": "목표 직무의 어떤 역량인지 — 8자 안팎의 짧은 말",
      "why": "이 경험이 그 역량에 해당하는 이유 한 문장. 원문에 있는 사실만 근거로.",
      "context": "다시 쓴 맥락 및 배경",
      "problem": "다시 쓴 문제 정의",
      "execution": "다시 쓴 실행 내용",
      "outcome": "다시 쓴 핵심 성과",
      "reflection": "다시 쓴 배운 점"
    }
  ],
  "summary": "이 포트폴리오 전체를 목표 직무 지원용으로 소개하는 3~4문장. 원문에 있는 사실만 사용."
}

skip 이 true 이면 competency 에 빈 문자열, why 에 이유를 적고 나머지
항목은 빈 문자열로 두세요.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "서버 설정이 올바르지 않습니다." }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }

  if (!clip(payload.targetJob, MAX_JOB)) {
    return json({ error: "목표 직무를 입력해 주세요." }, 400);
  }
  if ((payload.projects?.length ?? 0) === 0) {
    return json({ error: "옮길 프로젝트가 없습니다." }, 400);
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
        max_tokens: 8000,
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
              : "직무 전환 제안을 만들지 못했습니다.",
        },
        502
      );
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .map((c: { type?: string; text?: string }) => (c.type === "text" ? c.text ?? "" : ""))
      .join("")
      .trim();

    // 모델이 가끔 코드펜스를 붙입니다. 붙어도 읽히게 벗겨냅니다.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON 파싱 실패", cleaned.slice(0, 500));
      return json({ error: "결과를 읽지 못했습니다. 다시 시도해 주세요." }, 502);
    }

    // 입력에 없던 id 가 섞여 오면 버립니다 — 그대로 저장하면 어느
    // 프로젝트 것인지 모르는 내용이 포트폴리오에 들어갑니다.
    const known = new Set((payload.projects ?? []).map((p) => p.id));
    const out = parsed as { projects?: Array<{ id?: string }>; summary?: string };
    const projects = (out.projects ?? []).filter((p) => p.id && known.has(p.id));

    return json({ projects, summary: typeof out.summary === "string" ? out.summary : "" });
  } catch (e) {
    console.error(e);
    return json({ error: "직무 전환 제안을 만들지 못했습니다." }, 502);
  }
});
