/**
 * 판정기(LLM) 날조 판정과 사람 블라인드 검수를 비교합니다.
 *
 *   npm run eval:agreement            → eval/review/judge-human.json 기준
 *
 * 표본이 "LLM 날조 전부 + LLM 정상 중 무작위 일부"로 층이 나뉘어 있어서,
 * 검수 표본의 날조 비율을 그대로 전체 날조율로 읽으면 안 됩니다. 전체 추정은
 * 층별 비율 × 모집단 크기로 다시 가중합니다. 구간은 층별 Wilson 95% 구간의
 * 끝점을 그대로 합친 것이라 보수적(넓게)입니다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL, arg } from "./data.ts";

interface Item {
  id: string;
  llm: { fabricated: boolean };
  server_flag: boolean;
  human: { decision: "fab" | "ok" };
}
interface Doc {
  run: string;
  judge_model: string;
  population: { sentences: number; llm_fabricated: number; llm_clean: number };
  items: Item[];
}

function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const range = ([a, b]: [number, number]) => `${pct(a)}~${pct(b)}`;

export function agreement(doc: Doc) {
  const it = doc.items;
  const c = (l: boolean, h: boolean) => it.filter((x) => x.llm.fabricated === l && (x.human.decision === "fab") === h).length;
  const tp = c(true, true), fp = c(true, false), fn = c(false, true), tn = c(false, false);
  const { sentences: N, llm_fabricated: NL, llm_clean: NC } = doc.population;
  const prec = tp / (tp + fp), miss = fn / (fn + tn);
  const pI = wilson(tp, tp + fp), mI = wilson(fn, fn + tn);
  const est = (prec * NL + miss * NC) / N;
  const estI: [number, number] = [(pI[0] * NL + mI[0] * NC) / N, (pI[1] * NL + mI[1] * NC) / N];
  const humanFab = it.filter((x) => x.human.decision === "fab");
  const flaggedFab = humanFab.filter((x) => x.server_flag).length;
  const flaggedOk = it.filter((x) => x.server_flag && x.human.decision === "ok").length;
  return { n: it.length, tp, fp, fn, tn, prec, pI, miss, mI, est, estI, estCount: est * N, humanFab: humanFab.length, flaggedFab, flaggedOk, N, NL, NC };
}

function main() {
  const file = arg("file", join(EVAL, "review/judge-human.json"))!;
  const doc = JSON.parse(readFileSync(file, "utf8")) as Doc;
  const a = agreement(doc);
  const L: string[] = [];
  L.push(`판정기 사람 검수 — ${doc.run} · 판정 모델 ${doc.judge_model}`);
  L.push(`표본 ${a.n}건 (LLM 날조 ${a.tp + a.fp} / LLM 정상 ${a.fn + a.tn}) · 모집단 ${a.N}문장 (LLM 날조 ${a.NL} / LLM 정상 ${a.NC})`);
  L.push("");
  L.push(`| | 사람 날조 | 사람 정상 |`);
  L.push(`|---|---|---|`);
  L.push(`| LLM 날조 | ${a.tp} | ${a.fp} |`);
  L.push(`| LLM 정상 | ${a.fn} | ${a.tn} |`);
  L.push("");
  L.push(`- 일치: ${a.tp + a.tn}/${a.n} (${pct((a.tp + a.tn) / a.n)})`);
  L.push(`- 판정기 정밀도(LLM 날조 중 사람도 날조): ${a.tp}/${a.tp + a.fp} = ${pct(a.prec)} (95% ${range(a.pI)})`);
  L.push(`- 판정기가 놓친 비율(LLM 정상 중 사람 날조): ${a.fn}/${a.fn + a.tn} = ${pct(a.miss)} (95% ${range(a.mI)})`);
  L.push(`- 보정한 전체 날조율: ${pct(a.est)} ≈ ${Math.round(a.estCount)}/${a.N}문장 (보수적 구간 ${range(a.estI)})`);
  L.push(`- 서버 검증기: 사람이 날조로 본 ${a.humanFab}건 중 경고 ${a.flaggedFab}건 · 사람이 정상으로 본 문장에 경고 ${a.flaggedOk}건`);
  L.push("");
  L.push(`주의: 표본의 날조 비율(${a.humanFab}/${a.n})은 층화 표본이라 전체 날조율이 아닙니다.`);
  console.log(L.join("\n"));
}

if (import.meta.filename === process.argv[1]) main();
