import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const providers = [
  { id: "google", label: "Google로 로그인" },
  { id: "github", label: "GitHub로 로그인" },
  { id: "figma", label: "Figma로 로그인" },
];

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
        <div className="space-y-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLogin(p.id)}
              className="btn-secondary w-full"
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-600 mt-8">
          계속 진행하면 Tellmefolio 이용약관과 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  );
}
