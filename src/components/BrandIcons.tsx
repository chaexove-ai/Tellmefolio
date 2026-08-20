/**
 * 소셜 로그인 제공자 로고.
 *
 * [왜 lucide 를 안 쓰나]
 * lucide 에도 Github 아이콘이 있지만 Google · Figma 는 없고, 있더라도
 * 단색 실루엣이라 "공식 로고"가 아닙니다. 로그인 버튼은 사용자가
 * 0.5초 안에 자기 계정을 찾아야 하는 자리라, 여기서만큼은 각 사의
 * 공식 마크를 쓰는 것이 인지 속도에서 유리합니다.
 * (랜딩 본문의 장식용 아이콘은 lucide 로 통일합니다.)
 *
 * [색 처리 원칙]
 *   Google · Figma → 공식 브랜드 컬러 고정.
 *     이 둘은 색 자체가 식별 정보입니다. 우리 톤으로 바꾸면 알아보기
 *     어려워지고, 각 사 브랜드 가이드라인 위반이기도 합니다.
 *   GitHub        → currentColor.
 *     GitHub 마크는 원래 단색(검정)이라 다크 테마에서 배경에 묻힙니다.
 *     currentColor 로 두면 버튼의 글자색을 그대로 따라가므로
 *     라이트에서는 검정, 다크에서는 밝은 회색으로 자동 전환됩니다.
 *     단색 사용은 GitHub 로고 가이드라인이 허용하는 방식입니다.
 *
 * 버튼 껍데기(테두리·배경·호버)는 우리 테마입니다 — index.css 의
 * `.btn-social` 을 쓰세요. 로고만 각 사 것, 나머지는 전부 우리 것입니다.
 *
 * 모든 아이콘은 viewBox 24×24 로 통일했습니다. 원본 SVG 들은 제각기
 * 다른 좌표계(Google 48, Figma 38×57)라 그대로 두면 버튼마다 로고
 * 크기가 달라 보입니다. 여기서 미리 맞춰 두면 호출부는 size 만 주면 됩니다.
 */

interface IconProps {
  /** 정사각형 한 변 (px). 기본 18 — .btn-social 의 14px 글자와 균형이 맞습니다. */
  size?: number;
  className?: string;
}

/** Google "G" — 공식 4색. */
export function GoogleIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

/** GitHub Octocat 마크 — currentColor 로 테마를 따라갑니다. */
export function GitHubIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.4 11.4 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

/** Figma — 공식 5색 마크. 원본 38×57 을 24×24 안에 중앙 정렬했습니다. */
export function FigmaIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#0ACF83" d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 0 0 0 8z" />
      <path fill="#A259FF" d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#F24E1E" d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 0 1 0 8h-4V0z" />
      <path fill="#1ABCFE" d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

/**
 * 제공자 목록. 로그인 화면에서 이 배열을 돌리면
 * 버튼 순서·라벨을 한곳에서 관리할 수 있습니다.
 *
 * 순서는 화면 캡처와 동일하게 Google → GitHub → Figma 로 두었습니다.
 * (가장 많이 쓰는 것을 위에 두는 것이 일반적인 관행입니다)
 */
export const socialProviders = [
  { id: "google", label: "Google로 로그인", Icon: GoogleIcon },
  { id: "github", label: "GitHub로 로그인", Icon: GitHubIcon },
  { id: "figma", label: "Figma로 로그인", Icon: FigmaIcon },
] as const;

export type SocialProviderId = (typeof socialProviders)[number]["id"];
