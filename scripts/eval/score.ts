/**
 * 지표 계산 → 리포트. 모델을 부르지 않습니다.
 *
 *   npm run eval:score -- --run=<이름>                 # 한 실행의 리포트
 *   npm run eval:score -- --runs=<이름1>,<이름2>,...   # 실행끼리 비교표(모델 비교)
 *
 * 모든 지표에 분모(n)를 같이 적고, 판정 주체를 구분합니다.
 *   [자동]  코드가 기계적으로 계산 (숫자 대조, 라벨과 비교)
 *   [LLM]   다른 계열 모델(judge.ts)의 판정 — 판정기 정확도는 사람 표본으로 따로 보고
 *   [사람]  사람이 만든·검수한 정답 라벨. reviewed: false 면 "미검수 라벨"
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIELDS, numbersIn, type Sentence } from "../../supabase/functions/_shared/evidence.ts";
import { cost } from "./config.ts";
import { arg, EVAL, loadCase, type CaseLabel, type LoadedCase } from "./data.ts";
import type { JudgeOut } from "./judge.ts";
import type { RunResult } from "./pipeline.ts";

/* ------------------------------------------------------------------ */
/* 작은 도구                                                            */
/* ------------------------------------------------------------------ */

const pct = (a: number, b: number) => (b === 0 ? "–" : `${((a / b) * 100).toFixed(1)}%`);
const frac = (a: number, b: number) => `${pct(a, b)} (${a}/${b})`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const std = (xs: number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/** 금지어 검사. 영문 짧은 토큰은 단어 경계로(“PM” 이 “NPM” 에 걸리지 않게) */
export function hits(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => {
    const lw = w.toLowerCase();
    if (/^[a-z0-9 .+#/-]+$/i.test(w)) {
      const esc = lw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, "i").test(lower);
    }
    return lower.includes(lw);
  });
}

/* ------------------------------------------------------------------ */
/* 한 실행 결과(케이스 × 회차)의 원자료                                 */
/* ------------------------------------------------------------------ */

interface SentRow {
  case: string;
  rep: number;
  key: string; // p0:outcome:1
  text: string;
  verbatim: boolean; // 원문과 똑같은 문장(재작성이 빠져 원문으로 되살린 것 포함)
  serverFlagged: boolean; // 운영 4단계 경고(어떤 종류든)
  serverNumber: boolean; // 운영 숫자 경고(프로젝트 원문 전체 기준)
  strictNumber: boolean; // 인용한 근거 문장 기준 숫자 대조(더 엄격)
  forbidden: string[]; // 라벨 must_not_appear 적중
  trapReqTagged: string[]; // 문장이 대응한다고 단 요구사항 중 함정
  judge?: JudgeOut["j1"][number];
}

interface ReqRow {
  case: string;
  rep: number;
  goldId: string;
  trap: string | null;
  kind: string;
  gold: string; // full/partial/none
  model: string | null; // 최종(서버 정리 후) level, 정렬 실패면 null
  rawModel: string | null; // 서버 정리 전 모델이 말한 level
  downgraded: boolean;
  j2?: string;
}

interface CaseRun {
  r: RunResult;
  c: LoadedCase;
  j?: JudgeOut;
  sents: SentRow[];
  reqs: ReqRow[];
  fakeIds: number;
  claimedIds: number;
  stage1?: { goldProject: number; recalled: number; profileGold: number; profileOk: number; modelReqs: number };
}

