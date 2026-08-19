import { useState } from "react";
import { Link } from "react-router-dom";
import { socialAccounts as initial } from "../../mockData";

const impactNotes: Record<string, string[]> = {
  Google: [
    "이 계정은 현재 로그인 수단으로 사용 중입니다.",
    "해제 후에는 Google 계정으로 로그인할 수 없습니다.",
    "GitHub 또는 Figma 계정으로 계속 로그인할 수 있습니다.",
  ],
  GitHub: [
    "해제 후에는 GitHub 계정으로 로그인할 수 없습니다.",
    "연결된 GitHub 리포지토리 자료의 자동 수집이 중단됩니다.",
    "기존에 수집된 자료는 포트폴리오에 유지됩니다.",
  ],
  Figma: [
    "이 계정은 원본 자료 접근에 사용 중입니다.",
    "해제 후에는 Figma 계정으로 로그인할 수 없습니다.",
    "Figma에서 가져온 원본 자료에 대한 접근이 제한될 수 있습니다.",
    "이미 포트폴리오에 반영된 내용은 유지됩니다.",
  ],
};

export default function SocialAccountManage() {
  const [accounts, setAccounts] = useState(initial);
  const [target, setTarget] = useState<string | null>(null);

  const loginMethodCount = accounts.filter((a) => a.isLoginMethod).length;

  const disconnect = (provider: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.provider === provider ? { ...a, isLoginMethod: false } : a))
    );
    setTarget(null);
  };

  const targetAccount = accounts.find((a) => a.provider === target);

  return (
    <div className="max-w-xl space-y-6">
      <Link to="/settings" className="text-xs text-brand hover:underline">
        계정 설정으로
      </Link>
      <h1 className="text-xl font-heading">소셜 계정 관리</h1>

      <p className="note border-neutral-700 text-xs text-neutral-400">
        연결된 소셜 계정 중 하나 이상은 로그인 수단으로 유지되어야 합니다. 마지막
        남은 계정을 해제하려면 먼저 다른 로그인 수단을 추가해야 합니다.
      </p>

      <div className="entry">
        <h2 className="entry-title">연결된 소셜 계정</h2>
        {accounts.map((a) => (
          <div key={a.provider} className="row flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-neutral-100">{a.provider}</p>
              <p className="text-xs text-neutral-500">{a.identifier}</p>
              {a.isLoginMethod && (
                <p className="text-xs text-brand mt-0.5">로그인 수단으로 사용 중</p>
              )}
              {a.isSourceAccess && (
                <p className="text-xs text-neutral-500 mt-0.5">원본 자료 접근에 사용 중</p>
              )}
            </div>
            <button
              className="btn-secondary disabled:opacity-40"
              disabled={a.isLoginMethod && loginMethodCount <= 1}
              onClick={() => setTarget(a.provider)}
            >
              연결 해제
            </button>
          </div>
        ))}
      </div>

      <p className="note border-neutral-700 text-xs text-neutral-500 space-y-1">
        <span className="block font-medium text-neutral-300 mb-1">연결 해제 시 영향 안내</span>
        <span className="block">· 해제한 계정으로는 더 이상 Tellmefolio에 로그인할 수 없습니다.</span>
        <span className="block">· Figma 계정을 해제하면 해당 계정에서 가져온 원본 자료에 접근이 제한될 수 있습니다.</span>
        <span className="block">· GitHub 계정을 해제하면 연결된 리포지토리 자료의 수집이 중단됩니다.</span>
        <span className="block">· 소셜 서비스의 계정 자체는 삭제되지 않으며 해당 서비스에서 별도로 관리해야 합니다.</span>
      </p>

      {targetAccount && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">{targetAccount.provider} 계정 연결 해제</h2>
            <p className="text-xs text-neutral-400 mb-3">
              {targetAccount.provider} 계정({targetAccount.identifier})의 연결을
              해제합니다.
            </p>
            <p className="text-xs text-neutral-300 font-medium mb-1">해제 전 확인 사항</p>
            <ul className="text-xs text-neutral-500 space-y-1">
              {impactNotes[targetAccount.provider]?.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setTarget(null)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => disconnect(targetAccount.provider)}>
                연결 해제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
