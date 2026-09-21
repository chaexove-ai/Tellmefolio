import { Link } from "react-router-dom";
import { Link2, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

/**
 * [2026-09] 연결 상태를 실제 세션에서 읽습니다.
 *
 * 전에는 mockData.socialAccounts(hong@gmail.com / hong-dev …)를 그대로
 * 그려서, 누가 로그인하든 "Google, GitHub, Figma 3개 연결됨"이 떴습니다.
 * 다른 목업과 성격이 다릅니다 — 이건 본인의 보안 상태를 잘못 알려주는
 * 화면이라, 사용자가 "연결을 끊어야지" 하고 들어올 수 있는 자리입니다.
 *
 * Supabase 는 세션의 user.identities 에 실제로 연결된 공급자를 담아
 * 줍니다. 그걸 그대로 씁니다. 목업 폴백은 두지 않습니다 — 연결 상태를
 * 모를 때 "3개 연결됨"이라고 하는 것보다 "확인할 수 없음"이 맞습니다.
 */

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  figma: "Figma",
  email: "이메일",
};

export default function AccountSettings() {
  const { session, configured } = useAuth();
  const user = session?.user;

  const identities = user?.identities ?? [];
  const providers = identities
    .map((i) => PROVIDER_LABEL[i.provider] ?? i.provider)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const email = user?.email ?? null;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.user_name as string | undefined) ??
    null;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-heading">계정 설정</h1>

      <div className="entry space-y-4">
        <h2 className="entry-title mb-0 inline-flex items-center gap-2">
          <ShieldCheck size={16} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
          계정 보안 및 연결 상태
        </h2>

        {!configured ? (
          <p className="text-sm text-neutral-500">
            Supabase 설정이 없어 연결 상태를 확인할 수 없습니다.
          </p>
        ) : (
          <dl className="text-sm divide-y divide-neutral-800">
            <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
              <dt className="text-neutral-300">계정</dt>
              <dd className="text-neutral-500 truncate">
                {displayName ? `${displayName}` : email ? email : "확인할 수 없음"}
              </dd>
            </div>
            {email && displayName && (
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-neutral-300">이메일</dt>
                <dd className="text-neutral-500 truncate">{email}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-neutral-300">로그인 수단</dt>
              <dd className="text-neutral-500">
                {providers.length > 0 ? `${providers.length}개 연결됨` : "확인할 수 없음"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
              <dt className="text-neutral-300">연결된 서비스</dt>
              <dd className="text-neutral-500">
                {providers.length > 0 ? providers.join(", ") : "—"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <Row
        icon={Link2}
        title="소셜 계정 연결 관리"
        desc="Google, GitHub, Figma 계정의 연결 상태를 확인하고 해제할 수 있습니다."
        to="/settings/social"
      />

      <Row
        icon={RefreshCw}
        title="GitHub 다시 연결"
        desc="저장소 목록이 비어 보이면 여기서 연결을 새로 하세요. 로그인 상태와 별개로, 저장소를 읽는 권한은 새로고침하면 사라집니다."
        to="/settings/social"
      />

      <Row
        icon={Trash2}
        title="개인 데이터 및 계정 삭제"
        desc="내 데이터를 내려받거나 특정 포트폴리오 또는 계정 전체를 삭제할 수 있습니다."
        to="/settings/data"
      />

      {/* 아직 만들지 않은 자리입니다. 링크 대신 목록으로만 적어 둡니다 —
          누를 수 있게 해두면 404 로 보내는 셈입니다. */}
      <div className="entry">
        <p className="inline-flex items-center gap-2 font-medium text-neutral-100">
          <UserRound size={16} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
          기본값 설정
        </p>
        <p className="text-xs text-neutral-500 mt-1.5">
          새 포트폴리오를 만들 때마다 매번 고르는 값들을 한 번만 정해두는
          자리입니다. 아직 만들지 않았습니다.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-neutral-600">
          <li>· 기본 직무와 연도 — 지금은 연도를 바꿀 수 있는 화면이 아예 없습니다</li>
          <li>· 기본 템플릿 · 색 · 여백</li>
          <li>· 새 포트폴리오의 기본 공개 범위</li>
        </ul>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  to,
}: {
  icon: typeof Link2;
  title: string;
  desc: string;
  to: string;
}) {
  return (
    <div className="entry flex items-start justify-between gap-6">
      <div>
        <p className="inline-flex items-center gap-2 font-medium text-neutral-100">
          <Icon size={16} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
          {title}
        </p>
        <p className="text-xs text-neutral-500 mt-1.5 max-w-[62ch] leading-relaxed">{desc}</p>
      </div>
      <Link to={to} className="btn-secondary shrink-0">
        관리
      </Link>
    </div>
  );
}
