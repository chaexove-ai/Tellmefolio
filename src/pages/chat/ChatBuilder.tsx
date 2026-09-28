import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, LoaderCircle, Minus, Plus, SendHorizontal } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { listMyPortfolios, type LibraryPortfolio } from "../../lib/portfolios";
import {
  draftInterview,
  filledCount,
  getInterview,
  sendAnswer,
  skipQuestion,
  startInterview,
  startFillInterview,
  isFillSession,
  INTERVIEW_FIELDS,
  INTERVIEW_FIELD_NAMES,
  InterviewError,
  MAX_QUESTIONS,
  MIN_FILLED_FOR_DRAFT,
  type InterviewField,
  type InterviewMessage,
  type InterviewState,
} from "../../lib/interview";

/**
 * 대화로 만들기. 설계는 docs/chat-builder-design.md, 화면은
 * docs/mockups/chat-builder.html 이 기준입니다.
 *
 * 왼쪽은 채팅, 오른쪽은 채워지는 칸 여섯 개. 사용자가 봐야 할 것은
 * "지금 무엇을 묻는지"와 "얼마나 찼는지" 둘이라, 안내 문단을 늘어놓지
 * 않습니다.
 *
 * 주소
 *   /chat/new              새 대화. 홈 입력창에서 온 첫 문장이 state 로 옵니다
 *   /chat/new?portfolio=…  "다른 프로젝트도 이야기하기" — 그 포트폴리오에 이어 붙임
 *   /chat/new?project=…    "대화로 채우기" — 편집기에서 그 프로젝트의 빈 칸만 묻기
 *   /chat/:sessionId       이어서 하기
 */
/**
 * 주소가 바뀔 때마다 새로 그립니다. /chat/abc 에서 "다른 프로젝트도
 * 이야기하기"(/chat/new?portfolio=…)로 가면 같은 컴포넌트가 그대로 남아
 * 이전 대화가 보이는 문제를 막습니다. 새 대화를 시작한 직후 /chat/new →
 * /chat/:id 로 바뀔 때는 결과를 location.state 로 넘겨 다시 읽지 않습니다.
 */
export default function ChatRoute() {
  const location = useLocation();
  return <ChatBuilder key={location.pathname + location.search} />;
}

