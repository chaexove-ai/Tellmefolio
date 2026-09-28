import GrainCover from "./GrainCover";

/**
 * 로그인 화면 왼쪽 면의 장식용 책장.
 *
 * [2026-09-25] 왼쪽 면은 글을 걷어낸 뒤(시선이 두 곳으로 갈려서) 워드마크와
 * 맨 아래 한 줄만 남아 너무 비어 보였습니다. 다시 글을 채우면 같은 문제가
 * 돌아오므로 "읽는 것"이 아니라 "보는 것"으로 채웁니다.
 *
 * 책장을 고른 이유: 로그인하면 처음 만나는 화면이 '내 서재'의 책장입니다.
 * 들어가기 전에 그 모양을 먼저 보여주면, 이 서비스가 무엇을 쌓아주는지가
 * 설명 없이 전달됩니다.
 *
 * - 책등에 글씨를 쓰지 않습니다. 글자가 있으면 결국 읽게 되고, 그러면
 *   "읽을 곳은 오른쪽 한 곳"이라는 이 화면의 원칙이 다시 깨집니다.
 *   대신 실제 책등처럼 가는 띠 두 줄로 형태만 줍니다.
 * - 마지막 칸은 비워 점선으로 둡니다. "다음 책은 당신 것"이라는 자리입니다.
 * - 전부 aria-hidden 입니다. 스크린리더에게는 뜻 없는 그림이고, 이 화면에서
 *   읽어야 할 것은 오른쪽뿐입니다.
 * - 실제 Bookshelf 의 .book 클래스는 쓰지 않습니다. 거기엔 hover 로 펼쳐지는
 *   동작이 붙어 있는데, 누를 수 없는 그림이 반응하면 눌러보게 됩니다.
 */

interface Spine {
  /** 그리지 않습니다. key 와 GrainCover 의 seed 로만 씁니다. */
  id: string;
  /** 직무 색. 책장과 같이 위쪽 띠 + (cover 면) 그레인 색조로 씁니다. */
  color: string;
  height: number;
  width: number;
  /** true 면 그레인 표지로, false 면 어두운 책등으로 그립니다. */
  cover?: boolean;
  /** 살짝 기댄 책. 줄이 너무 반듯하면 그림이 아니라 도표처럼 보입니다. */
  lean?: boolean;
  /** 넓은 화면(2xl)에서만 꽂는 책. 면이 넓어지면 책장이 한쪽에 몰려 보입니다. */
  wide?: boolean;
}

const SPINES: Spine[] = [
  { id: "fe", color: "#c2703d", height: 292, width: 64 },
  { id: "ux", color: "#b8894a", height: 248, width: 56, cover: true },
  { id: "pm", color: "#8f6a52", height: 272, width: 60 },
  { id: "brand", color: "#a4553a", height: 310, width: 68, cover: true },
  { id: "data", color: "#7d7a4f", height: 258, width: 58 },
  { id: "mobile", color: "#b0764f", height: 238, width: 54, cover: true, wide: true },
  { id: "mkt", color: "#8a5a44", height: 276, width: 60, wide: true },
  { id: "be", color: "#9a6b3f", height: 284, width: 62, lean: true },
];

export default function ShelfIllustration() {
  return (
    <div aria-hidden="true" className="shelf-illo w-full select-none [zoom:0.8] xl:[zoom:1] 2xl:[zoom:1.15]">
      {/* 크기는 zoom 으로 화면 폭에 맞춥니다(lg 0.8 / xl 1 / 2xl 1.15). 책마다 치수를
          단계별로 따로 적는 것보다 한 줄로 끝납니다.
          선반 선은 면 끝까지 긋습니다. 책이 한쪽에 모여 있어도 선이 바닥을
          잡아줘서 허공에 떠 보이지 않습니다. */}
      <div className="flex w-full items-end gap-[6px] border-b-2 border-neutral-700 pb-0">
        {SPINES.map((s, i) => (
          <div
            key={s.id}
            className={`shelf-illo-book relative shrink-0 ${s.lean ? "shelf-illo-lean" : ""} ${
              s.wide ? "hidden 2xl:block" : ""
            }`}
            style={{
              height: s.height,
              width: s.width,
              animationDelay: `${120 + i * 70}ms`,
            }}
          >
            {s.cover ? (
              <div className="h-full w-full overflow-hidden rounded-t-[3px] rounded-b-sm border border-neutral-800 border-b-0">
                <GrainCover seed={`shelf-${s.id}`} tint={s.color} className="h-full w-full" />
                {/* 크림 그레인이 어두운 면 위에서 혼자 튀지 않게 한 겹 눌러줍니다.
                    내 서재의 다크용 스크림(.book-cover-scrim)과 같은 생각입니다. */}
                <span className="absolute inset-0 bg-neutral-950/30" />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center rounded-t-[3px] rounded-b-sm border border-neutral-800 border-b-0 bg-neutral-900">
                <span
                  className="block h-[11px] w-full shrink-0 rounded-t-[2px]"
                  style={{ backgroundColor: s.color }}
                />
                {/* 실제 책등처럼 아래쪽에 가는 띠 두 줄 */}
                <span className="mt-auto mb-6 flex w-full flex-col gap-[5px] px-[10px]">
                  <span className="block h-px w-full bg-neutral-700" />
                  <span className="block h-px w-full bg-neutral-700" />
                </span>
              </div>
            )}
          </div>
        ))}

        {/* 비어 있는 다음 칸. 바로 앞 책이 이쪽으로 기대므로 조금 띄웁니다. */}
        <div
          className="shelf-illo-book ml-5 flex h-[270px] w-[64px] shrink-0 items-end justify-center rounded-t-[3px] border border-dashed border-b-0 border-neutral-600 pb-4"
          style={{ animationDelay: `${120 + SPINES.length * 70}ms` }}
        >
          <span className="text-lg leading-none text-brand">+</span>
        </div>
      </div>
    </div>
  );
}

