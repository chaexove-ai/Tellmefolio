/** @type {import('tailwindcss').Config} */

// neutral-* 유틸리티를 고정 hex 대신 CSS 변수(--n50 ~ --n950)로 연결합니다.
// index.css의 :root / :root.light 블록이 이 변수 값을 테마별로 다시 정의하므로,
// 컴포넌트의 className은 그대로 둔 채 다크/라이트 전환이 가능합니다.
function withOpacityValue(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 의도적으로 고른 단일 액센트 색. 보라/파랑 그라데이션(가장 흔한 "AI 티")을
        // 피하고, "이야기하면 포트폴리오가 됩니다"라는 브랜드 톤에 맞춰
        // 손글씨·케이스 스터디 느낌의 클레이(테라코타) 톤을 사용합니다.
        brand: {
          DEFAULT: "#c2703d",
          dark: "#8f4f27",
        },
        neutral: {
          50: withOpacityValue("--n50"),
          100: withOpacityValue("--n100"),
          200: withOpacityValue("--n200"),
          300: withOpacityValue("--n300"),
          400: withOpacityValue("--n400"),
          500: withOpacityValue("--n500"),
          600: withOpacityValue("--n600"),
          700: withOpacityValue("--n700"),
          800: withOpacityValue("--n800"),
          900: withOpacityValue("--n900"),
          950: withOpacityValue("--n950"),
        },
      },
      fontFamily: {
        // 제목: 한글을 지원하는 서체 중 시스템 기본값이 아닌 것을 명시적으로 지정
        heading: ["'Gowun Batang'", "serif"],
        // 본문: Inter/시스템 기본값 대신 Pretendard를 실제로 로드해서 사용
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
