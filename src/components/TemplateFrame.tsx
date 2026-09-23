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
 * 하고(tpl:check 가 막습니다), 없으면 막아두는 편이 맞습니다.
 *
 * [왜 높이를 재지 않고 고정 창인가 — 2026-09-23]
 * 처음에는 내용 높이를 재서 iframe 을 그만큼 늘렸습니다. 미리보기 안에
 * 또 스크롤바가 생기는 걸 피하려던 것인데, `min-h-screen`(100vh)을 쓰는
 * 템플릿에서 되먹임이 생깁니다: 높이를 늘리면 100vh 가 같이 늘고, 그러면
 * 내용이 더 길어지고, 다시 늘리고… 미니멀 세리프가 그 경우였고 화면이
 * 거의 빈 검은 판으로 나왔습니다.
 *
 * 그래서 iframe 을 **고정 크기 창**으로 둡니다. 1280×800 은 흔한 노트북
 * 화면이고, vh 단위가 실제 화면과 똑같이 풀립니다. 안에서 스크롤하는 건
 * 실제 방문자가 하는 것과 같으니 오히려 정직한 미리보기입니다.
 */

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 800;

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
  className?: string;
  /**
   * 공개 링크(/p/:id)용. 축소하지 않고 실제 화면 폭으로 그립니다.
   *
   * 미리보기는 "노트북 화면을 줄여서 보여주는 창"이지만, 공개 링크는
   * 방문자가 자기 기기로 직접 보는 것이라 축소하면 안 됩니다. 폰에서
   * 열면 템플릿의 반응형 규칙이 그 폭에 맞춰 동작해야 합니다.
   */
  fullWidth?: boolean;
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
  className = "",
  fullWidth = false,
  onHtml,
}: TemplateFrameProps) {
  const [template, setTemplate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  /**
   * 바깥 폭을 재서 축소 비율을 정합니다.
   *
   * [2026-09-23] 이 효과가 처음 돌 때는 아직 템플릿을 받는 중이라
   * 화면에 "불러오는 중…"만 있고 boxRef 가 비어 있었습니다. 그대로
   * 끝나고 다시 붙지 않아서 축소가 영영 안 걸렸습니다 — 1280px 짜리
   * 내용이 좁은 패널에 그대로 나와 오른쪽이 잘렸습니다.
   * 이제 렌더링이 끝난 뒤에도 다시 붙도록 html 을 의존성에 넣습니다.
   */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / BASE_WIDTH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);

  if (loadError) {
    return <p className={`text-xs text-red-400 px-4 py-10 text-center ${className}`}>{loadError}</p>;
  }
  if (!html) {
    return <p className={`text-xs text-neutral-600 px-4 py-10 text-center ${className}`}>불러오는 중…</p>;
  }

  if (fullWidth) {
    return (
      <iframe
        title="포트폴리오"
        srcDoc={html}
        sandbox="allow-same-origin"
        className={`block w-full border-0 ${className}`}
        style={{ height: "100vh" }}
      />
    );
  }

  return (
    <div ref={boxRef} className={`w-full overflow-hidden ${className}`}>
      <div
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          // transform 은 레이아웃 크기를 줄이지 않습니다. 줄어든 만큼
          // 아래에 빈 공간이 남으므로 바깥 높이를 직접 지정합니다.
          marginBottom: -(BASE_HEIGHT * (1 - scale)),
        }}
      >
        <iframe
          title="포트폴리오 미리보기"
          srcDoc={html}
          sandbox="allow-same-origin"
          className="block border-0"
          style={{ width: BASE_WIDTH, height: BASE_HEIGHT }}
        />
      </div>
    </div>
  );
}
