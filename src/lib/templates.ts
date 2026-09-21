import type { TemplateId } from "./portfolios";

/**
 * 디자인 템플릿 목록. StylePanel.tsx(선택 UI)와 Export.tsx(반영 확인
 * 문구)가 같은 목록을 봐야 해서 하나로 뺐습니다 — 전에는 Export.tsx 쪽이
 * "라이브에디터"로 고정 문자열이라 실제 선택과 항상 어긋났습니다.
 */
export const templates: Array<{ id: TemplateId; name: string; desc: string }> = [
  { id: "research", name: "연구노트", desc: "학술적이고 정제된 레이아웃" },
  { id: "live", name: "라이브에디터", desc: "개발자 감성의 다크 코드 스타일" },
  { id: "minimal", name: "클린 미니멀", desc: "여백 중심의 깔끔한 구성" },
  { id: "magazine", name: "매거진형", desc: "이미지 중심의 감각적인 레이아웃" },
];

export function templateName(id: string): string {
  return templates.find((t) => t.id === id)?.name ?? id;
}
