import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 뒤로 가기 링크 (09-28). 전에는 화면마다 "← 홈", "내 서재로", "편집기로 돌아가기"
 * 같은 갈색 글자 한 줄이었습니다. 갈색 글자는 이 앱에서 "누르면 무언가 일어나는
 * 버튼"과 같은 색이라, 이동과 행동이 구분되지 않았습니다. 뒤로 가기는 회색 + 화살표로.
 */
export default function BackLink({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`link-back ${className}`}>
      <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </Link>
  );
}
