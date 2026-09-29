import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, LoaderCircle, Paintbrush, X } from "lucide-react";
import Logo from "../../components/Logo";
import PortfolioThumb from "../../components/PortfolioThumb";
import TemplateFrame from "../../components/TemplateFrame";
import { NewPortfolioProvider, useNewPortfolio } from "../../components/NewPortfolio";
import { useAuth } from "../../auth/AuthProvider";
import {
  GALLERY,
  USE_LABEL,
  itemLabel,
  sampleFor,
  thumbFor,
  type GalleryItem,
  type GalleryUse,
} from "../../lib/templateGallery";
import { derivePalette } from "../../lib/themeRules";
import { setPendingDesign } from "../../lib/pendingDesign";
import {
  getCoverImageUrl,
  getPortfolioWithProjects,
  listMyPortfolios,
  listProjectImages,
  updatePortfolioStyle,
  updatePortfolioTheme,
  type LibraryPortfolio,
  type PortfolioProjectRow,
  type PortfolioRow,
  type ProjectImageMap,
} from "../../lib/portfolios";

/**
 * [2026-09-29] 템플릿 갤러리 — /templates (로그인 없이도 열림).
 *
 * 전에는 템플릿이 편집기 안에 이름 버튼으로만 있어서, 다 만들고 나서야
 * 모양을 알았습니다. 여기서는 디자인부터 고릅니다(v0 의 템플릿 페이지처럼).
 *
 *  · 카드 = 템플릿 × 분위기 조합의 실제 첫 화면(예시 데이터로 그림)
 *  · 누르면 미리보기 — 아래로 내려 프로젝트 영역까지 봄
 *    - 이 디자인으로 시작하기: 고른 디자인을 기억해 두고 새 포트폴리오 만들기로.
 *      만들어진 포트폴리오를 편집기가 처음 열 때 입힙니다(lib/pendingDesign).
 *    - 내 포트폴리오에 적용하기 / 내 내용으로 보기: 로그인한 사람만
 *  · 주소 ?use=&d= 로 필터와 열린 미리보기를 남깁니다(링크로 공유 가능)
 */
export default function TemplateGallery() {
  return (
    <NewPortfolioProvider>
      <GalleryPage />
    </NewPortfolioProvider>
  );
}

function GalleryPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const use = (params.get("use") as GalleryUse | null) ?? null;
  const openId = params.get("d");
  const open = GALLERY.find((g) => g.id === openId) ?? null;

  const items = useMemo(() => (use ? GALLERY.filter((g) => g.use === use) : GALLERY), [use]);
  const thumbs = useMemo(() => new Map(GALLERY.map((g) => [g.id, thumbFor(g)])), []);

  const setParam = (k: string, v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: k === "use" }
    );

  useEffect(() => {
    document.title = "템플릿 — Tellmefolio";
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/85 px-6 py-4 backdrop-blur-md lg:px-10">
        <Logo to={session ? "/library" : "/"} className="text-neutral-100" />
        {session ? (
          <Link to="/library" className="btn-secondary px-3.5 py-2 text-sm">
            내 서재로
          </Link>
        ) : (
          <Link to="/login" state={{ from: "/templates" }} className="btn-primary px-3.5 py-2 text-sm">
            시작하기
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-14 lg:px-10">
        <h1 className="font-heading text-[32px] leading-tight lg:text-[44px] break-keep">디자인부터 골라 보세요</h1>
        <p className="mt-3 max-w-2xl text-sm lg:text-base text-neutral-500 leading-relaxed break-keep">
          고른 디자인으로 바로 시작하거나, 이미 만든 포트폴리오에 입힐 수 있어요. 색·서체·문구는 나중에 얼마든지 바꿀 수 있어요.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2" aria-label="용도">
          {([null, "resume", "design", "dev"] as Array<GalleryUse | null>).map((u) => (
            <button
              key={u ?? "all"}
              type="button"
              onClick={() => setParam("use", u)}
              aria-pressed={use === u}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                use === u
                  ? "border-neutral-100 bg-neutral-100 text-neutral-950"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
              }`}
            >
              {u ? USE_LABEL[u] : "전체"}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-neutral-500">{items.length}가지</span>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setParam("d", g.id)}
              className="group text-left"
              aria-label={`${itemLabel(g)} 미리보기`}
            >
              <div className="overflow-hidden rounded-xl border border-neutral-800 transition-all group-hover:-translate-y-0.5 group-hover:border-neutral-600 group-hover:shadow-lg">
                <PortfolioThumb portfolio={thumbs.get(g.id)!} className="aspect-[16/10] w-full" />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100">{g.templateName}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {g.presetLabel ? `분위기 · ${g.presetLabel}` : "기본"} · {USE_LABEL[g.use]}
                  </p>
                </div>
                <Swatch item={g} />
              </div>
            </button>
          ))}
        </div>
      </main>

      {open && <Preview item={open} onClose={() => setParam("d", null)} />}
    </div>
  );
}

function Swatch({ item }: { item: GalleryItem }) {
  if (!item.theme.bg || !item.theme.accent) return null;
  const p = derivePalette(item.theme.bg, item.theme.accent);
  return (
    <span className="mt-0.5 flex shrink-0 overflow-hidden rounded-md border border-neutral-800" aria-hidden="true">
      <span className="block size-4" style={{ background: p.bg }} />
      <span className="block size-4" style={{ background: p.accent }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 미리보기                                                            */
/* ------------------------------------------------------------------ */

function Preview({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const navigate = useNavigate();
  const openNew = useNewPortfolio();

  const [mine, setMine] = useState<LibraryPortfolio[] | null>(null);
  const [withMine, setWithMine] = useState<string>(""); // 내 내용으로 볼 포트폴리오 id
  const [mineData, setMineData] = useState<{ portfolio: PortfolioRow; projects: PortfolioProjectRow[]; images: ProjectImageMap } | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!userId) return;
    listMyPortfolios(userId).then(setMine).catch(() => setMine([]));
  }, [userId]);

  // 내 내용으로 보기
  useEffect(() => {
    if (!withMine) {
      setMineData(null);
      return;
    }
    let alive = true;
    setLoadingMine(true);
    (async () => {
      const { portfolio, projects } = await getPortfolioWithProjects(withMine);
      const rows = await listProjectImages(projects.map((p) => p.id));
      const images: ProjectImageMap = {};
      for (const r of rows) {
        (images[r.project_id] ??= []).push({ id: r.id, url: await getCoverImageUrl(r.storage_path), caption: r.caption });
      }
      if (alive) setMineData({ portfolio, projects, images });
    })()
      .catch(() => alive && setWithMine(""))
      .finally(() => alive && setLoadingMine(false));
    return () => {
      alive = false;
    };
  }, [withMine]);

  const sample = sampleFor(item);
  const shown = mineData
    ? {
        portfolio: { ...mineData.portfolio, template_id: item.templateId, theme: item.theme },
        projects: mineData.projects,
        images: mineData.images,
      }
    : sample;

  const start = () => {
    setPendingDesign({ templateId: item.templateId, theme: item.theme, label: itemLabel(item) });
    if (!userId) {
      navigate("/login");
      return;
    }
    onClose();
    openNew();
  };

  return (
    <div className="fixed inset-0 z-40 flex bg-black/70 p-3 lg:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${itemLabel(item)} 미리보기`}
        className="surface mx-auto flex w-full max-w-[1500px] flex-col overflow-hidden p-0 lg:flex-row"
      >
        {/* 왼쪽: 실제 모습(안에서 스크롤) */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-900">
          {loadingMine && (
            <p className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-300">
              <LoaderCircle size={12} className="animate-spin" /> 내 내용을 불러오는 중…
            </p>
          )}
          <TemplateFrame
            portfolio={shown.portfolio}
            projects={shown.projects}
            images={shown.images}
            className="h-full"
            fillHeight
          />
        </div>

        {/* 오른쪽: 설명과 행동 */}
        <aside className="flex w-full shrink-0 flex-col gap-5 border-t border-neutral-800 p-6 lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl text-neutral-100">{item.templateName}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {item.presetLabel ? `분위기 · ${item.presetLabel}` : "기본 분위기"} · {USE_LABEL[item.use]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-neutral-400 break-keep">{item.desc}</p>

          <div className="space-y-2">
            <button type="button" onClick={start} className="btn-primary w-full">
              이 디자인으로 시작하기 <ArrowRight size={15} />
            </button>
            {userId && (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="btn-secondary w-full"
                disabled={mine !== null && mine.length === 0}
              >
                <Paintbrush size={15} /> 내 포트폴리오에 적용하기
              </button>
            )}
          </div>

          {userId && mine && mine.length > 0 && (
            <label className="block text-xs text-neutral-500">
              내 내용으로 보기
              <select
                value={withMine}
                onChange={(e) => setWithMine(e.target.value)}
                className="field mt-1.5 py-2 text-sm"
              >
                <option value="">예시 내용</option>
                {mine.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="mt-auto text-xs leading-relaxed text-neutral-500 break-keep">
            {mineData
              ? "내 포트폴리오 내용을 이 디자인으로 그린 모습이에요. 적용하기 전까지 바뀌는 건 없어요."
              : "예시 내용은 지어낸 사람의 지어낸 프로젝트예요. 시작하면 내 이야기로 채워져요."}
          </p>
        </aside>
      </div>

      {applyOpen && mine && (
        <ApplyDialog item={item} mine={mine} onClose={() => setApplyOpen(false)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 내 포트폴리오에 적용                                                */
/* ------------------------------------------------------------------ */

function ApplyDialog({ item, mine, onClose }: { item: GalleryItem; mine: LibraryPortfolio[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const apply = async (p: LibraryPortfolio) => {
    setBusy(p.id);
    setError(null);
    try {
      await updatePortfolioStyle(p.id, { template_id: item.templateId });
      // 분위기는 DB 에 칸이 생긴 뒤에만 저장됩니다(마이그레이션 전이면 템플릿만).
      await updatePortfolioTheme(p.id, item.theme).catch(() => undefined);
      setDone(p.id);
      window.setTimeout(() => navigate(`/wizard/editor/${p.id}`), 600);
    } catch {
      setError("적용하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="apply-title" className="surface w-full max-w-md">
        <h2 id="apply-title" className="entry-title mb-1">
          어느 포트폴리오에 적용할까요?
        </h2>
        <p className="mb-4 text-xs text-neutral-500 break-keep">
          “{itemLabel(item)}”을(를) 입혀요. 내용은 그대로이고, 편집기에서 언제든 되돌릴 수 있어요.
        </p>
        <ul className="max-h-80 space-y-1.5 overflow-y-auto">
          {mine.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => void apply(p)}
                disabled={busy !== null}
                className="flex w-full items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2.5 text-left transition-colors hover:border-neutral-600 disabled:opacity-60"
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.jobColor }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{p.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {done === p.id ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Check size={13} /> 적용됨
                    </span>
                  ) : busy === p.id ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    p.job
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy !== null}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
