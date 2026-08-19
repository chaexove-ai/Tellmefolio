import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Portfolio } from "../mockData";

interface BookshelfProps {
  portfolios: Portfolio[];
}

/**
 * "내 서재" 상단 전용 미니 책장 배너. 나무 질감·삽화 없이 책 앞면 형태의
 * 단순한 표지 카드로 표현합니다. 제목을 가로쓰기로 그대로 읽을 수 있게
 * 하고, 표지를 누르면 해당 포트폴리오 버전 관리 화면으로 이동합니다.
 */
export default function Bookshelf({ portfolios }: BookshelfProps) {
  return (
    <div>
      {/* overflow-x-auto인 가로 스크롤 컨테이너는 CSS 규칙상 overflow-y도
          함께 자르기 때문에, hover 시 위로 뜨는 표지가 잘리지 않도록
          위쪽에 여유 패딩(pt-3)을 둡니다. */}
      <div className="flex items-end gap-3 border-b-2 border-neutral-800 overflow-x-auto pt-3 pb-0">
        {portfolios.map((p) => (
          <Link
            key={p.id}
            to={`/library/portfolios/${p.id}/versions`}
            className="group shrink-0 w-[104px] h-[144px] rounded-md border border-neutral-800 bg-neutral-900/60
              overflow-hidden flex flex-col hover:-translate-y-1 hover:border-brand/50 transition-all duration-150"
          >
            <div className="h-2 shrink-0" style={{ backgroundColor: p.jobColor }} />
            <div className="flex-1 min-h-0 px-2.5 py-2.5 flex flex-col">
              <p className="text-[11px] font-medium text-neutral-100 leading-snug line-clamp-4">
                {p.title}
              </p>
              <div className="mt-auto pt-1">
                <p className="text-[9px] text-neutral-500 truncate">
                  {p.job} · {p.year}
                </p>
              </div>
            </div>
          </Link>
        ))}
        <Link
          to="/wizard"
          title="새 포트폴리오 만들기"
          className="shrink-0 w-[104px] h-[144px] rounded-md border-2 border-dashed border-neutral-700 text-neutral-600
            hover:border-brand hover:text-brand hover:-translate-y-1 flex items-center justify-center
            transition-all duration-150"
        >
          <Plus size={18} />
        </Link>
      </div>
      <p className="text-xs text-neutral-600 mt-2">표지를 눌러 포트폴리오를 열어보세요</p>
    </div>
  );
}
