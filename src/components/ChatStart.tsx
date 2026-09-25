import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp, FolderGit2, History, Repeat } from "lucide-react";
import { listOpenInterviews, type InterviewSummary } from "../lib/interview";

/**
 * 홈 맨 위의 입력창 — "대화로 만들기"의 입구. 설계는 docs/chat-builder-design.md.
 *
 * 검색창처럼 한 줄만 두고, 사용자가 편하게 쓴 첫 문장을 들고 대화 화면으로
 * 넘어갑니다. 첫 문장은 location.state 로 넘기고 대화 화면이 바로 보냅니다
 * — 여기서 함수를 부르고 기다리면 홈에서 몇 초 멈춰 있는 것처럼 보입니다.
 *
 * 아래 칩은 다른 입구들입니다. 저장소가 많은 개발자에게는 기존 위저드가 더
 * 빠르므로 없애지 않고 "저장소로 시작하기"로 남깁니다.
 */
export default function ChatStart() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<InterviewSummary[]>([]);

  useEffect(() => {
    listOpenInterviews(3).then(setOpen).catch(() => setOpen([]));
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    navigate("/chat/new", { state: { text: t } });
  };

  return (
    <section className="text-center pt-4">
      <h2 className="font-heading text-[28px] leading-snug text-neutral-100">어떤 프로젝트 이야기를 해볼까요?</h2>
      <p className="mt-2 text-sm text-neutral-500">편하게 말해 주세요. 질문하면서 포트폴리오를 같이 채워 갈게요.</p>

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

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Chip to="/wizard" icon={FolderGit2} label="저장소로 시작하기" />
        <Chip to="/job-switch" icon={Repeat} label="공고에 맞춰 다시 쓰기" />
        {open[0] && (
          <Chip to={`/chat/${open[0].id}`} icon={History} label={`이어서: ${open[0].title}`} />
        )}
      </div>
    </section>
  );
}

function Chip({ to, icon: Icon, label }: { to: string; icon: typeof Repeat; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex max-w-[280px] items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/50 px-3.5 py-1.5 text-sm text-neutral-400 hover:border-brand/50 hover:text-brand transition-colors"
    >
      <Icon size={14} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
