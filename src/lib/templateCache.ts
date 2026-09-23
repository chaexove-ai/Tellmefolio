/**
 * 템플릿 HTML 을 한 번만 받아 공유합니다.
 *
 * [왜 따로 뺐나 — 2026-09-23]
 * 원래 TemplateFrame 안에 있었습니다. 썸네일(PortfolioThumb)이 같은
 * 템플릿을 쓰게 되면서, 캐시가 컴포넌트마다 따로 있으면 커뮤니티 한
 * 화면에서 같은 파일을 수십 번 받게 됩니다. 캐시는 "누가 쓰든 한 벌"
 * 이어야 의미가 있습니다.
 *
 * [모르는 id 는 기본 템플릿으로]
 * template_id 컬럼에는 옛 React 템플릿 이름(research·live·magazine)이
 * 남아 있는 행이 있습니다. 그대로 fetch 하면 404 가 나고 화면이 빕니다.
 * 기본 템플릿으로 돌려두면 적어도 내용은 보입니다.
 */

import { loadTemplate } from "./htmlTemplate";
import { DEFAULT_HTML_TEMPLATE, htmlTemplates } from "./htmlTemplates";

const cache = new Map<string, Promise<string>>();

/** 실제로 그릴 템플릿 id. 모르는 값이면 기본 템플릿입니다. */
export function resolveTemplateId(id: string): string {
  return htmlTemplates.some((t) => t.id === id) ? id : DEFAULT_HTML_TEMPLATE;
}

export function getTemplate(id: string): Promise<string> {
  const safeId = resolveTemplateId(id);
  let p = cache.get(safeId);
  if (!p) {
    p = loadTemplate(safeId);
    // 실패한 약속을 캐시에 남기면 이후 모든 호출이 같은 실패를 되풀이합니다.
    p.catch(() => cache.delete(safeId));
    cache.set(safeId, p);
  }
  return p;
}
