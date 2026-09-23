import { useEffect, useRef, useState } from "react";
import GrainCover from "./GrainCover";
import { fillTemplate } from "../lib/htmlTemplate";
import { buildThumbData } from "../lib/buildTemplateData";
import { getTemplate } from "../lib/templateCache";
import type { LibraryPortfolio } from "../lib/portfolios";

/**
 * 포트폴리오의 실제 첫 화면을 축소해 보여주는 썸네일.
 *
 * [왜 그림 파일을 만들지 않나 — 2026-09-23]
 * "첫 화면을 표지로" 를 하려면 보통 스크린샷을 찍어 저장합니다. 그러려면
 * 서버에서 헤드리스 브라우저를 돌려야 하는데, Supabase Edge Function 은
 * Deno 라 크롬이 없습니다. 바깥 서비스를 붙이면 비용과 고장 지점이
 * 늘어납니다. 게다가 저장한 그림은 **내용을 고치면 즉시 낡습니다** —
 * 제목을 바꿨는데 서재의 표지는 옛 제목인 상태가 생깁니다.
 *
 * 그래서 그림을 만들지 않고 **그 페이지 자체를 작게 띄웁니다.** 파일도
 * 캐시도 없고, 내용을 고치면 다음 화면에서 바로 따라옵니다.
 *
 * [화면에 들어올 때만 붙입니다]
 * 커뮤니티 목록은 최대 60장입니다. 60개의 iframe 을 한꺼번에 띄우면
 * 목록이 뜨는 데만 한참 걸립니다. IntersectionObserver 로 보이는 것만
 * 붙이고, 한 번 붙은 것은 떼지 않습니다 — 스크롤을 오르내릴 때마다
 * 다시 그리면 그게 더 느립니다.
 *
 * [크기를 어떻게 맞추나]
 * 템플릿은 1280px 폭을 전제로 만들어졌습니다. 그래서 iframe 을 1280 폭
 * 으로 두고 `상자폭/1280` 만큼 축소합니다. 높이는 `상자높이/축소율` 로
 * 정합니다 — 이렇게 하면 템플릿의 100vh(min-h-screen) 첫 화면이 상자를
 * 정확히 채웁니다. 높이를 내용에서 재지 않으므로 예전의 되먹임(높이를
 * 늘리면 100vh 가 커지고 다시 늘어나는)이 생기지 않습니다.
 *
 * [실패하면 물러납니다]
 * 템플릿을 못 받거나 아직 받는 중이면 GrainCover 가 그대로 보입니다.
 * 썸네일은 목록의 장식이지 본체가 아니라, 여기서 실패했다고 카드가
 * 비면 안 됩니다.
 */

interface PortfolioThumbProps {
  portfolio: LibraryPortfolio;
  /** 크기·모서리 지정. 예: "aspect-[4/3] rounded-xl" */
  className?: string;
  /**
   * 폭·높이가 정해져 있으면 넘기세요. 책장처럼 상자 크기가 애니메이션
   * 으로 변하는 자리에서는 크기를 재면 매 프레임 다시 계산하게 됩니다.
   */
  size?: { width: number; height: number };
}

const BASE_WIDTH = 1280;

export default function PortfolioThumb({
  portfolio,
  className = "",
  size,
}: PortfolioThumbProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(size ?? null);

  // 화면에 들어왔는지
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // 지원하지 않는 환경에서는 그냥 바로 붙입니다.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      // 조금 미리 준비해두면 스크롤할 때 빈 칸이 스쳐 지나가지 않습니다.
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 크기 — size 를 받았으면 재지 않습니다.
  useEffect(() => {
    if (size) {
      setBox(size);
      return;
    }
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setBox({ width: w, height: h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    getTemplate(portfolio.templateId)
      .then((tpl) => {
        if (!alive) return;
        setHtml(fillTemplate(tpl, buildThumbData(portfolio)));
      })
      // 실패하면 GrainCover 가 그대로 남습니다.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, portfolio]);

  const scale = box ? box.width / BASE_WIDTH : 0;

  return (
    <div ref={boxRef} className={`relative overflow-hidden ${className}`}>
      {/* 아래에 항상 깔아둡니다 — 못 그렸을 때의 바탕이자, 뜨는 동안의 자리입니다.
          GrainCover 자체에는 `position: relative` 가 CSS 에 박혀 있어서
          className 으로 absolute 를 줘도 안 먹습니다(index.css). 그래서
          바깥을 한 겹 씌워 그 상자를 절대배치합니다. */}
      <div className="absolute inset-0">
        <GrainCover
          seed={portfolio.id}
          tint={portfolio.jobColor}
          className="h-full w-full"
        />
      </div>

      {html && box && scale > 0 && (
        <iframe
          title=""
          aria-hidden="true"
          tabIndex={-1}
          srcDoc={html}
          sandbox="allow-same-origin"
          scrolling="no"
          className="absolute left-0 top-0 border-0"
          style={{
            width: BASE_WIDTH,
            // 상자 높이를 축소율로 나눠 두면, 템플릿의 100vh 첫 화면이
            // 상자를 정확히 채웁니다.
            height: box.height / scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            // 목록의 카드는 통째로 링크입니다. iframe 이 클릭과 스크롤을
            // 가로채면 카드가 안 눌립니다.
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
