import { ChevronDown } from "lucide-react";
import { faqs } from "../landingContent";

/**
 * FAQ. <details>/<summary> 를 그대로 써서 키보드·스크린리더 동작을
 * 브라우저에 맡깁니다(직접 만든 아코디언보다 안전하고 코드도 짧습니다).
 *
 * ⚠️ 답변 내용은 src/landingContent.ts 에 있습니다.
 *    데이터 정책·가격 항목은 TODO 표시를 지우고 실제 방침으로 교체해 주세요.
 */
export default function Faq() {
  return (
    <div className="divide-y divide-neutral-800 border-t border-b border-neutral-800">
      {faqs.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-4 text-sm text-neutral-100 marker:hidden">
            <span>{f.q}</span>
            <ChevronDown
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="shrink-0 text-neutral-400 transition-transform duration-150 group-open:rotate-180"
            />
          </summary>
          <p className="pb-4 text-sm text-neutral-400 leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
