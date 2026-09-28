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
// 값으로 가져오는 건 순수 모듈 하나뿐입니다 — 템플릿 검사기(Node)도 이 파일을 씁니다.
import {
  blockHasContent,
  extractMetrics,
  findComparePair,
  isPhoneShot,
  orderedFields,
  resolveDisplay,
  type ImageSize,
} from "./templateRules.ts";

import type { TemplateData } from "./htmlTemplate";

/** copyKey — 사용자가 "문구 바꾸기"에서 칸 이름을 바꿀 때 쓰는 키(portfolios.copy). */
export const FIELD_LABELS: Array<{ key: keyof PortfolioProjectRow; copyKey: string; ko: string; en: string }> = [
  { key: "context", copyKey: "fieldContext", ko: "맥락 및 배경", en: "BACKGROUND" },
  { key: "problem", copyKey: "fieldProblem", ko: "문제 정의", en: "PROBLEM" },
  { key: "execution", copyKey: "fieldExecution", ko: "실행 내용", en: "EXECUTION" },
  { key: "outcome", copyKey: "fieldOutcome", ko: "핵심 성과", en: "OUTCOME" },
  { key: "reflection", copyKey: "fieldReflection", ko: "배운 점", en: "REFLECTION" },
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
  /** 이미지 url → 원래 크기. 모바일 화면(세로 스크린숏) 판단에 씁니다.
   *  TemplateFrame 이 이미지를 읽어 채웁니다. 없으면 크기 없이 판단합니다. */
  imageSizes?: Record<string, ImageSize>;
}): TemplateData {
  const {
    portfolio,
    projects,
    images = {},
    blocks = {},
    coverUrl = null,
    lang = "ko",
    contact = {},
    imageSizes = {},
  } = input;

  // [2026-09-25] 직무 전환으로 만든 포트폴리오는 공고가 가장 먼저 보고
  // 싶어 하는 필드 하나를 맨 앞으로 올립니다. 순서만 바뀌고 내용은 같습니다.
  // 템플릿은 fields 를 배열로 받으므로 템플릿 파일은 손대지 않아도 됩니다.
  // [2026-09-28] 사용자가 고친 고정 문구(portfolios.copy). 템플릿 문구는 엔진이
  // data-tf-text 로 바꾸고, 칸 이름은 여기서 바꿉니다.
  const copy = portfolio.copy ?? {};
  const copyTable: Record<string, string> = (lang === "en" ? copy.en : copy.ko) ?? {};

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
              key: f.key,
              label: copyTable[f.copyKey]?.trim() || (lang === "en" ? f.en : f.ko),
              value: String(p[f.key] ?? "").trim(),
            })).filter((f) => f.value.length > 0);

      const textBlocks = blk
        .filter((b) => b.content.kind === "text")
        .map((b) => ({
          label: b.content.kind === "text" ? b.content.label.trim() : "",
          text: b.content.kind === "text" ? b.content.text.trim() : "",
        }));
      const imageList = imgs.map((i) => ({ url: i.url, caption: (i.caption ?? "").trim() }));
      const lead = p.depth === "brief" ? p.context.trim() : p.role.trim();

      // [2026-09-28] 보여주기 방식(templateRules.ts). 방식마다 이미지를
      // 어느 자리에 둘지가 다르므로 여기서 나눠 넘깁니다 — 템플릿은
      // 받은 자리만 그립니다(같은 이미지가 두 번 나오지 않게).
      const outcome = p.depth === "brief" ? "" : p.outcome.trim();
      const display = resolveDisplay({
        display: p.display,
        hasText: fields.length > 0 || textBlocks.length > 0,
        textLength:
          fields.reduce((n, f) => n + f.value.length, 0) +
          textBlocks.reduce((n, b) => n + b.text.length, 0) +
          (p.depth === "brief" ? lead.length : 0),
        images: imageList,
        sizes: imageSizes,
        outcome,
      });

      // 성과 지표로 보여줄 때, 성과 칸의 모든 줄이 숫자 카드로 올라갔으면
      // 아래 "핵심 성과" 칸은 뺍니다(같은 글이 두 번 나오지 않게). 숫자 없는
      // 줄이 하나라도 있으면 칸을 그대로 둡니다 — 그 줄이 사라지면 안 됩니다.
      const metrics = display === "metrics" ? extractMetrics(outcome) : [];
      const outcomeLines = outcome.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const shownFields =
        display === "metrics" && metrics.length === outcomeLines.length
          ? fields.filter((f) => f.key !== "outcome")
          : fields;

      let hero: { url: string; caption: string } | null = null;
      let gallery = imageList.slice(1);
      let before: { url: string; caption: string } | null = null;
      let after: { url: string; caption: string } | null = null;
      let phones: Array<{ url: string; caption: string }> = [];
      let visuals: Array<{ url: string; caption: string }> = [];

      if (display === "compare") {
        // 설명에 이전/이후가 없으면(직접 고른 경우) 앞의 두 장을 씁니다.
        const pair = findComparePair(imageList) ?? {
          before: imageList[0],
          after: imageList[1],
          rest: imageList.slice(2),
        };
        before = pair.before;
        after = pair.after;
        gallery = pair.rest;
      } else if (display === "mobile") {
        // 크기를 아직 모르면(처음 그릴 때) 전부 폰 화면으로 봅니다.
        const known = imageList.some((i) => imageSizes[i.url]);
        phones = known ? imageList.filter((i) => isPhoneShot(imageSizes[i.url])) : imageList;
        if (phones.length === 0) phones = imageList;
        gallery = imageList.filter((i) => !phones.includes(i));
      } else if (display === "visual") {
        visuals = imageList;
        gallery = [];
      } else {
        hero = imageList[0] ?? null;
      }

      return {
        id: p.id,
        name: p.name.trim(),
        role: p.role.trim(),
        // 간단히는 한 줄 설명(context)이 리드 문장입니다. 케이스 스터디는
        // 그 값이 아래 fields 에 이미 들어가므로 중복을 피해 역할만 씁니다.
        lead,
        stack: p.stack.filter((t) => t.trim()),
        image: imgs[0]?.url ?? "",
        images: imageList,
        display,
        // 템플릿의 data-tf-if 용 표시. 비어 있으면 그 덩어리가 빠집니다.
        isMobile: display === "mobile" ? "1" : "",
        isVisual: display === "visual" ? "1" : "",
        isCompare: display === "compare" ? "1" : "",
        isMetrics: display === "metrics" ? "1" : "",
        // 성과 지표 — 사용자가 성과 칸에 쓴 줄에서 찾은 숫자만
        metrics: metrics.map((m) => ({ value: m.value, label: m.label })),
        hero: hero?.url ?? "",
        heroCaption: hero?.caption ?? "",
        gallery,
        before: before ?? "",
        after: after ?? "",
        phones,
        visuals,
        // 칸을 안 쓴("간단히") 프로젝트를 모바일·비주얼·전후 비교로 보여줄 때
        // 한 줄 설명이 들어갈 자리. 칸을 쓴 프로젝트는 그 설명이 fields 에 있습니다.
        intro: display !== "brief" && fields.length === 0 && textBlocks.length === 0 ? lead : "",
        fields: shownFields.map((f) => ({ label: f.label, value: f.value })),
        blocks: textBlocks,
      };
    })
    // 아무것도 없는 프로젝트는 내보내지 않습니다. 템플릿에 빈 카드가
    // 생기면 결과물이 미완성으로 보입니다.
    .filter((p) => p.name || p.lead || p.fields.length > 0 || p.images.length > 0 || p.blocks.length > 0)
    .map((p, i) => {
      const no = String(i + 1).padStart(2, "0");
      return {
        ...p,
        no,
        // [2026-09-28] 이름을 비워 둔 프로젝트도 제목 자리가 비지 않게.
        title: p.name || (lang === "en" ? `Project ${no}` : `프로젝트 ${no}`),
        // 케이스 스터디(전체 폭)와 짧은 작업(카드)을 나눕니다. 한 격자에
        // 섞으면 긴 글 옆에 한 줄짜리 카드가 서서 큰 빈칸이 생겼습니다.
        kind: p.display === "brief" ? "brief" : "case",
        // 이미지 없는 카드의 자리표시에 쓰는 첫 글자
        initial: Array.from(p.name || (lang === "en" ? "Project" : "프로젝트"))[0] ?? "",
      };
    });

  // 프로젝트에 적은 스택을 모읍니다. 템플릿에 기술 목록을 박아두면
  // 누가 쓰든 같은 기술이 적히므로, 템플릿은 자리만 두고 값은 여기서 옵니다.
  const stack: string[] = [];
  for (const p of projectData) {
    for (const t of p.stack) if (!stack.includes(t)) stack.push(t);
  }

  const email = (contact.email ?? "").trim();

  return {
    // 엔진이 읽는 예약 키입니다(htmlTemplate.ts). 템플릿의 고정 문구를
    // 영어판으로 바꿀지 여기서 정해집니다 — 머리말·꼬리말처럼 사용자
    // 내용이 아닌 글자는 번역 경로가 닿지 않기 때문입니다.
    lang,
    title: portfolio.title.trim(),
    // 로고 자리 같은 곳에 쓰는 제목 첫 글자
    initial: Array.from(portfolio.title.trim())[0] ?? "",
    copy: { ko: { ...(copy.ko ?? {}) }, en: { ...(copy.en ?? {}) } },
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
    // [2026-09-28] 템플릿이 두 덩어리로 배치할 수 있게 나눈 목록.
    //   caseStudies — 전체 폭 한 건씩(제목·대표 이미지·칸별 글·갤러리)
    //   otherWorks  — 작은 카드 격자(한 줄 설명)
    // projects 는 그대로 둡니다(옛 템플릿·썸네일 호환).
    // 번호는 덩어리마다 01 부터 다시 셉니다(케이스 01·03·05 처럼 건너뛰지 않게).
    caseStudies: renumber(projectData.filter((p) => p.kind === "case")),
    otherWorks: renumber(projectData.filter((p) => p.kind === "brief")),
  };
}

