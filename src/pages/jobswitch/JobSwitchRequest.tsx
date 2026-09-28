import { useEffect, useRef, useState } from "react";
import { NewPortfolioButton } from "../../components/NewPortfolio";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Link2, LoaderCircle, Lock, Quote, Repeat, ShieldAlert } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { listMyPortfolios, type LibraryPortfolio } from "../../lib/portfolios";
import {
  listJobSwitchRuns,
  startJobSwitch,
  JobSwitchError,
  type JobSwitchRunSummary,
} from "../../lib/jobSwitch";
import { formatRelativeTime } from "../../lib/formatRelativeTime";

/**
 * 직무 전환 재구성 — 요청 화면.
 *
 * [2026-09-25] 목업을 실제로 동작하게 바꿨습니다. 설계는
 * docs/job-switch-design.md.
 *
 * - 포트폴리오 목록이 mockData 가 아니라 내 서재입니다.
 * - "포트폴리오 구성 방식 선택(결과 중심형 / 문제-실행-결과형)"을
 *   뺐습니다. 둘은 같은 내용을 앞에 두느냐 뒤에 두느냐의 차이뿐이었고,
 *   "AI가 추천합니다"라고 적어두고 실제로는 기본값이었습니다. 이제 무엇을
 *   앞에 둘지는 공고가 정하고, 결과 화면에서 이유와 함께 보여줍니다.
 * - 요청은 1분 안팎 걸립니다(모델을 세 번 부릅니다). 지나간 시간을
 *   보여줘서 멈춘 건지 도는 건지 알 수 있게 합니다.
 */
