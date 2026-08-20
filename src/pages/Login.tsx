import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import SocialLoginButtons from "../components/SocialLoginButtons";

/**
 * [2026-08-20] 소셜 로그인 버튼에 각 사 브랜드 로고를 넣었습니다.
 *
 * 바뀐 것은 버튼 생김새뿐이고 로그인 흐름은 그대로입니다.
 *   - providers 배열 → BrandIcons.tsx 의 socialProviders 로 이동
 *     (라벨과 로고를 한곳에서 관리하려고 옮겼습니다)
 *   - 버튼 반복문 → <SocialLoginButtons /> 한 줄
 *   - handleLogin 은 손대지 않았습니다
 *
 * 로고 색 원칙은 BrandIcons.tsx 주석에 적어두었습니다.
 * 요약하면 로고만 각 사 공식 색이고, 테두리·배경·글자는 전부
 * index.css 의 테마 변수를 씁니다.
 */
export default function Login() {
  const navigate = useNavigate();

  // TODO: 실제 OAuth 연동. 지금은 목업으로 로그인 성공 시 내 서재로 이동합니다.
  const handleLogin = (_provider: string) => {
    navigate("/library");
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

        <SocialLoginButtons onSelect={handleLogin} />

        <p className="text-xs text-neutral-600 mt-8">
          계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  );
}
