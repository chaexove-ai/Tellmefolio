/** "n분 전" 같은 상대 시간 문구. StylePanel·PortfolioEditor 저장 표시가 같이 씁니다. */
export function formatRelativeTime(ms: number | null): string {
  if (ms === null) return "아직 저장하지 않음";
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.round(diffHour / 24)}일 전`;
}
