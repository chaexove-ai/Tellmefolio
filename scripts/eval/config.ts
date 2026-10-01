/**
 * 모델 조합과 단가. 단가는 비용 지표 계산에만 씁니다.
 *
 * [단가 확인] Anthropic 공식 요금표(platform.claude.com/docs/en/about-claude/pricing)
 * 를 2026-10-01 에 확인했을 때 Haiku 4.5 = $1/$5 였고, 운영 기본값인
 * claude-sonnet-5 는 표에 없었습니다. 그래서 Sonnet 5 는 보수적으로 $3/$15 로
 * 두었습니다. Console 에서 실제 단가를 확인하면 여기만 고치면 됩니다.
 * 리포트에는 "가정 단가"임을 함께 적습니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./data.ts";

export interface Price {
  input: number; // USD / 1M tokens
  output: number;
  verified: boolean;
}

export const PRICES: Record<string, Price> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5, verified: true },
  "claude-sonnet-5": { input: 3, output: 15, verified: false },
  "claude-sonnet-5-5": { input: 2, output: 10, verified: true },
};

/** 운영 기본값과 같은 이름. job-switch/index.ts 의 LIGHT_MODEL / STRONG_MODEL */
export const PROD = {
  light: "claude-haiku-4-5-20251001",
  strong: "claude-sonnet-5",
};

export interface StageModels {
  s1: string; // 공고 해부
  s2: string; // 근거 매칭
  s3: string; // 재작성
}

/** 3단계 실험(모델 비교)의 조합. baseline 이 운영과 같은 조합입니다. */
export const CONFIGS: Record<string, StageModels> = {
  baseline: { s1: PROD.light, s2: PROD.strong, s3: PROD.strong },
  "s2-haiku": { s1: PROD.light, s2: PROD.light, s3: PROD.strong },
  "s3-haiku": { s1: PROD.light, s2: PROD.strong, s3: PROD.light },
  "all-haiku": { s1: PROD.light, s2: PROD.light, s3: PROD.light },
  "s1-sonnet": { s1: PROD.strong, s2: PROD.strong, s3: PROD.strong },
};

export function cost(model: string, input: number, output: number): number {
  const p = PRICES[model];
  if (!p) return NaN;
  return (input * p.input + output * p.output) / 1_000_000;
}

/**
 * .env.eval.local 을 읽어 process.env 에 넣습니다. 이 파일은 .gitignore 에
 * 있습니다(.env*.local). 키는 여기와 환경변수에만 둡니다.
 */
export function loadEnv() {
  const f = join(ROOT, ".env.eval.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
