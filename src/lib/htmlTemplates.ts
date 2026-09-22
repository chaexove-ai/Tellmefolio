/**
 * HTML 템플릿 목록.
 *
 * 템플릿 파일은 public/templates/<id>.html 입니다. 목록을 코드에 두는
 * 이유는, 파일이 있다고 해서 쓸 수 있는 템플릿은 아니기 때문입니다 —
 * data-tf 가 제대로 달려 있는지, 인쇄 규칙이 있는지는 사람이 확인해야
 * 합니다. 여기 적혀야 고를 수 있습니다.
 *
 * [새 템플릿을 넣을 때]
 * 1. public/templates/<id>.html 에 파일을 둡니다
 * 2. Tailwind 를 썼다면 CSS 를 뽑아 인라인합니다 (CDN 은 쓰지 않습니다 —
 *    공개 링크가 외부를 기다리고, 내보낸 HTML 을 오프라인에서 열면
 *    스타일이 전부 죽습니다)
 * 3. @media print 를 넣습니다. 웹용 레이아웃을 그대로 인쇄하면
 *    검은 배경이 종이에 그대로 찍힙니다
 * 4. 여기 한 줄 추가합니다
 *
 * [템플릿에 넣으면 안 되는 것]
 * · 지어낸 숫자 ("42+ Projects", "99% 만족도")
 * · 박아둔 기술·고객사 목록 — 누가 써도 같은 내용이 나옵니다
 * · 입력 폼 — 내보낸 파일에는 받아줄 서버가 없습니다
 * · 외부 스크립트·이미지 — 오프라인에서 깨집니다
 */

export interface HtmlTemplate {
  id: string;
  name: string;
  desc: string;
  /** 어두운 배경인지 — 미리보기 자리의 바탕색을 맞추는 데 씁니다. */
  dark: boolean;
}

export const htmlTemplates: HtmlTemplate[] = [
  {
    id: "minimal-serif",
    name: "미니멀 세리프",
    desc: "여백과 세리프 제목. 디자이너·기획 직군에 맞습니다",
    dark: true,
  },
  {
    id: "devcore",
    name: "데브코어",
    desc: "굵은 타이포와 형광 포인트. 개발 직군에 맞습니다",
    dark: true,
  },
];

export function htmlTemplateName(id: string): string {
  return htmlTemplates.find((t) => t.id === id)?.name ?? id;
}

export const DEFAULT_HTML_TEMPLATE = "minimal-serif";
