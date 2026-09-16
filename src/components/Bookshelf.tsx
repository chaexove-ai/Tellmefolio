import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import GrainCover from "./GrainCover";
import type { Portfolio } from "../mockData";

interface BookshelfProps {
  portfolios: Portfolio[];
}

/**
 * "내 서재" 상단 전용 미니 책장.
 *
 * 책등(spine)이 꽂혀 있다가 커서를 올리면 책이 실제로 넓어지며(width)
 * 앞으로 살짝 떠오르고, 책등 대신 표지(cover)가 서서히 나타나는 인터랙션.
 * 폭이 진짜 레이아웃 값이라 hover 한 책이 넓어지는 만큼 옆 책들이 자연스럽게
 * 옆으로 밀립니다(index.css `.book`). 책등/표지는 같은 자리에 겹쳐 두고
 * opacity 로만 교차 전환합니다(.book-face-spine / .book-face-cover).
 *
 * 표지 그림은 실제 썸네일이 아직 없어 GrainCover(절차적 그라디언트 커버)로
 * 대체합니다 — 포트폴리오 id 가 seed 라 같은 책은 언제나 같은 표지를 갖고,
 * 실제 썸네일이 생기면 이 자리를 <img> 로 바꾸면 됩니다.
 *
 * ── 처음에 3D로 두 면을 맞대 돌렸다가 폭 확장 방식으로 바꾼 이유 ──────
 * 책등 면과 표지 면을 실제 3D로 맞대 돌리는(rotateY) 버전을 먼저 만들었는데,
 * 실기기에서 두 가지 문제가 나왔습니다. (1) 회전 기준점이 완전히 일치하지
 * 않으면 두 면이 3D 공간에서 서로 뚫고 지나가며 글자가 겹쳐 보였고, (2)
 * 표지의 GrainCover 가 mix-blend-mode 로 그레인 질감을 내는데 격리 없이
 * 겹치니 그 블렌드가 뒤에 있는 책등 글자와 섞여 마치 투명한 것처럼
 * 비쳐 보였습니다. 게다가 (3) position:absolute라 레이아웃 흐름에서 완전히
 * 빠져 있어서, 옆 책이 전혀 밀리지 않고 표지가 그냥 옆 책 위에 겹쳐
 * 보였습니다. 지금 방식(폭 확장 + opacity 교차 전환)은 이 세 가지를 구조
 * 자체로 피합니다 — 두 얼굴이 같은 자리에서 겹치지 않고, 폭 변화가 진짜
 * 레이아웃이라 옆 책이 밀려납니다.
 *
 * ── 잘림 문제를 어떻게 피했는가 ────────────────────────────────
 * 가로 스크롤 컨테이너는 CSS 규칙상 세로 방향도 함께 자릅니다
 * (overflow-x: auto 를 주면 overflow-y 도 visible 로 둘 수 없습니다).
 * 그래서 두 가지를 지켰습니다.
 *
 *   1. 제목은 스크롤 컨테이너 "바깥" 표시줄(readout)에 띄웁니다.
 *      말풍선을 책 위에 절대배치하면 반드시 잘립니다.
 *   2. perspective-origin 을 `50% 100%`(선반 바닥)로 잡았습니다.
 *      소실점이 위쪽에 있으면 translateY 로 들어올릴 때 책의 아랫부분이
 *      아래로 밀려나 잘립니다. 바닥에 두면 책이 위로만 커집니다.
 *      위쪽은 pt-10 여유로 처리합니다.
 *
 * ── 그 외 ─────────────────────────────────────────────────────
 * - `title` 속성을 쓰지 않습니다. 브라우저 기본 툴팁이 readout 과
 *   겹쳐서 두 개가 동시에 뜹니다.
 * - 책등 글자는 nowrap + ellipsis 로 한 칸만 씁니다. 그냥 두면 긴 제목이
 *   여러 칸으로 접혀서 읽는 순서가 깨집니다.
 * - hover 와 focus-visible 을 함께 처리해 키보드로도 동작합니다.
 * - prefers-reduced-motion 에서는 폭이 늘어나지 않고 테두리 강조만 남깁니다
 *   (표지 면은 아예 감춥니다 — 넓어지지 않으면 책등과 겹쳐 보이므로).
 */
