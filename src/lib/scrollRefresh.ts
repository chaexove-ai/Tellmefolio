import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * ScrollTrigger 는 마운트 시점의 레이아웃으로 트리거 위치를 계산합니다.
 * 이 사이트는 웹폰트(Gowun Batang, Pretendard)가 늦게 도착해서 그 뒤로
 * 레이아웃이 밀립니다. 그대로 두면 트리거 위치가 실제 위치와 어긋난 채
 * 남아 리빌이 늦거나 엉뚱한 지점에서 터집니다.
 *
 * 폰트 로드가 끝난 뒤 딱 한 번만 전체를 재계산합니다.
 * 여러 컴포넌트가 호출해도 실제 실행은 한 번뿐입니다.
 */
let scheduled = false;

export function scheduleScrollRefresh() {
  if (scheduled) return;
  scheduled = true;

  const run = () => ScrollTrigger.refresh();

  if (typeof document !== "undefined" && "fonts" in document) {
    document.fonts.ready.then(() => requestAnimationFrame(run));
  } else {
    requestAnimationFrame(run);
  }
  window.addEventListener("load", run, { once: true });
}
