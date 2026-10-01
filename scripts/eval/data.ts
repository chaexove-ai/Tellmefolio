/**
 * 평가 세트 읽기. 포트폴리오(JSON) · 공고(Markdown) · 정답 라벨(YAML).
 *
 * 근거 id 는 운영 코드(_shared/evidence.ts 의 buildEvidence)로 만듭니다.
 * 라벨이 가리키는 id 와 운영이 만드는 id 가 어긋나면 평가 전체가 무의미해지기
 * 때문에, 라벨 작성·검증·실행 모두 같은 함수를 거칩니다.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  buildEvidence,
  type Evidence,
  type SourceProject,
} from "../../supabase/functions/_shared/evidence.ts";

export const ROOT = resolve(import.meta.dirname, "../..");
export const EVAL = join(ROOT, "eval");

export type Family = "dev" | "design" | "marketing" | "planning";
export type Difficulty = "sufficient" | "partial_gap" | "cross";
export type Trap = "T1" | "T2" | "T3" | "T4" | "T5" | "T6";
export type GoldLevel = "full" | "partial" | "none";

export interface Portfolio {
  id: string;
  family: Family;
  /** 가상 인물 설명. 실존 인물 아님 */
  persona: string;
  projects: SourceProject[];
}

export interface GoldRequirement {
  /** r1, r2 … 격리 모드에서 2단계에 이 순서·id 그대로 들어갑니다 */
  id: string;
  text: string;
  label: string;
  kind: "must" | "nice";
  scope: "project" | "profile";
  keywords: string[];
  /** scope=profile 이면 null — 프로젝트에서 찾지 않는 요건 */
  level: GoldLevel | null;
  /** full/partial 일 때 뒷받침하는 근거 id */
  evidence: string[];
  trap: Trap | null;
  note: string;
  /** 사람이 이 요구사항을 검수한 기록. 없으면 Claude 초안 그대로(미검수) */
  human?: {
    reviewer: string;
    at: string;
    /** keep(none) 처럼 유지, 또는 none→partial 처럼 바꾼 내용 */
    decision: string;
    comment?: string;
    /** 함정이었다가 사람이 none 이 아니라고 판정해 함정에서 뺀 경우 원래 유형 */
    was_trap?: Trap;
  };
}

export interface CaseLabel {
  case: string;
  portfolio: string;
  job: string;
  target_job: string;
  family: Family;
  /** 공고의 직무군. cross 면 family 와 다름 */
  job_family: Family;
  difficulty: Difficulty;
  /** 사람이 검수를 마쳤는가. false 면 리포트에 "미검수 라벨"로 표시 */
  reviewed: boolean;
  reviewer: string | null;
  lead: "outcome" | "execution" | "problem" | "context";
  vocabulary: string[];
  requirements: GoldRequirement[];
  /**
   * 재작성 결과에 나오면 날조로 보는 표현. 함정 요구사항이 유혹하는 도구명·
   * 도메인·수치 등. 자동 검사에 씁니다(사람·LLM 판정의 보조).
   */
  must_not_appear: string[];
}

export interface LoadedCase {
  label: CaseLabel;
  portfolio: Portfolio;
  jd: string;
  evidence: Evidence[];
}

export function loadPortfolio(id: string): Portfolio {
  const p = JSON.parse(readFileSync(join(EVAL, "cases/portfolios", `${id}.json`), "utf8")) as Portfolio;
  p.projects = p.projects.map((x) => ({
    id: x.id,
    name: x.name ?? "",
    stack: x.stack ?? [],
    context: x.context ?? "",
    role: x.role ?? "",
    problem: x.problem ?? "",
    execution: x.execution ?? "",
    outcome: x.outcome ?? "",
    reflection: x.reflection ?? "",
  }));
  return p;
}

export function loadJob(id: string): string {
  return readFileSync(join(EVAL, "cases/jobs", `${id}.md`), "utf8").trim();
}

export function listCaseIds(): string[] {
  const dir = join(EVAL, "labels");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
}

export function loadLabel(caseId: string): CaseLabel {
  return parseYaml(readFileSync(join(EVAL, "labels", `${caseId}.yaml`), "utf8")) as CaseLabel;
}

export function loadCase(caseId: string): LoadedCase {
  const label = loadLabel(caseId);
  const portfolio = loadPortfolio(label.portfolio);
  return { label, portfolio, jd: loadJob(label.job), evidence: buildEvidence(portfolio.projects) };
}

/** --cases=dev-01a,dev-02b 또는 --cases=dev 처럼 접두어로 고릅니다 */
export function selectCases(filter: string | undefined): string[] {
  const all = listCaseIds();
  if (!filter) return all;
  const keys = filter.split(",").map((s) => s.trim()).filter(Boolean);
  return all.filter((id) => keys.some((k) => id === k || id.startsWith(k)));
}

export function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
