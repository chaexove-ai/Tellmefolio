import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { useAuth } from "../../auth/AuthProvider";
import { getSupabase } from "../../lib/supabase";
import { socialProviders } from "../../components/BrandIcons";
import type { SocialProviderId } from "../../components/BrandIcons";

/**
 * [2026-09-23] 목업을 걷어내고 실제 연결 상태를 읽습니다.
 *
 * 그전까지 이 화면은 mockData.socialAccounts 를 그렸습니다 —
 * hong@gmail.com, hong-dev, hong@figma.com. 존재하지 않는 계정 셋이
 * 누구에게나 똑같이 떴고, "연결 해제"를 누르면 로컬 플래그만 바뀌어서
 * 실제로는 아무것도 해제되지 않는데 해제된 것처럼 보였습니다.
 *
 * 다른 목업 화면들과 성격이 다릅니다. 여기는 사용자가 "이 계정 연결을
 * 끊어야지" 하고 일부러 찾아오는 자리라, 틀린 정보가 곧바로 잘못된
 * 안심으로 이어집니다. 데이터 관리 화면의 죽은 버튼과 같은 종류입니다.
 *
 * [연결 정보는 어디서 오는가]
 * 세션의 user.identities 입니다. Supabase 가 실제로 붙어 있는 공급자를
 * 거기에 담아줍니다. 해제는 auth.unlinkIdentity, 추가는 auth.linkIdentity
 * 입니다 — 둘 다 서버가 처리하므로 화면 상태만 바꾸는 일이 없습니다.
 *
 * [마지막 하나는 해제할 수 없습니다]
 * Supabase 자체가 거부합니다. 막지 않으면 로그인할 방법이 없는 계정이
 * 되기 때문입니다. 그래서 버튼을 비활성화하고 이유를 옆에 적습니다 —
 * 눌러서 에러를 보고 알게 하는 것보다 낫습니다.
 *
 * [Figma 는 어디 갔나]
 * 목업에는 있었지만 실제로 붙은 적이 없습니다. 연결된 것만 보여주므로
 * 로그인 수단으로 쓰지 않는 공급자는 아래 "추가" 쪽에만 나옵니다.
 */

const LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  figma: "Figma",
  email: "이메일",
};

const ICON: Partial<Record<string, (typeof socialProviders)[number]["Icon"]>> =
  Object.fromEntries(socialProviders.map((p) => [p.id, p.Icon]));