function ChatBuilder() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session: auth } = useAuth();

  const isNew = !sessionId || sessionId === "new";
  const presetPortfolio = params.get("portfolio");
  const presetProject = params.get("project");
  const incoming = location.state as { text?: string; initial?: InterviewState } | null;

  const [state, setState] = useState<InterviewState | null>(incoming?.initial ?? null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [portfolios, setPortfolios] = useState<LibraryPortfolio[]>([]);
  const [target, setTarget] = useState<string>(presetPortfolio ?? "");
  const [drafting, setDrafting] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  // 이어서 하기: 주소에 id 가 있고 state 로 넘겨받은 게 없으면 읽어 옵니다.
  useEffect(() => {
    if (isNew || state?.session.id === sessionId) return;
    getInterview(sessionId!)
      .then(setState)
      .catch((e) => setLoadError(e instanceof InterviewError ? e.message : "대화를 불러오지 못했습니다."));
  }, [isNew, sessionId, state?.session.id]);

  // 홈 입력창에서 첫 문장을 들고 왔으면 바로 시작합니다.
  useEffect(() => {
    if (!isNew || !incoming?.text || startedRef.current) return;
    startedRef.current = true;
    void begin(incoming.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // 편집기의 "대화로 채우기"에서 왔으면 첫 문장 없이 바로 엽니다.
  useEffect(() => {
    if (!isNew || !presetProject || startedRef.current) return;
    startedRef.current = true;
    setBusy(true);
    startFillInterview(presetProject)
      .then((next) => {
        setState(next);
        navigate(`/chat/${next.session.id}`, { replace: true, state: { initial: next } });
      })
      .catch((e) => setLoadError(e instanceof InterviewError ? e.message : "대화를 시작하지 못했습니다."))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, presetProject]);

  useEffect(() => {
    const uid = auth?.user?.id;
    if (!uid) return;
    listMyPortfolios(uid).then(setPortfolios).catch(() => setPortfolios([]));
  }, [auth?.user?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.messages.length, pendingText, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  async function begin(text: string) {
    setBusy(true);
    setError(null);
    setPendingText(text);
    try {
      const next = await startInterview(text, presetPortfolio);
      setPendingText(null);
      setState(next);
      navigate(`/chat/${next.session.id}`, { replace: true, state: { initial: next } });
    } catch (e) {
      setPendingText(null);
      setDraft(text);
      setError(e instanceof InterviewError ? e.message : "대화를 시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function reply(text: string | null) {
    if (!state) return;
    setBusy(true);
    setError(null);
    setPendingText(text ?? "넘어가기");
    try {
      const next = text === null ? await skipQuestion(state.session.id) : await sendAnswer(state.session.id, text);
      setState(next);
    } catch (e) {
      if (text) setDraft(text);
      setError(e instanceof InterviewError ? e.message : "보내지 못했습니다. 다시 보내 주세요.");
    } finally {
      setPendingText(null);
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    if (!state) void begin(text);
    else void reply(text);
  };

  const makeDraft = async () => {
    if (!state) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await draftInterview(state.session.id, target || state.session.portfolioId);
      setState({
        ...state,
        session: { ...state.session, status: "drafted", portfolioId: res.portfolioId, flags: res.flags },
      });
    } catch (e) {
      setError(e instanceof InterviewError ? e.message : "초안을 만들지 못했습니다.");
    } finally {
      setDrafting(false);
    }
  };

  const s = state?.session;
  const messages = state?.messages ?? [];
  const drafted = s?.status === "drafted";
  const waitingForDraft = Boolean(s && !drafted && !s.currentField);
  const filled = s ? filledCount(s.fields) : 0;
  const fillMode = s ? isFillSession(s) || (drafted && Boolean(s.projectId) && INTERVIEW_FIELDS.some((f) => s.fields[f]?.state === "existing")) : false;
  const needed = fillMode ? 1 : MIN_FILLED_FOR_DRAFT;
  const settled = s ? INTERVIEW_FIELDS.filter((f) => s.fields[f]).length : 0;
  const pct = Math.round((settled / INTERVIEW_FIELDS.length) * 100);

  /** 답변 번호 → 그 답으로 채워진 칸들 ("✓ 문제 정의에 저장" 표시) */
  const savedByAnswer = useMemo(() => {
    const map = new Map<number, InterviewField[]>();
    if (!s) return map;
    for (const f of INTERVIEW_FIELDS) {
      const st = s.fields[f];
      if (st?.state !== "filled") continue;
      for (const id of st.answerIds) {
        const no = Number(id.split(":")[0].slice(1));
        const list = map.get(no) ?? [];
        if (!list.includes(f)) list.push(f);
        map.set(no, list);
      }
    }
    return map;
  }, [s]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <Link to="/library" className="text-xs text-brand hover:underline">
          ← 홈
        </Link>
        <p className="text-sm text-neutral-400">{loadError}</p>
      </div>
    );
  }

  const lastAi = [...messages].reverse().find((m) => m.role === "ai");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px] h-[calc(100vh-5rem)] min-h-[560px]">
      {/* ── 왼쪽: 채팅 ───────────────────────────────────────── */}
      <section className="entry p-0 flex flex-col min-h-0">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800">
          <Link to="/library" className="text-xs text-brand hover:underline shrink-0">
            ← 홈
          </Link>
          <h1 className="font-heading text-lg truncate">{s?.title || "새 이야기"}</h1>
          {s && (
            <span className="ml-auto text-xs text-neutral-500 tabular-nums shrink-0">
              질문 {Math.min(s.questionCount, MAX_QUESTIONS)} / {MAX_QUESTIONS}
            </span>
          )}
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!s && !pendingText && !presetProject && (
            <AiBubble text="어떤 프로젝트 이야기를 해볼까요? 편하게 말해 주세요. 질문하면서 포트폴리오를 같이 채워 갈게요." />
          )}

          {messages.map((m) =>
            m.role === "ai" ? (
              <AiBubble key={m.position} text={m.text} followUp={m.follow_up} />
            ) : (
              <UserBubble key={m.position} message={m} saved={m.answer_no ? savedByAnswer.get(m.answer_no) ?? [] : []} />
            )
          )}

          {pendingText && (
            <UserBubble
              message={{ position: -1, role: "user", text: pendingText, answer_no: null, target_field: null, follow_up: false, skipped: pendingText === "넘어가기" }}
              saved={[]}
            />
          )}
          {busy && (
            <div className="text-sm text-neutral-500 inline-flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" /> 생각하는 중…
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-5 mb-2 text-sm text-brand">
            {error}
          </p>
        )}

        {/* 빠른 답 — 지금 묻는 칸이 있을 때만 */}
        {s && !drafted && s.currentField && !busy && lastAi && (
          <div className="px-5 pb-2 flex gap-2">
            <button type="button" className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-neutral-100 hover:border-neutral-500" onClick={() => void reply(null)}>
              넘어가기
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-neutral-800 p-3">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              drafted
                ? "초안을 만들었어요"
                : waitingForDraft
                  ? "칸을 다 채웠어요. 오른쪽에서 ‘초안 만들기’를 눌러 주세요"
                  : "답하기… (모르면 ‘넘어가기’)"
            }
            className="field"
            maxLength={2000}
            disabled={busy || drafted || waitingForDraft}
            aria-label="답변"
          />
          <button type="submit" className="btn-primary px-3.5 disabled:opacity-40" disabled={busy || !draft.trim() || drafted || waitingForDraft} aria-label="보내기">
            <SendHorizontal size={16} strokeWidth={1.75} />
          </button>
        </form>
      </section>

      {/* ── 오른쪽: 채워지는 칸 ─────────────────────────────── */}
      <aside className="entry p-0 flex flex-col min-h-0">
        <div className="px-5 py-4 border-b border-neutral-800">
          <div className="flex justify-between text-xs text-neutral-500 mb-2">
            <span>{drafted ? "초안 완성" : "포트폴리오 채우는 중"}</span>
            <b className="text-neutral-100 tabular-nums">{pct}%</b>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-5 py-2">
          {INTERVIEW_FIELDS.map((f) => {
            const st = s?.fields[f];
            const now = !drafted && s?.currentField === f;
            const answerNos = st ? [...new Set(st.answerIds.map((id) => id.split(":")[0].slice(1)))] : [];
            return (
              <li key={f} className="py-3 border-b border-neutral-800/60 last:border-b-0">
                <div className="flex items-center gap-2 text-sm">
                  <FieldDot state={st?.state ?? (now ? "now" : "empty")} />
                  <span className={now ? "text-brand font-medium" : st ? "text-neutral-200" : "text-neutral-500"}>
                    {INTERVIEW_FIELD_NAMES[f]}
                  </span>
                  <span className="ml-auto text-[11px] text-neutral-500">
                    {st?.state === "filled"
                      ? "채움"
                      : st?.state === "skipped"
                        ? "건너뜀"
                        : st?.state === "existing"
                          ? "원래 있음"
                          : now
                            ? "지금 묻는 중"
                            : "비어 있음"}
                  </span>
                </div>
                {st?.state === "existing" && (
                  <p className="ml-[26px] mt-1 text-xs text-neutral-500 line-clamp-2 break-keep">{st.summary}</p>
                )}
                {st?.state === "filled" && (
                  <div className="ml-[26px] mt-1.5">
                    <p className="text-sm text-neutral-300 break-keep">{st.summary}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">↳ 답변 {answerNos.join(", ")}에서</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* 초안 만들기 / 결과 */}
        <div className="border-t border-neutral-800 p-5 space-y-3">
          {!s ? (
            <p className="text-xs text-neutral-500">답하면 칸이 하나씩 채워져요.</p>
          ) : drafted ? (
            <DraftDone state={state!} />
          ) : filled < needed ? (
            <p className="text-xs text-neutral-500">
              {fillMode ? "한 칸이라도 답하면 채워 넣을 수 있어요." : `${needed - filled}칸 더 채우면 초안을 만들 수 있어요.`}
            </p>
          ) : (
            <>
              {/* 기존 프로젝트를 채우는 대화는 저장할 곳이 이미 정해져 있습니다 */}
              {!fillMode && (
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="shrink-0">저장할 곳</span>
                  <select className="field py-1.5 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} disabled={drafting}>
                    <option value="" className="bg-neutral-900">
                      {s.portfolioId ? "처음 고른 포트폴리오" : "새 포트폴리오"}
                    </option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900">
                        {p.title}에 추가
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="btn-primary w-full disabled:opacity-50" disabled={drafting || busy} onClick={() => void makeDraft()}>
                {drafting ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> 초안 쓰는 중…
                  </>
                ) : (
                  <>
                    {fillMode ? "빈 칸에 채워 넣기" : "초안 만들기"} <ArrowRight size={16} strokeWidth={1.75} />
                  </>
                )}
              </button>
              <p className="text-[11px] text-neutral-500 text-center">
                {fillMode ? "답한 칸만 씁니다. 원래 있던 칸은 건드리지 않아요." : "답한 내용만으로 씁니다. 지어서 채우지 않아요."}
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function AiBubble({ text, followUp }: { text: string; followUp?: boolean }) {
  return (
    <div className="max-w-[80%]">
      <p className="text-[11px] text-brand mb-1 ml-0.5">Tellmefolio{followUp && " · 한 번 더 여쭤볼게요"}</p>
      <p className="rounded-2xl rounded-bl-md border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-sm text-neutral-100 leading-relaxed break-keep whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function UserBubble({ message, saved }: { message: InterviewMessage; saved: InterviewField[] }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <p
        className={`max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed break-keep ${
          message.skipped ? "border border-dashed border-neutral-700 text-neutral-500" : "bg-neutral-100 text-neutral-950"
        }`}
      >
        {message.text}
      </p>
      {saved.map((f) => (
        <span key={f} className="badge bg-emerald-500/10 text-emerald-600">
          <Check size={12} strokeWidth={2} /> {INTERVIEW_FIELD_NAMES[f]}에 저장
        </span>
      ))}
    </div>
  );
}

function FieldDot({ state }: { state: "filled" | "skipped" | "existing" | "now" | "empty" }) {
  if (state === "existing")
    return (
      <span className="w-[18px] h-[18px] rounded-full bg-neutral-800 text-neutral-400 inline-flex items-center justify-center shrink-0">
        <Check size={11} strokeWidth={2.5} />
      </span>
    );
  if (state === "filled")
    return (
      <span className="w-[18px] h-[18px] rounded-full bg-emerald-600 text-white inline-flex items-center justify-center shrink-0">
        <Check size={11} strokeWidth={3} />
      </span>
    );
  if (state === "skipped")
    return (
      <span className="w-[18px] h-[18px] rounded-full bg-neutral-600 text-white inline-flex items-center justify-center shrink-0">
        <Minus size={11} strokeWidth={3} />
      </span>
    );
  return (
    <span
      className={`w-[18px] h-[18px] rounded-full border-[1.5px] shrink-0 ${
        state === "now" ? "border-brand" : "border-dashed border-neutral-700"
      }`}
    />
  );
}

function DraftDone({ state }: { state: InterviewState }) {
  const { session } = state;
  const flags = session.flags;
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-neutral-100">
        <Check size={16} strokeWidth={2} className="text-emerald-600" />{" "}
        {INTERVIEW_FIELDS.some((f) => session.fields[f]?.state === "existing") ? "빈 칸을 채워 넣었어요" : "초안을 만들었어요"}
      </div>
      {flags.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 px-3 py-2.5">
          <p className="text-xs text-amber-700 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} strokeWidth={2} /> 확인 필요 {flags.length}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {flags.slice(0, 3).map((f, i) => (
              <li key={i} className="text-xs text-neutral-300 break-keep">
                {f.sentence}
                <span className="text-neutral-500">
                  {" "}
                  — {f.kind === "number" ? `답에 없는 숫자 ${f.detail}` : f.kind === "term" ? `답에 없는 이름 ${f.detail}` : "근거 없음"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {session.portfolioId && (
        <Link
          to={`/wizard/editor/${session.portfolioId}${session.projectId ? `?project=${session.projectId}` : ""}`}
          className="btn-primary w-full"
        >
          편집기에서 열기 <ArrowRight size={16} strokeWidth={1.75} />
        </Link>
      )}
      {session.portfolioId && (
        <Link to={`/chat/new?portfolio=${session.portfolioId}`} className="btn-secondary w-full">
          <Plus size={16} strokeWidth={1.75} /> 다른 프로젝트도 이야기하기
        </Link>
      )}
    </>
  );
}
