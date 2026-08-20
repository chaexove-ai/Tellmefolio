import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { demoSource, demoViews } from "../landingContent";

/**
 * "같은 경험, 다른 직무 언어" 를 나란히 보여주는 데모.
 *
 * 이 서비스의 차별점은 문장으로 설명하면 전달되지 않습니다.
 * 원본 메모 하나가 직무별로 어떻게 다르게 쓰이는지 직접 눈으로 비교하게 합니다.
 *
 * 접근성: 탭 위젯 표준(role=tablist/tab/tabpanel)을 따르고,
 * 좌우 방향키로 탭 간 이동이 됩니다.
 */
export default function BeforeAfterDemo() {
  const [active, setActive] = useState(0);
  const view = demoViews[active];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (active + 1) % demoViews.length
        : (active - 1 + demoViews.length) % demoViews.length;
    setActive(next);
    document.getElementById(`persp-tab-${demoViews[next].key}`)?.focus();
  };

  return (
    <div className="space-y-4">
      {/* 원본 자료 */}
      <div className="entry">
        <div className="flex items-center gap-2 mb-3">
          <span className="badge bg-neutral-800 text-neutral-300">{demoSource.label}</span>
          <span className="text-xs text-neutral-500">예시</span>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">“{demoSource.text}”</p>
      </div>

      <div className="flex justify-center" aria-hidden="true">
        <ArrowDown size={18} strokeWidth={2} className="text-brand" />
      </div>

      {/* 직무 관점 선택 */}
      <div
        role="tablist"
        aria-label="직무 관점 선택"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {demoViews.map((v, i) => (
          <button
            key={v.key}
            id={`persp-tab-${v.key}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`persp-panel-${v.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={
              i === active
                ? "rounded-xl px-3.5 py-2 text-sm font-medium bg-brand/10 text-brand transition-colors"
                : "rounded-xl px-3.5 py-2 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition-colors"
            }
          >
            {/* [2026-08-20] 탭에도 같은 아이콘을 붙여, 몰입 구간(데스크톱)과
                탭 위젯(모바일·모션 감소)에서 같은 기호를 보게 합니다. */}
            <span className="inline-flex items-center gap-1.5">
              <v.icon size={14} strokeWidth={1.5} aria-hidden="true" />
              {v.job}
            </span>
          </button>
        ))}
      </div>

      {/* 재구성 결과 */}
      <div
        id={`persp-panel-${view.key}`}
        role="tabpanel"
        aria-labelledby={`persp-tab-${view.key}`}
        tabIndex={0}
        className="entry"
      >
        <p className="text-xs text-brand mb-3">{view.lens}</p>
        <h3 className="entry-title">{view.title}</h3>
        <p className="text-sm text-neutral-400 leading-relaxed mb-4">{view.summary}</p>
        <ul className="space-y-2">
          {view.bullets.map((b) => (
            <li key={b} className="text-sm text-neutral-400 leading-relaxed flex gap-2.5">
              <span className="text-brand shrink-0" aria-hidden="true">
                —
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
