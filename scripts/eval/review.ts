/**
 * 사람 검수용 표(CSV) 만들기·반영하기. 비용 0.
 *
 * 1) 정답 라벨 검수
 *    npm run eval:review                   → eval/review/labels.csv
 *    (스프레드시트에서 agree / fix_level / fix_evidence / comment 열을 채움)
 *    npm run eval:review -- --apply=eval/review/labels.csv --reviewer=이름
 *    → 고친 값을 YAML 에 반영하고, 한 행도 빠짐없이 검수된 케이스는 reviewed: true
 *
 * 2) LLM 판정기 검수 표본 (판정기 정확도를 재기 위해)
 *    npm run eval:review -- --judge-sample=<실행 이름> [--size=40]
 *    → eval/review/judge-<실행>.csv : 날조 판정 전부 + 비날조 무작위 표본
 *    (human_fabricated 열에 yes/no 를 채움)
 *    npm run eval:review -- --judge-agree=eval/review/judge-<실행>.csv
 *    → 판정기 정밀도·재현율(사람 기준)
 *
 * CSV 는 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙입니다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { FIELDS } from "../../supabase/functions/_shared/evidence.ts";
import { arg, EVAL, listCaseIds, loadCase } from "./data.ts";
import type { JudgeOut } from "./judge.ts";
import type { RunResult } from "./pipeline.ts";

const OUT = join(EVAL, "review");
const BOM = "﻿";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  const cols = Object.keys(rows[0] ?? {});
  return BOM + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};

/** 따옴표·줄바꿈을 처리하는 작은 CSV 파서 */
function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function exportLabels() {
  const rows: Record<string, unknown>[] = [];
  for (const id of listCaseIds()) {
    const c = loadCase(id);
    const text = new Map(c.evidence.map((e) => [e.id, e.text]));
    for (const q of c.label.requirements) {
      rows.push({
        case: id,
        difficulty: c.label.difficulty,
        target_job: c.label.target_job,
        req: q.id,
        kind: q.kind,
        scope: q.scope,
        requirement: q.text,
        gold_level: q.level ?? "(profile)",
        evidence_ids: (q.evidence ?? []).join(" "),
        evidence_text: (q.evidence ?? []).map((e) => `[${e}] ${text.get(e)}`).join("\n"),
        trap: q.trap ?? "",
        note: q.note,
        agree: "", // y / n
        fix_level: "", // full / partial / none
        fix_evidence: "", // 공백으로 구분한 id
        comment: "",
      });
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "labels.csv"), toCsv(rows));
  console.log(`eval/review/labels.csv — ${rows.length}행. 근거 원문은 npm run eval:evidence -- <포트폴리오> 로도 볼 수 있습니다.`);
}

function applyLabels(file: string, reviewer: string) {
  const rows = parseCsv(readFileSync(file, "utf8"));
  const byCase = new Map<string, Record<string, string>[]>();
  rows.forEach((r) => byCase.set(r.case, [...(byCase.get(r.case) ?? []), r]));
  let changed = 0;
  for (const [id, rs] of byCase) {
    const path = join(EVAL, "labels", `${id}.yaml`);
    const doc = parseDocument(readFileSync(path, "utf8"));
    const reqs = doc.get("requirements") as { items: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }[] };
    let touched = false;
    for (const r of rs) {
      const node = reqs.items.find((n) => n.get("id") === r.req);
      if (!node) continue;
      if (r.fix_level || r.fix_evidence || r.comment) touched = true;
      if (r.fix_level) {
        node.set("level", r.fix_level === "none" ? "none" : r.fix_level);
        if (r.fix_level === "none") node.set("evidence", []);
        changed++;
      }
      if (r.fix_evidence) {
        node.set("evidence", r.fix_evidence.split(/\s+/).filter(Boolean));
        changed++;
      }
      if (r.comment) node.set("note", `${node.get("note")} [검수: ${r.comment}]`);
    }
    // 이 케이스의 모든 행에 agree 가 채워졌을 때만 검수 완료
    if (rs.every((r) => ["y", "n"].includes(r.agree.trim().toLowerCase())) && doc.get("reviewed") !== true) {
      doc.set("reviewed", true);
      doc.set("reviewer", reviewer);
      touched = true;
    }
    // 손대지 않은 케이스는 파일을 다시 쓰지 않습니다(불필요한 diff 방지)
    if (touched) writeFileSync(path, doc.toString({ flowCollectionPadding: false, lineWidth: 0 }));
  }
  console.log(`수정 ${changed}건 반영. npm run eval:validate 로 확인하세요.`);
}

