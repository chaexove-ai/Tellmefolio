import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import type { Draft, DraftProject } from "../../lib/draft";

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

/** 앞 단계(AIDraftGeneration)가 navigate 로 넘겨준 값. 주소로 바로 들어오면 비어 있습니다. */
interface WizardEditorState {
  draft?: Draft;
}

/**
 * [2026-09] "AI 돌리면 여기 자동 입력되는 거 아니었어?" 라는 질문에서 시작된
 * 수정입니다. 실제로는 이 화면이 location.state.draft 를 전혀 읽지 않고
 * 있었습니다 — 이전 단계에서 만든 초안이 그냥 버려지고 있었던 것입니다.
 *
 * 채워지는 항목 / 못 채우는 항목
 *   Draft.projects[i] 는 { name, oneLiner, body, highlights, stack } 만 갖고
 *   있어서, 아래 7칸 중 "프로젝트 제목·맥락 및 배경·실행 내용·핵심 성과 및
 *   수치" 네 개만 자동으로 채울 수 있습니다. "담당 역할·문제 정의·배운 점 및
 *   회고" 는 AI 응답에 대응하는 필드가 없어 계속 빈 칸으로 둡니다 — 채워진
 *   척 가짜 문장을 넣는 대신, 직접 쓰라고 안내만 합니다.
 *
 * 프로젝트가 여러 개일 수 있어(자료함에 리포를 여러 개 담을 수 있으므로)
 * 위에 프로젝트 탭을 두고, 탭을 바꾸면 그 프로젝트 값으로 다시 채웁니다.
 *
 * "AI 근거 및 사실 확인" / "이력서·포트폴리오 불일치 확인" 두 섹션은 이번에
 * 건드리지 않았습니다 — 실제로 문장-출처를 연결하거나 이력서와 대조하는
 * 기능 자체가 아직 없어서, 지금 손대면 또 다른 가짜 데이터를 진짜처럼
 * 보이게 만드는 것밖에 안 됩니다. 여전히 예시 데이터라는 것만 명시했습니다.
 */
export default function PortfolioEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { draft } = (location.state as WizardEditorState | null) ?? {};
  const projects: DraftProject[] = draft?.projects ?? [];

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

  const loadProject = (index: number) => {
    const p = projects[index];
    setProjectIndex(index);
    setTitleField(p?.name ?? "");
    setContext(p?.oneLiner ?? "");
    setExecution(p?.body ?? "");
    setOutcome(p?.highlights?.length ? p.highlights.join("\n") : "");
    // 담당 역할 · 문제 정의 · 배운 점은 AI 응답에 없는 항목이라, 프로젝트를
    // 바꿀 때도 항상 빈 칸으로 초기화합니다(다른 프로젝트 내용이 남지 않게).
    setRole("");
    setProblem("");
    setReflection("");
  };

  useEffect(() => {
    if (projects.length > 0) loadProject(0);
    // draft 는 이 화면에 들어올 때 한 번 정해지고 이후 바뀌지 않으므로,
    // 마운트 시 한 번만 채웁니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const currentProject = projects[projectIndex];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/wizard/draft" className="text-xs text-brand hover:underline">
          AI 초안 생성으로 돌아가기
        </Link>
        <button
          className="btn-primary"
          onClick={() => navigate("/wizard/style")}
        >
          템플릿/스타일 설정
        </button>
      </div>
      <div>
        <h1 className="text-xl font-heading">포트폴리오 편집기</h1>
        {draft ? (
          <p className="text-sm text-neutral-400 mt-1">{draft.summary}</p>
        ) : (
          <p className="text-xs text-neutral-600 mt-1 flex items-start gap-1.5">
            <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
            <span>
              전달된 AI 초안이 없습니다. 빈 칸에 직접 작성하거나,{" "}
              <Link to="/wizard/source" className="text-brand hover:underline">
                원본 자료 입력
              </Link>
              부터 다시 시작해 주세요.
            </span>
          </p>
        )}
      </div>

      <div className="entry space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="entry-title mb-0">프로젝트 개요</h2>
          {draft && <span className="badge bg-brand/10 text-brand">AI 초안 반영됨</span>}
        </div>

        {projects.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {projects.map((p, i) => (
              <button
                key={`${p.name}-${i}`}
                type="button"
                onClick={() => loadProject(i)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  i === projectIndex
                    ? "border-brand bg-brand/10 text-brand font-medium"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
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
        {draft && (
          <p className="text-xs text-neutral-600 flex items-start gap-1.5">
            <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
            담당 역할·문제 정의·배운 점은 AI가 아직 채우지 못하는 항목이라 비워
            뒀습니다. 직접 적어주세요.
          </p>
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
          <p className="text-sm text-neutral-200">마지막 자동 저장: 방금 전</p>
          <button className="text-xs text-brand hover:underline mt-1">변경 이력 확인</button>
          <p className="text-xs text-neutral-600 mt-1">
            AI 생성, 직접 수정, 저장 시점이 버전으로 기록됩니다. 원하는 버전으로
            되돌릴 수 있습니다.
          </p>
        </div>
        <button className="btn-secondary">수동 저장</button>
      </div>
    </div>
  );
}
