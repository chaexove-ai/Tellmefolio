import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { deletePortfolios } from "../lib/account";

/**
 * [2026-09-28] 포트폴리오 삭제 — 이름을 똑같이 입력해야 지워집니다(Vercel 방식).
 *
 * 지운 뒤에는 되돌릴 방법이 없습니다. 확인 버튼 하나로는 "다른 카드를
 * 누른 줄 모르고" 지우는 일을 막지 못해서, 지울 것의 이름을 직접 치게
 * 합니다. 이름이 곧 "무엇을 지우는지 읽었다"는 확인입니다.
 *
 * 실제 삭제는 lib/account deletePortfolios 를 씁니다 — 표지·프로젝트
 * 이미지 파일까지 챙겨 지우는 코드가 이미 거기 있습니다(데이터 관리 화면과
 * 같은 경로).
 *
 * DB 에서 함께 사라지는 것(on delete cascade): 프로젝트, 블록, 조회·북마크
 * 기록, 이 포트폴리오로 한 직무 전환 결과. 남는 것(set null): 제출 기록 —
 * 제출할 때 찍어 둔 사본이 있어서 어디에 냈는지는 계속 보입니다.
 */
export default function DeletePortfolioDialog({
  portfolio,
  onClose,
  onDeleted,
}: {
  portfolio: { id: string; title: string; visibility?: "공개" | "비공개"; listed?: boolean };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const name = portfolio.title.trim() || "제목 없음";
  const matches = typed.trim() === name;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const run = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deletePortfolios([portfolio.id]);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-portfolio-title"
        className="surface w-full max-w-md p-0 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 id="delete-portfolio-title" className="entry-title mb-1">
              포트폴리오 삭제
            </h2>
            <p className="text-sm text-neutral-400 break-keep">
              <span className="text-neutral-100">“{name}”</span>을(를) 영구 삭제합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mx-6 flex gap-2.5 rounded-xl border border-red-500/30 bg-red-500/5 p-3.5 text-xs text-neutral-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <div className="space-y-1.5 break-keep">
            <p className="font-medium text-neutral-100">되돌릴 수 없어요. 함께 지워지는 것:</p>
            <ul className="space-y-0.5 text-neutral-400">
              <li>· 모든 프로젝트 내용과 이미지·표지</li>
              {portfolio.visibility === "공개" && <li>· 공개 링크 — 이미 보낸 링크도 더는 열리지 않아요</li>}
              {portfolio.listed && <li>· 커뮤니티 게시와 받은 북마크·조회 기록</li>}
              <li>· 이 포트폴리오로 만든 직무 전환 결과</li>
            </ul>
            <p className="text-neutral-500">제출 기록(어디에 언제 냈는지)은 남아요.</p>
          </div>
        </div>

        <form
          className="p-6 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label htmlFor="delete-confirm" className="block text-sm text-neutral-300 break-keep">
            확인을 위해{" "}
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-medium text-neutral-100 select-all">{name}</span>
            {" "}을(를) 입력하세요.
          </label>
          <input
            ref={inputRef}
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className={`field mt-2 ${typed && !matches ? "border-red-500/60" : ""}`}
            aria-invalid={Boolean(typed) && !matches}
          />

          {error && (
            <p role="alert" className="mt-3 text-xs text-red-500">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button
              type="submit"
              disabled={!matches || busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <LoaderCircle size={14} className="animate-spin" />}
              {busy ? "삭제 중…" : "영구 삭제"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
