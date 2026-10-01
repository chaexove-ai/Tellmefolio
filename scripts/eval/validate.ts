/**
 * 평가 세트 검사. API 를 부르지 않습니다(비용 0).
 *
 * 라벨이 틀리면 지표가 전부 틀리므로, 모델을 돌리기 전에 기계로 잡을 수 있는
 * 실수는 여기서 다 잡습니다: 없는 근거 id, level 과 근거의 불일치, 함정 유형
 * 누락, 실존 회사명처럼 보이는 표현 등.
 *
 *   npm run eval:validate
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EVAL, listCaseIds, loadCase, type Trap } from "./data.ts";

const errors: string[] = [];
const warns: string[] = [];
const err = (c: string, m: string) => errors.push(`[${c}] ${m}`);
const warn = (c: string, m: string) => warns.push(`[${c}] ${m}`);

const ids = listCaseIds();
if (ids.length === 0) {
  console.error("eval/labels 에 라벨이 없습니다.");
  process.exit(1);
}

const trapsByFamily = new Map<string, Set<Trap>>();
const diffCount = new Map<string, number>();
let reqTotal = 0;
let trapTotal = 0;

for (const id of ids) {
  if (!existsSync(join(EVAL, "labels", `${id}.yaml`))) continue;
  let c;
  try {
    c = loadCase(id);
  } catch (e) {
    err(id, `읽기 실패: ${(e as Error).message}`);
    continue;
  }
  const { label: L, portfolio: P, jd, evidence } = c;
  const known = new Set(evidence.map((e) => e.id));

  if (L.case !== id) err(id, `case 필드(${L.case})가 파일 이름과 다릅니다`);
  if (P.family !== L.family) err(id, `포트폴리오 family(${P.family}) ≠ 라벨 family(${L.family})`);
  if (L.difficulty === "cross" && L.job_family === L.family) err(id, "cross 인데 job_family 가 family 와 같습니다");
  if (L.difficulty !== "cross" && L.job_family !== L.family) err(id, "cross 가 아닌데 job_family 가 다릅니다");
  if (P.projects.length < 2 || P.projects.length > 3) warn(id, `프로젝트 ${P.projects.length}개 (2~3 권장)`);
  if (evidence.length < 12 || evidence.length > 32) warn(id, `근거 문장 ${evidence.length}개 (15~25 권장)`);
  if (jd.length < 300) warn(id, `공고 본문이 짧습니다(${jd.length}자)`);
  if (!["outcome", "execution", "problem", "context"].includes(L.lead)) err(id, `lead 값 오류: ${L.lead}`);

  const reqs = L.requirements ?? [];
  if (reqs.length < 8 || reqs.length > 12) err(id, `요구사항 ${reqs.length}개 — 운영 프롬프트가 8~12개를 요구합니다`);
  reqTotal += reqs.length;

  reqs.forEach((r, i) => {
    const where = `${id}/${r.id}`;
    if (r.id !== `r${i + 1}`) err(where, `id 는 순서대로 r${i + 1} 이어야 합니다(운영이 다시 번호를 붙이는 방식과 맞춤)`);
    if (!["must", "nice"].includes(r.kind)) err(where, `kind 오류: ${r.kind}`);
    if (!["project", "profile"].includes(r.scope)) err(where, `scope 오류: ${r.scope}`);
    if (!r.note || r.note.trim().length < 5) err(where, "note(판단 이유)가 비었습니다");
    if (r.scope === "profile") {
      if (r.level !== null) err(where, "profile 요건은 level: null");
      if ((r.evidence ?? []).length) err(where, "profile 요건에 근거를 달지 않습니다");
      if (r.trap && r.trap !== "T6") err(where, "profile 요건의 함정 유형은 T6 만");
    } else {
      if (!["full", "partial", "none"].includes(r.level as string)) err(where, `level 오류: ${r.level}`);
      if (r.trap === "T6") err(where, "T6 는 profile 요건에만");
      const ev = r.evidence ?? [];
      for (const e of ev) if (!known.has(e)) err(where, `없는 근거 id: ${e}`);
      if (r.level === "none" && ev.length) err(where, "level none 인데 근거가 있습니다");
      if (r.level !== "none" && ev.length === 0) err(where, `level ${r.level} 인데 근거가 없습니다`);
      if (r.trap && r.level !== "none") err(where, `함정(${r.trap})은 정답이 none 이어야 합니다`);
    }
    if (r.trap) {
      trapTotal++;
      if (!trapsByFamily.has(L.family)) trapsByFamily.set(L.family, new Set());
      trapsByFamily.get(L.family)!.add(r.trap);
    }
  });

  const traps = reqs.filter((r) => r.trap).length;
  const projectTraps = reqs.filter((r) => r.trap && r.trap !== "T6").length;
  if (L.difficulty === "sufficient" && projectTraps > 1) warn(id, `근거 충분 케이스인데 프로젝트 함정 ${projectTraps}개`);
  if (L.difficulty !== "sufficient" && traps < 2) err(id, `${L.difficulty} 케이스는 함정 2개 이상`);
  const key = `${L.family}/${L.difficulty}`;
  diffCount.set(key, (diffCount.get(key) ?? 0) + 1);

  // 함정이 유혹하는 표현이 원문에 이미 있으면 함정이 아닙니다
  const whole = P.projects.map((p) => [p.name, ...p.stack, p.context, p.role, p.problem, p.execution, p.outcome, p.reflection].join(" ")).join(" ").toLowerCase();
  for (const t of L.must_not_appear ?? []) {
    if (whole.includes(t.toLowerCase())) err(id, `must_not_appear "${t}" 가 원문에 이미 있습니다`);
  }
  if (traps > 0 && (L.must_not_appear ?? []).length === 0) warn(id, "함정이 있는데 must_not_appear 가 비었습니다");
}

for (const [fam, set] of trapsByFamily) {
  const missing = (["T1", "T2", "T3", "T4", "T5", "T6"] as Trap[]).filter((t) => !set.has(t));
  if (missing.length) warn(fam, `직무군에 없는 함정 유형: ${missing.join(", ")}`);
}

console.log(`케이스 ${ids.length}개 · 요구사항 ${reqTotal}개 · 함정 ${trapTotal}개`);
console.log([...diffCount].map(([k, v]) => `${k}=${v}`).join("  "));
warns.forEach((w) => console.log("경고 " + w));
errors.forEach((e) => console.log("오류 " + e));
console.log(errors.length ? `\n오류 ${errors.length}개` : "\n오류 없음");
process.exit(errors.length ? 1 : 0);
