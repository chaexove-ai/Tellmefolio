import { Link, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { NewPortfolioButton } from "./NewPortfolio";

/**
 * "내 포트폴리오" 머리 — 포트폴리오 / 제출 기록 두 탭 (09-26).
 * 제출 기록은 전에는 홈의 작은 링크나 카드 속 링크로만 갈 수 있었습니다.
 */
export default function LibraryTabs({
  portfolioCount,
  submissionCount,
  actions,
}: {
  portfolioCount?: number;
  submissionCount?: number;
  /** 새 포트폴리오 버튼 왼쪽에 둘 것 (예: 직무 색상 설정) */
  actions?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const onSubs = pathname.startsWith("/submissions");
  const tab = (to: string, label: string, on: boolean, count?: number) => (
    <Link
      to={to}
      aria-current={on ? "page" : undefined}
      className={`-mb-px border-b-2 py-2.5 text-sm transition-colors ${
        on ? "border-neutral-100 font-medium text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-200"
      }`}
    >
      {label}
      {typeof count === "number" && <span className="ml-1.5 text-xs text-neutral-500">{count}</span>}
    </Link>
  );
  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="font-heading text-2xl">내 포트폴리오</h1>
        <div className="ml-auto flex items-center gap-4">
          {actions}
          <NewPortfolioButton className="btn-primary inline-flex items-center gap-1.5">
            <Plus size={16} strokeWidth={2.25} />새 포트폴리오
          </NewPortfolioButton>
        </div>
      </div>
      <nav className="mt-5 flex gap-6 border-b border-neutral-800">
        {tab("/library/portfolios", "포트폴리오", !onSubs, portfolioCount)}
        {tab("/submissions", "제출 기록", onSubs, submissionCount)}
      </nav>
    </div>
  );
}