function judgeSample(run: string, size: number) {
  const dir = join(EVAL, "runs", run);
  const rows: Record<string, unknown>[] = [];
  for (const f of readdirSync(join(dir, "judge")).filter((x) => x.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as RunResult;
    const j = JSON.parse(readFileSync(join(dir, "judge", f), "utf8")) as JudgeOut;
    const c = loadCase(r.case);
    const text = new Map(c.evidence.map((e) => [e.id, e.text]));
    r.rewrites.forEach((rw, pi) =>
      FIELDS.forEach((fl) =>
        rw[fl].forEach((s, si) => {
          const jj = j.j1.find((x) => x.key === `p${pi}:${fl}:${si}`);
          if (!jj) return;
          rows.push({
            run: `${r.case}.r${r.rep}`,
            key: jj.key,
            sentence: s.text,
            cited: s.evidence.map((e) => `[${e}] ${text.get(e)}`).join("\n"),
            project_source: c.evidence.filter((e) => e.projectIndex === pi).map((e) => `[${e.id}] ${e.text}`).join("\n"),
            llm_fabricated: jj.fabricated ? "yes" : "no",
            llm_category: jj.category,
            llm_span: jj.span,
            llm_reason: jj.reason,
            human_fabricated: "",
            human_note: "",
          });
        })
      )
    );
  }
  // 날조 판정은 전부, 비날조는 고정 시드로 무작위 size 개
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const fab = rows.filter((r) => r.llm_fabricated === "yes");
  const clean = rows.filter((r) => r.llm_fabricated === "no").sort(() => rand() - 0.5).slice(0, size);
  // 사람이 LLM 판정에 끌려가지 않도록 섞고, 판정 열은 맨 뒤에 둡니다
  const sample = [...fab, ...clean].sort(() => rand() - 0.5);
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `judge-${run}.csv`);
  writeFileSync(file, toCsv(sample.map(({ llm_fabricated, llm_category, llm_span, llm_reason, ...rest }) => ({ ...rest, llm_fabricated, llm_category, llm_span, llm_reason }))));
  console.log(`${file} — 날조 판정 ${fab.length} + 비날조 표본 ${clean.length}. human_fabricated 에 yes/no 를 채워 주세요.`);
}

function judgeAgree(file: string) {
  const rows = parseCsv(readFileSync(file, "utf8")).filter((r) => ["yes", "no"].includes(r.human_fabricated.trim()));
  const tp = rows.filter((r) => r.llm_fabricated === "yes" && r.human_fabricated === "yes").length;
  const fp = rows.filter((r) => r.llm_fabricated === "yes" && r.human_fabricated === "no").length;
  const fn = rows.filter((r) => r.llm_fabricated === "no" && r.human_fabricated === "yes").length;
  const tn = rows.filter((r) => r.llm_fabricated === "no" && r.human_fabricated === "no").length;
  console.log(`사람이 검수한 문장 ${rows.length}개`);
  console.log(`판정기 정밀도 (LLM 이 날조라 한 것 중 사람도 날조): ${tp}/${tp + fp}`);
  console.log(`판정기 재현율 (사람이 날조라 한 것 중 LLM 도 날조, 비날조 쪽은 표본): ${tp}/${tp + fn}`);
  console.log(`일치율: ${tp + tn}/${rows.length}`);
  console.log("※ 비날조 쪽은 무작위 표본이라 재현율은 표본 기준값입니다.");
}

const apply = arg("apply");
const js = arg("judge-sample");
const ja = arg("judge-agree");
if (apply) applyLabels(apply, arg("reviewer", "reviewer")!);
else if (js) judgeSample(js, Number(arg("size", "40")));
else if (ja) judgeAgree(ja);
else exportLabels();
if (existsSync(OUT) && !existsSync(join(OUT, ".gitkeep"))) writeFileSync(join(OUT, ".gitkeep"), "");
