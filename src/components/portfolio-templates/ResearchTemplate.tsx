import { getPortfolioPalette, SERIF_STACK } from "../../lib/portfolioTheme";
import type { PortfolioTemplateProps } from "./types";
import { hasContent } from "./types";

const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const fieldLabels: Array<{ key: "context" | "problem" | "execution" | "outcome" | "reflection"; label: string }> = [
  { key: "context", label: "Background" },
  { key: "problem", label: "Problem" },
  { key: "execution", label: "Method" },
  { key: "outcome", label: "Result" },
  { key: "reflection", label: "Discussion" },
];

/**
 * 연구노트 — "학술적이고 정제된 레이아웃".
 *
 * 학술 논문의 관례를 그대로 빌립니다: 표지는 제목·저자·연도만 있는 타이틀
 * 페이지, 각 프로젝트는 로마 숫자로 매긴 섹션(진짜 순서가 있는 내용이라
 * 번호가 타당합니다), 5칸은 Background/Problem/Method/Result/Discussion
 * 이라는 논문 소제목으로 다시 이름 붙였습니다. 폭을 좁게 잡고(65ch 근방)
 * 세리프 제목 + 여백으로 "정제된" 인상을 만듭니다 — 카드나 배지 없이
 * 가로줄(rule)만으로 구획을 나눕니다.
 */
export default function ResearchTemplate({ portfolio, projects, bodyFontStack }: PortfolioTemplateProps) {
  const palette = getPortfolioPalette(portfolio.color_theme);
  const visible = projects.filter(hasContent);

  return (
    <div
      style={{ background: palette.bg, color: palette.text, fontFamily: bodyFontStack }}
      className="w-full"
    >
      <div className="mx-auto max-w-[640px] px-10 py-16">
        {/* 타이틀 페이지 */}
        <div className="text-center pb-14 mb-14" style={{ borderBottom: `1px solid ${palette.border}` }}>
          <p
            className="text-[11px] tracking-[0.2em] uppercase mb-6"
            style={{ color: palette.textFaint }}
          >
            {portfolio.job || "Case Study Portfolio"} {portfolio.year ? `· ${portfolio.year}` : ""}
          </p>
          <h1
            style={{ fontFamily: SERIF_STACK, lineHeight: 1.3 }}
            className="text-[32px] font-normal mb-5"
          >
            {portfolio.title}
          </h1>
          {portfolio.summary && (
            <p className="text-sm leading-relaxed max-w-[46ch] mx-auto" style={{ color: palette.textMuted }}>
              {portfolio.summary}
            </p>
          )}
        </div>

        {/* 목차 */}
        {visible.length > 1 && (
          <div className="mb-14">
            <p className="text-[11px] tracking-[0.2em] uppercase mb-3" style={{ color: palette.textFaint }}>
              Contents
            </p>
            <ol className="space-y-1.5 text-sm">
              {visible.map((p, i) => (
                <li key={p.id} className="flex items-baseline gap-3">
                  <span style={{ color: palette.textFaint, fontFamily: SERIF_STACK }}>
                    {romanNumerals[i] ?? i + 1}.
                  </span>
                  <span>{p.name || "제목 없음"}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 본문 섹션들 */}
        <div className="space-y-16">
          {visible.map((p, i) => (
            <section key={p.id}>
              <div className="flex items-baseline gap-3 mb-1.5">
                <span
                  style={{ fontFamily: SERIF_STACK, color: palette.accent }}
                  className="text-base"
                >
                  {romanNumerals[i] ?? i + 1}.
                </span>
                <h2 style={{ fontFamily: SERIF_STACK }} className="text-xl font-normal">
                  {p.name || "제목 없음"}
                </h2>
              </div>
              {p.role.trim() && (
                <p className="text-xs mb-5" style={{ color: palette.textFaint }}>
                  Role — {p.role}
                </p>
              )}
              {p.stack.length > 0 && (
                <p className="text-xs mb-5" style={{ color: palette.textFaint }}>
                  {p.stack.join(" · ")}
                </p>
              )}

              <div className="space-y-5">
                {fieldLabels.map(({ key, label }) => {
                  const value = p[key];
                  if (!value.trim()) return null;
                  return (
                    <div key={key}>
                      <p
                        className="text-[11px] tracking-[0.15em] uppercase mb-1.5"
                        style={{ color: palette.textFaint }}
                      >
                        {label}
                      </p>
                      <p className="text-sm leading-[1.8] whitespace-pre-wrap" style={{ color: palette.textMuted }}>
                        {value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div
          className="mt-16 pt-6 text-[11px] flex items-center justify-between"
          style={{ borderTop: `1px solid ${palette.border}`, color: palette.textFaint }}
        >
          <span>{portfolio.title}</span>
          <span>Tellmefolio</span>
        </div>
      </div>
    </div>
  );
}
