import { aiUsage } from "../mockData";

/**
 * 공통 AI 요청 상태·사용량 정책(명세서 1.2.2)에 따라
 * 모든 화면 상단에서 잔여 사용량을 확인할 수 있게 하는 배지.
 */
export default function AIUsageBadge() {
  const nearLimit = aiUsage.dailyUsed >= aiUsage.dailyLimit;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`badge ${
          nearLimit ? "bg-red-500/15 text-red-400" : "bg-brand/15 text-brand"
        }`}
        title="오늘 남은 AI 요청 / 일일 한도"
      >
        AI {aiUsage.dailyLimit - aiUsage.dailyUsed} / {aiUsage.dailyLimit}회
      </span>
      <span className="badge bg-neutral-800 text-neutral-300">{aiUsage.plan}</span>
    </div>
  );
}
