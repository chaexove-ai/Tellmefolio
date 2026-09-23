import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, LoaderCircle, RotateCcw } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import {
  getPortfolioWithProjects,
  listMyPortfolios,
  PortfolioError,
} from "../../lib/portfolios";
import type { LibraryPortfolio, PortfolioProjectRow, PortfolioRow } from "../../lib/portfolios";
import { requestSwitch, saveSwitchedPortfolio, SwitchError } from "../../lib/switchRole";
import type { SwitchSuggestion } from "../../lib/switchRole";

/**
 * 직무 전환.
 *
 * [전에 무엇이었나]
 * 목업이었습니다. 포트폴리오 목록이 mockData.portfolios(고정 4건)이고,
 * "변환" 은 setTimeout(1200ms) 뒤에 완료로 바뀔 뿐 아무 일도 하지
 * 않았습니다. 사이드바에 메뉴로 떠 있어서 사용자는 되는 기능으로 봤습니다.
 *
 * [무엇을 묻던 화면이었나 — 그게 왜 틀렸나]
 * "결과 중심형 / 문제-실행-결과형" 중 하나를 고르게 했습니다. 그건
 * 서술 순서를 묻는 것인데, 순서는 이미 템플릿과 5필드(맥락→문제→실행→
 * 성과→회고)가 정하고 있었습니다. 같은 걸 두 군데서 정한 셈입니다.
 * 게다가 순서를 바꾼다고 마케터의 포트폴리오가 PM 것처럼 읽히지 않습니다.
 *
 * 직무를 바꿀 때 실제로 막히는 건 "내 경험 중 무엇이 새 직무의 무엇에
 * 해당하는가" 입니다. 숙소 운영 경험을 PM 지원에 쓸 때 필요한 건 순서
 * 바꾸기가 아니라 "예약 자동화 운영 → 요구사항 정의와 이해관계자 조율"
 * 로 번역하는 일입니다. 그래서 화면이 묻는 것도 그것으로 바꿨습니다.
 *
 * [왜 프로젝트마다 고르게 하나]
 * 한 번에 다 바꿔놓으면 사용자는 무엇이 어떻게 바뀌었는지 모른 채
 * 통째로 받거나 통째로 버려야 합니다. 자기 경험이 실제로 무엇이었는지는
 * 본인만 알기 때문에, 판단할 자리를 프로젝트마다 둡니다.
 *
 * [왜 한 화면인가]
 * 전에는 요청 화면과 결과 화면이 나뉘어 있었습니다. 제안을 보면서
 * 목표 직무를 고쳐 다시 돌리는 일이 잦을 텐데, 화면이 갈리면 그때마다
 * 뒤로 가야 합니다. 위에 입력, 아래에 제안을 두고 같은 자리에서 돕니다.
 */
