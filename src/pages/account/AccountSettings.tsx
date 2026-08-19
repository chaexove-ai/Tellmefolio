import { Link } from "react-router-dom";
import { socialAccounts } from "../../mockData";

export default function AccountSettings() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-heading">계정 설정</h1>

      <div className="entry">
        <h2 className="entry-title">계정 보안 및 연결 상태</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-300">로그인 수단</span>
          <span className="text-neutral-500">소셜 계정 {socialAccounts.length}개 연결됨</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-neutral-300">연결된 서비스</span>
          <span className="text-neutral-500">
            {socialAccounts.map((a) => a.provider).join(", ")}
          </span>
        </div>
      </div>

      <div className="entry flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-100">소셜 계정 연결 관리</p>
          <p className="text-xs text-neutral-500 mt-1">
            Google, GitHub, Figma 계정의 연결 상태를 확인하고 해제할 수 있습니다.
          </p>
        </div>
        <Link to="/settings/social" className="btn-secondary shrink-0">
          관리
        </Link>
      </div>

      <div className="entry flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-100">개인 데이터 및 계정 삭제</p>
          <p className="text-xs text-neutral-500 mt-1">
            내 데이터를 내려받거나 특정 포트폴리오 또는 계정 전체를 삭제할 수
            있습니다.
          </p>
        </div>
        <Link to="/settings/data" className="btn-secondary shrink-0">
          관리
        </Link>
      </div>
    </div>
  );
}
