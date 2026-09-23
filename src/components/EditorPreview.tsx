import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import TemplateFrame from "./TemplateFrame";
import type { PortfolioProjectRow, PortfolioRow, ProjectImageMap } from "../lib/portfolios";
import type { BlockMap } from "../lib/blocks";


/**
 * 편집기 오른쪽에 붙는 실시간 미리보기입니다.
 *
 * 왜 오른쪽인가: 왼쪽에는 이미 사이드바 내비가 있습니다. 미리보기를 왼쪽에
 * 두면 [내비 | 미리보기 | 입력폼] 이 되어 정작 타이핑하는 칸이 화면 맨
 * 오른쪽으로 밀립니다.
 *
 * [2026-09-23] 템플릿이 React 컴포넌트에서 HTML 파일로 바뀌면서 이 화면도
 * iframe 을 그립니다. 템플릿이 자기 CSS 를 통째로 들고 오기 때문에 —
 * `body { background: #050505 }` 같은 전역 규칙까지 — 앱 문서에 그냥
 * 넣으면 편집기 UI 가 같이 검게 변합니다.
 *
 * 디바운스는 남겨둡니다. 타이핑할 때마다 iframe 을 다시 그리면 한 글자
 * 칠 때마다 화면이 깜빡입니다.
 */
const DEBOUNCE_MS = 400;

interface Props {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  coverUrl: string | null;
  images?: ProjectImageMap;
  blocks?: BlockMap;
  contact?: { email?: string | null; github?: string | null; site?: string | null };
  /** 전체화면으로 크게 보기. 없으면 버튼을 그리지 않습니다. */
  onExpand?: () => void;
}

export default function EditorPreview({
  portfolio,
  projects,
  coverUrl,
  images = {},
  blocks = {},
  contact,
  onExpand,
}: Props) {
  const [shown, setShown] = useState({ portfolio, projects, blocks });

  useEffect(() => {
    const t = window.setTimeout(() => setShown({ portfolio, projects, blocks }), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [portfolio, projects, blocks]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium text-neutral-400">미리보기</h2>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-brand transition-colors"
          >
            <Maximize2 size={12} aria-hidden="true" />
            크게 보기
          </button>
        )}
      </div>

      {/* [2026-09-23] 바깥 스크롤을 없앴습니다. 미리보기가 고정 크기
          창이라 스크롤은 그 안에서 합니다 — 바깥에도 두면 어느 쪽이
          움직이는지 알 수 없어집니다. */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <TemplateFrame
          portfolio={shown.portfolio}
          projects={shown.projects}
          images={images}
          blocks={shown.blocks}
          coverUrl={coverUrl}
          contact={contact}
        />
      </div>
    </div>
  );
}
