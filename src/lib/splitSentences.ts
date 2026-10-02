/**
 * 원문을 문장으로 쪼갭니다 — 결과 화면의 '근거 보기'용.
 *
 * supabase/functions/_shared/evidence.ts 의 splitSentences 와 **같은 규칙**이어야
 * 합니다. 근거 ID(p0:outcome:2)의 마지막 숫자가 그 함수가 매긴 문장 순번이라,
 * 규칙이 어긋나면 하이라이트가 엉뚱한 문장에 걸립니다. 한쪽을 고치면 다른 쪽도
 * 고치세요. 프런트와 함수는 빌드가 따로라 import 로 나눌 수 없어 옮겨 적었습니다.
 *
 * 그래도 어긋날 수 있는 경우(직무 전환을 돌린 뒤 원본을 고친 경우)는 화면 쪽에서
 * 문장 내용으로 한 번 더 맞춰 봅니다(EvidenceCompare).
 */

const SENTENCE_END = /(?<=[.!?。])\s+/;
const LIST_MARK = /^\s*(?:[-•·*]|\d+[.)])\s+/;

/** 서버와 같은 결과. 테스트·비교용 */
export function splitSentences(text: string): string[] {
  return (text ?? "")
    .split(/\n+/)
    .flatMap((line) => line.split(SENTENCE_END))
    .map((s) => s.replace(LIST_MARK, "").trim())
    .filter((s) => s.length > 0);
}

export interface SentencePiece {
  text: string;
  /** 서버가 매긴 문장 순번과 같은 번호 */
  index: number;
}

/**
 * 화면용 — 줄 구분을 살린 채 쪼갭니다. 펼치면 splitSentences 와 같은 순서·번호입니다.
 * (원문은 whitespace-pre-line 으로 보여 주던 글이라 줄을 없애면 읽기 어렵습니다)
 */
export function splitSentenceLines(text: string): SentencePiece[][] {
  let index = 0;
  return (text ?? "")
    .split(/\n+/)
    .map((line) =>
      line
        .split(SENTENCE_END)
        .map((s) => s.replace(LIST_MARK, "").trim())
        .filter((s) => s.length > 0)
        .map((s) => ({ text: s, index: index++ })),
    )
    .filter((line) => line.length > 0);
}
