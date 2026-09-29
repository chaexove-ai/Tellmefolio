/**
 * [2026-09-29] 템플릿 갤러리에서 "이 디자인으로 시작하기"를 누른 뒤 만들어질
 * 포트폴리오에 그 디자인(템플릿·분위기)을 입히는 약속.
 *
 * 포트폴리오를 만드는 길이 여럿입니다(자료로 만들기는 화면에서, 대화로
 * 만들기는 서버 함수에서). 길마다 손대는 대신, 고른 디자인을 이 기기에
 * 적어 두고 편집기가 "방금 새로 만든" 포트폴리오를 처음 열 때 한 번 입힙니다.
 *
 * 조건: 디자인을 고른 뒤에 만들어진 포트폴리오이고, 고른 지 3시간 안.
 * 한 번 쓰면 지웁니다. 저장소가 막혀 있으면 조용히 건너뜁니다.
 */
import { normalizeTheme, type PortfolioTheme } from "./themeRules";

const KEY = "tf-pending-design";
const TTL = 3 * 60 * 60 * 1000;

export interface PendingDesign {
  templateId: string;
  theme: PortfolioTheme;
  label: string;
  at: number;
}

export function setPendingDesign(d: Omit<PendingDesign, "at">) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() }));
  } catch {
    /* 저장이 막혀 있으면 표시만 못 합니다 */
  }
}

export function peekPendingDesign(): PendingDesign | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as PendingDesign;
    if (!d || typeof d.templateId !== "string" || Date.now() - d.at > TTL) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { ...d, theme: normalizeTheme(d.theme) };
  } catch {
    return null;
  }
}

export function clearPendingDesign() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/** 이 포트폴리오가 디자인을 고른 "뒤에" 만들어졌으면 그 디자인을 돌려주고 지웁니다. */
export function takePendingDesignFor(createdAt: string): PendingDesign | null {
  const d = peekPendingDesign();
  if (!d) return null;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created) || created < d.at - 5_000) return null;
  clearPendingDesign();
  return d;
}
