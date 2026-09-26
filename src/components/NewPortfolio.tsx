import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { MessagesSquare, Paperclip, Repeat, X } from "lucide-react";

/**
 * "새 포트폴리오" 선택 창 (09-26).
 *
 * 전에는 만들기 입구가 9곳이 넘었고 같은 위저드를 다섯 가지 이름(생성·자료로
 * 만들기·저장소로 시작하기·새 포트폴리오 만들기·포트폴리오 만들기)으로
 * 불렀습니다. 이제 모든 "만들기" 버튼이 이 창 하나를 엽니다. 이름은 둘뿐:
 *   대화로 만들기  → /chat/new
 *   자료로 만들기  → /wizard/source
 * 설계 예시: docs/mockups/navigation.html
 */

const Ctx = createContext<() => void>(() => {});

/** 어디서든 선택 창을 여는 함수 */
export function useNewPortfolio() {
  return useContext(Ctx);
}

export function NewPortfolioProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);
  return (
    <Ctx.Provider value={openDialog}>
      {children}
      {open && <NewPortfolioDialog onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

/** 사이드바·목록 머리 등에 쓰는 기본 버튼 */
export function NewPortfolioButton({ className = "btn-primary", children }: { className?: string; children?: ReactNode }) {
  const open = useNewPortfolio();
  return (
    <button type="button" className={className} onClick={open}>
      {children ?? "＋ 새 포트폴리오"}
    </button>
  );
}

function NewPortfolioDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-portfolio-title"
        className="w-full max-w-[640px] rounded-3xl bg-neutral-950 p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-portfolio-title" className="font-heading text-2xl text-neutral-100">
              새 포트폴리오
            </h2>
            <p className="mt-1.5 text-sm text-neutral-400">
              어떻게 시작할까요? 어느 쪽이든 나중에 편집기에서 똑같이 고칠 수 있어요.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 text-neutral-500 hover:text-neutral-100">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3.5">
          <Choice
            ref={firstRef}
            icon={MessagesSquare}
            title="대화로 만들기"
            badge="자료가 없어도 OK"
            desc="질문에 답하면 맥락·문제·실행·성과를 대신 정리해요. 답한 내용만 씁니다."
            meta="약 5분 · 질문 최대 12개"
            onClick={() => go("/chat/new")}
          />
          <Choice
            icon={Paperclip}
            title="자료로 만들기"
            desc="깃허브 저장소, 웹 링크, 메모를 넣으면 AI가 초안을 한 번에 써요."
            meta="약 1분 · 자료가 있을 때"
            onClick={() => go("/wizard/source")}
          />
        </div>

        <button
          type="button"
          onClick={() => go("/job-switch")}
          className="mt-5 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand"
        >
          <Repeat size={13} strokeWidth={1.75} />
          이미 만든 포트폴리오를 공고에 맞추려면 → 직무 전환
        </button>
      </div>
    </div>
  );
}

const Choice = forwardRef<
  HTMLButtonElement,
  { icon: typeof Repeat; title: string; badge?: string; desc: string; meta: string; onClick: () => void }
>(function Choice({ icon: Icon, title, badge, desc, meta, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-left transition-colors hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon size={19} strokeWidth={1.75} />
      </span>
      <span className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-neutral-100">{title}</span>
        {badge && (
          <span className="rounded-full border border-brand/25 bg-neutral-950 px-2 py-0.5 text-[11px] font-medium text-brand">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-neutral-400 break-keep">{desc}</span>
      <span className="mt-3 text-xs text-neutral-600">{meta}</span>
    </button>
  );
});
