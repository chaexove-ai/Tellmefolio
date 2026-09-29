import { socialProviders, type SocialProviderId } from "./BrandIcons";

/**
 * 소셜 로그인 버튼 3종.
 *
 * ⚠️ 이 파일은 **끼워 넣기용**입니다.
 *    현재 `Login.tsx` 를 제가 보지 못한 상태라, 기존 파일을 덮어쓰지 않고
 *    독립 컴포넌트로 분리했습니다. Login.tsx 에서 기존 버튼 세 줄을 지우고
 *    이걸 한 줄로 바꿔 끼우시면 됩니다.
 *
 *    <SocialLoginButtons onSelect={(id) => signIn(id)} />
 *
 *    기존 로그인 핸들러 이름이 무엇이든 onSelect 안에서 호출하면 됩니다.
 *    ("google" | "github" | "figma" 문자열이 넘어옵니다)
 *
 * [왜 로고를 왼쪽에 고정했나]
 * 라벨 길이가 제각각이라 로고를 글자 옆에 붙이면 세 버튼의 로고가
 * 서로 다른 x 좌표에 놓입니다. 눈은 왼쪽 정렬된 기호를 세로로 훑어
 * 자기 계정을 찾기 때문에, 로고 열이 맞아야 탐색이 빨라집니다.
 * 라벨은 그대로 가운데 정렬을 유지해 기존 화면의 인상을 바꾸지 않습니다.
 *
 * [접근성]
 * - 로고 SVG 는 전부 aria-hidden — 버튼의 글자가 이미 이름을 제공합니다.
 * - disabled 를 내려주면 로그인 진행 중 중복 클릭을 막을 수 있습니다.
 */
interface Props {
  onSelect: (id: SocialProviderId) => void;
  /** 로그인 요청 중일 때 true — 세 버튼이 함께 잠깁니다 */
  busy?: boolean;
  className?: string;
  /** [2026-09-29] 지난번에 고른 계정 — 그 버튼에 "최근 사용" 배지 */
  lastUsed?: SocialProviderId | null;
}

/* [2026-09-29] "최근 사용" — 이 기기에서 마지막으로 누른 계정을 기억합니다.
   연동(GitHub 저장소·Figma 파일)이 계정마다 달라서, 다른 계정으로 새로
   가입해 버리면 연결해 둔 것이 안 보입니다. 브라우저 저장소가 막혀 있으면
   표시만 빠집니다. */
const LAST_KEY = "tf-last-provider";

export function readLastProvider(): SocialProviderId | null {
  try {
    const v = window.localStorage.getItem(LAST_KEY);
    return socialProviders.some((p) => p.id === v) ? (v as SocialProviderId) : null;
  } catch {
    return null;
  }
}

export function rememberProvider(id: SocialProviderId) {
  try {
    window.localStorage.setItem(LAST_KEY, id);
  } catch {
    /* 저장이 막혀 있어도 로그인은 그대로 */
  }
}

export default function SocialLoginButtons({ onSelect, busy = false, className, lastUsed = null }: Props) {
  return (
    <div className={className ? `space-y-3 ${className}` : "space-y-3"}>
      {socialProviders.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          disabled={busy}
          className={`btn-social disabled:opacity-60 disabled:pointer-events-none ${
            lastUsed === id ? "border-neutral-500" : ""
          }`}
        >
          <span className="btn-social-icon">
            <Icon size={18} />
          </span>
          {label}
          {lastUsed === id && (
            <span className="absolute -right-2 -top-2.5 rounded-full bg-brand-solid px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
              최근 사용
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
