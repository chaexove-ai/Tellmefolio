/**
 * 코드 스플리팅된 라우트 청크를 내려받는 동안 잠깐 보이는 자리표시자.
 *
 * 스피너 대신 비어 있는 블록을 씁니다. 청크는 대개 100ms 안쪽으로 도착하는데
 * 그 사이에 스피너가 번쩍이면 오히려 느려 보입니다. 높이를 미리 잡아 두어
 * 실제 화면이 들어올 때 레이아웃이 튀지 않게 합니다.
 */
export default function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] w-full"
      role="status"
      aria-live="polite"
      aria-label="화면을 불러오는 중"
    />
  );
}
