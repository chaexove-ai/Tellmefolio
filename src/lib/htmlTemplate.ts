/**
 * HTML 템플릿 채우기.
 *
 * [왜 이 방식인가]
 * 템플릿을 React 컴포넌트로 두면 디자인을 바꿀 때마다 코드를 고쳐야 하고,
 * 결국 템플릿 종류가 늘지 않습니다. 정형화 느낌의 뿌리가 거기 있었습니다.
 * 템플릿을 그냥 HTML 파일로 두면 디자이너가 원하는 대로 만들어 넣을 수
 * 있고, 브라우저로 열어 그대로 확인할 수도 있습니다.
 *
 * [채우는 규칙 — 네 가지뿐입니다]
 *
 *   data-tf="키"            그 자리의 글자를 바꿉니다.
 *                           <img> 면 src, <a> 면 href 를 바꿉니다.
 *
 *   data-tf-repeat="목록"    그 덩어리를 목록 수만큼 복제합니다.
 *                           안쪽의 data-tf 는 항목 기준으로 풀립니다.
 *
 *   data-tf-if="키"          값이 비어 있으면 그 덩어리를 통째로 지웁니다.
 *
 *   data-tf="."             반복 안에서 "항목 자체"를 뜻합니다
 *                           (문자열 배열용 — 예: 스택 태그).
 *
 * 템플릿 파일에 원래 적혀 있던 예시 글자는 그대로 둬도 됩니다. 채울 때
 * 덮어쓰고, 브라우저로 열면 그 글자가 보여서 템플릿 자체의 미리보기가
 * 됩니다.
 *
 * [안전에 대해]
 * 템플릿은 **우리가 만든 파일만** 씁니다(public/templates/). 사용자가
 * 올린 HTML 을 여기 넣으면 그 순간 임의 스크립트 실행 통로가 됩니다.
 * 사용자 내용은 textContent 로만 넣기 때문에 내용 쪽으로는 스크립트가
 * 들어갈 수 없습니다 — innerHTML 로 바꾸지 마세요.
 */

export type TemplateValue = string | number | null | undefined;

export interface TemplateData {
  [key: string]: TemplateValue | TemplateData | Array<TemplateData | string>;
}

const REPEAT = "data-tf-repeat";
const BIND = "data-tf";
const IF = "data-tf-if";

function lookup(data: TemplateData | string, key: string): unknown {
  if (key === ".") return data;
  if (typeof data === "string") return undefined;
  // "project.name" 처럼 점으로 파고들 수 있게 — 템플릿 쪽에서 한 단계
  // 위 값을 참조해야 하는 경우가 생깁니다.
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, data);
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "";
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v);
}

/** 한 요소에 값 하나를 꽂습니다. 태그에 따라 들어가는 자리가 다릅니다. */
function applyBinding(el: Element, value: unknown) {
  const text = asText(value);

  // [2026-09-23] instanceof 대신 tagName 을 봅니다.
  //
  // instanceof HTMLImageElement 는 그 요소가 "이 창의" HTMLImageElement
  // 일 때만 참입니다. 다른 document 에서 만든 요소나, 브라우저가 아닌
  // 곳(검증 스크립트)에서는 생성자가 달라 조용히 빗나갑니다 — 이미지가
  // src 대신 글자로 채워지는 식으로요. tagName 은 어디서든 같습니다.
  const tag = el.tagName.toUpperCase();

  if (tag === "IMG") {
    if (text) {
      el.setAttribute("src", text);
      el.removeAttribute("srcset");
    } else {
      // 이미지가 없으면 그 자리를 비웁니다. 깨진 이미지 아이콘이 남는
      // 것보다 아예 없는 편이 낫습니다.
      el.remove();
    }
    return;
  }

  if (tag === "A") {
    if (text) el.setAttribute("href", text);
    else el.removeAttribute("href");
    return;
  }

  // 사용자 내용은 반드시 textContent 로. innerHTML 로 바꾸면 그 순간
  // 사용자가 쓴 글이 실행 가능한 마크업이 됩니다.
  el.textContent = text;
}

