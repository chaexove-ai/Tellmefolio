import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
    /* [2026-09] 가운데 뜬 카드에서 전체 화면 분할로 바꿨습니다.
       카드를 384 → 448 → 896px 로 키워 봤지만, 큰 화면에서는 무엇이든
       가운데 떠 있으면 작아 보입니다. 화면을 반으로 나눠 한쪽을 면으로
       채우면 크기 문제 자체가 없어집니다.

       왼쪽 면은 랜딩의 반전 구역과 같은 .surface-invert 입니다 — 로그인
       화면만 다른 색을 쓰면 다른 사이트로 넘어온 것처럼 보입니다.

       lg 미만에서는 위아래로 쌓입니다. 로그인은 데스크탑 전용 게이트
       바깥이라 휴대폰에서도 열립니다. */
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="surface-invert flex flex-col justify-between px-8 py-12 lg:px-16 lg:py-20">
        <div>
          <p className="text-xs tracking-[0.2em] text-brand uppercase mb-6 lg:mb-10">
            Tellmefolio
          </p>
          <h1 className="font-heading text-2xl lg:text-[44px] leading-snug lg:leading-[1.3]">
            이야기하면
            <br />
            포트폴리오가 됩니다
          </h1>
          <p className="mt-4 lg:mt-7 text-sm lg:text-base text-neutral-400 leading-relaxed max-w-[42ch]">
            GitHub 저장소와 메모를 맥락 · 문제 · 실행 · 성과 · 회고의 케이스
            스터디로 바꿉니다.
          </p>
        </div>

        <p className="hidden lg:block text-xs text-neutral-600 leading-relaxed max-w-[44ch]">
          공개 저장소만 읽습니다. 비공개 코드에 접근하는 권한은 요청하지
          않습니다.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-14 lg:px-16">
        <div className="w-full max-w-sm">
          <h2 className="font-heading text-xl lg:text-2xl mb-1.5">로그인하기</h2>
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

          <p className="text-xs text-neutral-600 mt-10 leading-relaxed">
            계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
          </p>
        </div>
      </div>
    </div>
  );
}