function analyse(r: RunResult, j: JudgeOut | undefined): CaseRun {
  const c = loadCase(r.case);
  const L = c.label;
  const textById = new Map(c.evidence.map((e) => [e.id, e.text]));
  const evTexts = new Set(c.evidence.map((e) => e.text.trim()));
  const trapIds = new Set(L.requirements.filter((q) => q.trap && q.trap !== "T6").map((q) => q.id));

  // 모델 요구사항 id → 정답 id. 격리 모드는 같은 id, E2E 는 J3 판정으로
  const toGold = new Map<string, string | null>();
  if (r.mode === "isolated") L.requirements.forEach((q) => toGold.set(q.id, q.id));
  else (j?.j3 ?? []).forEach((x) => toGold.set(x.modelId, x.goldId));

  const sents: SentRow[] = [];
  r.rewrites.forEach((rw, pi) => {
    for (const f of FIELDS) {
      rw[f].forEach((s: Sentence, si: number) => {
        const key = `p${pi}:${f}:${si}`;
        const flags = r.flags.filter((x) => x.projectIndex === pi && x.field === f && x.sentenceIndex === si);
        const cited = s.evidence.map((id) => textById.get(id) ?? "").join(" ");
        const citedNums = new Set(numbersIn(cited));
        sents.push({
          case: r.case,
          rep: r.rep,
          key,
          text: s.text,
          verbatim: evTexts.has(s.text.trim()),
          serverFlagged: flags.length > 0,
          serverNumber: flags.some((x) => x.kind === "number"),
          strictNumber: numbersIn(s.text).some((n) => !citedNums.has(n)),
          forbidden: hits(s.text, L.must_not_appear ?? []),
          trapReqTagged: s.requirements
            .map((id) => (r.mode === "isolated" ? id : toGold.get(id) ?? ""))
            .filter((id) => trapIds.has(id)),
          judge: j?.j1.find((x) => x.key === key),
        });
      });
    }
  });

  // 2단계 원시 응답
  const raw = (r.stages.s2?.raw as { matches?: { requirementId?: string; level?: string; evidenceIds?: unknown[] }[] }) ?? {};
  const known = new Set(c.evidence.map((e) => e.id));
  let fakeIds = 0;
  let claimedIds = 0;
  const rawLevel = new Map<string, string>();
  for (const m of raw.matches ?? []) {
    const ids = Array.isArray(m.evidenceIds) ? m.evidenceIds.map(String) : [];
    claimedIds += ids.length;
    fakeIds += ids.filter((x) => !known.has(x)).length;
    if (m.requirementId && !rawLevel.has(String(m.requirementId))) rawLevel.set(String(m.requirementId), String(m.level ?? "none"));
  }

  // 요구사항별 비교(프로젝트 요건만)
  const reqs: ReqRow[] = [];
  const goldToModel = new Map<string, string>();
  for (const [mid, gid] of toGold) if (gid && !goldToModel.has(gid)) goldToModel.set(gid, mid);
  for (const q of L.requirements.filter((x) => x.scope === "project")) {
    const mid = goldToModel.get(q.id);
    const m = mid ? r.matches.find((x) => x.requirementId === mid) : undefined;
    reqs.push({
      case: r.case,
      rep: r.rep,
      goldId: q.id,
      trap: q.trap,
      kind: q.kind,
      gold: q.level ?? "none",
      model: m ? m.level : null,
      rawModel: mid ? rawLevel.get(mid) ?? "none" : null,
      downgraded: !!m?.downgraded,
      j2: mid ? j?.j2.find((x) => x.requirementId === mid)?.support : undefined,
    });
  }

  let stage1: CaseRun["stage1"];
  if (r.mode === "e2e" && r.analysis && j?.j3.length) {
    const goldProject = L.requirements.filter((q) => q.scope === "project");
    const profile = L.requirements.filter((q) => q.scope === "profile");
    stage1 = {
      goldProject: goldProject.length,
      recalled: goldProject.filter((q) => goldToModel.has(q.id)).length,
      profileGold: profile.length,
      profileOk: profile.filter((q) => {
        const mid = goldToModel.get(q.id);
        return mid && r.analysis!.requirements.find((x) => x.id === mid)?.scope === "profile";
      }).length,
      modelReqs: r.analysis.requirements.length,
    };
  }
  return { r, c, j, sents, reqs, fakeIds, claimedIds, stage1 };
}

/* ------------------------------------------------------------------ */
/* 집계                                                                 */
/* ------------------------------------------------------------------ */

export interface Summary {
  run: string;
  mode: string;
  config: string;
  models: Record<string, string>;
  n: { cases: number; runs: number; failed: number; sentences: number; judged: number; reqs: number; traps: number };
  labelsReviewed: string;
  fabrication: { judge: number | null; serverAny: number; strictNumber: number; serverNumber: number; forbidden: number };
  serverRecall: number | null;
  serverPrecision: number | null;
  citationS3: number | null;
  citationS2: number | null;
  fakeIdRate: number;
  matchAccuracy: number | null;
  overclaim: number | null;
  trapPass: number | null;
  trapPassByModel: number | null;
  trapLeak: number | null;
  costPerCase: number;
  wallP50: number;
  stage: Record<string, { calls: number; inTok: number; outTok: number; usd: number; msP50: number; msP95: number }>;
}

