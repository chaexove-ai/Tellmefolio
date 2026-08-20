import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { setGitHubToken } from "../lib/github";
import type { SocialProviderId } from "../components/BrandIcons";

/**
 * 로그인 상태를 앱 전체에 하나로 유지합니다.
 *
 * [loading 을 따로 둔 이유]
 * 새로고침 직후에는 세션이 아직 없습니다. 저장된 토큰을 읽어오는 동안
 * 잠깐 "로그인 안 됨" 상태가 되는데, 이때 보호 라우트가 바로 판단해버리면
 * 로그인한 사용자가 새로고침할 때마다 로그인 화면으로 튕깁니다.
 * 확인이 끝날 때까지 loading 으로 붙잡아 둡니다.
 *
 * [환경변수가 없을 때]
 * supabase 가 null 이면 로그인 없이 통과시킵니다. 설정 전에도 화면을
 * 둘러볼 수 있게 하려는 것이고, 실제 배포에서는 환경변수를 넣어야 합니다.
 */
interface AuthValue {
  session: Session | null;
  loading: boolean;
  /** OAuth 공급자로 로그인을 시작합니다. 성공하면 브라우저가 이동합니다. */
  signIn: (provider: SocialProviderId) => Promise<void>;
  signOut: () => Promise<void>;
  /** Supabase 설정이 없는 상태인지 — 화면에서 안내를 띄울 때 씁니다. */
  configured: boolean;
  /** GitHub 으로 로그인한 경우의 계정 이름. 그 외에는 null. */
  githubLogin: string | null;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * GitHub 공급자 토큰을 꺼내 메모리에 넘깁니다.
 *
 * 이 값은 로그인 직후 한 번만 들어 있고, 새로고침하면 사라집니다. Supabase
 * 가 공급자 토큰을 세션에 보관하지 않기 때문입니다. 없으면 GitHub 호출이
 * 권한 없는 요청으로 넘어가므로 기능이 멈추지는 않고 한도만 낮아집니다.
 */
function captureProviderToken(session: Session | null) {
  const provider = session?.user?.app_metadata?.provider;
  if (provider !== "github") return;
  if (session?.provider_token) setGitHubToken(session.provider_token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let alive = true;
    let unsubscribe: (() => void) | undefined;

    getSupabase().then(async (sb) => {
      if (!sb || !alive) return;

      const { data } = await sb.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      captureProviderToken(data.session);
      setLoading(false);

      // 로그인, 로그아웃, 토큰 갱신을 모두 여기서 받습니다.
      const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        captureProviderToken(next);
        setLoading(false);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = async (provider: SocialProviderId) => {
    const sb = await getSupabase();
    if (!sb) return;

    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        // 로그인이 끝나면 돌아올 주소. 로컬과 배포 양쪽에서 그대로 동작하도록
        // 고정 문자열 대신 현재 origin 을 씁니다.
        // Supabase 대시보드의 Redirect URLs 에 두 주소를 모두 등록해야 합니다.
        redirectTo: `${window.location.origin}/library`,
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    setGitHubToken(null);
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
  };

  const githubLogin =
    session?.user?.app_metadata?.provider === "github"
      ? ((session.user.user_metadata?.user_name as string | undefined) ?? null)
      : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signIn,
        signOut,
        configured: isSupabaseConfigured,
        githubLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
