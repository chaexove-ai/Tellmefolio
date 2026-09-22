import type { PortfolioProjectRow, PortfolioRow } from "../../lib/portfolios";
import type { BlockMap } from "../../lib/blocks";
import { blockHasContent } from "../../lib/blocks";

/** 프로젝트 id → 그 프로젝트의 이미지들(공개 URL + 설명). 템플릿은 경로가
 *  아니라 이미 URL 로 바뀐 값을 받습니다 — getPublicUrl 이 비동기라
 *  렌더링 중에 부를 수 없기 때문입니다. */
export type ProjectImageMap = Record<
  string,
  Array<{ id: string; url: string; caption: string }>
>;

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
  /** [2026-09-22] 프로젝트별 이미지. 없으면 빈 객체. */
  images?: ProjectImageMap;
  /** [2026-09-22] 프로젝트에 붙은 자유 블록. 5필드 뒤에 그립니다. */
  blocks?: BlockMap;
  /** 이미지를 lazy 가 아니라 즉시 받습니다. PDF 내보내기에서 반드시 true —
   *  html2canvas 는 아직 안 받아진 이미지를 빈칸으로 캡처합니다. 공개
   *  링크처럼 사람이 스크롤하며 보는 화면에서는 끄는 편이 빠릅니다. */
  eagerImages?: boolean;
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

/**
 * [2026-09-22] 이미지만 있는 프로젝트도 보여줍니다.
 *
 * hasContent 는 글만 봅니다. 이미지 중심으로 쓰는 "간단히" 프로젝트는
 * 제목과 사진 몇 장이 전부일 수 있는데, 그걸 빈 프로젝트로 보고 건너뛰면
 * 올린 이미지가 결과물에 나타나지 않습니다.
 */
export function visibleProjects(
  projects: PortfolioProjectRow[],
  images: ProjectImageMap = {},
  blocks: BlockMap = {}
): PortfolioProjectRow[] {
  return projects.filter(
    (p) =>
      hasContent(p) ||
      (images[p.id]?.length ?? 0) > 0 ||
      (blocks[p.id] ?? []).some(blockHasContent)
  );
}

/** "간단히" 로 둔 프로젝트인지. 설계는 docs/editor-redesign.md 3절. */
export function isBrief(p: PortfolioProjectRow): boolean {
  return p.depth === "brief";
}

/**
 * 이 프로젝트에서 그릴 케이스 스터디 필드들.
 *
 * "간단히" 는 빈 배열을 돌려줍니다 — 그 모드의 한 줄 설명(context)은
 * 라벨 없이 제목 아래 리드 문장으로 그리기 때문입니다. 라벨을 붙이면
 * 한 줄짜리 글에 "맥락 및 배경" 같은 제목이 얹혀서 도로 케이스 스터디처럼
 * 보입니다.
 *
 * **값은 지우지 않습니다.** 간단히로 바꿔도 problem·execution·outcome·
 * reflection 은 DB에 그대로 있고, 여기서 안 그릴 뿐입니다. 다시 케이스
 * 스터디로 바꾸면 쓰던 글이 돌아옵니다.
 */
export function caseStudyFields<T extends { key: string }>(
  p: PortfolioProjectRow,
  all: T[]
): T[] {
  return isBrief(p) ? [] : all;
}

/** "간단히" 프로젝트의 한 줄 설명. 케이스 스터디에서는 null(본문에서 그림). */
export function briefLead(p: PortfolioProjectRow): string | null {
  if (!isBrief(p)) return null;
  const line = p.context.trim();
  return line || null;
}
