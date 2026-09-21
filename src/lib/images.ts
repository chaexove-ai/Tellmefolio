/**
 * 업로드 전 이미지 축소.
 *
 * [왜 필요한가]
 * 그전까지 표지는 고른 파일이 그대로 올라갔습니다. 요즘 폰 사진은 한 장에
 * 4~8MB 이고, 그게 그대로 Storage 에 저장돼 방문자에게 전송됩니다.
 *
 * 문제가 세 겹입니다.
 *   1. 채용 담당자가 링크를 열었을 때 첫 화면이 늦게 뜹니다. 이 서비스의
 *      결과물이 평가받는 그 순간입니다.
 *   2. Storage egress 가 조회 수에 비례해 늘어납니다.
 *   3. 화질 이득은 없습니다 — 표지는 화면에서 기껏해야 폭 1000px 언저리로
 *      그려지는데 4000px 원본을 보내는 셈입니다.
 *
 * 긴 변 1600px, WebP 품질 0.82 로 줄이면 보통 200KB 아래로 떨어집니다.
 * 표지 용도로는 눈에 띄는 차이가 없는 수준입니다.
 *
 * [왜 서버가 아니라 브라우저인가]
 * 서버(Edge Function)로 보내면 원본을 한 번 전송한 뒤 다시 받아야 해서,
 * 줄이려는 그 전송을 오히려 한 번 더 합니다. 브라우저에서 줄이면 작아진
 * 것만 올라갑니다. canvas 는 모든 대상 브라우저에 있습니다.
 *
 * [실패하면 원본을 씁니다]
 * 이 함수는 던지지 않습니다. 줄이는 데 실패했다고 업로드까지 막을 이유가
 * 없습니다 — 큰 파일이 올라가는 것이 아무것도 안 올라가는 것보다 낫습니다.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** 이 크기 아래면 건드리지 않습니다. 이미 작은 파일을 다시 인코딩하면
 *  용량이 오히려 늘거나 화질만 깎입니다. */
const SKIP_UNDER_BYTES = 300 * 1024;

export interface ShrinkResult {
  file: File;
  /** 원본을 그대로 쓰기로 했으면 false. 호출부가 안내 문구를 바꾸는 데 씁니다. */
  changed: boolean;
  originalBytes: number;
  bytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했습니다."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function shrinkImage(file: File): Promise<ShrinkResult> {
  const keepOriginal: ShrinkResult = {
    file,
    changed: false,
    originalBytes: file.size,
    bytes: file.size,
  };

  // GIF 는 건드리지 않습니다 — canvas 로 다시 그리면 애니메이션이 첫
  // 프레임만 남습니다. SVG 도 그대로 둡니다(벡터라 이미 작고, 래스터로
  // 바꾸면 오히려 손해입니다).
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return keepOriginal;
  }
  if (file.size < SKIP_UNDER_BYTES) return keepOriginal;

  try {
    const img = await loadImage(file);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return keepOriginal;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await toBlob(canvas, "image/webp", QUALITY);
    if (!blob) return keepOriginal;

    // 줄였는데 더 커졌으면(이미 잘 압축된 원본일 때 생깁니다) 원본을 씁니다.
    if (blob.size >= file.size) return keepOriginal;

    const base = file.name.replace(/\.[^.]+$/, "") || "cover";
    return {
      file: new File([blob], `${base}.webp`, { type: "image/webp" }),
      changed: true,
      originalBytes: file.size,
      bytes: blob.size,
    };
  } catch {
    return keepOriginal;
  }
}

/** "4.2MB" 처럼 사람이 읽는 크기. 안내 문구용. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