function loadRun(name: string) {
  const dir = join(EVAL, "runs", name);
  if (!existsSync(join(dir, "manifest.json"))) {
    console.error(`실행 결과가 없습니다: eval/runs/${name}\n먼저 npm run eval -- --name=${name} ... 로 실행하세요.`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const files = readdirSync(dir).filter((f) => /\.r\d+\.json$/.test(f)).sort();
  const runs: CaseRun[] = [];
  let failed = 0;
  for (const f of files) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as RunResult;
    if (r.error) {
      failed++;
      continue;
    }
    const jf = join(dir, "judge", f);
    runs.push(analyse(r, existsSync(jf) ? JSON.parse(readFileSync(jf, "utf8")) : undefined));
  }
  return { dir, manifest, runs, failed };
}

function summarize(name: string): { s: Summary; md: string } {
  const { dir, manifest, runs, failed } = loadRun(name);
  const sents = runs.flatMap((x) => x.sents);
  const reqs = runs.flatMap((x) => x.reqs);
  const judged = sents.filter((s) => s.judge);
  const fabJ = judged.filter((s) => s.judge!.fabricated);
  const flagged = judged.filter((s) => s.serverFlagged);
  const cit3 = judged.filter((s) => ["yes", "partial", "no"].includes(s.judge!.citation));
  const j2 = reqs.filter((q) => q.j2 && q.model && q.model !== "none");
  const aligned = reqs.filter((q) => q.model !== null);
  const goldNone = aligned.filter((q) => q.gold === "none");
  const traps = reqs.filter((q) => q.trap && q.trap !== "T6");
  const trapsAligned = traps.filter((q) => q.model !== null);
  const labels = new Map<string, CaseLabel>(runs.map((x) => [x.c.label.case, x.c.label]));
  const reviewed = [...labels.values()].filter((l) => l.reviewed).length;

  // 함정 유출: 함정 요구사항을 "대응한다"고 단 문장, 또는 금지어가 나온 문장이 있는 (케이스, 회차, 함정)
  const leak = traps.filter((q) =>
    runs
      .find((x) => x.r.case === q.case && x.r.rep === q.rep)!
      .sents.some((s) => s.trapReqTagged.includes(q.goldId))
  );

  // 단계별 비용·시간
  const stage: Summary["stage"] = {};
  for (const st of ["s1", "s2", "s3"] as const) {
    const recs = runs.flatMap((x) => (st === "s3" ? x.r.stages.s3 : x.r.stages[st] ? [x.r.stages[st]!] : []));
    if (!recs.length) continue;
    const inTok = recs.reduce((a, b) => a + b.usage.input_tokens, 0);
    const outTok = recs.reduce((a, b) => a + b.usage.output_tokens, 0);
    stage[st] = {
      calls: recs.length,
      inTok,
      outTok,
      usd: recs.reduce((a, b) => a + cost(b.model, b.usage.input_tokens, b.usage.output_tokens), 0),
      msP50: quantile(recs.map((x) => x.ms), 0.5),
      msP95: quantile(recs.map((x) => x.ms), 0.95),
    };
  }
  const totalUsd = Object.values(stage).reduce((a, b) => a + b.usd, 0);

  const s: Summary = {
    run: name,
    mode: manifest.mode,
    config: manifest.config,
    models: manifest.models,
    n: {
      cases: labels.size,
      runs: runs.length,
      failed,
      sentences: sents.length,
      judged: judged.length,
      reqs: aligned.length,
      traps: trapsAligned.length,
    },
    labelsReviewed: `${reviewed}/${labels.size}`,
    fabrication: {
      judge: judged.length ? fabJ.length / judged.length : null,
      serverAny: sents.filter((x) => x.serverFlagged).length / (sents.length || 1),
      strictNumber: sents.filter((x) => x.strictNumber).length / (sents.length || 1),
      serverNumber: sents.filter((x) => x.serverNumber).length / (sents.length || 1),
      forbidden: sents.filter((x) => x.forbidden.length).length / (sents.length || 1),
    },
    serverRecall: fabJ.length ? fabJ.filter((x) => x.serverFlagged).length / fabJ.length : null,
    serverPrecision: flagged.length ? flagged.filter((x) => x.judge!.fabricated).length / flagged.length : null,
    citationS3: cit3.length ? cit3.filter((x) => x.judge!.citation === "yes").length / cit3.length : null,
    citationS2: j2.length ? j2.filter((q) => q.j2 === "yes").length / j2.length : null,
    fakeIdRate: runs.reduce((a, b) => a + b.fakeIds, 0) / (runs.reduce((a, b) => a + b.claimedIds, 0) || 1),
    matchAccuracy: aligned.length ? aligned.filter((q) => q.model === q.gold).length / aligned.length : null,
    overclaim: goldNone.length ? goldNone.filter((q) => q.model !== "none").length / goldNone.length : null,
    trapPass: trapsAligned.length ? trapsAligned.filter((q) => q.model === "none").length / trapsAligned.length : null,
    trapPassByModel: trapsAligned.length ? trapsAligned.filter((q) => q.rawModel === "none").length / trapsAligned.length : null,
    trapLeak: traps.length ? leak.length / traps.length : null,
    costPerCase: totalUsd / (runs.length || 1),
    wallP50: quantile(runs.map((x) => x.r.wallMs), 0.5),
    stage,
  };

  /* ---------------- 리포트 ---------------- */
  const L: string[] = [];
  const p = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
  L.push(`# 평가 결과 — ${name}`);
  L.push("");
  L.push(`- 모드: **${manifest.mode}** · 조합: **${manifest.config}** (1단계 ${manifest.models.s1} / 2단계 ${manifest.models.s2} / 3단계 ${manifest.models.s3})`);
  L.push(`- 표본: 케이스 ${s.n.cases}개 · 실행 ${s.n.runs}회${failed ? ` (실패 ${failed}회 제외)` : ""} · 재작성 문장 ${s.n.sentences}개 · 비교한 요구사항 ${s.n.reqs}개 · 함정 ${s.n.traps}개`);
  L.push(`- 정답 라벨 검수: **${s.labelsReviewed}** ${reviewed < labels.size ? "— 미검수 라벨이 섞여 있어 [사람] 지표는 잠정치입니다" : ""}`);
  L.push(`- LLM 판정: ${judged.length ? `${runs[0]?.j?.judgeModel ?? "?"} · 판정 문장 ${judged.length}개` : "아직 없음 (npm run eval:judge)"}`);
  L.push("");
  L.push("## 핵심 지표");
  L.push("");
  L.push("| 지표 | 값 | 분모 | 판정 |");
  L.push("|---|---|---|---|");
  L.push(`| 날조율 | ${p(s.fabrication.judge)} | 재작성 문장 ${judged.length} | LLM |`);
  L.push(`| 원문에 없는 숫자 (인용 근거 기준, 엄격) | ${p(s.fabrication.strictNumber)} | 재작성 문장 ${sents.length} | 자동 |`);
  L.push(`| 원문에 없는 숫자 (프로젝트 원문 기준 = 운영 검증기) | ${p(s.fabrication.serverNumber)} | 재작성 문장 ${sents.length} | 자동 |`);
  L.push(`| 금지어(함정 유혹어) 등장 | ${p(s.fabrication.forbidden)} | 재작성 문장 ${sents.length} | 자동 |`);
  L.push(`| 운영 검증기 재현율 (날조 문장 중 경고가 뜬 비율) | ${p(s.serverRecall)} | 날조 판정 ${fabJ.length} | LLM+자동 |`);
  L.push(`| 운영 검증기 정밀도 (경고 문장 중 실제 날조) | ${p(s.serverPrecision)} | 경고 ${flagged.length} | LLM+자동 |`);
  L.push(`| 근거 유효율 · 3단계 (문장↔인용 근거) | ${p(s.citationS3)} | 인용 있는 문장 ${cit3.length} | LLM |`);
  L.push(`| 근거 유효율 · 2단계 (요구사항↔근거) | ${p(s.citationS2)} | full/partial 매칭 ${j2.length} | LLM |`);
  L.push(`| 가짜 근거 id 비율 (서버가 버림) | ${p(s.fakeIdRate)} | 모델이 댄 id ${runs.reduce((a, b) => a + b.claimedIds, 0)} | 자동 |`);
  L.push(`| 요구사항 매칭 정확도 (full/partial/none 일치) | ${p(s.matchAccuracy)} | 요구사항 ${aligned.length} | 사람 라벨 |`);
  L.push(`| 과대평가율 (정답 none → AI full/partial) | ${p(s.overclaim)} | 정답 none ${goldNone.length} | 사람 라벨 |`);
  L.push(`| 함정 통과율 (최종 none) | ${p(s.trapPass)} | 함정 ${trapsAligned.length} | 사람 라벨 |`);
  L.push(`| └ 모델이 스스로 none (서버 강등 제외) | ${p(s.trapPassByModel)} | 함정 ${trapsAligned.length} | 사람 라벨 |`);
  L.push(`| 함정 유출 (함정 요구사항을 "대응"한다고 단 문장 존재) | ${p(s.trapLeak)} | 함정 ${traps.length} | 자동 |`);
  L.push("");

  // 혼동행렬
  const lv = ["full", "partial", "none"];
  L.push("## 매칭 혼동행렬 (행: 정답, 열: AI 최종)");
  L.push("");
  L.push("| 정답＼AI | full | partial | none |");
  L.push("|---|---|---|---|");
  for (const g of lv) L.push(`| **${g}** | ${lv.map((m) => aligned.filter((q) => q.gold === g && q.model === m).length).join(" | ")} |`);
  L.push("");

  // 함정 유형별
  L.push("## 함정 유형별");
  L.push("");
  L.push("| 유형 | 함정 수 | 최종 none | 모델 스스로 none | 유출 |");
  L.push("|---|---|---|---|---|");
  for (const t of ["T1", "T2", "T3", "T4", "T5"]) {
    const ts = trapsAligned.filter((q) => q.trap === t);
    const lk = leak.filter((q) => q.trap === t);
    L.push(`| ${t} | ${ts.length} | ${frac(ts.filter((q) => q.model === "none").length, ts.length)} | ${frac(ts.filter((q) => q.rawModel === "none").length, ts.length)} | ${frac(lk.length, traps.filter((q) => q.trap === t).length)} |`);
  }
  L.push("");

  // 난이도·직무군별
  L.push("## 난이도·직무군별");
  L.push("");
  L.push("| 묶음 | 실행 | 날조율(LLM) | 매칭 정확도 | 함정 통과 |");
  L.push("|---|---|---|---|---|");
  const groups: [string, (x: CaseRun) => boolean][] = [
    ...(["sufficient", "partial_gap", "cross"] as const).map((d) => [d, (x: CaseRun) => x.c.label.difficulty === d] as [string, (x: CaseRun) => boolean]),
    ...(["dev", "design", "marketing", "planning"] as const).map((f) => [f, (x: CaseRun) => x.c.label.family === f] as [string, (x: CaseRun) => boolean]),
  ];
  for (const [g, fn] of groups) {
    const rs = runs.filter(fn);
    const js = rs.flatMap((x) => x.sents).filter((x) => x.judge);
    const rq = rs.flatMap((x) => x.reqs).filter((q) => q.model !== null);
    const tp = rq.filter((q) => q.trap && q.trap !== "T6");
    L.push(`| ${g} | ${rs.length} | ${js.length ? frac(js.filter((x) => x.judge!.fabricated).length, js.length) : "–"} | ${frac(rq.filter((q) => q.model === q.gold).length, rq.length)} | ${frac(tp.filter((q) => q.model === "none").length, tp.length)} |`);
  }
  L.push("");

  // 1단계 (E2E)
  const s1 = runs.map((x) => x.stage1).filter(Boolean) as NonNullable<CaseRun["stage1"]>[];
  if (s1.length) {
    const a = s1.reduce((o, x) => ({ gp: o.gp + x.goldProject, rc: o.rc + x.recalled, pg: o.pg + x.profileGold, po: o.po + x.profileOk }), { gp: 0, rc: 0, pg: 0, po: 0 });
    L.push("## 1단계 공고 해부 (E2E)");
    L.push("");
    L.push(`- 정답 프로젝트 요건 재현율: ${frac(a.rc, a.gp)} [LLM 대응]`);
    L.push(`- 이력서 요건(profile) 분류 정확도: ${frac(a.po, a.pg)} [LLM 대응+자동]`);
    L.push(`- 모델이 뽑은 요구사항 수: 평균 ${mean(s1.map((x) => x.modelReqs)).toFixed(1)}개, 표준편차 ${std(s1.map((x) => x.modelReqs)).toFixed(2)}`);
    L.push("");
  }

  // 비용·시간
  L.push("## 비용과 응답 시간 [자동]");
  L.push("");
  L.push("| 단계 | 호출 | 입력 토큰 | 출력 토큰 | 비용 | 호출당 p50 | p95 |");
  L.push("|---|---|---|---|---|---|---|");
  for (const [st, v] of Object.entries(stage)) {
    L.push(`| ${st} | ${v.calls} | ${v.inTok.toLocaleString()} | ${v.outTok.toLocaleString()} | $${v.usd.toFixed(3)} | ${(v.msP50 / 1000).toFixed(1)}초 | ${(v.msP95 / 1000).toFixed(1)}초 |`);
  }
  L.push(`| **케이스당** | | | | **$${s.costPerCase.toFixed(4)}** | 벽시계 p50 ${(s.wallP50 / 1000).toFixed(1)}초 | |`);
  L.push("");
  L.push("비용은 config.ts 의 단가로 계산합니다. 확인되지 않은 단가는 가정값입니다. 재시도 호출의 토큰은 합산돼 있습니다.");
  L.push("");

  // 재현성
  const byCase = new Map<string, CaseRun[]>();
  runs.forEach((x) => byCase.set(x.r.case, [...(byCase.get(x.r.case) ?? []), x]));
  const multi = [...byCase.values()].filter((v) => v.length >= 2);
  if (multi.length) {
    let same = 0;
    let total = 0;
    const fabStd: number[] = [];
    for (const v of multi) {
      const ids = new Set(v.flatMap((x) => x.reqs.map((q) => q.goldId)));
      for (const id of ids) {
        const levels = v.map((x) => x.reqs.find((q) => q.goldId === id)?.model ?? "?");
        if (levels.includes("?")) continue;
        total++;
        if (new Set(levels).size === 1) same++;
      }
      const rates = v.map((x) => {
        const js = x.sents.filter((s) => s.judge);
        return js.length ? js.filter((s) => s.judge!.fabricated).length / js.length : NaN;
      }).filter((n) => !Number.isNaN(n));
      if (rates.length >= 2) fabStd.push(std(rates));
    }
    L.push("## 재현성");
    L.push("");
    L.push(`- 반복 실행한 케이스: ${multi.length}개 (케이스당 ${Math.min(...multi.map((v) => v.length))}~${Math.max(...multi.map((v) => v.length))}회)`);
    L.push(`- 요구사항 판정이 모든 회차에서 같았던 비율: ${frac(same, total)}`);
    if (fabStd.length) L.push(`- 케이스 안 날조율의 표준편차 평균: ${(mean(fabStd) * 100).toFixed(1)}%p`);
    L.push("");
  }

  // 사례
  const ex = judged.filter((x) => x.judge!.fabricated).slice(0, 15);
  if (ex.length) {
    L.push("## 날조 판정 사례 (최대 15개)");
    L.push("");
    L.push("| 케이스 | 문장 | 유형 | 날조 부분 | 운영 경고 |");
    L.push("|---|---|---|---|---|");
    for (const x of ex) L.push(`| ${x.case} r${x.rep} ${x.key} | ${x.text.replace(/\|/g, "/")} | ${x.judge!.category} | ${x.judge!.span.replace(/\|/g, "/")} | ${x.serverFlagged ? "있음" : "**없음**"} |`);
    L.push("");
  }

  const md = L.join("\n");
  writeFileSync(join(dir, "report.md"), md);
  writeFileSync(join(dir, "summary.json"), JSON.stringify(s, null, 2));
  return { s, md };
}

function compare(names: string[]) {
  const ss = names.map((n) => summarize(n).s);
  const p = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
  const L = [
    "| 조합 | 모드 | 실행 | 날조율(LLM) | 엄격 숫자 | 근거 유효 s2 | 근거 유효 s3 | 매칭 정확도 | 과대평가 | 함정 통과 | 케이스당 비용 | 벽시계 p50 |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...ss.map(
      (s) =>
        `| ${s.config} | ${s.mode} | ${s.n.runs} | ${p(s.fabrication.judge)} | ${p(s.fabrication.strictNumber)} | ${p(s.citationS2)} | ${p(s.citationS3)} | ${p(s.matchAccuracy)} | ${p(s.overclaim)} | ${p(s.trapPass)} | $${s.costPerCase.toFixed(4)} | ${(s.wallP50 / 1000).toFixed(1)}초 |`
    ),
  ];
  console.log(L.join("\n"));
}

const runs = arg("runs");
if (runs) compare(runs.split(","));
else {
  const name = arg("run");
  if (!name) {
    console.error("--run=<이름> 또는 --runs=<이름,...>");
    process.exit(1);
  }
  console.log(summarize(name).md);
}
