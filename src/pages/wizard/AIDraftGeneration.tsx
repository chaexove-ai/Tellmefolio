import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AIRequestStatus from "../../components/AIRequestStatus";
import { aiUsage, type AIRequestStatus as Status } from "../../mockData";

const jobOptions = ["프론트엔드 개발자", "백엔드 개발자", "UX/UI 디자이너", "프로덕트 매니저"];

export default function AIDraftGeneration() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("idle");
  const [title, setTitle] = useState("");
  const [job, setJob] = useState(jobOptions[0]);
  const [structure, setStructure] = useState<"결과 중심형" | "문제-실행-결과형">("결과 중심형");
  const [extra, setExtra] = useState("");

  const limitReached = aiUsage.dailyUsed >= aiUsage.dailyLimit;

  const startGeneration = () => {
    setStatus("processing");
    // 실제 연동 시 백엔드 응답으로 대체. 데모용으로 1.2초 후 완료 처리.
    window.setTimeout(() => setStatus("completed"), 1200);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/wizard/source" className="text-xs text-brand hover:underline">
          원본 자료 수정
        </Link>
        <h1 className="text-xl font-heading mt-2">AI 포트폴리오 초안 생성</h1>
      </div>

      <div className="entry">
        <h2 className="entry-title">선택된 원본 자료</h2>
        <ul className="text-sm text-neutral-400 space-y-1">
          <li>GitHub — portfolio-2024</li>
          <li>PDF — 이력서_최종본.pdf</li>
          <li>메모 — 프로젝트 회고 노트</li>
        </ul>
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
        onRetry={startGeneration}
        onCancel={() => setStatus("idle")}
      />

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
          disabled={limitReached}
          onClick={startGeneration}
        >
          {limitReached ? "오늘 AI 사용 한도를 초과했습니다" : "AI 초안 생성 요청"}
        </button>
      )}

      {status === "completed" && (
        <button className="btn-primary" onClick={() => navigate("/wizard/editor")}>
          편집기에서 열기
        </button>
      )}
    </div>
  );
}
