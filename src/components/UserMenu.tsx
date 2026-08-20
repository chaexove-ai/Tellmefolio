import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

/**
 * 사이드바 하단의 계정 블록.
 *
 * 로그인은 되는데 지금 누구로 들어와 있는지, 어떻게 나가는지가 화면에
 * 없었습니다. 로그아웃 방법이 안 보이면 사용자는 브라우저 탭을 닫는 것으로
 * 대신하는데, 공용 컴퓨터에서는 세션이 그대로 남습니다.
 *
 * 드롭다운 대신 펼쳐진 형태로 뒀습니다. 항목이 로그아웃 하나뿐이라
 * 한 번 더 누르게 만들 이유가 없습니다. 설정은 이미 왼쪽 메뉴에 있습니다.
 *
 * 세션이 없으면 아무것도 그리지 않습니다. Supabase 설정 전 둘러보기
 * 상태에서 빈 껍데기가 보이는 것을 막습니다.
 */
export default function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  const meta = session.user.user_metadata ?? {};
  const name =
    (meta.user_name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    session.user.email ??
    "사용자";
  const avatar = meta.avatar_url as string | undefined;

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      onNavigate?.();
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      {avatar ? (
        <img
          src={avatar}
          alt=""
          width={24}
          height={24}
          className="w-6 h-6 rounded-full shrink-0"
        />
      ) : (
        <span className="w-6 h-6 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
          <User size={13} strokeWidth={1.5} className="text-neutral-400" />
        </span>
      )}

      <span className="text-sm text-neutral-300 truncate flex-1" title={name}>
        {name}
      </span>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={busy}
        aria-label="로그아웃"
        title="로그아웃"
        className="text-neutral-500 hover:text-neutral-200 p-1 -mr-1 shrink-0 disabled:opacity-50"
      >
        <LogOut size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
