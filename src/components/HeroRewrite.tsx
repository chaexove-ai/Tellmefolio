import { useEffect, useRef, useState } from "react";
import { heroRewrite } from "../landingContent";

/**
 * 히어로 모션 — "문장 재작성".
 *
 * 지구본(cobe/WebGL)을 대체합니다. 지구본은 글로벌 서비스 은유였는데
 * 이 서비스는 국내 취업 시장을 대상으로 하므로 맞지 않았습니다.
 *
 * 이 모션은 은유가 아니라 제품이 실제로 하는 일을 그대로 보여줍니다.
 * 원본 메모 한 줄 → 직무가 바뀌면 문장이 다시 쓰임.
 * 첫 화면에서 "이게 뭘 해주는 서비스인지"가 몇 초 안에 전달됩니다.
 *
 * 구현 노트
 * - WebGL 없음. 텍스트와 CSS만 씁니다. cobe 의존성을 제거할 수 있습니다.
 * - 접근성: 타이핑 영역은 aria-hidden 으로 감추고, 스크린리더에는
 *   세 버전을 한 번에 읽어주는 정적 블록을 따로 제공합니다.
 *   (한 글자씩 바뀌는 텍스트를 읽어주면 소음이 됩니다)
 * - prefers-reduced-motion 에서는 타이핑 없이 정적으로 표시합니다.
 * - 탭이 백그라운드일 때는 루프를 쉬게 해서 불필요한 렌더를 막습니다.
 */

const TYPE_MS = 32; // 한 글자 입력 간격
const HOLD_MS = 2400; // 다 쓰고 머무는 시간
const ERASE_MS = 12; // 지우는 속도

export default function HeroRewrite() {
  const [jobIndex, setJobIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [reduced, setReduced] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mq.matches) {
      setReduced(true);
      setTyped(heroRewrite.lines[0].text);
      return () => {
        alive.current = false;
      };
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // 백그라운드 탭에서는 진행을 멈추고 돌아올 때까지 기다립니다.
    const awaitVisible = async () => {
      while (alive.current && document.hidden) await sleep(300);
    };

    (async () => {
      let i = 0;
      while (alive.current) {
        await awaitVisible();
        if (!alive.current) return;

        setJobIndex(i);
        const text = heroRewrite.lines[i].text;

        for (let c = 1; c <= text.length; c++) {
          if (!alive.current) return;
          setTyped(text.slice(0, c));
          await sleep(TYPE_MS);
        }
        await sleep(HOLD_MS);

        for (let c = text.length; c >= 0; c--) {
          if (!alive.current) return;
          setTyped(text.slice(0, c));
          await sleep(ERASE_MS);
        }
        i = (i + 1) % heroRewrite.lines.length;
      }
    })();

    return () => {
      alive.current = false;
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto">
      {/* 원본 메모 */}
      <div className="entry">
        <p className="text-[11px] tracking-[0.14em] text-brand mb-2.5">원본 메모</p>
        <p className="text-sm text-neutral-400 leading-relaxed">“{heroRewrite.source}”</p>
      </div>

      {/* 흐름 표시 */}
      <div className="flex justify-center py-3" aria-hidden="true">
        <span className="block w-px h-6 bg-gradient-to-b from-transparent to-brand/60" />
      </div>

      {/* 재작성 결과 */}
      <div className="entry min-h-[132px]" aria-hidden="true">
        <p className="text-[11px] mb-2.5 flex items-center gap-2 text-brand">
          <span
            className={
              reduced
                ? "w-1.5 h-1.5 rounded-full bg-brand"
                : "w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
            }
          />
          {heroRewrite.lines[jobIndex].job} 관점으로 재구성
        </p>
        <p className="font-heading text-base sm:text-lg leading-relaxed text-neutral-100">
          {typed}
          {!reduced && (
            <span className="inline-block w-[2px] h-[1em] align-[-0.15em] ml-0.5 bg-brand animate-pulse" />
          )}
        </p>
      </div>

      {/* 스크린리더 전용: 애니메이션 대신 세 버전을 한 번에 전달 */}
      <div className="sr-only">
        <p>같은 원본 메모가 직무에 따라 이렇게 다시 쓰입니다.</p>
        <ul>
          {heroRewrite.lines.map((l) => (
            <li key={l.job}>
              {l.job} 관점: {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
