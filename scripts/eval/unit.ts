/**
 * 날조 방지 장치(_shared/evidence.ts)의 기계 검사 단위 확인. 모델 호출 없음, 비용 0.
 *
 *   npm run eval:unit
 *
 * 두 종류로 나눕니다.
 *  - 보장: 지금 코드가 지켜야 하는 동작. 깨지면 실패(exit 1)
 *  - 알려진 한계: 지금 코드가 못 잡는 경우를 기록. 실패로 치지 않고 목록으로 보여 줍니다.
 *    리포트의 "실패 유형"과 개선 전후 비교의 출발점입니다.
 */
import {
  buildEvidence,
  normalizeMatches,
  numbersIn,
  splitSentences,
  termsIn,
  verifySentences,
  type FieldSentences,
} from "../../supabase/functions/_shared/evidence.ts";

let failed = 0;
const must = (name: string, cond: boolean) => {
  console.log(`${cond ? "통과" : "실패"}  ${name}`);
  if (!cond) failed++;
};
const limits: string[] = [];
const known = (name: string, stillTrue: boolean) => {
  if (stillTrue) limits.push(name);
  else console.log(`해소됨  ${name} — 이 줄을 '보장'으로 옮기세요`);
};

const one = (text: string, evidence: string[] = ["p0:outcome:0"]): FieldSentences => ({
  context: [], role: [], problem: [], execution: [], reflection: [],
  outcome: [{ text, evidence, requirements: [] }],
});
const verify = (rewrite: string, source: string, cited = source) =>
  verifySentences(one(rewrite), new Map([["p0:outcome:0", cited]]), source, () => [source]);

/* ---------- 문장 쪼개기 ---------- */
must("소수점은 문장 경계가 아님", splitSentences("전환율이 3.5배 올랐습니다. 다음 문장.").length === 2);
must("글머리표 제거", splitSentences("- 첫째\n• 둘째\n1) 셋째").join("|") === "첫째|둘째|셋째");
must("빈 필드는 근거 0개", buildEvidence([{ id: "a", name: "", stack: [], context: "", role: "", problem: "", execution: "", outcome: "", reflection: "" }]).length === 0);

/* ---------- 숫자 ---------- */
must("천 단위 쉼표 무시: 1,200 = 1200", numbersIn("1,200명")[0] === "1200");
must("원문에 있는 숫자는 경고 없음", verify("결제 응답이 4.2초에서 0.8초로 줄었습니다", "p95가 4.2초에서 0.8초로 줄었습니다").length === 0);
must("원문에 없는 숫자는 경고", verify("전환율이 30% 올랐습니다", "전환율이 올랐습니다").some((f) => f.kind === "number" && f.detail === "30"));
known(
  "같은 양을 다른 표기로 쓰면 오탐: '3,200만 원' → '3천2백만 원'",
  verify("월 광고비 3천2백만 원을 운영했습니다", "월 광고비는 약 3,200만 원이었습니다").some((f) => f.kind === "number")
);
known(
  "한글 수사로 쓴 숫자는 못 잡음: 원문에 없는 '두 배'",
  verify("매출이 두 배로 늘었습니다", "매출이 늘었습니다").length === 0
);
known(
  "원문의 다른 숫자 조각과 우연히 같으면 통과: '10만' 날조가 원문 '10명'의 10 과 겹침",
  verify("MAU 10만 서비스를 운영했습니다", "디자이너 10명과 협업했습니다").every((f) => f.kind !== "number")
);
known(
  "숫자의 '의미'가 바뀌어도 통과: 원문 '3배 몰린 트래픽' → '처리량 3배 개선'",
  verify("처리량을 3배 개선했습니다", "성수기에는 예약이 평소의 3배까지 몰렸습니다").length === 0
);

/* ---------- 영문 용어 ---------- */
must("원문에 없는 도구명 경고", verify("Amplitude 로 퍼널을 분석했습니다", "GA4 로 퍼널을 봤습니다").some((f) => f.kind === "term" && f.detail === "Amplitude"));
must("대소문자 무시", verify("ga4 이벤트를 정리했습니다", "GA4 이벤트").every((f) => f.kind !== "term"));
known(
  "한글로 쓴 도구명은 못 잡음: '앰플리튜드'",
  verify("앰플리튜드로 분석했습니다", "GA4 로 봤습니다").length === 0
);
known(
  "원문 어딘가 부분 문자열이면 통과: 'Java' 날조가 원문 'JavaScript' 에 포함",
  verify("Java 백엔드를 개발했습니다", "JavaScript 로 화면을 만들었습니다").every((f) => f.kind !== "term")
);

/* ---------- 한글 주장 ---------- */
known(
  "역할 과장은 기계 검사로 못 잡음: 원문 '팀원' → '리드'",
  verify("팀을 리드하며 설계를 주도했습니다", "백엔드 개발자 2명 중 한 명으로 설계를 맡았습니다").length === 0
);
known(
  "도메인 날조는 기계 검사로 못 잡음: '핀테크 도메인 경험'",
  verify("핀테크 도메인에서 결제를 설계했습니다", "숙소 예약 결제를 설계했습니다").length === 0
);
known(
  "방법론 날조는 기계 검사로 못 잡음: '두 시안 비교' → 'A/B 테스트' (A/B 는 한 글자라 용어 검사 제외)",
  verify("A/B 테스트로 검증했습니다", "시안 두 개를 번갈아 보여 줬습니다").length === 0
);

/* ---------- 2단계 방어 장치 ---------- */
const ev = buildEvidence([{ id: "a", name: "x", stack: [], context: "문장 하나.", role: "", problem: "", execution: "", outcome: "", reflection: "" }]);
const req = [{ id: "r1", text: "t", kind: "must" as const, keywords: [] }];
const m1 = normalizeMatches({ matches: [{ requirementId: "r1", level: "full", evidenceIds: ["p3:outcome:9"] }] }, req, ev)[0];
must("가짜 id 만 있으면 none 으로 강등", m1.level === "none" && m1.downgraded === true);
const m2 = normalizeMatches({ matches: [{ requirementId: "r1", level: "full", evidenceIds: ["p0:context:0"] }] }, req, ev)[0];
must("진짜 id 는 통과", m2.level === "full");
known(
  "진짜 id 를 엉뚱하게 대면 통과: id 존재만 보고 내용 관련성은 안 봄 (→ LLM 판정 '근거 유효율'로 잼)",
  m2.level === "full"
);

console.log(`\n알려진 한계 ${limits.length}개 (실패 아님 — 리포트의 실패 유형 후보)`);
limits.forEach((l) => console.log(`  - ${l}`));
console.log(failed ? `\n보장 실패 ${failed}개` : "\n보장 모두 통과");
process.exit(failed ? 1 : 0);
