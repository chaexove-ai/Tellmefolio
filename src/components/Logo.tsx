import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

/**
 * [2026-09-29] Tellmefolio 로고 — 모든 곳에서 이것 하나를 씁니다.
 *
 * 전에는 자리마다 달랐습니다: 사이드바·랜딩은 제목 글꼴 "Tellmefolio",
 * 로그인은 자간 넓힌 갈색 대문자, 데스크탑 안내 화면은 모니터 아이콘 + 글자,
 * 파비콘은 파일이 없어 404 였습니다.
 *
 * 마크는 책장을 두 팔처럼 펼친 사람입니다(09-29 확정) — 자기 이야기를
 * 펼쳐 보이는 사람. 색은 갈색(brand-solid)이고, 다른 색이 필요하면
 * className 으로 text-* 를 넘깁니다(fill 이 currentColor).
 * 같은 그림이 public/favicon.svg 에도 있습니다(둘을 같이 고치세요).
 */
export function LogoMark({ size = 24, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 text-brand-solid ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* 책장을 두 팔처럼 펼친 사람 — 자기 이야기를 펼쳐 보이는 사람 */}
      <circle cx="32" cy="13" r="8" fill="currentColor" />
      <path
        fill="currentColor"
        d="M30.6 30Q20 26 8 16L5 24Q17 36 30.6 40V58H33.4V40Q47 36 59 24L56 16Q44 26 33.4 30Z M27 34H37V58H27Z"
      />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 20, text: "text-base", gap: "gap-2" },
  md: { mark: 24, text: "text-lg", gap: "gap-2.5" },
  lg: { mark: 32, text: "text-2xl", gap: "gap-3" },
} as const;

/** 마크 + 글자. to 를 주면 링크(보통 홈)로, 아니면 그냥 표시. */
export default function Logo({
  size = "md",
  to,
  onClick,
  className = "",
  style,
}: {
  size?: keyof typeof SIZES;
  to?: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const s = SIZES[size];
  const inner = (
    <>
      <LogoMark size={s.mark} />
      <span className={`font-heading leading-none ${s.text}`}>Tellmefolio</span>
    </>
  );
  const cls = `inline-flex items-center ${s.gap} ${className}`;
  return to ? (
    <Link to={to} onClick={onClick} className={cls} style={style} aria-label="Tellmefolio 홈">
      {inner}
    </Link>
  ) : (
    <span className={cls} style={style}>
      {inner}
    </span>
  );
}