/** identity_data 는 공급자마다 칸 이름이 다릅니다. 보여줄 만한 것을 고릅니다. */
function identifierOf(identity: UserIdentity): string {
  const d = (identity.identity_data ?? {}) as Record<string, unknown>;
  const pick = (k: string) => {
    const v = d[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return (
    pick("email") ??
    pick("user_name") ??
    pick("preferred_username") ??
    pick("full_name") ??
    pick("name") ??
    "확인할 수 없음"
  );
}

export default function SocialAccountManage() {
  const { session, configured, signIn } = useAuth();
  const user = session?.user ?? null;

  const identities = useMemo<UserIdentity[]>(
    () => (user?.identities ?? []) as UserIdentity[],
    [user]
  );

  // 실제로 로그인에 쓴 공급자. 여러 개가 붙어 있어도 이번 세션을 만든 건
  // 하나뿐이라, 그걸 표시해두면 "지금 쓰는 게 뭔지"가 분명해집니다.
  const currentProvider = (user?.app_metadata?.provider as string | undefined) ?? null;

  const [target, setTarget] = useState<UserIdentity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectedIds = new Set(identities.map((i) => i.provider));
  const addable = socialProviders.filter((p) => !connectedIds.has(p.id));

  const unlink = async (identity: UserIdentity) => {
    setBusy(identity.provider);
    setError(null);
    setNotice(null);
    try {
      const sb = await getSupabase();
      if (!sb) throw new Error("서버 연결이 설정되지 않았습니다.");

      const { error: unlinkError } = await sb.auth.unlinkIdentity(identity);
      if (unlinkError) throw unlinkError;

      // 세션 안의 identities 는 갱신하기 전까지 옛 목록입니다. 새로
      // 받아오면 AuthProvider 의 onAuthStateChange 가 화면을 바꿉니다.
      await sb.auth.refreshSession();
      setNotice(`${LABEL[identity.provider] ?? identity.provider} 계정 연결을 해제했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결을 해제하지 못했습니다.");
    } finally {
      setBusy(null);
      setTarget(null);
    }
  };

  const link = async (provider: SocialProviderId) => {
    setBusy(provider);
    setError(null);
    setNotice(null);
    try {
      const sb = await getSupabase();
      if (!sb) throw new Error("서버 연결이 설정되지 않았습니다.");

      const { error: linkError } = await sb.auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/settings/social` },
      });
      // 성공하면 브라우저가 공급자 화면으로 떠납니다. 여기로 돌아오지 않습니다.
      if (linkError) throw linkError;
    } catch (e) {
      // Supabase 프로젝트에서 "Manual linking" 이 꺼져 있으면 여기로 옵니다.
      // 서버가 준 문구를 그대로 보여줍니다 — 우리가 지어내면 원인을 못 찾습니다.
      setError(e instanceof Error ? e.message : "계정을 연결하지 못했습니다.");
      setBusy(null);
    }
  };

  const reconnectGitHub = async () => {
    setBusy("reconnect");
    setError(null);
    try {
      await signIn("github");
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 연결하지 못했습니다.");
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/settings" className="text-xs text-brand hover:underline">
        계정 설정으로
      </Link>
      <h1 className="text-xl font-heading">소셜 계정 관리</h1>

      {!configured && (
        <p className="note border-neutral-700 text-sm text-neutral-400">
          <span>Supabase 설정이 없어 연결 상태를 확인할 수 없습니다.</span>
        </p>
      )}

      {notice && (
        <p className="entry py-3 text-sm text-neutral-200 border-l-2 border-l-brand">{notice}</p>
      )}
      {error && (
        <p role="alert" className="entry py-3 text-sm text-red-400 border-l-2 border-l-red-600">
          {error}
        </p>
      )}

      {configured && (
        <div className="entry">
          <h2 className="entry-title">연결된 소셜 계정</h2>

          {identities.length === 0 ? (
            <p className="text-sm text-neutral-500">연결된 계정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {identities.map((identity) => {
                const Icon = ICON[identity.provider];
                const last = identities.length <= 1;
                return (
                  <li
                    key={identity.identity_id ?? identity.provider}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {Icon && (
                        <span className="shrink-0" aria-hidden="true">
                          <Icon />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-100">
                          {LABEL[identity.provider] ?? identity.provider}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {identifierOf(identity)}
                        </p>
                        {currentProvider === identity.provider && (
                          <p className="text-xs text-brand mt-0.5">지금 로그인에 쓰고 있습니다</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* 왜 못 누르는지를 버튼 옆에 적습니다. 비활성 버튼만
                          두면 고장인지 제한인지 구분이 안 됩니다. */}
                      {last && (
                        <span className="text-xs text-neutral-600 hidden sm:inline">
                          하나뿐이라 해제할 수 없습니다
                        </span>
                      )}
                      <button
                        className="btn-secondary disabled:opacity-40"
                        disabled={last || busy !== null}
                        onClick={() => setTarget(identity)}
                      >
                        {busy === identity.provider ? "해제 중…" : "연결 해제"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {configured && addable.length > 0 && (
        <div className="entry">
          <h2 className="entry-title">로그인 수단 추가</h2>
          <p className="text-xs text-neutral-500 mb-3">
            하나 더 연결해두면, 쓰던 계정을 잃어도 로그인할 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {addable.map((p) => (
              <button
                key={p.id}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40"
                disabled={busy !== null}
                onClick={() => void link(p.id)}
              >
                {busy === p.id ? (
                  <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <p.Icon />
                )}
                {LABEL[p.id] ?? p.id} 연결
              </button>
            ))}
          </div>
        </div>
      )}

      {/* [2026-09-23] 계정 설정에 따로 있던 "GitHub 다시 연결" 줄을 여기로
          옮겼습니다. 거기서는 이 화면으로 보내기만 했는데, 정작 이 화면에
          다시 연결하는 방법이 없었습니다 — 링크가 약속한 일이 도착지에
          없었던 셈입니다. */}
      {configured && connectedIds.has("github") && (
        <div className="entry">
          <h2 className="entry-title">GitHub 다시 연결</h2>
          <p className="text-xs text-neutral-500 mb-3 max-w-[62ch] leading-relaxed">
            저장소 목록이 비어 보이면 여기서 다시 연결하세요. 로그인 상태와
            별개로, 저장소를 읽는 권한은 새로고침하면 사라집니다. 연결이
            끊기는 것이 아니라 권한만 다시 받는 것입니다.
          </p>
          <button
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40"
            disabled={busy !== null}
            onClick={() => void reconnectGitHub()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {busy === "reconnect" ? "이동 중…" : "GitHub 권한 다시 받기"}
          </button>
        </div>
      )}

      {/* .note 는 아이콘 + 본문 두 칸을 가로로 놓는 상자입니다(index.css).
          전에는 안내 다섯 줄을 그 안에 그대로 넣어서, 다섯 줄이 각각
          가로 칸이 되어 글자가 세로로 눌린 채 늘어서 있었습니다.
          한 덩어리로 감싸 한 칸만 쓰게 합니다. */}
      <div className="note border-neutral-700">
        <div className="text-xs text-neutral-500 space-y-1">
          <p className="font-medium text-neutral-300 mb-1.5">연결 해제 시 영향 안내</p>
          <p>· 해제한 계정으로는 더 이상 Tellmefolio에 로그인할 수 없습니다.</p>
          <p>· GitHub 계정을 해제하면 연결된 저장소 자료를 더 이상 읽지 못합니다.</p>
          <p>· 이미 포트폴리오에 담긴 내용은 그대로 남습니다.</p>
          <p>· 소셜 서비스의 계정 자체는 삭제되지 않습니다. 그쪽에서 따로 관리하세요.</p>
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">
              {LABEL[target.provider] ?? target.provider} 계정 연결 해제
            </h2>
            <p className="text-xs text-neutral-400 mb-3">
              {LABEL[target.provider] ?? target.provider} 계정({identifierOf(target)})의 연결을
              해제합니다.
            </p>
            <p className="text-xs text-neutral-300 font-medium mb-1">해제 전 확인 사항</p>
            <ul className="text-xs text-neutral-500 space-y-1">
              <li>· 이 계정으로는 더 이상 로그인할 수 없습니다.</li>
              {currentProvider === target.provider && (
                <li>· 지금 로그인에 쓰고 있는 계정입니다.</li>
              )}
              {target.provider === "github" && (
                <li>· 저장소 자료를 더 이상 읽지 못합니다. 이미 담긴 내용은 남습니다.</li>
              )}
              <li>· {LABEL[target.provider] ?? target.provider} 계정 자체는 삭제되지 않습니다.</li>
            </ul>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn-secondary"
                onClick={() => setTarget(null)}
                disabled={busy !== null}
              >
                취소
              </button>
              <button
                className="rounded-sm border border-red-600 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40"
                onClick={() => void unlink(target)}
                disabled={busy !== null}
              >
                {busy !== null ? "해제 중…" : "연결 해제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
