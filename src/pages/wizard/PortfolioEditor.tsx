import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Info, LoaderCircle } from "lucide-react";
import {
  getPortfolioWithProjects,
  updatePortfolioProject,
  PortfolioError,
  type PortfolioProjectRow,
  type PortfolioRow,
} from "../../lib/portfolios";
import { formatRelativeTime } from "../../lib/formatRelativeTime";

interface EvidenceItem {
  id: string;
  label: string;
  source: string;
  status: "확인 완료" | "검토 필요";
}

const evidenceItems: EvidenceItem[] = [
  { id: "e1", label: "핵심 성과 수치", source: "GitHub 리포지토리 — README.md 3행", status: "확인 완료" },
  { id: "e2", label: "담당 역할 서술", source: "업로드 PDF — 경력기술서 2페이지", status: "검토 필요" },
  { id: "e3", label: "프로젝트 기간", source: "텍스트 메모 — 프로젝트 메모 1항", status: "검토 필요" },
];

const mismatchItems = [
  {
    id: "m1",
    label: "경력 기간 불일치 가능성",
    detail: "이력서: 2021.03 – 2023.08 / 포트폴리오: 2021.06 – 2023.08",
  },
  {
    id: "m2",
    label: "성과 수치 표현 차이",
    detail: "이력서: 전환율 12% 개선 / 포트폴리오: 전환율 15% 향상",
  },
];

/**
 * [2026-09] location.state.draft 대신 실제 DB(portfolios/portfolio_projects)에서
 * 읽고 씁니다. 이전에는 이 화면이 새로고침하면 통째로 비어버렸습니다 —
 * AI 초안이 location.state 에만 있었고 어디에도 저장되지 않았기 때문입니다.
 * 이제는 주소의 :id 로 포트폴리오를 찾아 불러오고, 프로젝트 탭을 바꾸거나
 * "수동 저장"을 누르면 그 시점의 7칸 내용이 portfolio_projects 행에 그대로
 * 저장됩니다.
 *
 * 담당 역할·문제 정의·배운 점은 여전히 AI 응답에 대응하는 필드가 없어
 * 빈 칸으로 시작합니다 — DB 컬럼 자체는 있으니(role/problem/reflection)
 * 한 번 채워서 저장하면 그다음부터는 그대로 남습니다.
 *
 * "AI 근거 및 사실 확인" / "이력서·포트폴리오 불일치 확인" 두 섹션은 이번에도
 * 건드리지 않았습니다 — 문장-출처 연결이나 이력서 대조 기능 자체가 아직
 * 없어서, 여전히 예시 데이터라는 것만 명시합니다.
 */