function renumber<T extends { no: string }>(list: T[]): T[] {
  return list.map((p, i) => ({ ...p, no: String(i + 1).padStart(2, "0") }));
}

/**
 * 썸네일용 최소 데이터.
 *
 * 목록에는 포트폴리오가 최대 60건 뜹니다. 썸네일 하나를 그리려고
 * 프로젝트·이미지·블록을 다 읽으면 요청이 수백 번 갑니다. 썸네일에
 * 보이는 건 첫 화면뿐이고, 첫 화면에 필요한 건 제목·소개·직무·연도가
 * 전부입니다. 나머지는 비워 보내면 템플릿이 data-tf-if 로 알아서
 * 지웁니다 — 어차피 화면 밖입니다.
 */
export function buildThumbData(p: {
  title: string;
  summary: string;
  job: string;
  year: string;
  lang?: "ko" | "en";
}): TemplateData {
  return {
    lang: p.lang ?? "ko",
    title: p.title.trim(),
    initial: Array.from(p.title.trim())[0] ?? "",
    summary: p.summary.trim(),
    job: p.job.trim(),
    year: p.year.trim(),
    cover: "",
    projectCount: "",
    stack: [],
    email: "",
    emailHref: "",
    github: "",
    site: "",
    projects: [],
    caseStudies: [],
    otherWorks: [],
  };
}
