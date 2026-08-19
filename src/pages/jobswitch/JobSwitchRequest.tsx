import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AIRequestStatus from "../../components/AIRequestStatus";
import { portfolios, aiUsage, type AIRequestStatus as Status } from "../../mockData";

/**
 * [와이어프레임 리뷰 반영]
 * 기존 와이어프레임에는 대시보드용 "직무 전환 재구성"(퀵 액션형)과
 * "재구성 요청 화면"(상세 폼형)이 내용이 겹치는 채로 각각 설계돼 있었습니다.
 * 하나의 화면으로 통합하고, 구성 방식 선택은 AI 요청을 보내기 전(재구성
 * 요청 단계)에 하도록 순서를 맞췄습니다.
 */
export default function JobSwitchRequest() {
  const navigate = useNavigate();
  const [sourcePortfolio, setSourcePortfolio] = useState(portfolios[0].id);
  const [targetJob, setTargetJob] = useState("");
  const [jobPostingUrl, setJobPostingUrl] = useState("");
  const [jobPostingText, setJobPostingText] = useState("");
  const [structure, setStructure] = useState<"결과 중심형" | "문제-실행-결과형">("결과 중심형");
  const [status, setStatus] = useState<Status>("idle");

  const limitReached = aiUsage.dailyUsed >= aiUsage.dailyLimit;
  const canSubmit = targetJob.trim() && (jobPostingUrl.trim() || jobPostingText.trim());

  const submit = () => {
    setStatus("processing");
    window.setTimeout(() => setStatus("completed"), 1200);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-heading">직무 전환 재구성</h1>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">기본 정보</h2>
        <div>
          <label className="text-xs text-neutral-500">재구성할 포트폴리오 선택</label>
          <select
            value={sourcePortfolio}
            onChange={(e) => setSourcePortfolio(e.target.value)}
            className="field mt-1"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id} className="bg-neutral-900">
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">목표 직무</label>
          <input
            value={targetJob}
            onChange={(e) => setTargetJob(e.target.value)}
            placeholder="예: 프로덕트 매니저"
            className="field mt-1"
          />
        </div>
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">채용 공고 입력</h2>
        <p className="text-xs text-neutral-400">
          URL 또는 공고 내용을 입력하면 AI가 요구 역량과 우대 사항을 분석합니다.
        </p>
        <input
          value={jobPostingUrl}
          onChange={(e) => setJobPostingUrl(e.target.value)}
          placeholder="채용 공고 URL"
          className="field"
        />
        <p className="text-center text-xs text-neutral-600">또는</p>
        <textarea
          value={jobPostingText}
          onChange={(e) => setJobPostingText(e.target.value)}
          placeholder="공고 내용 직접 붙여넣기"
          rows={3}
          className="field-area"
        />
        <p className="text-xs text-neutral-600">
          로그인이 필요한 공고 링크는 지원하지 않습니다. 해당 공고의 내용을 직접
          붙여넣어 주세요.
        </p>
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">포트폴리오 구성 방식 선택</h2>
        <p className="text-xs text-neutral-400">
          AI가 분석한 공고 기준에 따라 적합한 구성 방식을 추천합니다. 원하는 방식을
          선택하거나 조정할 수 있습니다.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => setStructure("결과 중심형")}
            className={`w-full text-left rounded-sm border p-3 text-sm ${
              structure === "결과 중심형"
                ? "border-brand bg-brand/10"
                : "border-neutral-800 text-neutral-400"
            }`}
          >
            <p className="font-medium text-neutral-100">결과 중심형</p>
            성과 수치와 기여 범위를 앞부분에 배치해 채용 담당자가 핵심을 빠르게
            파악하도록 구성합니다.
          </button>
          <button
            onClick={() => setStructure("문제-실행-결과형")}
            className={`w-full text-left rounded-sm border p-3 text-sm ${
              structure === "문제-실행-결과형"
                ? "border-brand bg-brand/10"
                : "border-neutral-800 text-neutral-400"
            }`}
          >
            <p className="font-medium text-neutral-100">문제-실행-결과형</p>
            문제 정의 → 실행 과정 → 결과 순으로 서술해 사고 과정과 역량을 명확히
            전달합니다.
          </button>
        </div>
      </div>

      <p className="note border-neutral-700 text-xs text-neutral-500 space-y-1">
        <span className="block font-medium text-neutral-300 mb-1">재구성 기준 안내</span>
        <span className="block">입력한 채용 공고의 직무, 요구 역량, 우대 사항, 기대 성과를 분석합니다.</span>
        <span className="block">기존 포트폴리오 경험을 목표 직무 관점으로 재해석해 새 초안을 생성합니다.</span>
        <span className="block">원본 포트폴리오는 변경되지 않으며, 결과는 독립된 새 포트폴리오로 저장됩니다.</span>
      </p>

      {status === "idle" && (
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canSubmit || limitReached}
          onClick={submit}
        >
          {limitReached ? "오늘 AI 사용 한도를 초과했습니다" : "재구성 요청하기"}
        </button>
      )}

      <AIRequestStatus
        status={status}
        processingLabel={`${targetJob || "목표 직무"} 방향 재구성 분석 중…`}
        completedLabel="재구성 초안이 준비되었습니다."
        failedReason="채용 공고 링크를 읽어오지 못했습니다. 공고 내용을 직접 붙여넣어 재시도해 주세요."
        onRetry={submit}
        onCancel={() => setStatus("idle")}
      />

      {status === "completed" && (
        <button className="btn-primary" onClick={() => navigate("/job-switch/result")}>
          결과 확인
        </button>
      )}

      <div className="entry">
        <h2 className="entry-title">AI 사용량 안내</h2>
        <p className="text-sm text-neutral-200">
          오늘 남은 요청 {aiUsage.dailyLimit - aiUsage.dailyUsed} / {aiUsage.dailyLimit}
        </p>
        <p className="text-sm text-neutral-200">
          월 사용량 {aiUsage.monthlyUsed} / {aiUsage.monthlyLimit}
        </p>
        <p className="text-xs text-neutral-600 mt-2">
          한도 초과 시 기존 포트폴리오 열람, 직접 편집, 내보내기는 계속 이용할 수
          있습니다.
        </p>
      </div>

      <div className="text-xs text-neutral-500">
        구성 방식: <span className="text-neutral-300">{structure}</span>
      </div>
    </div>
  );
}
