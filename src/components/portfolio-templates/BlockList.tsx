import type { BlockMap } from "../../lib/blocks";
import { blockHasContent } from "../../lib/blocks";

/**
 * 프로젝트에 붙은 자유 블록들. 템플릿 4종이 공유합니다.
 *
 * [왜 한 컴포넌트인가]
 * ProjectImages 와 같은 이유입니다 — 네 벌로 두면 한 벌만 고치게 됩니다.
 * 템플릿마다 다른 것은 색과 글자 크기 정도라 props 로 넘깁니다.
 *
 * [왜 5필드 뒤인가]
 * 블록은 5필드를 대체하지 않고 더합니다(docs/editor-freedom.md 3.2).
 * AI 초안과 직무 전환이 계속 5필드에 쓰기 때문에, 그 내용이 먼저 오고
 * 사용자가 직접 쌓은 것이 뒤에 옵니다.
 */
export default function BlockList({
  projectId,
  blocks,
  textColor,
  labelColor,
  borderColor,
  className = "",
  labelClassName = "text-[11px] tracking-[0.15em] uppercase mb-1.5",
  bodyClassName = "text-[14px] leading-[1.8] whitespace-pre-wrap",
  dividerStyle = "rule",
}: {
  projectId: string;
  blocks: BlockMap;
  textColor: string;
  labelColor: string;
  borderColor: string;
  className?: string;
  labelClassName?: string;
  bodyClassName?: string;
  /** 라이브에디터는 코드 에디터 흉내가 정체성이라 가로줄 대신 주석 줄을
   *  씁니다. 같은 구분선이라도 그 템플릿의 문법을 따르는 편이 자연스럽습니다. */
  dividerStyle?: "rule" | "comment";
}) {
  const list = (blocks[projectId] ?? []).filter(blockHasContent);
  if (list.length === 0) return null;

  return (
    <div className={className}>
      {list.map((b) => {
        if (b.content.kind === "divider") {
          if (dividerStyle === "comment") {
            return (
              <p key={b.id} className="text-[14px] my-4" style={{ color: labelColor }}>
                {"// ──────────────────────────────"}
              </p>
            );
          }
          // [2026-09-23] borderColor 로 그렸더니 라이브에디터(다크)에서
          // 거의 안 보였습니다 — 테두리색 #262626 을 배경 #1a1a1a 위에
          // 얹는 꼴이라 대비가 없습니다. 테두리색은 "면을 나누는 선"이고
          // 구분선은 "읽는 사람이 봐야 하는 선"이라 역할이 다릅니다.
          // 글자색(textFaint)을 옅게 쓰면 두 테마 모두에서 보입니다.
          return (
            <hr
              key={b.id}
              className="my-6 border-0 border-t"
              style={{ borderColor: labelColor, opacity: 0.45 }}
            />
          );
        }

        const { label, text, style } = b.content;
        // heading 은 제목처럼 크게, small 은 주석처럼 작게. 본문은 템플릿이
        // 넘겨준 기본 크기 그대로 — 템플릿마다 본문 크기가 달라서
        // 여기서 px 를 박으면 그 템플릿의 리듬이 깨집니다.
        const textClass =
          style === "heading"
            ? "text-[18px] font-medium leading-[1.6] whitespace-pre-wrap"
            : style === "small"
              ? "text-[12px] leading-[1.7] whitespace-pre-wrap"
              : bodyClassName;

        return (
          <div key={b.id}>
            {label.trim() && (
              <p className={labelClassName} style={{ color: labelColor }}>
                {label}
              </p>
            )}
            {text.trim() && (
              <p
                className={textClass}
                style={{ color: style === "small" ? labelColor : textColor }}
              >
                {text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