export default function Bookshelf({ portfolios }: BookshelfProps) {
  const [active, setActive] = useState<Portfolio | null>(null);

  return (
    <div>
      {/* 제목 표시줄 — 스크롤 영역 바깥이라 잘리지 않습니다 */}
      <div className="h-7 flex items-center gap-2 text-xs text-neutral-400 mb-1">
        <span
          aria-hidden="true"
          className="w-[7px] h-[7px] rounded-[2px] transition-colors"
          style={{ backgroundColor: active ? active.jobColor : "transparent" }}
        />
        {active ? (
          <span className="truncate">
            <span className="text-neutral-100">{active.title}</span>
            <span className="text-neutral-500">
              {" "}
              · {active.job} · {active.year}
            </span>
          </span>
        ) : (
          <span>책등에 커서를 올리면 책이 빠져나옵니다</span>
        )}
      </div>

      <div className="shelf flex items-end gap-[3px] border-b-2 border-neutral-800 overflow-x-auto overflow-y-hidden pt-10 pb-0">
        {portfolios.map((p) => (
          <Link
            key={p.id}
            to={`/library/portfolios/${p.id}/versions`}
            onMouseEnter={() => setActive(p)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(p)}
            onBlur={() => setActive(null)}
            className="book group relative block h-[164px]"
          >
            {/* 책등 면 — 평소 보이는 얼굴. hover 시 서서히 사라집니다 */}
            <div
              className="book-face book-face-spine flex flex-col items-center
                rounded-t-[3px] rounded-b-sm border border-neutral-800 border-b-0 bg-neutral-900
                group-hover:border-brand/65 group-focus-visible:border-brand/65"
            >
              <span
                className="block w-full h-[7px] rounded-t-[2px] shrink-0"
                style={{ backgroundColor: p.jobColor }}
                aria-hidden="true"
              />
              <span className="book-title flex-1 min-h-0 w-full py-2.5 text-[10.5px] text-neutral-300 group-hover:text-neutral-100 transition-colors">
                {p.title}
              </span>
              <span className="text-[8px] text-neutral-500 pb-1.5 shrink-0" aria-hidden="true">
                {p.year}
              </span>
            </div>

            {/* 표지 면 — 평소엔 투명해서 안 보이다가 hover 시 서서히 나타납니다.
                책등과 같은 자리(inset:0)에 겹쳐 두고 opacity로만 전환하므로
                폭이 늘어나는 동안에도 항상 책 전체를 채웁니다.
                GrainCover 는 자기 CSS에 `position: relative` 가 이미 박혀
                있어서(index.css), className 으로 "absolute" 를 줘도 같은
                속성을 나중에 선언한 GrainCover 쪽이 이깁니다 — 그래서
                GrainCover 자체는 그냥 일반 흐름(relative)에 두고 h-full/
                w-full 로 부모를 꽉 채우게만 하고, 대신 글자를 얹는 아래
                오버레이 쪽을 absolute 로 띄워 그 위에 겹칩니다. */}
            <div className="book-face book-face-cover overflow-hidden rounded-t-[3px] rounded-b-sm border border-neutral-800">
              <GrainCover seed={p.id} className="h-full w-full" />
              {/* 다크 모드 전용 스크림 — GrainCover의 크림색 그레인이 다크 배경과
                  어울리지 않아서, 다크 테마에서만 어둡게 한 겹 덮어 톤을 낮춥니다.
                  라이트 테마에서는 index.css에서 display:none 처리됩니다. */}
              <div className="book-cover-scrim" aria-hidden="true" />
              <div className="absolute inset-0 z-10 flex flex-col justify-between p-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.jobColor }}
                  aria-hidden="true"
                />
                <div>
                  <p className="book-cover-title line-clamp-3 text-[11px] font-semibold leading-snug">
                    {p.title}
                  </p>
                  <p className="book-cover-meta mt-1 text-[9px]">
                    {p.job} · {p.year}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}

        <Link
          to="/wizard"
          className="shrink-0 w-[38px] h-[164px] ml-1.5 rounded-t-[3px]
            border-2 border-dashed border-neutral-700 border-b-0 text-neutral-600
            flex items-end justify-center pb-4 transition-colors duration-150
            hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:text-brand"
        >
          <Plus size={16} aria-hidden="true" />
          <span className="sr-only">새 포트폴리오 만들기</span>
        </Link>
      </div>

      <p className="text-xs text-neutral-500 mt-3">눌러서 포트폴리오를 열어보세요.</p>
    </div>
  );
}
