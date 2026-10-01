// 타입 검사 전용. 평가는 Node 에서 _shared/model.ts 를 불러오는데, 그 파일은
// Deno.env 만 씁니다. 실제 값은 pipeline.ts 의 initModel 이 process.env 로 잇습니다.
declare const Deno: { env: { get(key: string): string | undefined } };
