# AI 품질 평가 — 직무 전환(job-switch)

직무 전환 기능이 **지어내지 않는지**를 숫자로 잽니다. 설계 배경은
`docs/job-switch-design.md` 7절("검증 방법"), 첫 평가 대상을 고른 이유는 이 기능이
날조 차단을 가장 전면에 내세우기 때문입니다.

## 무엇을 재나

| 지표 | 정의 | 판정 |
|---|---|---|
| 날조율 | 재작성 문장 중 원문에 없는 사실(숫자·도구·도메인·역할·방법·성과)이 들어간 비율 | LLM(다른 계열) + 사람 표본 |
| 숫자 날조(엄격/운영) | 인용 근거 기준 / 프로젝트 원문 기준으로 원문에 없는 숫자가 나온 문장 비율 | 자동 |
| 운영 검증기 재현율·정밀도 | LLM 이 날조로 본 문장 중 운영 4단계가 경고한 비율, 경고 중 실제 날조 비율 | LLM + 자동 |
| 근거 유효율 | 2단계: full/partial 매칭의 근거가 요구사항을 실제로 뒷받침 / 3단계: 문장이 인용한 근거가 문장을 뒷받침 | LLM |
| 가짜 근거 id 비율 | 모델이 댄 근거 id 중 존재하지 않아 서버가 버린 비율 | 자동 |
| 매칭 정확도·과대평가율 | 정답 라벨(full/partial/none)과 일치율, 정답 none 을 full/partial 로 본 비율 | 사람 라벨 |
| 함정 통과율 | 일부러 심은 "근거 없는 요구사항"이 최종 none 인 비율. 모델이 스스로 none / 서버가 강등을 나눠 봄 | 사람 라벨 |
| 비용·시간 | 단계별 토큰·비용·호출 시간(p50/p95), 케이스당 벽시계 시간 | 자동 |
| 재현성 | 같은 입력 반복 시 요구사항 판정이 모든 회차에서 같은 비율, 날조율 표준편차 | 자동 |

모든 리포트 표에 **분모(n)** 와 **판정 주체**를 같이 적습니다.

## 실행 모드

- **격리(isolated)**: 사람이 만든 정답 요구사항을 2단계에 직접 넣습니다. 1단계의
  흔들림 없이 2·3단계만 잽니다. 모델 비교는 이 모드로 합니다.
- **E2E**: 1→2→3단계를 운영과 같이 전부 모델로. 1단계 품질(정답 요건 재현율,
  이력서 요건 분류)과 실제 사용 조건의 숫자를 봅니다.

평가는 운영 파일을 그대로 import 합니다: 프롬프트 `job-switch/prompts.ts`,
정리·검증 `_shared/evidence.ts`, 호출·재시도 `_shared/model.ts`. 단계를 잇는
순서만 `scripts/eval/pipeline.ts` 에 옮겨 적었습니다(index.ts 순서가 바뀌면 같이 고칠 것).

## 평가 세트

가상 포트폴리오 12 × 공고 2 = **24 케이스**, 요구사항 245개, 함정 68개.
작성 규칙과 함정 유형(T1~T6)은 `eval/cases/AUTHORING.md`.

- `eval/cases/portfolios/` 가상 포트폴리오 · `eval/cases/jobs/` 가상 공고
- `eval/labels/` 정답 라벨(YAML, 원본) — `reviewed: false` 는 미검수
- `eval/private/` 실제 데이터(본인 동의 필수, **커밋 안 됨**)
- `eval/runs/` 실행 원시 결과(**커밋 안 됨**). 요약만 `eval/REPORT.md` 로 옮깁니다

## 준비

```
cp .env.eval.example .env.eval.local   # 키 입력 (.env*.local 은 커밋되지 않음)
```

- `ANTHROPIC_API_KEY` 평가 대상 호출
- `GEMINI_API_KEY` 판정(다른 계열 모델). 무료 등급은 입력이 학습에 쓰일 수 있어 가상 샘플만 보냅니다
- Node 22.6 이상(TypeScript 를 바로 실행)

## 명령

| 명령 | 하는 일 | 비용 |
|---|---|---|
| `npm run eval:unit` | 검증기 단위 확인 + 알려진 한계 목록 | 0 |
| `npm run eval:selftest` | 가짜 모델로 실행기·채점기 배선 확인 | 0 |
| `npm run eval:validate` | 라벨 검사(없는 근거 id, 함정 누락 등) | 0 |
| `npm run eval:evidence -- pf-dev-01` | 포트폴리오의 근거 id 목록 | 0 |
| `npm run eval:review` | 라벨 검수표 `eval/review/labels.csv` 생성 | 0 |
| `npm run eval:review -- --apply=<csv> --reviewer=이름` | 검수 결과를 YAML 에 반영 | 0 |
| `npm run eval:estimate` | 전체 계획의 예상 비용표 | 0 (키가 있으면 count_tokens 로 정확히) |
| `npm run eval -- --mode=isolated --config=baseline` | 실행 (시작 전 예상 비용 표시·확인, `--budget` 상한) | 유료 |
| `npm run eval:judge -- --run=<이름>` | LLM 판정 | Gemini |
| `npm run eval:score -- --run=<이름>` | 리포트 `eval/runs/<이름>/report.md` | 0 |
| `npm run eval:score -- --runs=a,b,c` | 실행끼리 비교표 | 0 |
| `npm run eval:review -- --judge-sample=<이름>` | 판정기 검수 표본 CSV | 0 |
| `npm run eval:review -- --judge-agree=<csv>` | 판정기 정밀도·재현율(사람 기준) | 0 |

`--cases` 는 id·접두어(`dev`, `design-01a`), `@half`(직무군×난이도 12개),
`@repro`(재현성 8개)를 받습니다. 실패한 케이스는 같은 명령을 다시 실행하면 그것만 다시 돕니다.

## 순서

1. `eval:review` → 라벨 검수 → `--apply` → `eval:validate`
2. `eval:estimate` 로 비용 확인
3. 기준선: `eval -- --mode=isolated` / `eval -- --mode=e2e` / `eval -- --mode=e2e --cases=@repro --reps=3`
4. `eval:judge` → `eval:review -- --judge-sample` → 사람이 표본 판정 → `--judge-agree`
5. `eval:score`
6. 모델 비교: `--config=s2-haiku|s3-haiku --cases=@half`, 1단계는 `s1-sonnet` E2E
