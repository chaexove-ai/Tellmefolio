import { getPortfolioPalette, MONO_STACK, byDensity } from "../../lib/portfolioTheme";
import type { PortfolioTemplateProps } from "./types";
import { caseStudyFields, briefLead, visibleProjects } from "./types";
import ProjectImages from "./ProjectImages";
import BlockList from "./BlockList";

const fieldLabels: Array<{ key: "context" | "problem" | "execution" | "outcome" | "reflection"; label: string }> = [
  { key: "context", label: "background" },
  { key: "problem", label: "problem" },
  { key: "execution", label: "execution" },
  { key: "outcome", label: "outcome" },
  { key: "reflection", label: "reflection" },
];

function slugify(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/**
 * 라이브에디터 — "개발자 감성의 다크 코드 스타일".
 *
 * 항상 다크 배경 + 모노스페이스로 코드 에디터/터미널을 흉내냅니다(이 방은
 * "라이브에디터"라는 이름 자체가 아이덴티티라, colorTheme이 light여도
 * 배경만은 다크를 유지 — 대신 그 안의 텍스트 대비는 palette 함수가 이미
 * WCAG 기준으로 잡아둔 dark 팔레트를 그대로 씁니다). 각 프로젝트를
 * `project/{slug}.md` 라는 가짜 파일로, 각 필드를 YAML 프런트매터처럼,
 * 스택 배지를 npm 배지 스타일 pill로 표현합니다.
 */
export default function LiveEditorTemplate({ portfolio, projects, images = {}, blocks = {}, blockEditor, eagerImages }: PortfolioTemplateProps) {
  // 이 템플릿의 정체성상 항상 다크 팔레트를 씁니다.
  const palette = getPortfolioPalette("dark");
  const visible = visibleProjects(projects, images);
  const d = portfolio.density;
  const isTwoCol = portfolio.layout === "2col";

  return (
    <div style={{ background: palette.bg, color: palette.text, fontFamily: MONO_STACK }} className="w-full">
      <div className={`mx-auto max-w-[720px] px-6 ${byDensity(d, { roomy: "py-16", normal: "py-10", tight: "py-6" })}`}>
        {/* 창 크롬 */}
        <div
          className="rounded-t-lg px-4 py-2.5 flex items-center gap-2"
          style={{ background: palette.bgAlt, border: `1px solid ${palette.border}`, borderBottom: "none" }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#27c93f" }} />
          <span className="ml-3 text-[11px]" style={{ color: palette.textFaint }}>
            ~/portfolio/{slugify(portfolio.title)}.md
          </span>
        </div>

        <div
          className="rounded-b-lg px-6 py-8"
          style={{ background: palette.bgRaised, border: `1px solid ${palette.border}` }}
        >
          {/* 프런트매터 */}
          <p className="text-[14px] leading-[1.9]">
            <span style={{ color: palette.textFaint }}>---</span>
            <br />
            <span style={{ color: palette.accent }}>title</span>
            <span style={{ color: palette.textFaint }}>:</span> {portfolio.title}
            <br />
            {portfolio.job && (
              <>
                <span style={{ color: palette.accent }}>role</span>
                <span style={{ color: palette.textFaint }}>:</span> {portfolio.job}
                <br />
              </>
            )}
            {portfolio.year && (
              <>
                <span style={{ color: palette.accent }}>year</span>
                <span style={{ color: palette.textFaint }}>:</span> {portfolio.year}
                <br />
              </>
            )}
            <span style={{ color: palette.textFaint }}>---</span>
          </p>

          {portfolio.summary && (
            <p className="text-[14px] leading-relaxed mt-6" style={{ color: palette.textMuted }}>
              <span style={{ color: palette.textFaint }}>{"// "}</span>
              {portfolio.summary}
            </p>
          )}

          <div
            className={
              isTwoCol
                ? byDensity(d, {
                    roomy: "mt-16 grid grid-cols-2 gap-x-8 gap-y-16",
                    normal: "mt-10 grid grid-cols-2 gap-x-8 gap-y-10",
                    tight: "mt-6 grid grid-cols-2 gap-x-6 gap-y-6",
                  })
                : byDensity(d, { roomy: "mt-16 space-y-16", normal: "mt-10 space-y-10", tight: "mt-6 space-y-6" })
            }
          >
            {visible.map((p, i) => (
              <div key={p.id}>
                <p className="text-[13px] mb-3">
                  <span style={{ color: palette.textFaint }}>{i + 1 < 10 ? `0${i + 1}` : i + 1}</span>{" "}
                  <span style={{ color: palette.accent }}>function</span>{" "}
                  <span>{slugify(p.name || `project-${i + 1}`)}</span>
                  <span style={{ color: palette.textFaint }}>() {"{"}</span>
                </p>

                {p.stack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 pl-4">
                    {p.stack.map((s) => (
                      <span
                        key={s}
                        className="text-[11px] px-2 py-0.5 rounded"
                        style={{ background: palette.bgAlt, border: `1px solid ${palette.border}`, color: palette.textMuted }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`pl-4 border-l ${byDensity(d, { roomy: "space-y-5", normal: "space-y-3", tight: "space-y-2" })}`} style={{ borderColor: palette.border }}>
                  {p.role.trim() && (
                    <p className="text-[14px]">
                      <span style={{ color: palette.textFaint }}>{"// "}role</span>
                      <br />
                      <span style={{ color: palette.textMuted }}>{p.role}</span>
                    </p>
                  )}
                  {/* [2026-09-22] "간단히" 는 한 줄 설명을 주석 한 줄로.
                      이 템플릿의 문법(// label 아래 값)을 그대로 따릅니다. */}
                  {briefLead(p) && (
                    <p className="text-[14px] leading-[1.8] whitespace-pre-wrap">
                      <span style={{ color: palette.textFaint }}>{"// "}summary</span>
                      <br />
                      <span style={{ color: palette.textMuted }}>{briefLead(p)}</span>
                    </p>
                  )}

                  <ProjectImages
                    projectId={p.id}
                    images={images}
                    eager={eagerImages}
                    borderColor={palette.border}
                    captionColor={palette.textFaint}
                    rounded="rounded"
                  />

                  {caseStudyFields(p, fieldLabels).map(({ key, label }) => {
                    const value = p[key];
                    if (!value.trim()) return null;
                    return (
                      <p key={key} className="text-[14px] leading-[1.8] whitespace-pre-wrap">
                        <span style={{ color: palette.textFaint }}>{"// "}{label}</span>
                        <br />
                        <span style={{ color: palette.textMuted }}>{value}</span>
                      </p>
                    );
                  })}

                  {/* 이 템플릿의 문법(// label 아래 값)을 BlockList 도
                      따르도록 라벨 모양만 바꿔 넘깁니다. */}
                  <BlockList
                    projectId={p.id}
                    blocks={blocks}
                    editor={blockEditor}
                    textColor={palette.textMuted}
                    labelColor={palette.textFaint}
                    borderColor={palette.border}
                    labelClassName="text-[14px]"
                    bodyClassName="text-[14px] leading-[1.8] whitespace-pre-wrap"
                    dividerStyle="comment"
                    className={byDensity(d, { roomy: "space-y-5", normal: "space-y-3", tight: "space-y-2" })}
                  />
                </div>

                <p className="text-[13px] mt-3" style={{ color: palette.textFaint }}>
                  {"}"}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[11px] mt-10 pt-4" style={{ color: palette.textFaint, borderTop: `1px solid ${palette.border}` }}>
            {"// exported via Tellmefolio"}
          </p>
        </div>
      </div>
    </div>
  );
}
