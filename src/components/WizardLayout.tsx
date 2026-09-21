import { Outlet, useLocation } from "react-router-dom";
import { Check } from "lucide-react";

/**
 * [2026-09] 포트폴리오 생성 위저드의 공통 껍데기.
 *
 * 전에는 /wizard 에 3단계를 설명하는 안내 페이지가 따로 있었습니다. 문제는
 * 안내가 정작 필요한 곳이 그 다음 화면들이라는 것이었습니다 — 자료를 넣고
 * 초안을 만드는 동안에는 자기가 몇 단계인지, 다음에 뭐가 오는지 볼 방법이
 * 없었습니다. 한 번 읽고 지나가는 정보는 기억에 남지 않습니다.
 *
 * 그래서 안내 페이지를 없애고 그 내용을 왼쪽 레일로 옮겼습니다. "생성"을
 * 누르면 바로 자료 입력으로 가고, 단계는 작업 내내 옆에 붙어 있습니다.
 * 클릭이 하나 줄고, 안내는 더 오래 남고, 데스크탑에서 남던 가로도 레일이
 * 씁니다.
 *
 * 편집기(/wizard/editor/:id)에는 레일을 붙이지 않습니다. 거기는 이미
 * [폼 | 스타일·미리보기] 두 칸을 쓰고 있어서 레일까지 넣으면 세 칸이 되고,
 * 1200px 에서 어느 칸도 제 몫을 못 합니다. 그 화면은 위아래 버튼("AI 초안
 * 생성으로 돌아가기" / "내보내기")이 위치를 대신 알려줍니다.
 */

interface Step {
  n: number;
  title: string;
  desc: string;
  /** 이 단계에 해당하는 경로들 */
  match: (path: string) => boolean;
}

const steps: Step[] = [
  {
    n: 1,
    title: "자료 입력 및 AI 초안 생성",
    desc: "GitHub 저장소, 웹 링크, 메모를 모아 초안을 요청합니다.",
    match: (p) => p.startsWith("/wizard/source") || p.startsWith("/wizard/draft"),
  },
  {
    n: 2,
    title: "편집 및 스타일 설정",
    desc: "내용을 다듬고 템플릿·색·여백을 정합니다.",
    match: (p) => p.startsWith("/wizard/editor"),
  },
  {
    n: 3,
    title: "내보내기",
    desc: "한국어·영어 버전으로 PDF를 내려받습니다.",
    match: (p) => p.startsWith("/wizard/export"),
  },
];

export default function WizardLayout() {
  const { pathname } = useLocation();
  const current = steps.find((s) => s.match(pathname))?.n ?? 1;
  const isEditor = pathname.startsWith("/wizard/editor");

  if (isEditor) return <Outlet />;

  return (
    <div className="flex items-start gap-10">
      <nav aria-label="생성 단계" className="hidden lg:block w-[248px] shrink-0 sticky top-10">
        <p className="font-heading text-base text-neutral-100 mb-5">포트폴리오 생성</p>
        <ol className="space-y-0">
          {steps.map((s, i) => {
            const done = s.n < current;
            const now = s.n === current;
            return (
              <li key={s.n} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span
                    aria-hidden="true"
                    className={`size-7 rounded-full grid place-items-center text-xs transition-colors ${
                      now
                        ? "bg-brand-solid text-white"
                        : done
                          ? "bg-brand/15 text-brand"
                          : "border border-neutral-800 text-neutral-600"
                    }`}
                  >
                    {done ? <Check size={13} strokeWidth={2.5} /> : s.n}
                  </span>
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`w-px flex-1 my-1.5 ${done ? "bg-brand/30" : "bg-neutral-800"}`}
                    />
                  )}
                </div>
                <div className="pb-7">
                  <p
                    className={`text-sm ${now ? "text-neutral-100" : done ? "text-neutral-300" : "text-neutral-500"}`}
                  >
                    {s.title}
                    {now && <span className="sr-only"> (현재 단계)</span>}
                  </p>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
