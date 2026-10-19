/**
 * 대화로 만들기 — 채용 공고 붙여넣기 가드 확인. 네트워크·모델 호출 없음.
 *
 *   node --experimental-transform-types --no-warnings scripts/check-interview-rules.ts
 *
 * 2026-10-19 실사용에서 공고가 "맥락 및 배경" 칸에 들어간 사례가 첫 케이스입니다.
 * eval 브랜치의 가상 공고 24개·포트폴리오 180칸으로도 확인했습니다(공고 24/24 감지, 경험 글 오탐 0/180).
 */
import assert from "node:assert/strict";
import {
  dropUnsupportedFields,
  experienceAnswers,
  looksLikeJobPosting,
} from "../supabase/functions/interview/rules.ts";

const pasted =
  "•올리브영 US글로벌몰 UVUX 디자인 • 사용자 관점 문제 정의 및 사용자 흐름• 프로토타입 설계 • 영어, 중국어, 일본어 능력 우수 UI/UX디자인 • 글로벌 디자인 시스템 및 UI 라이브러리 구축•운영 • 영미권, 중국어권, 일본 거주 경험 (글로벌) • 사용자 리서치 •시장 분석 기반 디자인 개선 기회 발굴 ※ 포트폴리오 필수 제출 • 디자인 전공";

const postings = [
  pasted,
  "자격 요건\n- 웹 프론트엔드 개발 경력 3년 이상\n- React 실무 경험\n우대 사항\n- 디자인 시스템 운영 경험",
  "[주요 업무] 결제 화면 설계 / [자격 요건] UX 경력 2년 이상의 경력",
];
const experiences = [
  "필수 기능만 먼저 출시하고, 우대 고객 대상 이벤트는 다음 달로 미뤘습니다.",
  "채용 공고 관리 화면을 설계했습니다. 지원자 목록과 모집 상태를 한 화면에 보여 줬습니다.",
  "- 결제 단계를 5단계에서 3단계로 줄임\n- 배송 카드 도입\n- 동료 6명에게 시안을 써 보게 함",
  "디자이너 2명 중 한 명으로 결제 흐름 화면 설계를 맡았어요.",
  "cj 채용 공고를 줄테니 이에 맞는 포폴을 만들어줘",
];

for (const t of postings) assert.equal(looksLikeJobPosting(t), true, `공고인데 못 잡음: ${t.slice(0, 40)}`);
for (const t of experiences) assert.equal(looksLikeJobPosting(t), false, `경험인데 공고로 봄: ${t.slice(0, 40)}`);

const answers = [
  { no: 1, text: "ux디자인 포폴" },
  { no: 2, text: pasted },
  { no: 3, text: experiences[3] },
];
assert.deepEqual(experienceAnswers(answers).map((a) => a.no), [1, 3], "공고 답은 근거에서 빠지고 번호는 유지");

// 이 가드 전에 공고로 채워진 칸은 비워져 다시 묻게 됨. existing·skipped 는 그대로
const cleaned = dropUnsupportedFields(
  {
    context: { state: "filled", summary: "공고 요약", answerIds: ["a2:0"] },
    role: { state: "filled", summary: "역할", answerIds: ["a3:0", "a2:1"] },
    problem: { state: "existing", summary: "원래 글", answerIds: [] },
    outcome: { state: "skipped", summary: "", answerIds: [] },
  },
  new Set(["a1:0", "a3:0"])
);
assert.equal(cleaned.context, undefined);
assert.deepEqual(cleaned.role?.answerIds, ["a3:0"]);
assert.equal(cleaned.problem?.state, "existing");
assert.equal(cleaned.outcome?.state, "skipped");

console.log("통과: 공고 붙여넣기 가드");
