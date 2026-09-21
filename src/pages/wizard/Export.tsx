import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import {
  getPortfolioWithProjects,
  getCoverImageUrl,
  PortfolioError,
  type PortfolioProjectRow,
  type PortfolioRow,
} from "../../lib/portfolios";
import { templateName } from "../../lib/templates";
import { FONT_STACKS, DEFAULT_FONT } from "../../lib/portfolioTheme";
import { exportNodeToPdf } from "../../lib/exportPdf";
import PortfolioRenderer from "../../components/portfolio-templates/PortfolioRenderer";

/**
 * [2026-09] "적용 템플릿" 줄이 항상 "라이브에디터"로 고정돼 있던 걸 고친 게
 * 이 화면의 첫 개편이었습니다. 이번이 두 번째 개편입니다 — 그때는 텍스트로
 * "현재 편집 상태가 반영되는 것을 확인했습니다"라고 사용자가 믿어야 했는데,
 * 실제로 보여주는 건 없었습니다. 이제 아래 "미리보기"가 실제
 * PortfolioRenderer(4개 템플릿 중 실제 적용된 것)를 그대로 그리고, "PDF로
 * 내보내기"를 누르면 바로 그 DOM을 html2canvas로 캡처해 진짜 PDF 파일을
 * 만듭니다 — 미리보기와 실제 파일이 다르면 안 되니 같은 노드를 씁니다.
 *
 * 웹 형식(HTML/Notion 호환) 내보내기는 이번 범위가 아니라 여전히 버튼만
 * 비활성 상태로 남겨뒀습니다 — 안 되는 걸 되는 것처럼 보여주지 않으려고
 * 일부러 눌러도 반응 없게 두지 않고 disabled 처리했습니다.
 */
