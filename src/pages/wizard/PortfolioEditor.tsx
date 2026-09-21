import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Info, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import {
  getPortfolioWithProjects,
  updatePortfolioProject,
  createPortfolioProject,
  deletePortfolioProject,
  getCoverImageUrl,
  PortfolioError,
  type PortfolioProjectRow,
  type PortfolioRow,
} from "../../lib/portfolios";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import EditorPreview from "../../components/EditorPreview";
import StylePanel from "../../components/StylePanel";

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
/**
 * [2026-09] 스타일 패널을 어느 열에 둘지 결정하기 위한 훅입니다.
 *
 * CSS 로 숨기고 보이기만 하면(hidden/xl:block) 패널을 양쪽에 하나씩 두 벌
 * 두어야 하는데, 그러면 각자 자기 상태를 갖게 되어 한쪽에서 고친 값이
 * 다른 쪽에 없습니다. 인스턴스는 하나로 두고 둘 중 한 자리에만 그립니다.
 */
function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

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
  /** 툴·키워드. 지금까지 AI 초안이 넣어준 값을 보여주기만 하고 고칠 방법이
   *  없었습니다 — 직접 추가한 프로젝트는 빈 배열로 시작하니 영영 비어
   *  있었습니다. */
  const [stack, setStack] = useState<string[]>([]);
  const [stackInput, setStackInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [addingProject, setAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // coverUrl 은 "지금 미리보기에 그릴 표지"(아직 저장 안 한 새 파일일 수
  // 있음), savedCoverUrl 은 "DB에 들어 있는 표지"입니다. 스타일 패널의
  // 되돌리기가 후자를 복원합니다.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [savedCoverUrl, setSavedCoverUrl] = useState<string | null>(null);
  /** 미리보기는 xl(1280px) 이상에서만 자리가 납니다. 그 아래에서는 폼과
   *  미리보기가 둘 다 좁아져 양쪽 다 못 쓰게 되므로 감추고, 스타일 패널만
   *  왼쪽 열로 내려보냅니다(안 그러면 좁은 화면에서 스타일을 바꿀 방법이
   *  아예 없어집니다 — 설정 페이지를 없앴으니 여기가 유일한 입구입니다).
   *
   *  [2026-09] "미리보기 숨기기" 토글은 없앴습니다. 숨겨도 입력 폼이
   *  넓어지지 않습니다 — 폼이 max-w-3xl 에 묶여 있어서 숨긴 자리가 그대로
   *  빈 공간이 됩니다. 화면만 허전해지고 얻는 것이 없는 버튼이면서, 주
   *  버튼(내보내기) 옆자리를 차지하고 있었습니다. */
  const isWide = useIsWide();

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
    setStack(p?.stack ?? []);
    setStackInput("");
  };

  /** 쉼표로 여러 개를 한 번에 붙여넣는 경우까지 받습니다. 중복과 빈 값은
   *  버리고, 너무 긴 것은 자릅니다(배지 한 줄을 넘기면 목록이 안 읽힙니다). */
  const addStack = (raw: string) => {
    const added = raw
      .split(",")
      .map((v) => v.trim().slice(0, 24))
      .filter(Boolean);
    if (added.length === 0) return;
    setStack((prev) => {
      const next = [...prev];
      for (const a of added) if (!next.includes(a)) next.push(a);
      return next.slice(0, 12);
    });
    setStackInput("");
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
        if (p.cover_image_path) {
          // 표지를 못 불러와도 나머지 미리보기는 그려져야 하므로 조용히
          // 넘어갑니다(템플릿이 coverUrl null 을 알아서 처리합니다).
          getCoverImageUrl(p.cover_image_path)
            .then((url) => {
              if (!alive) return;
              setCoverUrl(url);
              setSavedCoverUrl(url);
            })
            .catch(() => {});
        }
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

  /** 미리보기에 넘길 데이터입니다.
   *
   *  편집 중인 탭의 값은 저장하기 전까지 projects 배열에 반영되지 않습니다
   *  (저장 시점에만 반영). 그래서 그 항목만 지금 입력칸의 값으로 덮어써서
   *  넘깁니다 — 저장을 눌러야 미리보기가 바뀐다면 "실시간"이 아닙니다. */
  const previewProjects = useMemo(
    () =>
      projects.map((p, i) =>
        i === projectIndex
          ? { ...p, name: titleField, context, role, problem, execution, outcome, reflection, stack }
          : p
      ),
    [
      projects,
      projectIndex,
      titleField,
      context,
      role,
      problem,
      execution,
      outcome,
      reflection,
      stack,
    ]
  );

  /** "프로젝트 개요"의 7칸을 순서 있는 케이스 스터디 흐름으로 보여주기 위한
   *  메타데이터입니다. 예전에는 placeholder 텍스트가 곧 라벨이라 필드를 다
   *  채우고 나면 지금 뭘 적고 있는 칸인지 알 수 없었습니다 — 이제 칸마다
   *  실제 <label>과 한 줄 안내, 그리고 순서(맥락→문제→실행→성과→회고)를
   *  숫자로 보여줍니다. aiFilled 가 false 인 칸(담당 역할·문제 정의·배운
   *  점)은 AI 초안에 대응 필드가 없어 항상 직접 입력해야 하는 칸이라는 걸
   *  라벨 옆 배지로 표시합니다. */
  const storyFields: Array<{
    key: string;
    label: string;
    helper: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    rows: number;
    aiFilled: boolean;
  }> = [
    {
      key: "context",
      label: "맥락 및 배경",
      helper: "이 프로젝트를 하게 된 상황이나 배경을 적어주세요.",
      placeholder: "예: 기존 온보딩 퍼널의 이탈률이 40%를 넘어서면서 개선이 필요했습니다.",
      value: context,
      onChange: setContext,
      rows: 3,
      aiFilled: true,
    },
    {
      key: "problem",
      label: "문제 정의",
      helper: "해결하려고 했던 핵심 문제를 한두 문장으로 정리하세요.",
      placeholder: "예: 신규 사용자가 첫 화면에서 다음 단계로 넘어가지 못하고 있었습니다.",
      value: problem,
      onChange: setProblem,
      rows: 2,
      aiFilled: false,
    },
    {
      key: "execution",
      label: "실행 내용",
      helper: "문제를 풀기 위해 실제로 한 일을 구체적으로 적으세요.",
      placeholder: "예: 온보딩 단계를 5단계에서 3단계로 줄이고, 각 단계에 진행률 표시를 추가했습니다.",
      value: execution,
      onChange: setExecution,
      rows: 3,
      aiFilled: true,
    },
    {
      key: "outcome",
      label: "핵심 성과 및 수치",
      helper: "수치나 결과로 보여줄 수 있는 성과를 적으세요.",
      placeholder: "예: 온보딩 완료율이 52%에서 71%로 개선되었습니다.",
      value: outcome,
      onChange: setOutcome,
      rows: 2,
      aiFilled: true,
    },
    {
      key: "reflection",
      label: "배운 점 및 회고",
      helper: "이 프로젝트를 통해 배운 점이나 아쉬웠던 점을 적으세요.",
      placeholder: "예: 초기 가설 검증 없이 구현부터 시작해서 한 차례 방향을 수정해야 했습니다.",
      value: reflection,
      onChange: setReflection,
      rows: 2,
      aiFilled: false,
    },
  ];

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
        stack,
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

  /** 빈 프로젝트 행을 하나 만들고 바로 그 탭으로 전환합니다. AI 초안이
   *  뽑아준 프로젝트 개수가 실제와 다를 때(하나 더 있었다거나, 초안 없이
   *  손으로 새로 쓰고 싶을 때) 쓰라고 만든 버튼입니다.
   *
   *  position 은 projects.length 가 아니라 "지금 있는 것 중 가장 큰
   *  position + 1"로 계산합니다 — 중간 프로젝트를 삭제한 적이 있으면
   *  length 와 실제 최댓값이 어긋나서, length 를 그대로 쓰면 이미 있는
   *  position 과 겹쳐 정렬이 꼬입니다. */
  const handleAddProject = async () => {
    if (!portfolio) return;
    setAddingProject(true);
    setAddProjectError(null);
    try {
      await saveCurrentProject();
      const nextPosition = projects.reduce((max, p) => Math.max(max, p.position), -1) + 1;
      const created = await createPortfolioProject(portfolio.id, nextPosition);
      const next = [...projects, created];
      setProjects(next);
      loadProject(next.length - 1, next);
    } catch (e) {
      setAddProjectError(e instanceof PortfolioError ? e.message : "프로젝트를 추가하지 못했습니다.");
    } finally {
      setAddingProject(false);
    }
  };

  /** 지금 탭의 프로젝트를 삭제합니다. 되돌릴 수 없는 동작이라 버튼을 바로
   *  두지 않고, 누르면 "정말 삭제할까요?" 확인 상태로 한 번 더 거칩니다. */
  const handleDeleteProject = async () => {
    if (!currentProject) return;
    setDeleting(true);
    setDeleteProjectError(null);
    try {
      await deletePortfolioProject(currentProject.id);
      const next = projects.filter((_, i) => i !== projectIndex);
      setProjects(next);
      setDeleteConfirming(false);
      if (next.length > 0) {
        loadProject(Math.min(projectIndex, next.length - 1), next);
      } else {
        setProjectIndex(0);
        setTitleField("");
        setContext("");
        setRole("");
        setProblem("");
        setExecution("");
        setOutcome("");
        setReflection("");
      }
    } catch (e) {
      setDeleteProjectError(e instanceof PortfolioError ? e.message : "프로젝트를 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
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

  const stylePanel = (
    <StylePanel
      portfolioId={portfolio.id}
      initial={portfolio}
      savedCoverUrl={savedCoverUrl}
      onStyleChange={(s) => setPortfolio((prev) => (prev ? { ...prev, ...s } : prev))}
      onCoverPreviewChange={setCoverUrl}
      onCoverSaved={(url) => {
        setCoverUrl(url);
        setSavedCoverUrl(url);
      }}
    />
  );

  return (
    <div className="flex items-start gap-6">
      <div className="flex-1 min-w-0 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/wizard/draft" className="text-xs text-brand hover:underline">
            AI 초안 생성으로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={() => navigate(`/wizard/export/${portfolio.id}`)}>
              내보내기
            </button>
          </div>
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

        {!isWide && stylePanel}

        <div className="entry space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="entry-title mb-0">프로젝트 개요</h2>
            <div className="flex items-center gap-2">
              {portfolio.summary && <span className="badge bg-brand/10 text-brand">AI 초안 반영됨</span>}
              {currentProject && !deleteConfirming && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirming(true)}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-brand"
                >
                  <Trash2 size={12} strokeWidth={1.75} />이 프로젝트 삭제
                </button>
              )}
            </div>
          </div>

          {deleteConfirming && (
            <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-xs">
              <span className="text-neutral-300">
                "{currentProject?.name || "제목 없음"}"을(를) 정말 삭제할까요? 되돌릴 수 없습니다.
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  className="text-neutral-400 hover:underline"
                  onClick={() => setDeleteConfirming(false)}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="font-medium text-brand hover:underline disabled:opacity-40"
                  onClick={() => void handleDeleteProject()}
                  disabled={deleting}
                >
                  {deleting ? "삭제하는 중" : "삭제"}
                </button>
              </div>
            </div>
          )}
          {deleteProjectError && (
            <p role="alert" className="text-xs text-brand">
              {deleteProjectError}
            </p>
          )}

          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => void handleAddProject()}
                disabled={addingProject}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
                {addingProject ? "추가하는 중" : "새 프로젝트"}
              </button>
            </div>
          )}

          {projects.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">
                프로젝트가 없습니다.{" "}
                <Link to="/wizard/source" className="text-brand hover:underline">
                  원본 자료 입력
                </Link>
                부터 다시 시작하거나, 아래에서 빈 프로젝트를 직접 추가할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={() => void handleAddProject()}
                disabled={addingProject}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
                {addingProject ? "추가하는 중" : "새 프로젝트"}
              </button>
            </div>
          )}
          {addProjectError && (
            <p role="alert" className="text-xs text-brand">
              {addProjectError}
            </p>
          )}

          {currentProject && (
            <div className="space-y-1.5">
              <label htmlFor="proj-stack" className="text-xs font-medium text-neutral-200">
                사용한 툴 · 키워드
              </label>
              {/* 칩과 입력칸을 하나의 상자 안에 넣습니다. 전에는 입력칸이
                  테두리 없이 투명이라 칩이 하나도 없을 때 그냥 안내 글자처럼
                  보였습니다 — 누를 수 있는 곳이라는 신호가 없었습니다.
                  <label>로 감싸서 상자 어디를 눌러도 입력칸에 커서가 갑니다. */}
              <label
                htmlFor="proj-stack"
                className="field flex flex-wrap items-center gap-1.5 cursor-text
                  focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15"
              >
                {stack.map((tag) => (
                  <span
                    key={tag}
                    className="badge bg-neutral-800 text-neutral-300 inline-flex items-center gap-1 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setStack((prev) => prev.filter((t) => t !== tag))}
                      aria-label={`${tag} 제거`}
                      className="grid size-4 place-items-center rounded text-neutral-500 hover:text-brand"
                    >
                      <X size={11} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  id="proj-stack"
                  value={stackInput}
                  onChange={(e) => setStackInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addStack(stackInput);
                    } else if (e.key === "Backspace" && !stackInput) {
                      // 빈 칸에서 지우면 마지막 것부터 떨어집니다 — 태그
                      // 입력칸의 관례라 별도 안내 없이도 통합니다.
                      setStack((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => addStack(stackInput)}
                  placeholder={stack.length === 0 ? "예: Figma, UX 리서치, React" : "추가"}
                  className="min-w-[7rem] flex-1 border-0 bg-transparent p-0 text-sm text-neutral-100
                    placeholder:text-neutral-600 focus:outline-none focus:ring-0"
                />
              </label>
              {stack.length === 0 && (
                <p className="text-xs text-neutral-600">
                  쉼표나 Enter 로 구분해 넣으세요. 템플릿에서 프로젝트 제목 아래
                  줄에 나옵니다.
                </p>
              )}
            </div>
          )}

          {projects.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="proj-title" className="text-xs font-medium text-neutral-300">
                    프로젝트 제목
                  </label>
                  <input
                    id="proj-title"
                    value={titleField}
                    onChange={(e) => setTitleField(e.target.value)}
                    placeholder="예: 사용자 온보딩 퍼널 개선"
                    className="field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="proj-role"
                    className="text-xs font-medium text-neutral-300 inline-flex items-center gap-1.5"
                  >
                    담당 역할
                    <span className="badge bg-neutral-800 text-neutral-500 px-1.5 py-0">
                      직접 입력
                    </span>
                  </label>
                  <input
                    id="proj-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="예: 프론트엔드 리드"
                    className="field"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4">
                <p className="text-xs text-neutral-500 mb-4">
                  아래 5가지는 케이스 스터디 흐름 순서(맥락 → 문제 → 실행 → 성과 → 회고)대로
                  적으면 자연스럽게 이어집니다.
                </p>
                <div className="space-y-5">
                  {storyFields.map((f, i) => (
                    <div key={f.key} className="flex gap-3">
                      <div className="flex flex-col items-center pt-0.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-400">
                          {i + 1}
                        </span>
                        {i < storyFields.length - 1 && (
                          <span className="w-px flex-1 bg-neutral-800 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5 pb-0.5">
                        <label
                          htmlFor={`proj-${f.key}`}
                          className="text-xs font-medium text-neutral-200 inline-flex items-center gap-1.5"
                        >
                          {f.label}
                          {!f.aiFilled && (
                            <span className="badge bg-neutral-800 text-neutral-500 px-1.5 py-0">
                              직접 입력
                            </span>
                          )}
                        </label>
                        {/* 안내는 칸이 비어 있을 때만 보여줍니다. 6칸에
                            라벨·안내·예시가 늘 함께 쌓이면 화면이 안내문으로
                            덮입니다 — 처음엔 필요하지만 한 번 채우고 나면
                            소음입니다. */}
                        {!f.value && <p className="text-xs text-neutral-600">{f.helper}</p>}
                        <textarea
                          id={`proj-${f.key}`}
                          value={f.value}
                          onChange={(e) => f.onChange(e.target.value)}
                          placeholder={f.placeholder}
                          rows={f.rows}
                          // 본문 기준(14px)보다 한 단계 위입니다. 이 앱에서
                          // 글을 가장 오래 쓰고 고치는 칸이라, 빽빽한 곳에
                          // 맞춘 기준을 그대로 적용할 이유가 없습니다.
                          className="field-area text-base leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* [2026-09] 아래 세 섹션은 전부 아직 동작하지 않습니다 — "AI 문장
            다듬기"는 버튼이 상태만 바꾸고, 나머지 둘은 고정된 예시 데이터를
            그립니다. 그런데 이 셋이 편집기 왼쪽 열의 절반을 차지하면서,
            정작 글을 쓰는 칸이 화면 위쪽 일부로 밀려 있었습니다. 지우지
            않고 접어 둡니다 — 만들 화면의 설계가 여기 담겨 있어서 참고용으로
            남길 가치가 있습니다. 실제로 동작하게 되는 순간 이 껍데기를
            벗기면 됩니다. */}
        <details className="entry">
          <summary className="cursor-pointer text-xs text-neutral-500 hover:text-brand list-none">
            아직 동작하지 않는 화면 3개 보기 (AI 문장 다듬기 · 근거 확인 · 이력서 대조)
          </summary>
          <div className="mt-4 space-y-6">
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

          </div>
        </details>

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

      {/* 미리보기 패널을 고정 폭(420/560px)으로 두니 넓은 모니터에서
          오른쪽이 계속 비었습니다. 왼쪽 폼과 같이 flex-1 로 두면 폼이
          max-w-3xl 에 걸린 뒤 남는 폭을 이쪽이 전부 가져갑니다. */}
      {isWide && (
        <aside className="sticky top-6 flex-1 min-w-[380px] space-y-3">
          {stylePanel}
          <EditorPreview
            portfolio={portfolio}
            projects={previewProjects}
            coverUrl={coverUrl}
          />
        </aside>
      )}
    </div>
  );
}
