import { Info, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { AIRequestStatus as Status } from "../mockData";

interface Props {
  status: Status;
  processingLabel?: string;
  completedLabel?: string;
  failedReason?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * 명세서 1.2.2 "공통 AI 요청 상태·사용량 확인 및 재시도"를 구현하는 공용 컴포넌트.
 * 포트폴리오 초안 생성, 문장 다듬기, 스타일 추천, 직무 전환 재구성 등
 * 모든 AI 요청 화면에서 동일하게 사용합니다.
 */
export default function AIRequestStatus({
  status,
  processingLabel = "요청을 처리하고 있습니다...",
  completedLabel = "요청이 완료되었습니다.",
  failedReason = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  onRetry,
  onCancel,
}: Props) {
  if (status === "idle" || status === "pending") {
    return (
      <div className="note border-neutral-700">
        <Info size={16} className="text-neutral-500 shrink-0 mt-0.5" />
        <p className="text-sm text-neutral-400">원본 자료를 선택하면 요청을 시작할 수 있습니다.</p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="note border-brand items-center justify-between">
        <div className="flex items-start gap-3">
          <Loader2 size={16} className="text-brand shrink-0 mt-0.5 animate-spin" />
          <div>
            <p className="text-sm font-medium text-neutral-100">처리 중</p>
            <p className="text-xs text-neutral-400 mt-1">{processingLabel}</p>
          </div>
        </div>
        {onCancel && (
          <button className="btn-secondary shrink-0" onClick={onCancel}>
            요청 취소
          </button>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="note border-red-500">
        <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-400">실패</p>
          <p className="text-xs text-neutral-400 mt-1">{failedReason}</p>
          <div className="mt-3 flex gap-2">
            {onRetry && (
              <button className="btn-primary" onClick={onRetry}>
                재시도
              </button>
            )}
            {onCancel && (
              <button className="btn-secondary" onClick={onCancel}>
                취소
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="note border-emerald-500">
      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-emerald-400">완료</p>
        <p className="text-xs text-neutral-400 mt-1">{completedLabel}</p>
      </div>
    </div>
  );
}
