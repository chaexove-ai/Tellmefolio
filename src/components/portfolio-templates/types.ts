import type { PortfolioProjectRow, PortfolioRow } from "../../lib/portfolios";

/**
 * 4개 템플릿(ResearchTemplate/LiveEditorTemplate/MinimalTemplate/
 * MagazineTemplate)이 공통으로 받는 props. PortfolioRenderer가 template_id
 * 를 보고 이 중 하나를 고릅니다.
 */
export interface PortfolioTemplateProps {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  /** 대표 이미지 공개 URL. 없으면 null — 각 템플릿이 알아서 대체 처리합니다
   *  (표지를 아예 생략하거나, GrainCover 같은 절차적 배경으로 대신). */
  coverUrl: string | null;
  /** "직접 편집"에서 고른 서체 — 본문에 적용합니다. 템플릿별 강조 타이포
   *  (연구노트의 세리프 제목, 라이브에디터의 모노스페이스 라벨 등)는
   *  이 값과 별개로 각 템플릿이 자체적으로 얹습니다. */
  bodyFontStack: string;
  /** Export.tsx의 "내보내기 언어 선택"과 연결됩니다. portfolio/projects의
   *  실제 텍스트(제목·본문 등)는 이미 번역된 상태로 들어오지만, 템플릿이
   *  자체적으로 그리는 구획 라벨("맥락 및 배경" 같은 섹션 제목, "제목
   *  없음" 같은 fallback 문구)은 데이터가 아니라 코드에 박혀 있어서 여기
   *  별도로 언어를 알려줘야 같이 바뀝니다. 기본값은 "ko".*/
  lang?: "ko" | "en";
}

/** projects 중 실제로 채워진 필드가 하나라도 있는지 — 완전히 빈 프로젝트는
 *  템플릿에서 건너뜁니다(제목만 있고 나머지가 빈 새 프로젝트 등). */
export function hasContent(p: PortfolioProjectRow): boolean {
  return Boolean(
    p.name.trim() ||
      p.context.trim() ||
      p.role.trim() ||
      p.problem.trim() ||
      p.execution.trim() ||
      p.outcome.trim() ||
      p.reflection.trim()
  );
}
