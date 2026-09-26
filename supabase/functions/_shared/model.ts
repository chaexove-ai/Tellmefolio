/**
 * Anthropic 호출 공용 — job-switch 와 interview 가 같이 씁니다.
 *
 * [09-26] 실제 공고로 돌렸더니 "AI 응답을 해석하지 못했습니다"가 났습니다.
 * 원인 후보는 두 가지입니다.
 *   1) 한국어 결과가 길어 max_tokens 에서 잘림 → JSON 이 닫히지 않음
 *   2) 모델이 JSON 앞뒤에 설명을 붙이거나, 끝에 쉼표를 남김
 * 그래서: 잘렸는지(stop_reason) 로그에 남기고, 해석에 실패하면 한 번만
 * 더 부릅니다 — 잘렸으면 토큰을 두 배로, 아니면 "JSON 만" 다시 요청.
 * 두 번째도 실패하면 어느 단계였는지 붙여서 알립니다.
 */

import { parseJson } from "./evidence.ts";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export class ModelError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MAX_TOKENS_CAP = 16000;
/** 첫 호출이 이보다 오래 걸렸으면 다시 부르지 않습니다(함수 전체 시간 제한 때문) */
const RETRY_IF_FASTER_THAN_MS = 30_000;

interface Raw {
  text: string;
  stopReason: string;
  usage: Usage;
}

async function once(model: string, prompt: string, maxTokens: number, timeoutMs: number): Promise<Raw> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      console.error("Anthropic 오류", model, res.status, await res.text());
      throw new ModelError(
        res.status === 429 ? "요청이 몰렸습니다. 잠시 후 다시 시도해 주세요." : "AI 호출에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    }
    const body = await res.json();
    const text = (body.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    return {
      text,
      stopReason: String(body.stop_reason ?? ""),
      usage: { input_tokens: body.usage?.input_tokens ?? 0, output_tokens: body.usage?.output_tokens ?? 0 },
    };
  } catch (e) {
    if (e instanceof ModelError) throw e;
    const timedOut = e instanceof Error && e.name === "AbortError";
    throw new ModelError(timedOut ? "AI 응답이 너무 오래 걸립니다. 다시 시도해 주세요." : "AI 호출 중 문제가 생겼습니다.");
  } finally {
    clearTimeout(timer);
  }
}

export const JSON_ONLY_RETRY =
  "\n\n[다시 요청] 방금 응답은 JSON 으로 읽을 수 없었습니다. 설명·코드 블록 없이 위에서 정한 모양의 JSON 객체 하나만 출력하세요. 문장은 짧게 써도 됩니다.";

/**
 * 모델을 부르고 JSON 으로 돌려받습니다. 실패하면 한 번 더.
 * @param stage 로그와 오류 문구에 붙일 이름 (예: "2단계 근거 매칭")
 */
export async function callModelJson(
  model: string,
  prompt: string,
  maxTokens: number,
  opts: { stage: string; timeoutMs: number }
): Promise<{ data: unknown; usage: Usage }> {
  const usage: Usage = { input_tokens: 0, output_tokens: 0 };
  const add = (u: Usage) => {
    usage.input_tokens += u.input_tokens;
    usage.output_tokens += u.output_tokens;
  };

  const started = Date.now();
  const first = await once(model, prompt, maxTokens, opts.timeoutMs);
  add(first.usage);
  const data = parseJson(first.text);
  if (data && first.stopReason !== "max_tokens") return { data, usage };

  const truncated = first.stopReason === "max_tokens";
  console.error("JSON 해석 실패", opts.stage, model, { truncated, len: first.text.length, head: first.text.slice(0, 300), tail: first.text.slice(-200) });

  // 잘렸어도 앞부분만으로 JSON 이 닫혔다면(드묾) 그대로 씁니다.
  if (data) return { data, usage };

  if (Date.now() - started < RETRY_IF_FASTER_THAN_MS) {
    const second = await once(
      model,
      truncated ? prompt : prompt + JSON_ONLY_RETRY,
      truncated ? Math.min(maxTokens * 2, MAX_TOKENS_CAP) : maxTokens,
      opts.timeoutMs
    );
    add(second.usage);
    const again = parseJson(second.text);
    if (again) return { data: again, usage };
    console.error("재시도도 해석 실패", opts.stage, model, { stop: second.stopReason, head: second.text.slice(0, 300) });
  }
  throw new ModelError(`AI 응답을 해석하지 못했습니다(${opts.stage}). 다시 시도해 주세요.`);
}
