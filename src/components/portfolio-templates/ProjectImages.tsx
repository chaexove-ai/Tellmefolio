import type { ProjectImageMap } from "./types";

/**
 * 프로젝트에 올린 이미지들. 템플릿 4종이 공유합니다.
 *
 * [왜 한 컴포넌트인가]
 * 템플릿마다 따로 그리면 네 벌을 똑같이 고쳐야 하고, 실제로는 한 벌만
 * 고치게 됩니다(Export 화면에서 이미 겪은 종류의 문제). 모양 차이는
 * 테두리 색과 모서리 정도라 props 로 넘기면 충분합니다.
 *
 * [왜 lazy 인가]
 * 공개 링크(/p/:id)는 폰에서 열립니다. 프로젝트마다 최대 8장이면 한
 * 페이지에 수십 장이 될 수 있는데, 전부 즉시 받으면 첫 화면이 늦습니다.
 * 다만 **PDF 내보내기 때는 끕니다** — html2canvas 는 화면에 아직 안 그려진
 * 이미지를 빈칸으로 캡처합니다.
 */
export default function ProjectImages({
  projectId,
  images,
  borderColor,
  captionColor,
  rounded = "rounded-lg",
  eager = false,
  className = "",
}: {
  projectId: string;
  images: ProjectImageMap;
  borderColor: string;
  captionColor: string;
  rounded?: string;
  /** PDF 캡처처럼 "전부 그려져 있어야" 하는 상황에서 true. */
  eager?: boolean;
  className?: string;
}) {
  const list = images[projectId] ?? [];
  if (list.length === 0) return null;

  // 한 장이면 전체폭, 두 장 이상이면 2열. 3장이면 마지막 한 장이 홀로
  // 남는데, 그 한 장만 전체폭으로 늘려 빈칸이 생기지 않게 합니다.
  const single = list.length === 1;

  // 폰에서는 2열이 너무 좁습니다 — 템플릿이 좌우 여백을 크게 쓰기 때문에
  // 375px 화면에서 한 칸이 140px 밖에 안 됩니다. 공개 링크가 열리는 주
  // 기기라 좁을 때는 한 줄에 하나씩 둡니다.
  return (
    <div className={`${single ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-3"} ${className}`}>
      {list.map((img, i) => {
        const isLastOdd = !single && list.length % 2 === 1 && i === list.length - 1;
        return (
          <figure key={img.id} className={isLastOdd ? "sm:col-span-2" : undefined}>
            <img
              src={img.url}
              alt={img.caption || ""}
              loading={eager ? "eager" : "lazy"}
              className={`w-full ${rounded}`}
              style={{ border: `1px solid ${borderColor}`, display: "block" }}
            />
            {img.caption.trim() && (
              <figcaption className="text-[11px] mt-1.5" style={{ color: captionColor }}>
                {img.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
