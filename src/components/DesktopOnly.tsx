import { Monitor } from "lucide-react";

/**
 * [2026-09] 좁은 창에서 앱 화면을 막고 안내만 보여줍니다.
 *
 * 편집기는 입력 폼과 미리보기를 나란히 놓는 것이 화면의 전제이고, 내보내기
 * 미리보기·템플릿 렌더링도 720px 고정 폭 문서를 그립니다. 이걸 휴대폰 폭에
 * 맞춰 다시 짜는 것은 별도 제품을 하나 더 만드는 일에 가깝습니다. 어중간하게
 * 무너진 화면을 보여주느니 "여기서는 안 됩니다"를 분명히 말하는 쪽이 낫습니다.
 *
 * 랜딩(/)과 로그인은 이 게이트 바깥입니다 — AppLayout 안쪽에만 걸려 있어서
 * 링크를 받은 사람이 휴대폰으로 열어도 서비스 소개는 그대로 보입니다.
 *
 * 색을 테마 변수가 아니라 직접 박은 이유는 index.css 의 .gate-grain 주석에
 * 적어뒀습니다 — 요약하면, 테마는 OS 를 따라가는데 이 바탕은 크림 한 가지라
 * 다크 사용자에게 밝은 글자가 나오면 읽을 수 없기 때문입니다.
 */
export const DESKTOP_MIN_WIDTH = 1200;

/** 이 화면 전용 색. 앱의 라이트 테마 팔레트와 같은 값이지만, 테마가 바뀌어도
 *  따라가면 안 되므로 변수가 아니라 리터럴로 둡니다. */
const INK = "#1e1a15";
const BODY = "#564d3f";
const MUTED = "#7a6f5d";
const BRAND = "#a05829";

export default function DesktopOnly() {
  return (
    <div className="gate-grain min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[520px] text-center">
        <div className="inline-flex items-center gap-2.5 mb-14">
          <Monitor size={20} strokeWidth={1.5} style={{ color: BRAND }} aria-hidden="true" />
          <span className="text-lg font-heading" style={{ color: INK }}>
            Tellmefolio
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-8" style={{ background: `${BRAND}66` }} aria-hidden="true" />
          <span
            className="text-[11px] font-medium tracking-[0.18em]"
            style={{ color: BRAND }}
          >
            DESKTOP ONLY
          </span>
          <span className="h-px w-8" style={{ background: `${BRAND}66` }} aria-hidden="true" />
        </div>

        <h1 className="font-heading text-[32px] leading-[1.35]" style={{ color: INK }}>
          데스크탑에서
          <br />
          확인해 주세요
        </h1>

        <p className="mt-6 text-sm leading-relaxed" style={{ color: BODY }}>
          작성 화면과 미리보기를 나란히 놓고 쓰는 도구라
          <br />
          좁은 화면은 지원하지 않습니다.
        </p>

        {/* 권장 환경 박스만 흰 면입니다 — 그레인 위에서 이 한 칸만 떠 보이게
            해서 시선이 마지막으로 닿는 자리로 씁니다. */}
        <div
          className="mt-12 rounded-2xl px-6 py-5"
          style={{
            background: "#ffffff",
            border: "1px solid rgb(0 0 0 / 0.06)",
            boxShadow: "0 1px 2px rgb(60 45 30 / 0.04), 0 8px 24px rgb(60 45 30 / 0.06)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: INK }}>
            권장 환경
          </p>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>
            가로 {DESKTOP_MIN_WIDTH}px 이상 · Chrome, Edge, Safari
          </p>
        </div>

        <p className="mt-8 text-xs" style={{ color: MUTED }}>
          창 크기를 늘리면 이 화면은 바로 사라집니다.
        </p>
      </div>
    </div>
  );
}
