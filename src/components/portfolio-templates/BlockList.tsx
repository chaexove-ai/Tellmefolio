import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Type, X } from "lucide-react";
import type { BlockMap, BlockContent, BlockEditorApi } from "../../lib/blocks";
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
 *
 * [2026-09-23] editor 가 있으면 그 자리에서 고칩니다.
 * 전체화면 미리보기에서만 넘깁니다 — 내보내기·공개 링크·작은 미리보기는
 * editor 없이 읽기 전용으로 그립니다.
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
  editor,
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
  editor?: BlockEditorApi;
}) {
  const all = blocks[projectId] ?? [];
  // 편집 중에는 빈 블록도 보여야 합니다 — 방금 추가한 빈 칸이 사라지면
  // 무엇을 추가했는지 알 수 없습니다.
  const list = editor ? all : all.filter(blockHasContent);

  if (list.length === 0 && !editor) return null;

  return (
    <div className={className}>
      {editor && <AddHere editor={editor} projectId={projectId} at={0} color={labelColor} />}

      {list.map((b, i) => {
        const body =
          b.content.kind === "divider" ? (
            dividerStyle === "comment" ? (
              <p className="text-[14px] my-4" style={{ color: labelColor }}>
                {"// ──────────────────────────────"}
              </p>
            ) : (
              // [2026-09-23] borderColor 로 그렸더니 라이브에디터(다크)에서
              // 거의 안 보였습니다 — 테두리색 #262626 을 배경 #1a1a1a 위에
              // 얹는 꼴이라 대비가 없습니다. 테두리색은 "면을 나누는 선"이고
              // 구분선은 "읽는 사람이 봐야 하는 선"이라 역할이 다릅니다.
              <hr
                className="my-6 border-0 border-t"
                style={{ borderColor: labelColor, opacity: 0.45 }}
              />
            )
          ) : (
            <TextBlockView
              key={`t-${b.id}`}
              content={b.content}
              textColor={textColor}
              labelColor={labelColor}
              labelClassName={labelClassName}
              bodyClassName={bodyClassName}
              editable={Boolean(editor)}
              onCommit={(next) => editor?.update(projectId, b.id, next)}
            />
          );

        if (!editor) return <div key={b.id}>{body}</div>;

        return (
          <div key={b.id}>
            <div className="group relative">
              <div
                className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5
                  opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                style={{ background: borderColor }}
              >
                {b.content.kind === "text" && (
                  <select
                    value={b.content.style}
                    onChange={(e) =>
                      editor.update(projectId, b.id, {
                        ...(b.content as Extract<BlockContent, { kind: "text" }>),
                        style: e.target.value as "heading" | "body" | "small",
                      })
                    }
                    className="bg-transparent text-[11px] outline-none cursor-pointer"
                    style={{ color: textColor }}
                    aria-label="글 크기"
                  >
                    <option value="heading">제목</option>
                    <option value="body">본문</option>
                    <option value="small">작게</option>
                  </select>
                )}
                <IconBtn label="위로" onClick={() => editor.move(projectId, i, -1)} disabled={i === 0} color={textColor}>
                  <ArrowUp size={12} />
                </IconBtn>
                <IconBtn
                  label="아래로"
                  onClick={() => editor.move(projectId, i, 1)}
                  disabled={i === list.length - 1}
                  color={textColor}
                >
                  <ArrowDown size={12} />
                </IconBtn>
                <IconBtn label="삭제" onClick={() => editor.remove(projectId, b.id)} color={textColor}>
                  <X size={12} />
                </IconBtn>
              </div>
              {body}
            </div>
            <AddHere editor={editor} projectId={projectId} at={i + 1} color={labelColor} />
          </div>
        );
      })}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  color,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-0.5 disabled:opacity-25 hover:opacity-60"
      style={{ color }}
    >
      {children}
    </button>
  );
}

/**
 * 블록 사이의 얇은 띠. 평소엔 거의 안 보이다가 커서를 올리면 열립니다.
 * 항상 보이는 "+ 추가" 버튼을 블록마다 두면 읽는 화면이 버튼밭이 됩니다.
 */
