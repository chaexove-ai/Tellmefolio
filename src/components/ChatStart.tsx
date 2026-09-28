import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";

/**
 * 홈 맨 위의 입력창 — "대화로 만들기"의 입구. 설계는 docs/chat-builder-design.md.
 *
 * 검색창처럼 한 줄만 두고, 사용자가 편하게 쓴 첫 문장을 들고 대화 화면으로
 * 넘어갑니다. 첫 문장은 location.state 로 넘기고 대화 화면이 바로 보냅니다
 * — 여기서 함수를 부르고 기다리면 홈에서 몇 초 멈춰 있는 것처럼 보입니다.
 *
 * 아래 한 줄은 다른 입구 "자료로 만들기"(저장소·링크·메모 위저드)입니다.
 */
export default function ChatStart() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    navigate("/chat/new", { state: { text: t } });
  };

  return (
    <section className="text-center pt-4">
      <h2 className="font-heading text-[28px] leading-snug text-neutral-100">어떤 프로젝트 이야기를 해볼까요?</h2>
      <p className="mt-2 text-sm text-neutral-500">한 줄만 적어도 돼요. 질문에 답하면 포트폴리오로 정리해 드려요.</p>

      <form
        onSubmit={submit}
        className="mx-auto mt-7 max-w-3xl flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/70 pl-5 pr-2 py-2 shadow-lg shadow-black/5 focus-within:border-brand/60 transition-colors"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 작년에 한 미용실 예약 앱 리뉴얼 정리하고 싶어"
          className="flex-1 bg-transparent py-2.5 text-base text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          maxLength={2000}
          aria-label="프로젝트 이야기"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grid size-11 place-items-center rounded-xl bg-brand-solid text-white disabled:opacity-40 transition-opacity"
          aria-label="대화 시작"
        >
          <ArrowUp size={18} strokeWidth={2} />
        </button>
      </form>

      {/* [09-26] 칩 셋(저장소로 시작하기·공고에 맞춰 다시 쓰기·이어서)을 한 줄로.
          "이어서"는 홈의 "이어서 할 일"로, 직무 전환은 사이드바로 갔습니다. */}
      <p className="mt-4 text-sm text-neutral-500">
        깃허브 저장소나 링크·메모가 있다면 →{" "}
        <Link to="/wizard/source" className="text-brand underline-offset-4 hover:underline">
          자료로 만들기
        </Link>
      </p>
    </section>
  );
}
