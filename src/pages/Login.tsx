import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SocialLoginButtons, { readLastProvider, rememberProvider } from "../components/SocialLoginButtons";
import ShelfIllustration from "../components/ShelfIllustration";
import { useAuth } from "../auth/AuthProvider";
import type { SocialProviderId } from "../components/BrandIcons";
import Logo from "../components/Logo";

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
  // [2026-09-29] 지난번에 고른 계정 — "최근 사용" 표시. 다른 계정으로 새로 가입하는 실수를 막습니다.
  const [lastUsed] = useState(readLastProvider);

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
    rememberProvider(provider);

    try {
      await signIn(provider);
      // 성공하면 브라우저가 공급자 화면으로 이동하므로 여기 아래는 실행되지 않습니다.
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    /* [2026-09-29] 좌우 분할을 걷고 한 단으로 합쳤습니다.

       분할 화면은 왼쪽 면이 "바라보는 면"이라 읽을 것도 누를 것도 없는데
       화면 절반을 차지했습니다. 로그인에서 할 일은 하나라 한 줄로 흐르게
       합니다: 책장(이 서비스의 얼굴) → 제목 → 한 줄 설명 → 계정 버튼 → 안내.

       예전에 "가운데 뜬 카드는 큰 화면에서 작아 보인다"는 이유로 분할로
       갔었습니다. 그래서 카드(테두리 상자)로 가두지 않고, 제목을 크게,
       버튼을 넉넉하게, 위에 책장 그림을 두어 한 단 자체에 무게를 줍니다. */
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Logo to="/" size="sm" className="text-neutral-100 hover:opacity-80" />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[460px] text-center">
          <div className="mb-8 [zoom:0.5] sm:mb-10 sm:[zoom:0.62]" aria-hidden="true">
            <ShelfIllustration centered />
          </div>

          <h1 className="font-heading text-[28px] leading-[1.3] lg:text-[36px] break-keep">
            이야기하면
            <br />
            포트폴리오가 됩니다
          </h1>
          <p className="mt-4 text-sm lg:text-[15px] text-neutral-500 leading-relaxed break-keep">
            프로젝트 이야기와 자료를 넣으면 케이스 스터디로 정리해 드려요.{" "}
            <br className="hidden sm:block" />
            처음이면 가입, 다음부터는 로그인이에요.
          </p>

          <div className="mt-10 text-left">
            <SocialLoginButtons onSelect={handleLogin} busy={busy} lastUsed={lastUsed} />
          </div>

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

          {/* 연동이 이 서비스의 핵심이라 무엇을 가져오는지 버튼 바로 아래에서 밝힙니다 */}
          <p className="mt-6 text-xs text-neutral-500 leading-relaxed break-keep">
            GitHub로 들어오면 공개 저장소를, Figma로 들어오면 파일을 바로 불러올 수 있어요.{" "}
            <br className="hidden sm:block" />
            비공개 코드에 접근하는 권한은 요청하지 않아요.
          </p>
        </div>
      </main>

      <footer className="px-6 pb-8 text-center text-xs text-neutral-600 leading-relaxed">
        계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
      </footer>
    </div>
  );
}
