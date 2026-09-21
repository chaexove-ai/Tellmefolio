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
 */
export const DESKTOP_MIN_WIDTH = 1200;

export default function DesktopOnly() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-neutral-950">
      <div className="w-full max-w-[520px] text-center">
        <div className="inline-flex items-center gap-2.5 mb-14">
          <Monitor size={20} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
          <span className="text-lg font-heading text-neutral-100">Tellmefolio</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-7">
          <span className="h-px w-8 bg-brand/40" aria-hidden="true" />
          <span className="text-[11px] font-medium tracking-[0.18em] text-brand">DESKTOP ONLY</span>
          <span className="h-px w-8 bg-brand/40" aria-hidden="true" />
        </div>

        <h1 className="font-heading text-[32px] leading-[1.35] text-neutral-100">
          데스크탑에서
          <br />
          확인해 주세요
        </h1>

        <p className="mt-6 text-sm leading-relaxed text-neutral-400">
          작성 화면과 미리보기를 나란히 놓고 쓰는 도구라
          <br />
          좁은 화면은 지원하지 않습니다.
        </p>

        <div className="mt-12 rounded-2xl border border-neutral-800 px-6 py-5">
          <p className="text-sm font-medium text-neutral-200">권장 환경</p>
          <p className="mt-2 text-sm text-neutral-500">
            가로 {DESKTOP_MIN_WIDTH}px 이상 · Chrome, Edge, Safari
          </p>
        </div>

        <p className="mt-8 text-xs text-neutral-600">
          창 크기를 늘리면 이 화면은 바로 사라집니다.
        </p>
      </div>
    </div>
  );
}
