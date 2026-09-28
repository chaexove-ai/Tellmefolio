/**
 * 이미지의 원래 크기를 재서 기억합니다. [2026-09-28]
 *
 * "모바일 화면" 자동 판단(세로 스크린숏인가)에 필요합니다. 크기를 DB 에
 * 저장하지 않는 이유: 이미 올라간 이미지에는 값이 없고, 어차피 화면에
 * 그릴 때 브라우저가 받는 파일이라 여기서 재는 비용이 거의 없습니다.
 */
import { useEffect, useState } from "react";
import type { ImageSize } from "./templateRules";

const cache = new Map<string, Promise<ImageSize | null>>();
const known = new Map<string, ImageSize>();

function measure(url: string): Promise<ImageSize | null> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const s = { w: img.naturalWidth, h: img.naturalHeight };
        known.set(url, s);
        resolve(s);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}

/** url 목록의 크기. 아는 것부터 바로 돌려주고, 새로 잰 게 생기면 다시 그립니다. */
export function useImageSizes(urls: string[]): Record<string, ImageSize> {
  const key = urls.join("\n");
  const snapshot = () => {
    const out: Record<string, ImageSize> = {};
    for (const u of urls) {
      const s = known.get(u);
      if (s) out[u] = s;
    }
    return out;
  };
  const [sizes, setSizes] = useState<Record<string, ImageSize>>(snapshot);

  useEffect(() => {
    let alive = true;
    setSizes(snapshot());
    const missing = urls.filter((u) => u && !known.has(u));
    if (missing.length === 0) return;
    void Promise.all(missing.map(measure)).then(() => alive && setSizes(snapshot()));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return sizes;
}
