/**
 * 직무 전환 프롬프트 3개(1단계 공고 해부·2단계 근거 매칭·3단계 재작성).
 *
 * [2026-10-01] index.ts 에서 옮겼습니다. 내용은 한 글자도 바꾸지 않았습니다.
 * index.ts 는 Deno.serve 로 서버를 띄우기 때문에 다른 코드가 import 할 수
 * 없었고, 그래서 평가(scripts/eval)가 운영 프롬프트를 그대로 쓸 방법이
 * 없었습니다. 평가가 복사본을 들고 있으면 운영 프롬프트가 바뀌는 순간
 * 엉뚱한 것을 재게 됩니다. 이 파일을 고치면 평가도 같이 바뀝니다.
 *
 * 네트워크도 Deno API 도 쓰지 않습니다(evidence.ts 와 같은 원칙).
 */

import {
  FIELDS,
  type Analysis,
  type Evidence,
  type Match,
  type SourceProject,
} from "../_shared/evidence.ts";

export function analyzePrompt(targetJob: string, jd: string) {
  return [
    `목표 직무: ${targetJob}`,
    "",
    "아래 채용 공고를 해부해 주세요.",
    "",
    "## 공고",
    jd,
    "",
    "## 지켜야 할 것",
    "- requirements 는 공고가 실제로 요구하는 역량·경험만. 8~12개. 중복은 합치세요.",
    '- kind 는 필수 자격이면 "must", 우대 사항이면 "nice".',
    "- keywords 는 그 요구사항을 가리키는 공고 속 표현 2~5개.",
    "- label 은 그 요구사항의 짧은 이름. 12자 안팎 명사구(예: 사용자 흐름 설계, 디자인 시스템, 영어).",
    '- scope 는 프로젝트 경험으로 보여 줄 수 있으면 "project", 어학·학위·전공·자격증·경력 연수·해외 거주·서류(포트폴리오 제출 등)처럼 이력서로 확인하는 요건이면 "profile".',
    "- vocabulary 는 이 공고와 업계가 실제로 쓰는 어휘 10개 안팎(예: 그로스, 리텐션).",
    "- lead 는 이 공고가 포트폴리오에서 가장 먼저 보고 싶어 할 것 하나:",
    '  "outcome"(지표·성과·임팩트), "execution"(특정 기술·구현 역량), "problem"(문제 정의·기획·가설), "context"(도메인 이해·협업·조직 맥락)',
    "- leadReason 은 그렇게 판단한 근거를 공고 내용으로 한 문장. 예: 필수 요건 5개 중 3개가 지표를 요구합니다",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    '{ "role": "공고의 직무명", "requirements": [{ "text": "...", "label": "...", "kind": "must", "scope": "project", "keywords": ["..."] }], "vocabulary": ["..."], "lead": "outcome", "leadReason": "..." }',
  ].join("\n");
}

export function evidenceLines(evidence: Evidence[]) {
  return evidence.map((e) => `${e.id}: ${e.text}`).join("\n");
}

export function matchPrompt(analysis: Analysis, evidence: Evidence[], projects: SourceProject[]) {
  return [
    "채용 공고의 요구사항마다, 지원자 포트폴리오에서 그것을 뒷받침하는 근거 문장을 찾아 주세요.",
    "",
    "## 요구사항",
    analysis.requirements
      .filter((r) => r.scope !== "profile")
      .map((r) => `${r.id} [${r.kind}] ${r.text}`)
      .join("\n"),
    "",
    "## 포트폴리오 근거 문장 (id: 문장)",
    `프로젝트: ${projects.map((p, i) => `p${i}=${p.name || "(이름 없음)"}`).join(", ")}`,
    evidenceLines(evidence),
    "",
    "## 지켜야 할 것",
    "- evidenceIds 에는 위 목록에 **있는 id 만** 쓰세요. 새 id 를 만들지 마세요.",
    '- level: 근거가 요구사항을 직접 보여주면 "full", 관련은 있지만 약하면 "partial", 없으면 "none".',
    '- 근거가 없으면 억지로 찾지 말고 "none" 으로 두세요. 비슷한 단어가 있다는 것만으로는 근거가 아닙니다.',
    "- why 는 판단 이유를 한 문장으로.",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이. 모든 요구사항에 대해 하나씩.",
    '{ "matches": [{ "requirementId": "r1", "level": "full", "evidenceIds": ["p0:outcome:0"], "why": "..." }] }',
  ].join("\n");
}

export function rewritePrompt(
  targetJob: string,
  analysis: Analysis,
  matches: Match[],
  projectIndex: number,
  project: SourceProject,
  evidence: Evidence[]
) {
  const mine = evidence.filter((e) => e.projectIndex === projectIndex);
  const mineIds = new Set(mine.map((e) => e.id));
  const related = matches
    .filter((m) => m.level !== "none" && m.evidenceIds.some((id) => mineIds.has(id)))
    .map((m) => {
      const req = analysis.requirements.find((r) => r.id === m.requirementId)!;
      return `${req.id} ${req.text} ← 근거: ${m.evidenceIds.filter((id) => mineIds.has(id)).join(", ")}`;
    });

  return [
    `지원자의 프로젝트 하나를 "${targetJob}" 직무 공고에 맞게 다시 써 주세요.`,
    "새로 쓰는 것이 아니라 **같은 사실을 그 직무의 언어로 옮기는 것**입니다.",
    "",
    `## 프로젝트: ${project.name || "(이름 없음)"}`,
    "원문 문장 (id: 문장). id 의 가운데 부분이 필드입니다.",
    evidenceLines(mine),
    "",
    "## 이 프로젝트로 대응할 수 있는 공고 요구사항",
    related.length > 0 ? related.join("\n") : "(없음 — 그래도 공고 어휘로 옮겨 쓰세요)",
    "",
    "## 공고가 쓰는 어휘",
    analysis.vocabulary.join(", ") || "(없음)",
    "",
    "## 반드시 지킬 것",
    "- **사실을 더하지 마세요.** 원문에 없는 성과·기능·도구·역할을 쓰지 않습니다. 어휘와 강조만 바꿉니다.",
    "- **숫자는 원문에 있는 것만.** 새 숫자를 만들거나 반올림하지 마세요.",
    "- **원문에 없는 기술·제품 이름을 쓰지 마세요.** 공고에 나온 도구라도 원문에 없으면 쓰지 않습니다.",
    "- 위 목록에 없는 요구사항은 채우려 하지 마세요. 그건 부족한 부분으로 따로 알립니다.",
    "- 문장마다 evidence 에 근거 원문 id 를 1개 이상 답니다. 위 목록의 id 만 쓰세요.",
    "- 문장이 특정 요구사항에 대응하면 requirements 에 그 id(r1 등)를 답니다.",
    "- 각 사실은 원래 필드에 둡니다. 원문에서 비어 있는 필드는 빈 배열로 둡니다.",
    "- role 은 한 문장, 나머지 필드는 원문과 비슷한 분량으로.",
    "- 한국어, 채용 담당자가 읽는 담백한 문체.",
    "",
    "## 출력",
    "설명 없이 JSON 만. 코드펜스 없이.",
    `{ "fields": { ${FIELDS.map((f) => `"${f}": [{ "text": "...", "evidence": ["p${projectIndex}:${f}:0"], "requirements": ["r1"] }]`).join(", ")} } }`,
  ].join("\n");
}