export default function Export() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const previewRef = useRef<HTMLDivElement>(null);

  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectRow[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lang, setLang] = useState<"한국어" | "영어">("한국어");
  const [format, setFormat] = useState<"pdf" | "web">("pdf");
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoadError("포트폴리오 id가 없습니다.");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getPortfolioWithProjects(id)
      .then(({ portfolio: p, projects: ps }) => {
        if (!alive) return;
        setPortfolio(p);
        setProjects(ps);
        if (p.cover_image_path) {
          getCoverImageUrl(p.cover_image_path)
            .then((url) => {
              if (alive) setCoverUrl(url);
            })
            .catch(() => {
              // 표지 URL을 못 가져와도 나머지 미리보기는 정상 동작해야 하므로
              // 조용히 넘어갑니다(템플릿 쪽이 coverUrl null을 알아서 처리).
            });
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const startExport = async () => {
    if (!portfolio) return;
    setConfirming(false);
    setExportError(null);

    if (format === "web") {
      // 웹 형식은 아직 실제 구현이 없습니다 — 버튼이 disabled 라 이 분기는
      // 정상 경로로는 도달하지 않지만, 방어적으로 남겨둡니다.
      setExporting(true);
      window.setTimeout(() => {
        setExporting(false);
        navigate("/library/portfolios");
      }, 1200);
      return;
    }

    setExporting(true);
    try {
      if (!previewRef.current) {
        throw new Error("미리보기를 찾을 수 없습니다.");
      }
      const filename = `${portfolio.title.trim() || "portfolio"}.pdf`;
      await exportNodeToPdf(previewRef.current, filename);
      navigate("/library/portfolios");
    } catch {
      setExportError("PDF를 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setExporting(false);
    }
  };

  const bodyFontStack = portfolio ? FONT_STACKS[portfolio.font] ?? FONT_STACKS[DEFAULT_FONT] : FONT_STACKS[DEFAULT_FONT];

  return (
    <div className="max-w-2xl space-y-6">
      <Link to={id ? `/wizard/style/${id}` : "/wizard"} className="text-xs text-brand hover:underline">
        템플릿·스타일 설정으로 돌아가기
      </Link>
      <h1 className="text-xl font-heading">내보내기</h1>

      {loading && (
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          불러오는 중입니다.
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-brand">
          {loadError}
        </p>
      )}

      {portfolio && (
        <>
          <div className="entry">
            <h2 className="entry-title">내보내기 언어 선택</h2>
            <p className="text-xs text-neutral-400 mb-3">
              포트폴리오의 어느 언어 버전을 내보낼지 선택하세요.
            </p>
            <div className="flex gap-2">
              {(["한국어", "영어"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-sm border px-4 py-2 text-sm ${
                    lang === l ? "border-brand bg-brand/10 text-brand" : "border-neutral-800 text-neutral-400"
                  }`}
                >
                  {l} 버전
                </button>
              ))}
            </div>
            {lang === "영어" && (
              <p className="text-xs text-neutral-600 mt-3">
                영어 번역은 아직 준비 중이에요 — 지금 내보내면 원문(한국어) 그대로
                나갑니다.
              </p>
            )}
          </div>

          <div className="entry">
            <h2 className="entry-title">내보내기 형식 선택</h2>
            <p className="text-xs text-neutral-400 mb-3">
              PDF 파일 또는 웹 형식 자료 중 원하는 형식을 선택하세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("pdf")}
                className={`rounded-sm border px-4 py-2 text-sm ${
                  format === "pdf" ? "border-brand bg-brand/10 text-brand" : "border-neutral-800 text-neutral-400"
                }`}
              >
                PDF 파일 (.pdf)
              </button>
              <button
                disabled
                title="웹 형식 내보내기는 아직 준비 중입니다."
                className="rounded-sm border px-4 py-2 text-sm border-neutral-800 text-neutral-600 cursor-not-allowed opacity-60"
              >
                웹 형식 (HTML · Notion 호환) · 준비 중
              </button>
            </div>
          </div>

          <div className="entry">
            <div className="flex items-center justify-between mb-3">
              <h2 className="entry-title mb-0">미리보기</h2>
              <span className="text-xs text-neutral-500">
                {templateName(portfolio.template_id)} 템플릿
              </span>
            </div>
            <p className="text-xs text-neutral-600 mb-3">
              PDF로 내보내면 아래 미리보기와 똑같은 내용이 파일로 저장됩니다.
            </p>
            <div className="rounded-xl border border-neutral-800 overflow-auto max-h-[520px]">
              <PortfolioRenderer
                ref={previewRef}
                portfolio={portfolio}
                projects={projects}
                coverUrl={coverUrl}
                bodyFontStack={bodyFontStack}
              />
            </div>
          </div>

          <p className="note border-neutral-700 text-xs text-neutral-500 space-y-1">
            <span className="block font-medium text-neutral-300 mb-1">내보내기 전 주의사항</span>
            <span className="block">· 외부 서비스(Notion, 개인 웹사이트)에 직접 게시되지 않으며, 자료를 복사해 사용할 수 있습니다.</span>
            <span className="block">· 내보낸 파일의 변경 사항은 자동으로 동기화되지 않습니다.</span>
            <span className="block">· AI가 생성한 내용의 사실 여부는 직접 확인 후 제출하시기 바랍니다.</span>
          </p>

          {exportError && (
            <p role="alert" className="text-xs text-brand">
              {exportError}
            </p>
          )}

          <button className="btn-primary" onClick={() => setConfirming(true)}>
            PDF로 내보내기
          </button>
        </>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">PDF 내보내기 확인</h2>
            <p className="text-xs text-neutral-400 mb-3">
              위 미리보기 그대로 PDF 파일을 생성합니다.
            </p>
            <p className="text-sm text-neutral-200">언어: {lang}</p>
            <p className="text-sm text-neutral-200">형식: PDF (.pdf)</p>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirming(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => void startExport()}>
                PDF 내보내기 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm text-center">
            <p className="font-medium text-neutral-100">내보내기 진행 중</p>
            <p className="text-xs text-neutral-400 mt-1">
              포트폴리오를 PDF로 만들고 있습니다. 잠시 기다려 주세요.
            </p>
            <p className="text-xs text-neutral-500 mt-3">처리 중…</p>
          </div>
        </div>
      )}
    </div>
  );
}
