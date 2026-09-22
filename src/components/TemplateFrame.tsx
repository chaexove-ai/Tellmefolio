import { useEffect, useMemo, useRef, useState } from "react";
import { fillTemplate, loadTemplate } from "../lib/htmlTemplate";
import { buildTemplateData } from "../lib/buildTemplateData";
import { DEFAULT_HTML_TEMPLATE, htmlTemplates } from "../lib/htmlTemplates";
import type { PortfolioProjectRow, PortfolioRow, ProjectImageMap } from "../lib/portfolios";
import type { BlockMap } from "../lib/blocks";


/**
 * 템플릿 HTML 을 채워 iframe 에 그립니다.
 *
 * [왜 iframe 인가]
 * 템플릿은 자기만의 CSS 를 통째로 들고 옵니다 — Tailwind 유틸리티,
 * `body { background: #050505 }` 같은 전역 규칙까지. 그걸 앱 문서에
 * 그냥 넣으면 편집기 UI 가 같이 검게 변합니다. iframe 은 문서가 달라서
 * 스타일이 서로 닿지 않습니다.
 *
 * [스크립트를 막아둡니다]
 * sandbox 에 allow-scripts 를 주지 않습니다. 템플릿에는 스크립트가 없어야
 * 하고(없도록 정리해서 넣습니다), 없으면 막아두는 편이 맞습니다. 나중에
 * 스크립트가 필요한 템플릿이 생기면 그때 이 결정을 다시 합니다 —
 * 지금 열어두고 잊어버리는 것보다 낫습니다.
 *
 * [폭 맞추기]
 * 템플릿은 데스크탑 폭(1280px)을 기준으로 만들어집니다. 편집기 오른쪽
 * 패널은 그보다 좁으므로, iframe 을 1280px 로 두고 통째로 축소합니다.
 * 반응형으로 줄이면 안 됩니다 — 좁은 화면용 레이아웃이 나와서 "내보내면
 * 이렇게 나온다"가 거짓이 됩니다.
 */

const BASE_WIDTH = 1280;

/** 같은 템플릿을 탭 옮길 때마다 다시 받지 않도록. */
const cache = new Map<string, Promise<string>>();
function getTemplate(id: string): Promise<string> {
  const known = htmlTemplates.some((t) => t.id === id);
  const safeId = known ? id : DEFAULT_HTML_TEMPLATE;
  let p = cache.get(safeId);
  if (!p) {
    p = loadTemplate(safeId);
    cache.set(safeId, p);
  }
  return p;
}

export interface TemplateFrameProps {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  images?: ProjectImageMap;
  blocks?: BlockMap;
  coverUrl?: string | null;
  contact?: { email?: string | null; github?: string | null; site?: string | null };
  lang?: "ko" | "en";
  /**
   * fit  — 패널 폭에 맞춰 통째로 축소 (편집기 오른쪽)
   * full — 축소하지 않고 그대로 (전체화면·내보내기 미리보기)
   */
  mode?: "fit" | "full";
  className?: string;
  /** 완성된 HTML 을 밖에서도 써야 할 때(내보내기·인쇄). */
  onHtml?: (html: string) => void;
}

export default function TemplateFrame({
  portfolio,
  projects,
  images = {},
  blocks = {},
  coverUrl = null,
  contact,
  lang = "ko",
  mode = "fit",
  className = "",
  onHtml,
}: TemplateFrameProps) {
  const [template, setTemplate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    getTemplate(portfolio.template_id)
      .then((t) => alive && setTemplate(t))
      .catch(() => alive && setLoadError("템플릿을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [portfolio.template_id]);

  const html = useMemo(() => {
    if (!template) return null;
    const data = buildTemplateData({ portfolio, projects, images, blocks, coverUrl, contact, lang });
    return fillTemplate(template, data);
  }, [template, portfolio, projects, images, blocks, coverUrl, contact, lang]);

  useEffect(() => {
    if (html && onHtml) onHtml(html);
  }, [html, onHtml]);

  // 패널 폭을 재서 축소 비율을 정합니다.
  useEffect(() => {
    if (mode !== "fit") {
      setScale(1);
      return;
    }
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setScale(Math.min(1, w / BASE_WIDTH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  /**
   * 내용 높이를 읽어 iframe 높이를 맞춥니다.
   *
   * iframe 은 내용에 맞춰 늘어나지 않습니다 — 기본 높이 안에서 자기
   * 스크롤바를 만듭니다. 미리보기 안에 또 스크롤바가 생기면 바깥
   * 스크롤과 섞여서 못 씁니다.
   */
  const fitHeight = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    if (h > 0) setHeight(h);
  };

  useEffect(() => {
    if (!html) return;
    // 폰트와 이미지가 늦게 도착하면 높이가 달라집니다. 몇 번 더 봅니다 —
    // load 이벤트 한 번으로는 웹폰트가 적용되기 전 높이를 잡습니다.
    const timers = [80, 400, 1200].map((ms) => window.setTimeout(fitHeight, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [html]);

  if (loadError) {
    return <p className={`text-xs text-red-400 px-4 py-10 text-center ${className}`}>{loadError}</p>;
  }
  if (!html) {
    return <p className={`text-xs text-neutral-600 px-4 py-10 text-center ${className}`}>불러오는 중…</p>;
  }

  return (
    <div ref={boxRef} className={className}>
      <div
        style={{
          width: mode === "fit" ? BASE_WIDTH : "100%",
          height,
          transform: mode === "fit" ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          // transform 은 레이아웃 크기를 줄이지 않습니다. 줄인 만큼
          // 아래에 빈 공간이 남으므로 바깥 높이를 직접 줄여줍니다.
          marginBottom: mode === "fit" ? -(height * (1 - scale)) : 0,
        }}
      >
        <iframe
          ref={frameRef}
          title="포트폴리오 미리보기"
          srcDoc={html}
          onLoad={fitHeight}
          sandbox="allow-same-origin"
          className="block w-full border-0"
          style={{ height }}
        />
      </div>
    </div>
  );
}
