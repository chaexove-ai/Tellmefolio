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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 relative">
      <div className="absolute top-6 right-6">
        {/* 다크 테마를 감추면서 토글을 내렸습니다 — index.html 주석 참고 */}
      </div>
      {/* [2026-09] 카드를 크게 키웠습니다.
          다만 폭만 늘리면 버튼 세 개가 가로로 길쭉해져서 오히려 이상해집니다
          — 누르는 면적은 커지는데 시선이 갈 곳은 그대로라 빈 띠 세 개로
          보입니다. 그래서 큰 화면에서는 좌우 2단으로 나눠, 왼쪽이 브랜드와
          한 줄 설명을 맡고 오른쪽이 버튼을 맡습니다. 넓이가 내용으로 채워집니다.
          lg 미만에서는 예전처럼 한 단으로 쌓입니다 — 로그인은 데스크탑 전용
          게이트 바깥이라 휴대폰에서도 열립니다. */}
      <div className="w-full max-w-sm lg:max-w-4xl rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 lg:p-0 lg:grid lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
        <div className="lg:flex lg:flex-col lg:justify-between lg:p-12 lg:border-r lg:border-neutral-800">
          <div>
            <p className="text-xs tracking-[0.2em] text-brand uppercase mb-4">Tellmefolio</p>
            <h1 className="text-xl lg:text-[32px] font-heading leading-snug mb-2 lg:mb-3">
              로그인하기
            </h1>
            <p className="text-sm lg:text-base text-neutral-500 mb-8 lg:mb-0 lg:leading-relaxed">
              이야기하면 포트폴리오가 됩니다.
              <br className="hidden lg:block" />
              <span className="lg:hidden"> </span>
              GitHub 저장소와 메모를 케이스 스터디로 바꿉니다.
            </p>
          </div>

          <p className="hidden lg:block text-xs text-neutral-600 leading-relaxed">
            공개 저장소만 읽습니다. 비공개 코드에 접근하는 권한은 요청하지
            않습니다.
          </p>
        </div>

        <div className="lg:flex lg:flex-col lg:justify-center lg:p-12">
          <p className="hidden lg:block text-sm text-neutral-500 mb-5">
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

          <p className="text-xs text-neutral-600 mt-8 leading-relaxed">
            계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
          </p>
        </div>
      </div>
    </div>
  );
}
