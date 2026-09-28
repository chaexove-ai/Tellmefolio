/**
 * 탭 안에서만 살아 있는 임시 저장(sessionStorage). 위저드가 새로고침·뒤로가기에
 * 입력을 잃지 않게 하는 용도입니다 — 오래 남길 것은 여기 두지 않습니다.
 * 사생활 보호 모드 등에서 저장소가 막히면 조용히 넘어갑니다.
 */
export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 가득 찼거나 막혀 있음 — 저장 못 해도 화면은 그대로 동작
  }
}

export function clearSession(prefix: string): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    // 무시
  }
}

/** 위저드가 쓰는 키. 포트폴리오를 만들고 나면 clearSession(WIZARD_PREFIX) 로 비웁니다. */
export const WIZARD_PREFIX = "tf:wizard:";
export const WIZARD_SOURCE_KEY = `${WIZARD_PREFIX}source`;
