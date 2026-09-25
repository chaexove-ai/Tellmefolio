/**
 * 포트폴리오 데이터를 HTML 템플릿이 읽는 모양으로 바꿉니다.
 *
 * 템플릿은 우리 타입(PortfolioRow 등)을 모릅니다. 알아야 할 이유도
 * 없습니다 — 템플릿 만드는 사람은 디자이너이고, data-tf 에 적는 이름이
 * 계약의 전부여야 합니다. 그 번역을 여기 한 곳에서 합니다.
 *
 * 이름을 바꾸면 기존 템플릿이 조용히 빈칸이 됩니다. 이 파일이 곧
 * 템플릿 작성자와의 약속이라 생각하고 고치세요.
 */

import type { PortfolioProjectRow, PortfolioRow, ProjectImageMap } from "./portfolios";
import type { BlockMap } from "./blocks";
import { blockHasContent } from "./blocks";

import type { TemplateData } from "./htmlTemplate";
import { orderedFields } from "./jobSwitch";

const FIELD_LABELS: Array<{ key: keyof PortfolioProjectRow; ko: string; en: string }> = [
  { key: "context", ko: "맥락 및 배경", en: "BACKGROUND" },
  { key: "problem", ko: "문제 정의", en: "PROBLEM" },
  { key: "execution", ko: "실행 내용", en: "EXECUTION" },
  { key: "outcome", ko: "핵심 성과", en: "OUTCOME" },
  { key: "reflection", ko: "배운 점", en: "REFLECTION" },
];

export function buildTemplateData(input: {
  portfolio: PortfolioRow;
  projects: PortfolioProjectRow[];
  images?: ProjectImageMap;
  blocks?: BlockMap;
  coverUrl?: string | null;
  lang?: "ko" | "en";
  /** 연락처. 계정 이메일과 연결된 GitHub 에서 옵니다. 비면 템플릿의
   *  연락처 버튼이 data-tf-if 로 사라집니다. */
  contact?: { email?: string | null; github?: string | null; site?: string | null };
}): TemplateData {
  const {
    portfolio,
    projects,
    images = {},
    blocks = {},
    coverUrl = null,
    lang = "ko",
    contact = {},
  } = input;

  // [2026-09-25] 직무 전환으로 만든 포트폴리오는 공고가 가장 먼저 보고
  // 싶어 하는 필드 하나를 맨 앞으로 올립니다. 순서만 바뀌고 내용은 같습니다.
  // 템플릿은 fields 를 배열로 받으므로 템플릿 파일은 손대지 않아도 됩니다.
  const fieldOrder = orderedFields(portfolio.lead_field).map(
    (key) => FIELD_LABELS.find((f) => f.key === key)!
  );

  const projectData = projects
    .map((p) => {
      const imgs = images[p.id] ?? [];
      const blk = (blocks[p.id] ?? []).filter(blockHasContent);

      // "간단히" 로 둔 프로젝트는 5필드를 내보내지 않습니다. 값은 DB 에
      // 그대로 있고 여기서 넘기지 않을 뿐이라, 케이스 스터디로 되돌리면
      // 다시 나옵니다.
      const fields =
        p.depth === "brief"
          ? []
          : fieldOrder.map((f) => ({
              label: lang === "en" ? f.en : f.ko,
              value: String(p[f.key] ?? "").trim(),
            })).filter((f) => f.value.length > 0);

      return {
        id: p.id,
        name: p.name.trim(),
        role: p.role.trim(),
        // 간단히는 한 줄 설명(context)이 리드 문장입니다. 케이스 스터디는
        // 그 값이 아래 fields 에 이미 들어가므로 중복을 피해 역할만 씁니다.
        lead: p.depth === "brief" ? p.context.trim() : p.role.trim(),
        stack: p.stack.filter((t) => t.trim()),
        image: imgs[0]?.url ?? "",
        images: imgs.map((i) => ({ url: i.url, caption: i.caption })),
        fields,
        blocks: blk
          .filter((b) => b.content.kind === "text")
          .map((b) => ({
            label: b.content.kind === "text" ? b.content.label.trim() : "",
            text: b.content.kind === "text" ? b.content.text.trim() : "",
          })),
      };
    })
    // 아무것도 없는 프로젝트는 내보내지 않습니다. 템플릿에 빈 카드가
    // 생기면 결과물이 미완성으로 보입니다.
    .filter((p) => p.name || p.lead || p.fields.length > 0 || p.images.length > 0 || p.blocks.length > 0);

  // 프로젝트에 적은 스택을 모읍니다. 템플릿에 기술 목록을 박아두면
  // 누가 쓰든 같은 기술이 적히므로, 템플릿은 자리만 두고 값은 여기서 옵니다.
  const stack: string[] = [];
  for (const p of projectData) {
    for (const t of p.stack) if (!stack.includes(t)) stack.push(t);
  }

  const email = (contact.email ?? "").trim();

  return {
    title: portfolio.title.trim(),
    summary: (portfolio.summary ?? "").trim(),
    job: portfolio.job?.trim() || "",
    year: portfolio.year?.trim() || String(new Date(portfolio.created_at).getFullYear()),
    cover: coverUrl ?? "",
    // 숫자는 실제로 셀 수 있는 것만 넘깁니다. 지어낸 숫자가 들어간
    // 포트폴리오는 한 줄만 들켜도 나머지 전부를 의심받습니다.
    projectCount: projectData.length > 0 ? String(projectData.length) : "",
    stack: stack.slice(0, 24),
    email,
    // 템플릿이 <a data-tf="emailHref"> 로 링크 자리를 받습니다 — 눌러서
    // 바로 메일이 열려야 연락처 구실을 합니다.
    emailHref: email ? `mailto:${email}` : "",
    github: (contact.github ?? "").trim(),
    site: (contact.site ?? "").trim(),
    projects: projectData,
  };
}
