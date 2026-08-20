import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AIRequestStatus from "../../components/AIRequestStatus";
import { aiUsage, type AIRequestStatus as Status } from "../../mockData";
import type { RepoMaterial } from "../../lib/github";
import { generateDraft, DraftError, type Draft } from "../../lib/draft";

/** 앞 단계에서 넘겨준 재료. 주소로 바로 들어오면 비어 있습니다. */
interface WizardState {
  materials?: RepoMaterial[];
  note?: string;
  links?: { id: string; meta: string }[];
  failed?: string[];
}

const jobOptions = ["프론트엔드 개발자", "백엔드 개발자", "UX/UI 디자이너", "프로덕트 매니저"];

export default function AIDraftGeneration() {
  const navigate = useNavigate();
  const location = useLocation();
  const { materials = [], note = "", links = [], failed = [] } =
    (location.state as WizardState | null) ?? {};
  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState(jobOptions[0]);
  const [structure, setStructure] = useState<"결과 중심형" | "문제-실행-결과형">("결과 중심형");
  const [extra, setExtra] = useState("");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const limitReached = aiUsage.dailyUsed >= aiUsage.dailyLimit;
  const hasMaterial = materials.length > 0 || note.trim().length > 0;

  /**
   * Edge Function 을 호출합니다. 키는 서버에만 있으므로 여기서는 재료만
   * 넘깁니다. 실패하면 이유를 화면에 그대로 보여줍니다 — 조용히 실패하면
   * 사용자는 다시 눌러보는 것 말고 할 수 있는 게 없습니다.
   */
  const startGeneration = async () => {
    setStatus("processing");
    setErrorMessage(null);

    try {
      const { draft: result } = await generateDraft({
        materials,
        note,
        job,
        structure,
        extra,
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

  return (
    <div className="max-w-2xl space-y-6">
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

      <div className="entry space-y-4">
        <h2 className="entry-title mb-0">생성 설정</h2>
        <div>
          <label className="text-xs text-neutral-500">포트폴리오 제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field mt-1"
            placeholder="예: 프론트엔드 개발자 포트폴리오 2025"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">목표 직무</label>
          <select
            value={job}
            onChange={(e) => setJob(e.target.value)}
            className="field mt-1"
          >
            {jobOptions.map((j) => (
              <option key={j} className="bg-neutral-900">{j}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">구성 방식</label>
          <div className="flex gap-2 mt-1">
            {(["결과 중심형", "문제-실행-결과형"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStructure(s)}
                className={`flex-1 rounded-sm border px-3 py-2 text-sm ${
                  structure === s
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-800 text-neutral-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500">AI에게 추가 요청사항 입력 (선택)</label>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
            className="field-area mt-1"
          />
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
          <h2 className="entry-title">자료가 부족했던 부분</h2>
          <ul className="text-sm text-neutral-400 space-y-1 list-disc pl-4">
            {draft.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <p className="text-xs text-neutral-600 mt-2">
            이전 단계의 메모 칸에 내용을 보태면 결과가 좋아집니다.
          </p>
        </div>
      )}

      <div className="entry">
        <h2 className="entry-title">AI 사용량</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-neutral-500">오늘 남은 횟수</p>
            <p className="font-medium text-neutral-100">
              {aiUsage.dailyLimit - aiUsage.dailyUsed} / {aiUsage.dailyLimit}회
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">이번 달 남은 횟수</p>
            <p className="font-medium text-neutral-100">
              {aiUsage.monthlyLimit - aiUsage.monthlyUsed} / {aiUsage.monthlyLimit}회
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          한도 초과 시 기존 포트폴리오 열람·편집·내보내기는 계속 이용할 수 있습니다.
        </p>
      </div>

      {status === "idle" && (
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={limitReached || !hasMaterial}
          onClick={() => void startGeneration()}
        >
          {limitReached
            ? "오늘 AI 사용 한도를 초과했습니다"
            : !hasMaterial
              ? "생성할 자료가 없습니다"
              : "AI 초안 생성 요청"}
        </button>
      )}

      {status === "completed" && (
        <button
          className="btn-primary"
          onClick={() => navigate("/wizard/editor", { state: { draft } })}
        >
          편집기에서 열기
        </button>
      )}
    </div>
  );
}
