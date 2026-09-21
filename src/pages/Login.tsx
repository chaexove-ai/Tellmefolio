import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import SocialLoginButtons from "../components/SocialLoginButtons";
import { useAuth } from "../auth/AuthProvider";
import type { SocialProviderId } from "../components/BrandIcons";

/**
 * [2026-08-20] 목업이던 로그인을 Supabase OAuth 로 바꿨습니다.
 *
 * 버튼을 누르면 브라우저가 공급자 화면으로 넘어갔다가 /library 로
 * 돌아옵니다. 돌아오는 주소는 AuthProvider 에서 origin 기준으로 만듭니다.
 *
 * 환경변수가 없으면 예전처럼 목업으로 넘어갑니다. 설정 전에도 화면
 * 흐름을 확인할 수 있게 남겨둔 것이고, 그 상태에서는 안내 문구가 뜹니다.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, session, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인한 사람이 /login 에 오면 되돌려 보냅니다.
  useEffect(() => {
    if (!session) return;
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? "/library", { replace: true });
  }, [session, location.state, navigate]);

  const handleLogin = async (provider: SocialProviderId) => {
    if (!configured) {
      navigate("/library");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await signIn(provider);
      // 성공하면 브라우저가 공급자 화면으로 이동하므로 여기 아래는 실행되지 않습니다.
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm border border-neutral-800 p-8">
        <p className="text-xs tracking-[0.2em] text-brand uppercase mb-4">Tellmefolio</p>
        <h1 className="text-xl font-heading mb-1">로그인하기</h1>
        <p className="text-sm text-neutral-500 mb-8">
          Google, GitHub, Figma 계정으로 시작하세요
        </p>

        <SocialLoginButtons onSelect={handleLogin} busy={busy} />

        {error && (
          <p role="alert" className="text-xs text-brand mt-4">
            {error}
          </p>
        )}

        {!configured && (
          <p className="text-xs text-neutral-600 mt-4">
            연동 준비 중입니다. 지금은 어느 버튼을 눌러도 둘러보기로 넘어갑니다.
          </p>
        )}

        <p className="text-xs text-neutral-600 mt-8">
          계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  );
}
