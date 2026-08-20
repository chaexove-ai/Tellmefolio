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
}

export default function SocialLoginButtons({ onSelect, busy = false, className }: Props) {
  return (
    <div className={className ? `space-y-3 ${className}` : "space-y-3"}>
      {socialProviders.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          disabled={busy}
          className="btn-social disabled:opacity-60 disabled:pointer-events-none"
        >
          <span className="btn-social-icon">
            <Icon size={18} />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