/**
 * 한 스코프 안의 요소들을 채웁니다.
 *
 * 반복을 먼저 처리합니다 — 반복 안쪽의 data-tf 는 바깥 스코프가 아니라
 * 항목 스코프로 풀려야 하기 때문입니다. 반복을 나중에 처리하면 안쪽
 * 값들이 한 번 바깥 기준으로 덮어써진 뒤 복제됩니다.
 */
function fillScope(root: Element | DocumentFragment, data: TemplateData | string) {
  // 1) 조건 — 지울 것을 먼저 지워야 뒤 작업이 줄어듭니다.
  for (const el of Array.from(root.querySelectorAll(`[${IF}]`))) {
    if (!isDirectScope(el, root)) continue;
    const key = el.getAttribute(IF) ?? "";
    const negate = key.startsWith("!");
    const value = lookup(data, negate ? key.slice(1) : key);
    const keep = negate ? !truthy(value) : truthy(value);
    if (!keep) el.remove();
    else el.removeAttribute(IF);
  }

  // 2) 반복
  for (const tpl of Array.from(root.querySelectorAll(`[${REPEAT}]`))) {
    if (!isDirectScope(tpl, root)) continue;
    const key = tpl.getAttribute(REPEAT) ?? "";
    const raw = lookup(data, key);
    const items = Array.isArray(raw) ? raw : [];
    const parent = tpl.parentElement;
    if (!parent) continue;

    if (items.length === 0) {
      // 항목이 없으면 본보기까지 지웁니다. 템플릿에 써둔 예시가
      // 결과물에 남으면 사용자 것이 아닌 글이 섞입니다.
      tpl.remove();
      continue;
    }

    const frag = tpl.ownerDocument.createDocumentFragment();
    for (const item of items) {
      const clone = tpl.cloneNode(true) as Element;
      clone.removeAttribute(REPEAT);
      fillScope(clone, item as TemplateData | string);
      frag.appendChild(clone);
    }
    parent.replaceChild(frag, tpl);
  }

  // 3) 값
  for (const el of Array.from(root.querySelectorAll(`[${BIND}]`))) {
    if (!isDirectScope(el, root)) continue;
    const key = el.getAttribute(BIND) ?? "";
    applyBinding(el, lookup(data, key));
    el.removeAttribute(BIND);
  }
}

/**
 * 이 요소가 root 스코프에 "직접" 속하는지 — 중간에 다른 반복 덩어리가
 * 끼어 있으면 그건 그 반복이 자기 항목으로 처리할 몫입니다.
 */
function isDirectScope(el: Element, root: Element | DocumentFragment): boolean {
  let p = el.parentElement;
  while (p && p !== root) {
    if (p.hasAttribute(REPEAT)) return false;
    p = p.parentElement;
  }
  return true;
}

/**
 * 템플릿 HTML 에 데이터를 채워 완성된 HTML 문자열을 돌려줍니다.
 *
 * 브라우저의 DOMParser 를 씁니다 — 정규식으로 HTML 을 다루면 중첩과
 * 따옴표에서 반드시 틀립니다.
 */
export function fillTemplate(templateHtml: string, data: TemplateData): string {
  const doc = new DOMParser().parseFromString(templateHtml, "text/html");
  fillScope(doc.body, data);

  // 템플릿 파일의 주석은 템플릿 만드는 사람을 위한 것입니다. 사용자
  // 포트폴리오의 소스 보기에 우리 구현 설명이 실려 나갈 이유가 없습니다.
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  for (const c of comments) c.remove();
  // 남은 표시는 지웁니다 — 데이터에 없는 키가 템플릿에 있을 수 있고,
  // 그 흔적이 결과물 HTML 에 남을 이유가 없습니다.
  for (const el of Array.from(doc.querySelectorAll(`[${BIND}],[${REPEAT}],[${IF}]`))) {
    el.removeAttribute(BIND);
    el.removeAttribute(REPEAT);
    el.removeAttribute(IF);
  }
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/** 템플릿 파일을 받아옵니다. public/templates/ 아래 우리 파일만 씁니다. */
export async function loadTemplate(id: string): Promise<string> {
  const res = await fetch(`/templates/${id}.html`);
  if (!res.ok) throw new Error(`템플릿을 불러오지 못했습니다: ${id}`);
  return res.text();
}
