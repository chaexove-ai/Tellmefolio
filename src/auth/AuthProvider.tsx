import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
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
}

const AuthContext = createContext<AuthValue | null>(null);

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
      setLoading(false);

      // 로그인, 로그아웃, 토큰 갱신을 모두 여기서 받습니다.
      const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
        setSession(next);
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
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, signIn, signOut, configured: isSupabaseConfigured }}
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
