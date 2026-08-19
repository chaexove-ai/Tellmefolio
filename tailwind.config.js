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
        //
        // [2026-08 수정] 기존 단일 hex(#c2703d)로는 대비율을 동시에 만족할 수 없었습니다.
        //   - 라이트 배경(#faf7f1) 위 text-brand : 3.50:1  (기준 4.5:1 미달)
        //   - 다크 배경(#0a0a0a) 위 text-brand   : 5.36:1  (통과)
        //   - 흰 글자 + bg-brand 버튼            : 3.70:1  (기준 미달)
        // 라이트에서 통과시키려면 어둡게 해야 하는데 그러면 다크에서 떨어집니다.
        // → 액센트도 neutral처럼 테마별 CSS 변수로 분리했습니다.
        //   brand        : 텍스트·아이콘용 (테마별로 다름)
        //   brand-solid  : 흰 글자를 얹는 버튼 배경용 (양쪽 테마 공통, 4.95:1)
        //   brand-dark   : hover 상태
        brand: {
          DEFAULT: withOpacityValue("--brand"),
          dark: withOpacityValue("--brand-dark"),
          solid: withOpacityValue("--brand-solid"),
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
