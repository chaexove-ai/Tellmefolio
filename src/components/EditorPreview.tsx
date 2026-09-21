import { useEffect, useRef, useState } from "react";
import PortfolioRenderer from "./portfolio-templates/PortfolioRenderer";
import { hasContent } from "./portfolio-templates/types";
import { FONT_STACKS, DEFAULT_FONT } from "../lib/portfolioTheme";
import type { PortfolioProjectRow, PortfolioRow } from "../lib/portfolios";

/**
 * 편집기 오른쪽에 붙는 실시간 미리보기입니다.
 *
 * 왜 오른쪽인가: 왼쪽에는 이미 사이드바 내비가 있습니다. 미리보기를 왼쪽에
 * 두면 [내비 | 미리보기 | 입력폼] 이 되어 정작 타이핑하는 칸이 화면 맨
 * 바깥으로 밀립니다. 손이 가는 것을 안쪽에, 확인만 하는 것을 바깥에 둡니다.
 *
 * 왜 별도 컴포넌트인가: PortfolioEditor 가 이미 675줄이고, 여기 들어가는
 * ResizeObserver·디바운스는 편집 로직과 아무 관계가 없습니다.
 */

/** 내보내기 화면의 미리보기가 실제로 그려지는 대략적인 폭입니다.
 *  템플릿들은 전부 w-full 이라 폭에 따라 줄바꿈이 달라지는데, 편집기
 *  미리보기를 패널 폭에 그냥 맞춰 그리면 PDF 와 줄바꿈이 어긋납니다.
 *  그래서 항상 이 폭으로 그린 다음 축소해서 넣습니다 — 보이는 모양이
 *  실제 결과물과 같아야 미리보기를 믿고 쓸 수 있습니다. */
const BASE_WIDTH = 720;

/** 타이핑할 때마다 템플릿 4종 중 하나를 통째로 다시 그리면 입력이
 *  끊깁니다. 손을 멈춘 뒤에만 갱신합니다. */
const DEBOUNCE_MS = 250;

/** 미리보기 확대 상한. */
const MAX_ZOOM = 1.5;

interface Props {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  coverUrl: string | null;
}

export default function EditorPreview({ portfolio, projects, coverUrl }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [shown, setShown] = useState({ portfolio, projects });

  useEffect(() => {
    const t = window.setTimeout(() => setShown({ portfolio, projects }), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [portfolio, projects]);

  // 패널 폭은 화면 크기에 따라 달라지므로(xl/2xl 브레이크포인트) 고정
  // 배율을 쓸 수 없습니다. 실제 폭을 재서 BASE_WIDTH 대비 비율로 줄입니다.
  // transform: scale 대신 zoom 을 쓰는 이유는 scale 이 레이아웃 크기를
  // 그대로 두기 때문입니다 — 축소해도 원래 높이만큼 자리를 차지해서 빈
  // 공간이 아래로 길게 남습니다. zoom 은 레이아웃까지 같이 줄어듭니다.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // 1 을 넘겨도 됩니다 — 같은 720px 레이아웃을 키워 그리는 것이라
      // 줄바꿈은 그대로고 글자만 커집니다. 넓은 모니터에서 미리보기가
      // 720px 에 멈춰 있으면 오른쪽이 그만큼 빕니다. 상한을 두는 건
      // 과하게 커져서 한 화면에 몇 줄 안 들어오는 걸 막기 위해서입니다.
      if (w > 0) setZoom(Math.min(MAX_ZOOM, w / BASE_WIDTH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bodyFontStack = FONT_STACKS[shown.portfolio.font] ?? FONT_STACKS[DEFAULT_FONT];
  const filled = shown.projects.filter(hasContent);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium text-neutral-400">미리보기</h2>
        <span className="text-[11px] text-neutral-600">
          내보내면 이 모양 그대로 저장됩니다
        </span>
      </div>

      <div
        ref={frameRef}
        className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-9rem)]"
      >
        {filled.length === 0 ? (
          <p className="text-xs text-neutral-600 px-4 py-10 text-center">
            왼쪽에 내용을 채우면 여기에 바로 반영됩니다.
          </p>
        ) : (
          <div className="mx-auto" style={{ width: BASE_WIDTH, zoom }}>
            <PortfolioRenderer
              portfolio={shown.portfolio}
              projects={shown.projects}
              coverUrl={coverUrl}
              bodyFontStack={bodyFontStack}
            />
          </div>
        )}
      </div>
    </div>
  );
}
