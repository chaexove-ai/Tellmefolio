import { useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase,
  ChevronDown,
  Code2,
  Gauge,
  Info,
  MessageSquareText,
  Palette,
  Server,
  Sparkles,
  TriangleAlert,
  Type,
  Workflow,
} from "lucide-react";
import AIRequestStatus from "../../components/AIRequestStatus";
import { type AIRequestStatus as Status } from "../../mockData";
import { useAuth } from "../../auth/AuthProvider";
import type { RepoMaterial } from "../../lib/github";
import { generateDraft, DraftError, type Draft } from "../../lib/draft";
import { createPortfolioFromDraft, PortfolioError } from "../../lib/portfolios";

/** 앞 단계에서 넘겨준 재료. 주소로 바로 들어오면 비어 있습니다. */
interface WizardState {
  materials?: RepoMaterial[];
  note?: string;
  links?: { id: string; meta: string }[];
  failed?: string[];
}

const jobOptions = ["프론트엔드 개발자", "백엔드 개발자", "UX/UI 디자이너", "프로덕트 매니저"];

const jobPresets = [
  { value: "프론트엔드 개발자", Icon: Code2 },
  { value: "백엔드 개발자", Icon: Server },
  { value: "UX/UI 디자이너", Icon: Palette },
  { value: "프로덕트 매니저", Icon: Briefcase },
] as const;

const structureOptions = [
  { value: "결과 중심형" as const, desc: "성과·지표를 앞세워 빠르게 훑기 좋음", Icon: Gauge },
  { value: "문제-실행-결과형" as const, desc: "과정을 자세히 보여주고 싶을 때", Icon: Workflow },
];

/** Tab 자동완성용 예시 값. 실명·팀원 정보는 담지 않습니다. */
const TITLE_EXAMPLE = "프론트엔드 개발자 포트폴리오 2025";
const CUSTOM_JOB_EXAMPLE = "AI 프로덕트 디자이너";
const EXTRA_EXAMPLE = "팀 리딩 경험을 좀 더 부각해줘";

/** 비어 있는 칸에서 Tab을 누르면 예시 문구를 그대로 채워 넣고, 포커스는
 *  평소처럼 다음 칸으로 넘어가게 둡니다(preventDefault 하지 않음). */
function useTabFill(value: string, fill: (v: string) => void, example: string) {
  return (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey && value.trim() === "") {
      fill(example);
    }
  };
}

function TabHint() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs text-neutral-500 opacity-0 transition-opacity peer-focus:opacity-100">
      <kbd className="rounded border border-neutral-600 bg-neutral-800 px-1 py-0.5 font-mono text-xs text-neutral-300">
        Tab
      </kbd>
      예시 입력
    </span>
  );
}