function AddHere({
  editor,
  projectId,
  at,
  color,
}: {
  editor: BlockEditorApi;
  projectId: string;
  at: number;
  color: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative h-4 -my-2 flex items-center justify-center opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onMouseLeave={() => setOpen(false)}
    >
      <span className="absolute inset-x-0 top-1/2 border-t" style={{ borderColor: color, opacity: 0.3 }} />
      {open ? (
        <span className="relative z-10 flex items-center gap-1">
          <PillBtn onClick={() => { editor.add(projectId, "text", at); setOpen(false); }} color={color}>
            <Type size={11} />글
          </PillBtn>
          <PillBtn onClick={() => { editor.add(projectId, "divider", at); setOpen(false); }} color={color}>
            <Minus size={11} />구분선
          </PillBtn>
        </span>
      ) : (
        <button
          type="button"
          aria-label="여기에 추가"
          onClick={() => setOpen(true)}
          className="relative z-10 rounded-full border p-0.5"
          style={{ borderColor: color, color, background: "transparent" }}
        >
          <Plus size={11} />
        </button>
      )}
    </div>
  );
}

function PillBtn({
  onClick,
  color,
  children,
}: {
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:opacity-70"
      style={{ borderColor: color, color }}
    >
      {children}
    </button>
  );
}

function TextBlockView({
  content,
  textColor,
  labelColor,
  labelClassName,
  bodyClassName,
  editable,
  onCommit,
}: {
  content: Extract<BlockContent, { kind: "text" }> | BlockContent;
  textColor: string;
  labelColor: string;
  labelClassName: string;
  bodyClassName: string;
  editable: boolean;
  onCommit: (next: BlockContent) => void;
}) {
  if (content.kind !== "text") return null;
  const { label, text, style } = content;

  // heading 은 제목처럼 크게, small 은 주석처럼 작게. 본문은 템플릿이
  // 넘겨준 기본 크기 그대로 — 템플릿마다 본문 크기가 달라서 여기서 px 를
  // 박으면 그 템플릿의 리듬이 깨집니다.
  const textClass =
    style === "heading"
      ? "text-[18px] font-medium leading-[1.6] whitespace-pre-wrap"
      : style === "small"
        ? "text-[12px] leading-[1.7] whitespace-pre-wrap"
        : bodyClassName;

  if (!editable) {
    return (
      <div>
        {label.trim() && (
          <p className={labelClassName} style={{ color: labelColor }}>
            {label}
          </p>
        )}
        {text.trim() && (
          <p className={textClass} style={{ color: style === "small" ? labelColor : textColor }}>
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Editable
        value={label}
        onCommit={(v) => onCommit({ ...content, label: v })}
        placeholder="제목 (선택)"
        className={labelClassName}
        style={{ color: labelColor }}
      />
      <Editable
        value={text}
        onCommit={(v) => onCommit({ ...content, text: v })}
        placeholder="내용을 쓰세요"
        className={textClass}
        style={{ color: style === "small" ? labelColor : textColor }}
      />
    </div>
  );
}

/**
 * 그 자리에서 고치는 한 줄/여러 줄 텍스트.
 *
 * [왜 제어 컴포넌트가 아닌가]
 * contentEditable 에 매 키 입력마다 React 가 값을 다시 넣으면 커서가 맨
 * 앞으로 튑니다. 한글은 조합 중이라 더 심하게 깨집니다. 그래서 값은
 * 처음 한 번만 심고, 타이핑 중에는 DOM 이 주인입니다. 저장은 포커스가
 * 빠질 때 한 번.
 */
function Editable({
  value,
  onCommit,
  placeholder,
  className,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  className: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 바깥에서 값이 바뀐 경우(되돌리기 등)만 따라갑니다. 타이핑 중에는
    // document.activeElement 가 이 칸이라 건드리지 않습니다.
    if (document.activeElement !== el && el.innerText !== value) {
      el.innerText = value;
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      className={`block-editable ${className}`}
      style={{ ...style, outline: "none" }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onBlur={(e) => {
        const next = e.currentTarget.innerText.replace(/ /g, " ");
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => {
        // Esc 로 편집을 빠져나갑니다. 한글 조합 중에는 무시 — 조합 취소와
        // 겹치면 글자가 반쯤 지워집니다.
        if (e.key === "Escape" && !composing.current) {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
