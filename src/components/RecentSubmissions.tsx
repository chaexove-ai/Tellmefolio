import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Send } from "lucide-react";
import { listSubmissions, type Submission } from "../lib/submissions";

/**
 * 홈의 "최근 제출". 제출 기록(docs/submission-history-design.md)의 최근 3건.
 * 없으면 무엇을 하면 여기 쌓이는지 한 줄로만 알립니다.
 */
export default function RecentSubmissions() {
  const [items, setItems] = useState<Submission[] | null>(null);

  useEffect(() => {
    listSubmissions(null, 3).then(setItems).catch(() => setItems([]));
  }, []);

  if (items === null) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-heading text-neutral-200">최근 제출</h2>
        {items.length > 0 && (
          <Link to="/submissions" className="text-sm text-brand hover:underline">
            전체 제출 기록
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="entry text-sm text-neutral-500 inline-flex items-center gap-2 w-full">
          <Send size={15} strokeWidth={1.75} className="text-brand shrink-0" />
          내보낼 때 회사·포지션을 적으면, 어디에 무엇을 냈는지 여기 쌓여요.
        </p>
      ) : (
        <ul className="entry p-0 divide-y divide-neutral-800">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                to={s.portfolio_id ? `/library/portfolios/${s.portfolio_id}/versions?sub=${s.id}` : `/submissions?sub=${s.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-900 transition-colors group first:rounded-t-2xl last:rounded-b-2xl"
              >
                <span className="text-xs text-neutral-500 tabular-nums w-20 shrink-0">
                  {s.submitted_on.slice(0, 10).replace(/-/g, ".")}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">
                  <span className="text-neutral-100 font-medium">{s.company || "회사 미입력"}</span>
                  {s.position && <span className="text-neutral-400"> · {s.position}</span>}
                  <span className="text-neutral-600"> — {s.portfolio_title}</span>
                </span>
                <ArrowRight size={15} strokeWidth={1.5} className="text-neutral-600 group-hover:text-brand shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
