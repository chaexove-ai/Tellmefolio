import { getPortfolioPalette, byDensity } from "../../lib/portfolioTheme";
import type { PortfolioTemplateProps } from "./types";
import { caseStudyFields, briefLead, visibleProjects } from "./types";
import ProjectImages from "./ProjectImages";

type FieldKey = "context" | "problem" | "execution" | "outcome" | "reflection";

// [2026-09] 영어 버전을 골라도 이 라벨들이 계속 한국어로 나온다는 신고를
// 받고 언어별로 나눴습니다 — MinimalTemplate과 같은 이유입니다.
const fieldLabelsByLang: Record<"ko" | "en", Array<{ key: FieldKey; label: string }>> = {
  ko: [
    { key: "context", label: "맥락 및 배경" },
    { key: "problem", label: "문제 정의" },
    { key: "execution", label: "실행 내용" },
    { key: "outcome", label: "핵심 성과" },
    { key: "reflection", label: "배운 점" },
  ],
  en: [
    { key: "context", label: "Background" },
    { key: "problem", label: "Problem" },
    { key: "execution", label: "Execution" },
    { key: "outcome", label: "Key Outcomes" },
    { key: "reflection", label: "Reflection" },
  ],
};

/**
 * 매거진형 — "이미지 중심의 감각적인 레이아웃".
 *
 * 표지 이미지를 화면 폭 전체로 깔고 그 위에 제목을 얹는 매거진 커버
 * 방식을 씁니다(이미지가 없으면 accent 색 그라디언트 블록으로 대신 —
 * 매거진 표지에 사진이 없을 순 없으니, 빈 화면 대신 색 블록이라도
 * 채웁니다). 요약은 인용구처럼 크게, 프로젝트는 큰 인덱스 숫자를 그래픽
 * 요소로 삼아 한 편의 "기사"처럼 배치합니다. layout이 2단이면 프로젝트를
 * 좌우로 나눠 잡지 지면처럼 두 편씩 보이게 합니다.
 */
export default function MagazineTemplate({ portfolio, projects, coverUrl, images = {}, bodyFontStack, lang = "ko" }: PortfolioTemplateProps) {
  const palette = getPortfolioPalette(portfolio.color_theme);
  const visible = visibleProjects(projects, images);
  const isTwoCol = portfolio.layout === "2col";
  const d = portfolio.density;
  const fieldLabels = fieldLabelsByLang[lang];
  const untitled = lang === "en" ? "Untitled" : "제목 없음";

  return (
    <div style={{ background: palette.bg, color: palette.text, fontFamily: bodyFontStack }} className="w-full">
      {/* 표지 */}
      <div className="relative h-[340px] w-full overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${palette.accent}, ${palette.bgAlt})` }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-10 pb-8">
          <p className="text-[11px] tracking-[0.25em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
            {[portfolio.job, portfolio.year].filter(Boolean).join(" · ") || "Portfolio Issue"}
          </p>
          <h1 className="text-[38px] font-heading leading-[1.15]" style={{ color: "#ffffff" }}>
            {portfolio.title}
          </h1>
        </div>
      </div>

      <div className={`mx-auto max-w-[760px] px-10 ${byDensity(d, { roomy: "py-20", normal: "py-14", tight: "py-9" })}`}>
        {portfolio.summary && (
          <p
            className="font-heading italic text-[22px] leading-[1.6] mb-16 max-w-[52ch]"
            style={{ color: palette.textMuted }}
          >
            “{portfolio.summary}”
          </p>
        )}

        <div
          className={
            isTwoCol
              ? byDensity(d, {
                  roomy: "grid grid-cols-2 gap-x-10 gap-y-24",
                  normal: "grid grid-cols-2 gap-x-10 gap-y-16",
                  tight: "grid grid-cols-2 gap-x-8 gap-y-10",
                })
              : byDensity(d, { roomy: "space-y-24", normal: "space-y-16", tight: "space-y-10" })
          }
        >
          {visible.map((p, i) => (
            <article key={p.id}>
              <div className="flex items-start gap-4 mb-4">
                <span
                  className="font-heading text-[40px] leading-none shrink-0"
                  style={{ color: palette.accent, opacity: 0.35 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1">
                  <h2 className="text-[20px] font-heading leading-snug">{p.name || untitled}</h2>
                  {(p.role || p.stack.length > 0) && (
                    <p className="text-[12px] mt-1" style={{ color: palette.textFaint }}>
                      {[p.role, p.stack.join(" · ")].filter(Boolean).join(" — ")}
                    </p>
                  )}
                </div>
              </div>

              {/* 이미지가 주인공인 템플릿이라 "간단히" 와 가장 잘 맞습니다.
                  큰 인덱스 숫자 아래 들여쓰기에 맞춰 이미지를 둡니다. */}
              <div className="pl-[56px]">
                {briefLead(p) && (
                  <p className="text-[14px] leading-[1.9] mb-4" style={{ color: palette.textMuted }}>
                    {briefLead(p)}
                  </p>
                )}
                <ProjectImages
                  projectId={p.id}
                  images={images}
                  borderColor={palette.border}
                  captionColor={palette.textFaint}
                  className={byDensity(d, { roomy: "mb-6", normal: "mb-4", tight: "mb-2.5" })}
                />
              </div>

              <div className={`pl-[56px] ${byDensity(d, { roomy: "space-y-6", normal: "space-y-4", tight: "space-y-2.5" })}`}>
                {caseStudyFields(p, fieldLabels).map(({ key, label }) => {
                  const value = p[key];
                  if (!value.trim()) return null;
                  return (
                    <div key={key}>
                      <p className="text-[11px] font-medium mb-1" style={{ color: palette.accent }}>
                        {label}
                      </p>
                      <p className="text-[14px] leading-[1.75] whitespace-pre-wrap" style={{ color: palette.textMuted }}>
                        {value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
