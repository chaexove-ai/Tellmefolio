import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import LibraryTabs from "../components/LibraryTabs";
import { Copy, Download, FileText, Globe2, LoaderCircle, Printer, Send, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteSubmission,
  downloadSubmissionHtml,
  duplicateFromSubmission,
  listSubmissions,
  SubmissionError,
  type Submission,
} from "../lib/submissions";

/**
 * 제출 기록. 설계는 docs/submission-history-design.md.
 *
 * [2026-09-25] 목업이던 "버전 관리"를 대체합니다. 그 화면은 "버전 3"처럼
 * 이름에 의미가 없는 목록과, 누르면 아무 일도 없는 "복원" 버튼이었습니다.
 * 이제 목록 한 줄이 "카카오 · 프로덕트 디자이너 · 9/25"이고, 누르면 그때
 * 낸 결과물이 그대로 보입니다.
 *
 * 주소
 *   /library/portfolios/:id/versions   그 포트폴리오로 낸 것만
 *   /submissions                       전부 (포트폴리오를 지운 기록도 여기서 봅니다)
 *   ?sub=…                             그 기록을 골라서 엽니다
 */

const FORMAT_LABEL: Record<Submission["format"], string> = { pdf: "PDF", html: "HTML", link: "링크" };
const FORMAT_ICON = { pdf: FileText, html: FileText, link: Globe2 } as const;

function formatDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${y}.${m}.${day}`;
}

export default function SubmissionHistory() {
  const { id: portfolioId } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [items, setItems] = useState<Submission[] | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "dup" | "del">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedId = params.get("sub");
  const selected = useMemo(
    () => items?.find((s) => s.id === selectedId) ?? items?.[0] ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    listSubmissions(portfolioId ?? null)
      .then(setItems)
      .catch(() => setItems([]));
  }, [portfolioId]);

  useEffect(() => {
    setHtml(null);
    setConfirmDelete(false);
    setError(null);
    if (!selected?.html_path) return;
    let alive = true;
    setLoadingHtml(true);
    downloadSubmissionHtml(selected)
      .then((h) => alive && setHtml(h))
      .catch((e) => alive && setError(e instanceof SubmissionError ? e.message : "결과물을 불러오지 못했습니다."))
      .finally(() => alive && setLoadingHtml(false));
    return () => {
      alive = false;
    };
  }, [selected]);

  const select = (id: string) => setParams({ sub: id }, { replace: true });

  const fileName = (s: Submission) =>
    [s.portfolio_title, s.company, s.position].filter(Boolean).join("_").replace(/[\\/:*?"<>|]/g, "") || "portfolio";

  const saveHtml = () => {
    if (!html || !selected) return;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName(selected)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Export.tsx 의 printPdf 와 같은 방식 — 숨은 iframe 에 넣고 브라우저 인쇄 */
  const printPdf = () => {
    if (!html) return;
    const frame = document.createElement("iframe");
    frame.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;");
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return frame.remove();
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60000);
    }, 800);
  };

  const duplicate = async () => {
    if (!selected || !session?.user?.id) return;
    setBusy("dup");
    setError(null);
    try {
      const newId = await duplicateFromSubmission(selected, session.user.id);
      navigate(`/wizard/editor/${newId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "새 포트폴리오를 만들지 못했습니다.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setBusy("del");
    setError(null);
    try {
      await deleteSubmission(selected);
      setItems((prev) => (prev ?? []).filter((s) => s.id !== selected.id));
      setParams({}, { replace: true });
    } catch (e) {
      setError(e instanceof SubmissionError ? e.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  const heading = portfolioId ? items?.[0]?.portfolio_title : null;

  return (
    <div className="space-y-6">
      {portfolioId ? (
        <div className="flex items-end justify-between gap-4">
          <div>
            <Link to="/library/portfolios" className="text-xs text-brand hover:underline">
              ← 내 포트폴리오
            </Link>
            <h1 className="text-xl font-heading mt-2">
              제출 기록{" "}
              {items && items.length > 0 && <span className="text-sm text-neutral-500 font-sans">{items.length}건</span>}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">{heading ?? "이 포트폴리오"}로 낸 곳</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/submissions" className="text-xs text-brand hover:underline">
              전체 제출 기록
            </Link>
            <Link to={`/wizard/export/${portfolioId}`} className="btn-secondary py-2">
              <Send size={15} strokeWidth={1.75} /> 내보내며 기록하기
            </Link>
          </div>
        </div>
      ) : (
        // [09-26] 전체 제출 기록은 "내 포트폴리오"의 두 번째 탭입니다.
        <LibraryTabs submissionCount={items?.length} />
      )}

      {items === null ? (
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" /> 불러오는 중…
        </p>
      ) : items.length === 0 ? (
        <div className="entry text-center py-14">
          <Send size={28} strokeWidth={1.5} className="text-brand mx-auto" />
          <p className="mt-4 font-heading text-lg text-neutral-100">아직 제출 기록이 없어요</p>
          <p className="mt-1.5 text-sm text-neutral-500 break-keep">
            내보내기 화면에서 회사·포지션을 적으면, 그때 낸 결과물이 여기 그대로 남아요.
          </p>
          {portfolioId && (
            <Link to={`/wizard/export/${portfolioId}`} className="btn-primary mt-6 inline-flex">
              내보내기로 가기
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)] items-start">
          {/* ── 목록 ─────────────────────────────────────── */}
          <ul className="entry p-2 space-y-1 xl:sticky xl:top-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
            {items.map((s) => {
              const on = selected?.id === s.id;
              const Icon = FORMAT_ICON[s.format];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => select(s.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 transition-colors ${
                      on ? "bg-brand/10" : "hover:bg-neutral-900"
                    }`}
                  >
                    <p className={`text-sm font-medium truncate ${on ? "text-brand" : "text-neutral-100"}`}>
                      {s.company || "회사 미입력"}
                      {s.position && <span className="font-normal text-neutral-400"> · {s.position}</span>}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <span className="tabular-nums">{formatDate(s.submitted_on)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon size={12} strokeWidth={1.75} />
                        {FORMAT_LABEL[s.format]}
                        {s.lang === "en" && " · EN"}
                      </span>
                      {!portfolioId && <span className="truncate">· {s.portfolio_title}</span>}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* ── 선택한 기록 ───────────────────────────────── */}
          {selected && (
            <section className="entry p-0 overflow-hidden">
              <header className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-neutral-800">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg text-neutral-100 truncate">
                    {selected.company || "회사 미입력"}
                    {selected.position && <span className="text-neutral-400"> · {selected.position}</span>}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {formatDate(selected.submitted_on)} 제출 · {FORMAT_LABEL[selected.format]}
                    {selected.lang === "en" ? " · 영어" : ""} ·{" "}
                    {selected.portfolio_id ? (
                      <Link to={`/wizard/editor/${selected.portfolio_id}`} className="text-brand hover:underline">
                        {selected.portfolio_title}
                      </Link>
                    ) : (
                      <span>{selected.portfolio_title} (삭제됨)</span>
                    )}
                    {selected.jd_url && (
                      <>
                        {" · "}
                        <a href={selected.jd_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          공고
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.format !== "link" && (
                    <>
                      <button type="button" className="btn-secondary py-2 disabled:opacity-40" disabled={!html} onClick={printPdf}>
                        <Printer size={15} strokeWidth={1.75} /> PDF
                      </button>
                      <button type="button" className="btn-secondary py-2 disabled:opacity-40" disabled={!html} onClick={saveHtml}>
                        <Download size={15} strokeWidth={1.75} /> HTML
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-secondary py-2 disabled:opacity-40" disabled={busy !== null} onClick={() => void duplicate()}>
                    <Copy size={15} strokeWidth={1.75} /> {busy === "dup" ? "만드는 중…" : "이 버전으로 새로 만들기"}
                  </button>
                  {confirmDelete ? (
                    <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
                      지울까요?
                      <button type="button" className="text-brand hover:underline" onClick={() => void remove()}>
                        지우기
                      </button>
                      <button type="button" className="hover:underline" onClick={() => setConfirmDelete(false)}>
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="p-2 text-neutral-500 hover:text-neutral-200"
                      onClick={() => setConfirmDelete(true)}
                      aria-label="이 기록 지우기"
                      title="이 기록 지우기"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </header>

              {error && (
                <p role="alert" className="px-6 pt-3 text-sm text-brand">
                  {error}
                </p>
              )}

              {selected.format === "link" ? (
                <div className="px-6 py-16 text-center">
                  <Globe2 size={26} strokeWidth={1.5} className="text-neutral-500 mx-auto" />
                  <p className="mt-3 text-sm text-neutral-400">링크로 보낸 기록이라 저장된 파일이 없어요.</p>
                  {selected.portfolio_id && (
                    <Link to={`/p/${selected.portfolio_id}`} className="text-sm text-brand hover:underline mt-2 inline-block">
                      공개 링크 열기
                    </Link>
                  )}
                </div>
              ) : loadingHtml ? (
                <p className="px-6 py-16 text-sm text-neutral-500 inline-flex items-center gap-2">
                  <LoaderCircle size={14} className="animate-spin" /> 그때 낸 결과물을 불러오는 중…
                </p>
              ) : html ? (
                <SnapshotFrame html={html} />
              ) : null}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 그때 결과물을 읽기 전용으로. 템플릿이 1280px 기준이라 그 폭으로 그리고
 * 패널 폭에 맞춰 줄입니다(TemplateFrame 과 같은 방식). sandbox 로 스크립트는
 * 막습니다 — 템플릿에는 원래 스크립트가 없습니다.
 */
function SnapshotFrame({ html }: { html: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const BASE = 1280;
  const HEIGHT = 900;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / BASE)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="bg-neutral-900/40" style={{ height: HEIGHT * scale }}>
      <iframe
        title="제출한 결과물"
        sandbox="allow-same-origin"
        srcDoc={html}
        style={{ width: BASE, height: HEIGHT, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
    </div>
  );
}