export default function AIDraftGeneration() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { materials = [], note = "", links = [], failed = [] } =
    (location.state as WizardState | null) ?? {};
  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState(jobOptions[0]);
  const [customJob, setCustomJob] = useState("");
  const [structure, setStructure] = useState<"결과 중심형" | "문제-실행-결과형">("결과 중심형");
  const [extra, setExtra] = useState("");
  /**
   * [2026-09-23] 부족했던 항목에 대한 답.
   *
   * 전에는 "자료가 부족했던 부분"을 보여주고 "이전 단계의 메모 칸에
   * 내용을 보태면 결과가 좋아집니다"로 끝났습니다. 무엇이 없는지 알려준
   * 뒤에 뒤로 가라고 하는 셈이라, 알려준 의미가 없었습니다. 여기서 바로
   * 채우고 다시 만듭니다.
   */
  const [gapAnswers, setGapAnswers] = useState<Record<number, string>>({});

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // [2026-09] 자료함에 웹 링크만 담고 GitHub 저장소나 메모가 없으면
  // "생성할 자료가 없습니다"로 버튼이 계속 비활성이었던 버그를 고쳤습니다
  // — links 를 안 보고 있었습니다.
  const hasMaterial = materials.length > 0 || note.trim().length > 0 || links.length > 0;

  const titleTabFill = useTabFill(title, setTitle, TITLE_EXAMPLE);
  const extraTabFill = useTabFill(extra, setExtra, EXTRA_EXAMPLE);

  const selectPresetJob = (value: string) => {
    setJob(value);
    setCustomJob("");
  };

  const onCustomJobChange = (value: string) => {
    setCustomJob(value);
    setJob(value.trim() ? value : jobOptions[0]);
  };

  const customJobTabFill = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && !e.shiftKey && customJob.trim() === "") {
      onCustomJobChange(CUSTOM_JOB_EXAMPLE);
    }
  };

  /**
   * Edge Function 을 호출합니다. 키는 서버에만 있으므로 여기서는 재료만
   * 넘깁니다. 실패하면 이유를 화면에 그대로 보여줍니다 — 조용히 실패하면
   * 사용자는 다시 눌러보는 것 말고 할 수 있는 게 없습니다.
   */
  /** 부족 항목 + 사용자가 채운 답을 모델이 읽을 수 있는 한 덩어리로. */
  const composeExtra = () => {
    const filled = (draft?.gaps ?? [])
      .map((g, i) => [g, (gapAnswers[i] ?? "").trim()] as const)
      .filter(([, a]) => a.length > 0)
      .map(([g, a]) => `- ${g}\n  → ${a}`);
    if (filled.length === 0) return extra;
    const block = ["[보완한 내용]", ...filled].join("\n");
    return extra.trim() ? `${extra.trim()}\n\n${block}` : block;
  };

  const filledGapCount = (draft?.gaps ?? []).filter(
    (_, i) => (gapAnswers[i] ?? "").trim().length > 0
  ).length;

  const startGeneration = async () => {
    setStatus("processing");
    setErrorMessage(null);

    try {
      const { draft: result } = await generateDraft({
        materials,
        note,
        links: links.map((l) => l.meta),
        job,
        structure,
        extra: composeExtra(),
      });
      setDraft(result);
      setStatus("completed");
    } catch (e) {
      setErrorMessage(
        e instanceof DraftError ? e.message : "초안 생성 중 문제가 생겼습니다."
      );
      setStatus("failed");
    }
  };

  /**
   * [2026-09] "편집기에서 열기"가 이제 실제로 portfolios/portfolio_projects
   * 행을 만듭니다. 전에는 draft 를 location.state 로만 다음 화면에 넘겼고,
   * 그 화면에서 새로고침하면 통째로 사라졌습니다. 여기서 만든 id 로
   * /wizard/editor/:id 에 들어가면 그 다음부터는 항상 DB 에서 다시 읽습니다.
   */
  const openInEditor = async () => {
    if (!draft) return;
    if (!session?.user?.id) {
      setCreateError("로그인이 필요합니다.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const { portfolio } = await createPortfolioFromDraft({
        userId: session.user.id,
        title: title.trim() || draft.title,
        job,
        draft,
      });
      navigate(`/wizard/editor/${portfolio.id}`);
    } catch (e) {
      setCreateError(e instanceof PortfolioError ? e.message : "포트폴리오를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    // 폭 기준은 SourceInput 주석 참고 — 칸은 넓게, 읽는 글만 좁게.
    <div className="space-y-6">
      <div>
        <Link to="/wizard/source" className="text-xs text-brand hover:underline">
          원본 자료 수정
        </Link>
        <h1 className="text-xl font-heading mt-2">AI 포트폴리오 초안 생성</h1>
      </div>

      {/* 앞 단계에서 실제로 읽어온 재료를 보여줍니다. README 를 못 읽은
          저장소는 그 사실을 함께 알립니다. 조용히 빠지면 사용자는 결과가
          부실한 이유를 모릅니다. */}
      <div className="entry">
        <h2 className="entry-title">선택된 원본 자료</h2>

        {materials.length === 0 && note.trim().length === 0 && links.length === 0 ? (
          <p className="text-sm text-neutral-500">
            선택된 자료가 없습니다.{" "}
            <Link to="/wizard/source" className="text-brand hover:underline">
              이전 단계
            </Link>
            에서 저장소를 고르거나 메모를 적어주세요.
          </p>
        ) : (
          <ul className="text-sm text-neutral-400 space-y-1">
            {materials.map((m) => (
              <li key={m.repo.id}>
                GitHub — {m.repo.name}
                {m.languages.length > 0 && (
                  <span className="text-xs text-neutral-500"> · {m.languages.join(", ")}</span>
                )}
                {!m.readme && (
                  <span className="text-xs text-neutral-600"> · README 없음</span>
                )}
                {m.readmeTruncated && (
                  <span className="text-xs text-neutral-600"> · README 앞부분만</span>
                )}
              </li>
            ))}
            {links.map((l) => (
              <li key={l.id}>웹 링크 — {l.meta}</li>
            ))}
            {note.trim().length > 0 && <li>메모 — 직접 작성한 내용</li>}
          </ul>
        )}

        {failed.length > 0 && (
          <p className="text-xs text-brand mt-3">
            읽지 못한 저장소: {failed.join(", ")}
          </p>
        )}
      </div>

      <div className="entry">
        <h2 className="entry-title inline-flex items-center gap-2">
          <Sparkles size={16} strokeWidth={1.75} />
          생성 설정
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-500 inline-flex items-center gap-1.5">
              <Type size={13} strokeWidth={1.5} />
              포트폴리오 제목 <span className="text-neutral-600">(선택)</span>
            </label>
            <div className="relative mt-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={titleTabFill}
                className="field peer w-full"
                placeholder="예: 프론트엔드 개발자 포트폴리오 2025"
              />
              <TabHint />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-500 inline-flex items-center gap-1.5 mb-1.5">
              <Workflow size={13} strokeWidth={1.5} />
              구성 방식
            </label>
            <div className="grid grid-cols-2 gap-2">
              {structureOptions.map(({ value, desc, Icon }) => {
                const active = structure === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStructure(value)}
                    className={`rounded-xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-brand bg-brand/10"
                        : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-600"
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center gap-1.5 text-sm font-medium ${
                        active ? "text-brand" : "text-neutral-100"
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {value}
                    </div>
                    <p className="text-xs text-neutral-500">{desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <details className="group border-t border-neutral-800 pt-3.5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-neutral-300">
              <span className="inline-flex items-center gap-1.5">
                세부 설정 — 직무, 추가 요청
                <span className="badge bg-neutral-800 text-neutral-400">선택</span>
              </span>
              <ChevronDown size={16} strokeWidth={1.75} className="transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-4 pt-3.5">
              <div>
                <label className="text-xs text-neutral-500 inline-flex items-center gap-1.5 mb-1.5">
                  <Briefcase size={13} strokeWidth={1.5} />
                  직무
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {jobPresets.map(({ value, Icon }) => {
                    const active = !customJob.trim() && job === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectPresetJob(value)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                          active
                            ? "border-brand bg-brand/10 text-brand font-medium"
                            : "border-neutral-700 bg-neutral-900/40 text-neutral-300 hover:border-neutral-500"
                        }`}
                      >
                        <Icon size={14} strokeWidth={1.75} />
                        {value}
                      </button>
                    );
                  })}
                  <div className="relative min-w-[160px] flex-1">
                    <input
                      value={customJob}
                      onChange={(e) => onCustomJobChange(e.target.value)}
                      onKeyDown={customJobTabFill}
                      placeholder="✏️ 직접 입력"
                      className="peer w-full rounded-full border border-dashed border-neutral-600 bg-transparent px-3.5 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-solid focus:border-brand focus:outline-none"
                    />
                    <TabHint />
                  </div>
                </div>
                <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-neutral-600">
                  <Info size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-neutral-500" />
                  목록에 없는 직무는 옆 칸에 바로 입력하세요.
                </p>
              </div>

              <div>
                <label className="text-xs text-neutral-500 inline-flex items-center gap-1.5 mb-1">
                  <MessageSquareText size={13} strokeWidth={1.5} />
                  AI에게 추가 요청사항 입력 (선택)
                </label>
                <div className="relative">
                  <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    onKeyDown={extraTabFill}
                    rows={2}
                    placeholder="예: 팀 리딩 경험을 좀 더 부각해줘"
                    className="field-area max-w-[80ch] peer"
                  />
                  <span className="pointer-events-none absolute right-3 top-2.5 inline-flex items-center gap-1 text-xs text-neutral-500 opacity-0 transition-opacity peer-focus:opacity-100">
                    <kbd className="rounded border border-neutral-600 bg-neutral-800 px-1 py-0.5 font-mono text-xs text-neutral-300">
                      Tab
                    </kbd>
                    예시 입력
                  </span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <AIRequestStatus
        status={status}
        processingLabel="초안을 생성하고 있습니다... 원본 자료를 분석하고 있습니다."
        completedLabel="포트폴리오 초안이 준비되었습니다. 편집기에서 내용을 검토하고 수정할 수 있습니다."
        failedReason="요청 처리 중 오류가 발생했습니다. 원본 자료의 용량이 크거나 서버 요청이 일시적으로 실패했습니다."
        onRetry={() => void startGeneration()}
        onCancel={() => setStatus("idle")}
      />

      {errorMessage && (
        <p role="alert" className="text-sm text-brand">
          {errorMessage}
        </p>
      )}

      {/* 모델이 자료 부족으로 못 쓴 부분을 그대로 보여줍니다. 결과가 얇을 때
          사용자가 무엇을 보강해야 하는지 알 수 있는 유일한 단서입니다. */}
      {draft && draft.gaps?.length > 0 && (
        <div className="entry">
          <h2 className="entry-title inline-flex items-center gap-2">
            <TriangleAlert size={16} strokeWidth={1.75} className="text-amber-400" />
            자료가 부족했던 부분
          </h2>
          <p className="text-xs text-neutral-500 mb-3">
            아는 내용을 여기 적으면 그대로 반영해 다시 만듭니다. 모르는 항목은
            비워두면 됩니다.
          </p>
          <ul className="space-y-2">
            {draft.gaps.map((g, i) => (
              <li key={i} className="rounded-lg bg-amber-500/[0.07] px-3.5 py-2.5">
                <div className="flex items-start gap-2.5 text-sm text-neutral-300">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span className="leading-relaxed">{g}</span>
                </div>
                <input
                  value={gapAnswers[i] ?? ""}
                  onChange={(e) =>
                    setGapAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  placeholder="예: 월 방문 1,200명 · 전환율 3.4% · 2025년 3월 기준"
                  className="field mt-2 py-1.5 text-sm"
                />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-600 min-w-0">
              {filledGapCount > 0
                ? `${filledGapCount}개를 채웠습니다.`
                : "채우지 않고 넘어가도 됩니다 — 나중에 직접 편집에서 고칠 수 있습니다."}
            </p>
            <button
              className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-40"
              disabled={filledGapCount === 0 || status === "processing"}
              onClick={() => void startGeneration()}
            >
              {status === "processing" ? "다시 만드는 중" : "채운 내용으로 다시 만들기"}
            </button>
          </div>
        </div>
      )}

      {status === "idle" && (
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!hasMaterial}
          onClick={() => void startGeneration()}
        >
          {!hasMaterial ? "생성할 자료가 없습니다" : "AI 초안 생성 요청"}
        </button>
      )}

      {status === "completed" && (
        <div className="space-y-2">
          <button
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={creating}
            onClick={() => void openInEditor()}
          >
            {creating ? "저장하는 중" : "편집기에서 열기"}
          </button>
          {createError && (
            <p role="alert" className="text-xs text-brand">
              {createError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
