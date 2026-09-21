import { getPortfolioPalette, byDensity } from "../../lib/portfolioTheme";
import type { PortfolioTemplateProps } from "./types";
import { caseStudyFields, briefLead, visibleProjects } from "./types";
import ProjectImages from "./ProjectImages";

type FieldKey = "context" | "problem" | "execution" | "outcome" | "reflection";

// [2026-09] 영어 버전을 골라도 이 라벨들이 계속 한국어로 나온다는 신고를
// 받고 언어별로 나눴습니다 — portfolio/projects의 실제 텍스트는 translate.ts
// 쪽에서 이미 번역돼 들어오지만, 이 라벨은 데이터가 아니라 템플릿 코드에
// 박힌 문자열이라 그쪽 번역과 별개로 여기서 직접 나눠줘야 합니다.
const fieldLabelsByLang: Record<"ko" | "en", Array<{ key: FieldKey; label: string }>> = {
  ko: [
    { key: "context", label: "맥락" },
    { key: "problem", label: "문제" },
    { key: "execution", label: "실행" },
    { key: "outcome", label: "성과" },
    { key: "reflection", label: "회고" },
  ],
  en: [
    { key: "context", label: "Context" },
    { key: "problem", label: "Problem" },
    { key: "execution", label: "Execution" },
    { key: "outcome", label: "Outcome" },
    { key: "reflection", label: "Reflection" },
  ],
};

/**
 * 클린 미니멀 — "여백 중심의 깔끔한 구성".
 *
 * 카드·배지·굵은 구분선을 전부 뺐습니다. 프로젝트 사이는 여백 하나로만
 * 나누고(border 없음), 라벨은 아주 작고 옅게, 본문은 넓은 줄간격으로
 * 둡니다. 대표 이미지가 있어도 화면 전체를 채우지 않고 작게, 살짝
 * 무채색(grayscale)으로 눌러서 튀지 않게 — "여백이 주인공"이라는
 * 컨셉을 색이 방해하지 않게 하려는 선택입니다.
 */
export default function MinimalTemplate({ portfolio, projects, coverUrl, images = {}, eagerImages, bodyFontStack, lang = "ko" }: PortfolioTemplateProps) {
  const palette = getPortfolioPalette(portfolio.color_theme);
  const visible = visibleProjects(projects, images);
  const d = portfolio.density;
  const isTwoCol = portfolio.layout === "2col";
  const fieldLabels = fieldLabelsByLang[lang];
  const untitled = lang === "en" ? "Untitled" : "제목 없음";

  return (
    <div style={{ background: palette.bg, color: palette.text, fontFamily: bodyFontStack }} className="w-full">
      <div className={`mx-auto max-w-[600px] px-10 ${byDensity(d, { roomy: "py-28", normal: "py-20", tight: "py-12" })}`}>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="w-40 h-28 object-cover rounded mb-12"
            style={{ filter: "grayscale(55%)" }}
          />
        )}

        <p className="text-[12px] mb-3" style={{ color: palette.textFaint }}>
          {[portfolio.job, portfolio.year].filter(Boolean).join(" · ") || "Portfolio"}
        </p>
        <h1 className="text-[28px] font-medium mb-6 leading-snug">{portfolio.title}</h1>
        {portfolio.summary && (
          <p className="text-[15px] leading-[1.9] mb-20" style={{ color: palette.textMuted }}>
            {portfolio.summary}
          </p>
        )}

        <div
          className={
            isTwoCol
              ? byDensity(d, {
                  roomy: "grid grid-cols-2 gap-x-8 gap-y-28",
                  normal: "grid grid-cols-2 gap-x-8 gap-y-24",
                  tight: "grid grid-cols-2 gap-x-6 gap-y-14",
                })
              : byDensity(d, { roomy: "space-y-28", normal: "space-y-24", tight: "space-y-14" })
          }
        >
          {visible.map((p) => (
            <div key={p.id}>
              <h2 className="text-[18px] font-medium mb-1">{p.name || untitled}</h2>
              <p className="text-[12px] mb-8" style={{ color: palette.textFaint }}>
                {[p.role, p.stack.join(", ")].filter(Boolean).join(" · ")}
              </p>

              {briefLead(p) && (
                <p className="text-[15px] leading-[1.9] mb-8" style={{ color: palette.textMuted }}>
                  {briefLead(p)}
                </p>
              )}

              {/* 이 템플릿은 "여백이 주인공"이라 이미지도 모서리를 죽이고
                  테두리를 옅게 둡니다. */}
              <ProjectImages
                projectId={p.id}
                images={images}
                eager={eagerImages}
                borderColor={palette.border}
                captionColor={palette.textFaint}
                rounded="rounded-none"
                className="mb-8"
              />

              <div className={byDensity(d, { roomy: "space-y-9", normal: "space-y-7", tight: "space-y-4" })}>
                {caseStudyFields(p, fieldLabels).map(({ key, label }) => {
                  const value = p[key];
                  if (!value.trim()) return null;
                  return (
                    <div key={key} className="grid grid-cols-[64px_1fr] gap-6">
                      <p className="text-[12px] pt-0.5" style={{ color: palette.textFaint }}>
                        {label}
                      </p>
                      <p className="text-[15px] leading-[1.9] whitespace-pre-wrap" style={{ color: palette.textMuted }}>
                        {value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12px] mt-24" style={{ color: palette.textFaint }}>
          {portfolio.title}
        </p>
      </div>
    </div>
  );
}