export default function JobSwitchRequest() {
  const navigate = useNavigate();
  const { session, configured } = useAuth();
  const userId = session?.user?.id;

  const [mine, setMine] = useState<LibraryPortfolio[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [posting, setPosting] = useState("");

  const [source, setSource] = useState<PortfolioRow | null>(null);
  const [sourceProjects, setSourceProjects] = useState<PortfolioProjectRow[]>([]);
  const [suggestions, setSuggestions] = useState<SwitchSuggestion[] | null>(null);
  const [summary, setSummary] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState<null | "ask" | "save">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !userId) {
      setMine([]);
      return;
    }
    let alive = true;
    listMyPortfolios(userId)
      .then((rows) => {
        if (!alive) return;
        setMine(rows);
        if (rows.length > 0) setSourceId((cur) => cur || rows[0].id);
      })
      .catch(() => alive && setError("포트폴리오 목록을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [configured, userId]);

  const ask = async () => {
    if (!sourceId || !targetJob.trim()) return;
    setBusy("ask");
    setError(null);
    setSuggestions(null);
    try {
      const { portfolio, projects } = await getPortfolioWithProjects(sourceId);
      setSource(portfolio);
      setSourceProjects(projects);

      if (projects.length === 0) {
        throw new SwitchError("이 포트폴리오에는 옮길 프로젝트가 없습니다.");
      }

      const result = await requestSwitch({
        targetJob: targetJob.trim(),
        currentJob: portfolio.job ?? "",
        posting: posting.trim(),
        projects,
      });

      setSuggestions(result.projects);
      setSummary(result.summary);
      // 옮길 수 있다고 본 것만 미리 체크해 둡니다. 안 된다고 한 것까지
      // 켜두면 "제안" 이 아니라 "결정" 이 됩니다.
      setAccepted(new Set(result.projects.filter((p) => !p.skip).map((p) => p.id)));
    } catch (e) {
      setError(
        e instanceof SwitchError || e instanceof PortfolioError
          ? e.message
          : "제안을 만들지 못했습니다."
      );
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!userId || !source || !suggestions) return;
    setBusy("save");
    setError(null);
    try {
      const map = new Map<string, SwitchSuggestion>();
      for (const s of suggestions) if (accepted.has(s.id)) map.set(s.id, s);

      const created = await saveSwitchedPortfolio({
        userId,
        source,
        sourceProjects,
        targetJob: targetJob.trim(),
        title: `${source.title} — ${targetJob.trim()}`,
        summary,
        accepted: map,
      });
      navigate(`/wizard/editor/${created.id}`);
    } catch (e) {
      setError(e instanceof SwitchError ? e.message : "저장하지 못했습니다.");
      setBusy(null);
    }
  };

  const toggle = (id: string) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const projectName = (id: string) =>
    sourceProjects.find((p) => p.id === id)?.name?.trim() || "제목 없는 프로젝트";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-heading">직무 전환</h1>
        <p className="text-xs text-neutral-500 mt-1.5 max-w-[68ch] leading-relaxed">
          지금 포트폴리오를 목표 직무의 말로 다시 씁니다. 없는 경험을 만들지
          않습니다 — 같은 사실을 그 직무가 쓰는 용어로 바꿔 부를 뿐이고,
          옮길 것이 없는 프로젝트는 그렇다고 알려줍니다.
        </p>
      </div>

      {error && (
        <p role="alert" className="entry py-3 text-sm text-red-400 border-l-2 border-l-red-600">
          {error}
        </p>
      )}

      <div className="entry space-y-4">
        <div>
          <label htmlFor="source" className="block text-sm text-neutral-300 mb-1.5">
            바꿀 포트폴리오
          </label>
          {mine === null ? (
            <p className="text-sm text-neutral-500">불러오는 중…</p>
          ) : mine.length === 0 ? (
            <div className="text-sm text-neutral-500">
              아직 만든 포트폴리오가 없습니다.{" "}
              <Link to="/wizard" className="text-brand hover:underline">
                먼저 하나 만드세요
              </Link>
            </div>
          ) : (
            <select
              id="source"
              className="field w-full py-2"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {mine.map((p) => (
                <option key={p.id} value={p.id} className="bg-neutral-900">
                  {p.title} · {p.job}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="target" className="block text-sm text-neutral-300 mb-1.5">
            목표 직무
          </label>
          <input
            id="target"
            className="field w-full py-2"
            value={targetJob}
            maxLength={80}
            placeholder="예: 프로덕트 매니저"
            onChange={(e) => setTargetJob(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="posting" className="block text-sm text-neutral-300 mb-1.5">
            공고 내용 <span className="text-neutral-600">(선택)</span>
          </label>
          <textarea
            id="posting"
            className="field w-full py-2 min-h-[8rem]"
            value={posting}
            maxLength={6000}
            placeholder="지원할 공고를 붙여넣으면 그 공고가 요구하는 역량에 맞춰 제안합니다."
            onChange={(e) => setPosting(e.target.value)}
          />
          <p className="text-xs text-neutral-600 mt-1.5">
            붙여넣지 않아도 됩니다. 넣으면 "이 공고가 찾는 것" 기준으로 맞춥니다.
          </p>
        </div>

        <button
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-40"
          disabled={!sourceId || !targetJob.trim() || busy !== null}
          onClick={() => void ask()}
        >
          {busy === "ask" ? (
            <>
              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
              읽는 중…
            </>
          ) : (
            <>
              {suggestions ? (
                <RotateCcw size={14} aria-hidden="true" />
              ) : (
                <ArrowRight size={14} aria-hidden="true" />
              )}
              {suggestions ? "다시 제안받기" : "제안받기"}
            </>
          )}
        </button>
      </div>

      {suggestions && (
        <>
          {summary && (
            <div className="entry">
              <h2 className="entry-title">다시 쓴 소개</h2>
              <textarea
                className="field w-full py-2 min-h-[6rem] text-sm"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                aria-label="다시 쓴 소개"
              />
              <p className="text-xs text-neutral-600 mt-1.5">
                그대로 저장되는 글입니다. 고치고 싶으면 여기서 고치세요.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm text-neutral-300">
                프로젝트별 제안{" "}
                <span className="text-neutral-600">
                  ({accepted.size}/{suggestions.length} 채택)
                </span>
              </h2>
              <p className="text-xs text-neutral-600">
                채택하지 않은 것은 원문 그대로 들어갑니다
              </p>
            </div>

            {suggestions.map((s) => {
              const on = accepted.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`entry ${on ? "border-l-2 border-l-brand" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-100 truncate">
                        {projectName(s.id)}
                      </p>
                      {s.competency && (
                        <p className="text-xs text-brand mt-1">{s.competency}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={on}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs transition-colors ${
                        on
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {on && <Check size={12} aria-hidden="true" />}
                      {on ? "채택함" : "원문 유지"}
                    </button>
                  </div>

                  {s.why && (
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">{s.why}</p>
                  )}

                  {s.skip ? (
                    <p className="text-xs text-neutral-600">
                      목표 직무와 연결되는 부분을 찾지 못했습니다. 그래도 채택하면
                      다시 쓴 글이 들어가지만, 대개는 원문 그대로 두는 편이 낫습니다.
                    </p>
                  ) : (
                    // 무엇이 어떻게 바뀌는지 접어두지 않고 그대로 보여줍니다.
                    // "펼쳐보기" 뒤에 숨기면 대부분은 안 펼치고 채택합니다.
                    <dl className="space-y-2.5 text-sm">
                      <Field label="맥락 및 배경" value={s.context} />
                      <Field label="문제 정의" value={s.problem} />
                      <Field label="실행 내용" value={s.execution} />
                      <Field label="핵심 성과" value={s.outcome} />
                      <Field label="배운 점" value={s.reflection} />
                    </dl>
                  )}
                </div>
              );
            })}
          </div>

          <div className="entry flex items-center justify-between gap-4">
            <p className="text-xs text-neutral-500 leading-relaxed">
              <span className="text-neutral-300">새 포트폴리오로 저장됩니다.</span> 지금
              포트폴리오는 그대로 남습니다.
            </p>
            <button
              className="btn-primary shrink-0 inline-flex items-center gap-2 disabled:opacity-40"
              disabled={busy !== null}
              onClick={() => void save()}
            >
              {busy === "save" && (
                <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
              )}
              새 포트폴리오로 저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 비어 있는 항목은 아예 그리지 않습니다 — 빈 칸이 줄줄이 보이면 실패로 읽힙니다. */
function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-600 mb-1">{label}</dt>
      <dd className="text-neutral-300 whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  );
}
