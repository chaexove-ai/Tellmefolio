import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useTheme } from "../theme/ThemeContext";

const BRAND: [number, number, number] = [0.7608, 0.4392, 0.2392];

// 대표적인 도시 몇 곳 — "같은 이야기를 여러 관점(직무)으로" 라는 브랜드
// 메시지를 "여러 곳에서 열리는 포트폴리오"라는 이미지로 은유합니다.
const markers: { location: [number, number]; size: number }[] = [
  { location: [37.5665, 126.978], size: 0.07 },
  { location: [37.7749, -122.4194], size: 0.05 },
  { location: [51.5072, -0.1276], size: 0.05 },
  { location: [1.3521, 103.8198], size: 0.05 },
  { location: [-33.8688, 151.2093], size: 0.04 },
  { location: [35.6762, 139.6503], size: 0.05 },
];

/**
 * 랜딩 히어로 전용 인터랙티브 3D 글로브. 랜딩 이외의 화면은 절제된 모션만
 * 쓰고, 이 컴포넌트에서만 화려한 WebGL 포인트를 씁니다. 드래그로 회전
 * 가능하고, 손을 떼면 다시 천천히 자동 회전합니다.
 *
 * cobe는 onRender 콜백 없이 update()를 직접 매 프레임 호출하는 방식이라,
 * 회전 애니메이션은 이 컴포넌트가 requestAnimationFrame으로 직접 구동합니다.
 */
export default function HeroGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const phi = useRef(0);
  const width = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerMovement = useRef(0);
  const dragRotation = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      width.current = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();

    const dark = theme === "dark" ? 1 : 0;
    const baseColor: [number, number, number] =
      theme === "dark" ? [0.16, 0.13, 0.11] : [0.93, 0.88, 0.79];
    const glowColor: [number, number, number] =
      theme === "dark" ? [0.45, 0.27, 0.16] : [0.86, 0.63, 0.42];

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width.current * 2,
      height: width.current * 2,
      phi: 0,
      theta: 0.32,
      dark,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: theme === "dark" ? 6.5 : 3.2,
      baseColor,
      markerColor: BRAND,
      glowColor,
      opacity: 0.92,
      markers,
    });

    let rafId: number;
    const animate = () => {
      if (pointerInteracting.current === null) {
        phi.current += 0.0028;
      }
      globe.update({
        phi: phi.current + dragRotation.current,
        width: width.current * 2,
        height: width.current * 2,
      });
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [theme]);

  return (
    <div className="relative aspect-square w-full max-w-[380px] mx-auto">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerMovement.current;
          e.currentTarget.style.cursor = "grabbing";
        }}
        onPointerUp={(e) => {
          pointerInteracting.current = null;
          e.currentTarget.style.cursor = "grab";
        }}
        onPointerOut={(e) => {
          pointerInteracting.current = null;
          e.currentTarget.style.cursor = "grab";
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerMovement.current = delta;
            dragRotation.current = delta / 200;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerMovement.current = delta;
            dragRotation.current = delta / 100;
          }
        }}
        style={{ width: "100%", height: "100%", cursor: "grab", contain: "layout paint size" }}
      />
    </div>
  );
}