export default function JobSwitchRequest() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, configured } = useAuth();
  const userId = session?.user?.id;

  const [portfolios, setPortfolios] = useState<LibraryPortfolio[] | null>(null);
  const [runs, setRuns] = useState<JobSwitchRunSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sourcePortfolio, setSourcePortfolio] = useState(params.get("portfolio") ?? "");
  const [targetJob, setTargetJob] = useState("");
  const [jobPostingUrl, setJobPostingUrl] = useState("");
  const [jobPostingText, setJobPostingText] = useState("");

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!configured || !userId) {
      setPortfolios([]);
      return;
    }
    let alive = true;
    listMyPortfolios(userId)
      .then((list) => {
        if (!alive) return;
        setPortfolios(list);
        setSourcePortfolio((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? ""));
      })
      .catch(() => alive && setLoadError("서재 목록을 불러오지 못했습니다."));
    listJobSwitchRuns().then((r) => alive && setRuns(r));
    return () => {
      alive = false;
    };
  }, [configured, userId]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const canSubmit =
    !running &&
    Boolean(sourcePortfolio) &&
    targetJob.trim().length > 0 &&
    (jobPostingUrl.trim().length > 0 || jobPostingText.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setRunning(true);
    setError(null);
    setElapsed(0);
    const started = Date.now();
    timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    try {
      const runId = await startJobSwitch({
        portfolioId: sourcePortfolio,
        targetJob: targetJob.trim(),
        jdUrl: jobPostingUrl.trim(),
        jdText: jobPostingText.trim(),
      });
      navigate(`/job-switch/result/${runId}`);
    } catch (e) {
      setError(e instanceof JobSwitchError ? e.message : "재구성 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setRunning(false);
    } finally {
      if (timer.current) window.clearInterval(timer.current);
    }
  };

  if (portfolios && portfolios.length === 0 && !loadError) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-xl font-heading">직무 전환 재구성</h1>
        <div className="entry">
          <p className="text-sm text-neutral-400">
            재구성할 포트폴리오가 아직 없습니다. 먼저 포트폴리오를 하나 만들어 주세요.
          </p>
          <NewPortfolioButton className="btn-primary mt-4 inline-flex">
            새 포트폴리오
          </NewPortfolioButton>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-heading">직무 전환 재구성</h1>
        <p className="text-sm text-neutral-500 mt-1">같은 경험을 목표 직무의 언어로 옮깁니다.</p>
      </div>

      {/* 약속 세 가지 — 문단 대신 아이콘 칩 */}
      <ul className="grid grid-cols-3 gap-3">
        {PROMISES.map((pr) => (
          <li key={pr.title} className="entry p-4">
            <pr.icon size={18} strokeWidth={1.75} className="text-brand" aria-hidden="true" />
            <p className="mt-2 text-sm text-neutral-100">{pr.title}</p>
            <p className="mt-0.5 text-xs text-neutral-500 break-keep">{pr.sub}</p>
          </li>
        ))}
      </ul>

      <section className="entry space-y-5">
        <div className="flex gap-4">
          <span className="step-mark">1</span>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="js-source" className="text-xs text-neutral-500">
                원본 포트폴리오
              </label>
              <select
                id="js-source"
                value={sourcePortfolio}
                onChange={(e) => setSourcePortfolio(e.target.value)}
                className="field mt-1"
                disabled={!portfolios || running}
              >
                {!portfolios && <option>불러오는 중…</option>}
                {portfolios?.map((p) => (
                  <option key={p.id} value={p.id} className="bg-neutral-900">
                    {p.title} · {p.job}
                  </option>
                ))}
              </select>
              {loadError && <p className="text-xs text-brand mt-1">{loadError}</p>}
            </div>
            <div>
              <label htmlFor="js-job" className="text-xs text-neutral-500">
                목표 직무
              </label>
              <input
                id="js-job"
                value={targetJob}
                onChange={(e) => setTargetJob(e.target.value)}
                placeholder="예: 프로덕트 매니저"
                className="field mt-1"
                maxLength={100}
                disabled={running}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <span className="step-mark">2</span>
          <div className="flex-1 space-y-2">
            <label htmlFor="js-jd" className="text-xs text-neutral-500">
              채용 공고 — 자격 요건·우대 사항이 들어간 본문
            </label>
            <textarea
              id="js-jd"
              value={jobPostingText}
              onChange={(e) => setJobPostingText(e.target.value)}
              placeholder="공고 내용 붙여넣기"
              rows={6}
              className="field-area"
              maxLength={8000}
              disabled={running}
            />
            <div className="flex items-center gap-2">
              <Link2 size={14} strokeWidth={1.5} className="text-neutral-500 shrink-0" />
              <input
                value={jobPostingUrl}
                onChange={(e) => setJobPostingUrl(e.target.value)}
                placeholder="또는 공고 URL (로그인 필요한 사이트는 안 될 수 있어요)"
                className="field py-2"
                inputMode="url"
                disabled={running}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="note border-red-500" role="alert">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-neutral-300 break-keep">{error}</p>
        </div>
      )}

      {running ? (
        <div className="entry" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-neutral-100">
              <LoaderCircle size={16} className="text-brand animate-spin" />
              {targetJob.trim()} 방향으로 재구성하는 중
            </span>
            <span className="text-neutral-500 tabular-nums">{elapsed}초 · 보통 1분 안팎</span>
          </div>
          {/* 서버가 단계별 진행을 알려주지 않아서, 지난 시간으로 대략 짚습니다.
              정확한 진행률인 척하지 않도록 막대 대신 단계 이름만 켭니다. */}
          <ol className="mt-4 grid grid-cols-4 gap-2 text-xs">
            {STAGES.map((st, i) => {
              const on = elapsed >= st.at;
              const current = on && (i === STAGES.length - 1 || elapsed < STAGES[i + 1].at);
              return (
                <li
                  key={st.label}
                  className={`rounded-lg border px-3 py-2 ${
                    current
                      ? "border-brand text-brand"
                      : on
                        ? "border-neutral-700 text-neutral-400"
                        : "border-neutral-800 text-neutral-600"
                  }`}
                >
                  {st.label}
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          재구성 요청하기
        </button>
      )}

      {runs.length > 0 && (
        <section>
          <h2 className="text-xs text-neutral-500 mb-2">지난 재구성</h2>
          <ul className="entry p-0 divide-y divide-neutral-800/70">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/job-switch/result/${r.id}`}
                  className="flex items-center gap-3 px-5 py-3 text-sm hover:text-brand group"
                >
                  <Repeat size={14} strokeWidth={1.5} className="text-neutral-500 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">
                    <span className="text-neutral-100">{r.targetJob}</span>
                    <span className="text-neutral-500"> · {r.sourceTitle}</span>
                  </span>
                  {r.saved && <span className="badge bg-emerald-500/10 text-emerald-600">저장됨</span>}
                  <span className="text-xs text-neutral-500 shrink-0">{formatRelativeTime(new Date(r.createdAt).getTime())}</span>
                  <ArrowRight size={14} strokeWidth={1.5} className="text-neutral-600 group-hover:text-brand shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const PROMISES = [
  { icon: Quote, title: "문장마다 출처", sub: "어느 원문에서 왔는지 표시" },
  { icon: ShieldAlert, title: "없는 사실은 경고", sub: "원문에 없는 숫자·기술명을 짚음" },
  { icon: Lock, title: "원본은 그대로", sub: "확인 후 새 포트폴리오로 저장" },
] as const;

/** 대략의 단계 시각(초). 실제 진행과 정확히 맞지 않습니다 — 위 주석 참고. */
const STAGES = [
  { label: "공고 해부", at: 0 },
  { label: "근거 찾기", at: 8 },
  { label: "다시 쓰기", at: 25 },
  { label: "검증", at: 55 },
] as const;