export default function PortfolioEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sentence, setSentence] = useState("");
  const [showRefine, setShowRefine] = useState(false);

  const [projectIndex, setProjectIndex] = useState(0);
  const [titleField, setTitleField] = useState("");
  const [context, setContext] = useState("");
  const [role, setRole] = useState("");
  const [problem, setProblem] = useState("");
  const [execution, setExecution] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reflection, setReflection] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const loadProject = (index: number, list: PortfolioProjectRow[]) => {
    const p = list[index];
    setProjectIndex(index);
    setTitleField(p?.name ?? "");
    setContext(p?.context ?? "");
    setRole(p?.role ?? "");
    setProblem(p?.problem ?? "");
    setExecution(p?.execution ?? "");
    setOutcome(p?.outcome ?? "");
    setReflection(p?.reflection ?? "");
  };

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
        if (ps.length > 0) loadProject(0, ps);
        setLastSavedAt(new Date(p.updated_at).getTime());
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const currentProject = projects[projectIndex];

  /** 지금 탭에 보이는 7칸을 현재 프로젝트 행에 저장합니다. 저장 버튼과
   *  프로젝트 탭 전환 둘 다 여기를 거칩니다 — 탭을 바꿀 때 저장하지 않으면
   *  방금 고친 내용이 조용히 사라지기 때문입니다. */
  const saveCurrentProject = async () => {
    const current = projects[projectIndex];
    if (!current) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch = {
        name: titleField,
        context,
        role,
        problem,
        execution,
        outcome,
        reflection,
      };
      await updatePortfolioProject(current.id, patch);
      setProjects((prev) => prev.map((p, i) => (i === projectIndex ? { ...p, ...patch } : p)));
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const switchProject = async (index: number) => {
    if (index === projectIndex) return;
    await saveCurrentProject();
    loadProject(index, projects);
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          포트폴리오를 불러오는 중입니다.
        </p>
      </div>
    );
  }

  if (loadError || !portfolio) {
    return (
      <div className="max-w-3xl space-y-2">
        <p role="alert" className="text-sm text-brand">
          {loadError ?? "포트폴리오를 찾을 수 없습니다."}
        </p>
        <Link to="/wizard/source" className="text-xs text-brand hover:underline">
          원본 자료 입력부터 다시 시작하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/wizard/draft" className="text-xs text-brand hover:underline">
          AI 초안 생성으로 돌아가기
        </Link>
        <button className="btn-primary" onClick={() => navigate(`/wizard/style/${portfolio.id}`)}>
          템플릿/스타일 설정
        </button>
      </div>
      <div>
        <h1 className="text-xl font-heading">{portfolio.title}</h1>
        {portfolio.summary ? (
          <p className="text-sm text-neutral-400 mt-1">{portfolio.summary}</p>
        ) : (
          <p className="text-xs text-neutral-600 mt-1 flex items-start gap-1.5">
            <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
            <span>요약이 아직 없습니다. 아래 항목을 직접 채워 주세요.</span>
          </p>
        )}
      </div>

      <div className="entry space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="entry-title mb-0">프로젝트 개요</h2>
          {portfolio.summary && <span className="badge bg-brand/10 text-brand">AI 초안 반영됨</span>}
        </div>

        {projects.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {projects.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void switchProject(i)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  i === projectIndex
                    ? "border-brand bg-brand/10 text-brand font-medium"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {p.name || "제목 없음"}
              </button>
            ))}
          </div>
        )}

        {projects.length === 0 && (
          <p className="text-sm text-neutral-500">
            프로젝트가 없습니다.{" "}
            <Link to="/wizard/source" className="text-brand hover:underline">
              원본 자료 입력
            </Link>
            부터 다시 시작해 주세요.
          </p>
        )}

        {currentProject && currentProject.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentProject.stack.map((s) => (
              <span key={s} className="badge bg-neutral-800 text-neutral-400">
                {s}
              </span>
            ))}
          </div>
        )}

        {projects.length > 0 && (
          <>
            <input
              value={titleField}
              onChange={(e) => setTitleField(e.target.value)}
              placeholder="프로젝트 제목"
              className="field"
            />
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="맥락 및 배경"
              rows={2}
              className="field-area"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="담당 역할"
              className="field"
            />
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="문제 정의"
              rows={2}
              className="field-area"
            />
            <textarea
              value={execution}
              onChange={(e) => setExecution(e.target.value)}
              placeholder="실행 내용"
              rows={2}
              className="field-area"
            />
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="핵심 성과 및 수치"
              rows={2}
              className="field-area"
            />
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="배운 점 및 회고"
              rows={2}
              className="field-area"
            />
            {portfolio.summary && (
              <p className="text-xs text-neutral-600 flex items-start gap-1.5">
                <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
                담당 역할·문제 정의·배운 점은 AI가 아직 채우지 못하는 항목이라 비워
                뒀습니다. 직접 적어주세요.
              </p>
            )}
          </>
        )}
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">AI 문장 다듬기</h2>
        <p className="text-xs text-neutral-400">
          다듬을 문장을 선택하거나 아래에 붙여넣어 목표 직무에 맞는 케이스 스터디
          문장으로 개선할 수 있습니다.
        </p>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="다듬을 문장 입력"
          rows={2}
          className="field-area"
        />
        <button
          className="btn-secondary disabled:opacity-40"
          disabled={!sentence.trim()}
          onClick={() => setShowRefine(true)}
        >
          AI 문장 다듬기 요청
        </button>

        {showRefine && (
          <div className="border-t border-neutral-800 pt-3 mt-3">
            <p className="text-xs text-neutral-500 mb-2">
              아래 개선안을 원문과 비교하고 적용 여부를 직접 결정하세요. AI는 사실이나
              의도를 임의로 변경하지 않습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
              <div className="sm:pr-6 pb-4 sm:pb-0">
                <p className="text-xs text-neutral-500 mb-1">원문</p>
                {sentence}
              </div>
              <div className="sm:pl-6 pt-4 sm:pt-0">
                <p className="text-xs text-neutral-500 mb-1">AI 개선안</p>
                {sentence
                  ? `${sentence} (핵심 성과와 역할을 강조한 케이스 스터디 문장으로 개선된 예시입니다.)`
                  : ""}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary" onClick={() => setShowRefine(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => setShowRefine(false)}>
                개선안 적용
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="entry space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="entry-title mb-0">AI 근거 및 사실 확인</h2>
          <span className="badge bg-amber-500/15 text-amber-400">
            {evidenceItems.filter((e) => e.status === "검토 필요").length}건 검토 필요
          </span>
        </div>
        <p className="text-xs text-neutral-400 flex items-start gap-1.5">
          <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
          <span>
            AI가 제안한 문장별 원본 자료와 근거를 확인하고 사실 여부를 직접
            표시하세요.{" "}
            <span className="text-neutral-600">
              (아래는 예시 데이터입니다 — 문장-출처 연결 기능은 아직 없습니다.)
            </span>
          </span>
        </p>
        <ul>
          {evidenceItems.map((e) => (
            <li key={e.id} className="row text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-200">{e.label}</span>
                <span
                  className={`badge ${
                    e.status === "확인 완료"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {e.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">연결 원본: {e.source}</p>
              <div className="flex gap-3 mt-2 text-xs">
                <button className="text-brand hover:underline">원본 보기</button>
                <button className="text-neutral-400 hover:underline">불일치 표시</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">이력서·포트폴리오 불일치 확인</h2>
        <p className="text-xs text-neutral-400">
          경력 기간, 소속과 역할, 프로젝트명, 성과 수치의 불일치 가능성 항목을
          자동으로 탐지합니다.{" "}
          <span className="text-neutral-600">(예시 데이터 — 이력서 업로드 기능은 아직 없습니다.)</span>
        </p>
        <ul>
          {mismatchItems.map((m) => (
            <li key={m.id} className="row text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-200">{m.label}</span>
                <button className="text-xs text-brand hover:underline">확인</button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{m.detail}</p>
            </li>
          ))}
        </ul>
        <button className="text-xs text-brand hover:underline">전체 불일치 항목 보기</button>
      </div>

      <div className="entry flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-200">
            마지막 저장: {formatRelativeTime(lastSavedAt)}
          </p>
          {saveError && (
            <p role="alert" className="text-xs text-brand mt-1">
              {saveError}
            </p>
          )}
          <p className="text-xs text-neutral-600 mt-1">
            현재 프로젝트 탭의 내용을 저장합니다. 다른 탭으로 옮기면 자동으로 먼저
            저장됩니다.
          </p>
        </div>
        <button
          className="btn-secondary disabled:opacity-40 inline-flex items-center gap-1.5"
          disabled={saving || projects.length === 0}
          onClick={() => void saveCurrentProject()}
        >
          {saving ? (
            "저장하는 중"
          ) : (
            <>
              <Check size={13} strokeWidth={2.5} aria-hidden="true" />
              수동 저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
