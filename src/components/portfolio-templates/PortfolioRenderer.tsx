import { forwardRef } from "react";
import ResearchTemplate from "./ResearchTemplate";
import LiveEditorTemplate from "./LiveEditorTemplate";
import MinimalTemplate from "./MinimalTemplate";
import MagazineTemplate from "./MagazineTemplate";
import type { PortfolioTemplateProps } from "./types";

/**
 * template_id 로 4개 템플릿 중 하나를 골라 렌더링합니다. Export.tsx가 이
 * 컴포넌트를 화면에 그대로 보여주는 미리보기로도 쓰고, 같은 DOM 노드를
 * html2canvas로 캡처해 PDF로도 만듭니다(별도 "PDF 전용 뷰"를 따로 두지
 * 않고 화면에 보이는 그대로를 내보내는 편이 — 사용자가 미리보기에서 본
 * 것과 실제 파일이 다르면 신뢰를 잃습니다).
 *
 * forwardRef 인 이유: html2canvas(node) 는 실제 DOM 엘리먼트가 필요해서,
 * Export.tsx가 이 컴포넌트의 최상위 노드를 직접 가리킬 ref를 넘깁니다.
 */
const PortfolioRenderer = forwardRef<HTMLDivElement, PortfolioTemplateProps>(function PortfolioRenderer(
  props,
  ref
) {
  const Template =
    props.portfolio.template_id === "live"
      ? LiveEditorTemplate
      : props.portfolio.template_id === "minimal"
        ? MinimalTemplate
        : props.portfolio.template_id === "magazine"
          ? MagazineTemplate
          : ResearchTemplate;

  return (
    <div ref={ref}>
      <Template {...props} />
    </div>
  );
});

export default PortfolioRenderer;
