import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Portfolio } from "../mockData";

interface BookshelfProps {
  portfolios: Portfolio[];
}

/**
 * "내 서재" 상단 전용 미니 책장.
 *
 * 표지 카드 나열 → 책등(spine)이 꽂혀 있고 커서를 올리면 그 책이
 * 앞으로 빠져나오는 인터랙션.
 *
 * ── 잘림 문제를 어떻게 피했는가 ────────────────────────────────
 * 가로 스크롤 컨테이너는 CSS 규칙상 세로 방향도 함께 자릅니다
 * (overflow-x: auto 를 주면 overflow-y 도 visible 로 둘 수 없습니다).
 * 그래서 두 가지를 지켰습니다.
 *
 *   1. 제목은 스크롤 컨테이너 "바깥" 표시줄(readout)에 띄웁니다.
 *      말풍선을 책 위에 절대배치하면 반드시 잘립니다.
 *   2. perspective-origin 을 `50% 100%`(선반 바닥)로 잡았습니다.
 *      소실점이 위쪽에 있으면 translateZ 로 당겨올 때 책의 아랫부분이
 *      아래로 밀려나 잘립니다. 바닥에 두면 책이 위로만 커집니다.
 *      위쪽은 pt-10 여유로 처리합니다.
 *
 * ── 그 외 ─────────────────────────────────────────────────────
 * - `title` 속성을 쓰지 않습니다. 브라우저 기본 툴팁이 readout 과
 *   겹쳐서 두 개가 동시에 뜹니다.
 * - 책등 글자는 nowrap + ellipsis 로 한 칸만 씁니다. 그냥 두면 긴 제목이
 *   여러 칸으로 접혀서 읽는 순서가 깨집니다.
 * - hover 와 focus-visible 을 함께 처리해 키보드로도 동작합니다.
 * - prefers-reduced-motion 에서는 3D 이동 없이 테두리만 강조합니다.
 */
export default function Bookshelf({ portfolios }: BookshelfProps) {
  const [active, setActive] = useState<Portfolio | null>(null);

  return (
    <div>
      {/* 제목 표시줄 — 스크롤 영역 바깥이라 잘리지 않습니다 */}
      <div className="h-7 flex items-center gap-2 text-xs text-neutral-400 mb-1">
        <span
          aria-hidden="true"
          className="w-[7px] h-[7px] rounded-[2px] transition-colors"
          style={{ backgroundColor: active ? active.jobColor : "transparent" }}
        />
        {active ? (
          <span className="truncate">
            <span className="text-neutral-100">{active.title}</span>
            <span className="text-neutral-500">
              {" "}
              · {active.job} · {active.year}
            </span>
          </span>
        ) : (
          <span>책등에 커서를 올리면 책이 빠져나옵니다</span>
        )}
      </div>

      <div className="shelf flex items-end gap-[3px] border-b-2 border-neutral-800 overflow-x-auto overflow-y-hidden pt-10 pb-0">
        {portfolios.map((p) => (
          <Link
            key={p.id}
            to={`/library/portfolios/${p.id}/versions`}
            onMouseEnter={() => setActive(p)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(p)}
            onBlur={() => setActive(null)}
            className="book-spine group shrink-0 w-[38px] h-[164px] rounded-t-[3px] rounded-b-sm
              border border-neutral-800 border-b-0 bg-neutral-900
              flex flex-col items-center
              hover:border-brand/65 focus-visible:border-brand/65"
          >
            <span
              className="block w-full h-[7px] rounded-t-[2px] shrink-0"
              style={{ backgroundColor: p.jobColor }}
              aria-hidden="true"
            />
            <span className="book-title flex-1 min-h-0 w-full py-2.5 text-[10.5px] text-neutral-300 group-hover:text-neutral-100 transition-colors">
              {p.title}
            </span>
            <span className="text-[8px] text-neutral-500 pb-1.5 shrink-0" aria-hidden="true">
              {p.year}
            </span>
          </Link>
        ))}

        <Link
          to="/wizard"
          className="shrink-0 w-[38px] h-[164px] ml-1.5 rounded-t-[3px]
            border-2 border-dashed border-neutral-700 border-b-0 text-neutral-600
            flex items-end justify-center pb-4 transition-colors duration-150
            hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand"
        >
          <Plus size={16} aria-hidden="true" />
          <span className="sr-only">새 포트폴리오 만들기</span>
        </Link>
      </div>

      <p className="text-xs text-neutral-500 mt-3">눌러서 포트폴리오를 열어보세요.</p>
    </div>
  );
}
