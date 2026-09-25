import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  Copy,
  Info,
  ListOrdered,
  LoaderCircle,
  Lock,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import {
  deleteJobSwitchRun,
  getJobSwitchRun,
  orderedFields,
  saveRunAsPortfolio,
  updateRunLead,
  FIELD_NAMES,
  JobSwitchError,
  LEAD_FIELDS,
  type Flag,
  type JobSwitchProject,
  type JobSwitchRun,
  type LeadField,
  type Match,
  type RewriteField,
} from "../../lib/jobSwitch";
import type { PortfolioProjectRow } from "../../lib/portfolios";

/**
 * 직무 전환 재구성 — 결과 화면. 설계는 docs/job-switch-design.md 4절.
 *
 * 순서가 곧 설계입니다.
 *  1. 커버리지 표 — 이 기능의 정체성. 재구성된 글보다 먼저 봐야 합니다.
 *     "근거 없음"이 눈에 띄어야 합니다. 채팅은 이걸 지어내서라도 채웁니다.
 *  2. 강조 순서 — 왜 이 필드가 맨 앞인지. 바꿔도 모델을 다시 부르지 않습니다.
 *  3. 경고 — 원문에 없는 숫자·기술명, 근거 없는 문장. 지우지 않고 원문과
 *     나란히 둡니다(오탐일 수 있고 판단은 사용자 몫).
 *  4. 문장 비교 — 원본 → 재구성, 그리고 어느 요구사항 때문인지.
 */

const LEVEL_LABEL: Record<Match["level"], string> = {
  full: "충족",
  partial: "일부",
  none: "근거 없음",
};

const LEVEL_INK: Record<Match["level"], string> = {
  full: "#2f7d57",
  partial: "#a8641c",
  none: "#b3413a",
};

const LEVEL_ICON = { full: CheckCircle2, partial: CircleDashed, none: XCircle } as const;

/** 확인 필요 칩 — 무엇이 걸렸는지 한 단어로 */
const FLAG_CHIP: Record<Flag["kind"], (d: string) => string> = {
  number: (d) => `원문에 없는 숫자 ${d}`,
  term: (d) => `원문에 없는 이름 ${d}`,
  no_evidence: () => "근거 문장 없음",
};

export default function JobSwitchResult() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [run, setRun] = useState<JobSwitchRun | null>(null);
  const [projects, setProjects] = useState<JobSwitchProject[]>([]);
  const [source, setSource] = useState<{ title: string; projects: PortfolioProjectRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    getJobSwitchRun(runId)
      .then((r) => {
        if (!alive) return;
        setRun(r.run);
        setProjects(r.projects);
        setSource(r.source);
      })
      .catch((e) => alive && setError(e instanceof JobSwitchError ? e.message : "결과를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [runId]);

  const evidenceById = useMemo(() => new Map((run?.evidence ?? []).map((e) => [e.id, e])), [run]);
  const reqById = useMemo(() => new Map((run?.requirements ?? []).map((r) => [r.id, r])), [run]);
  const counts = useMemo(() => {
    const c = { full: 0, partial: 0, none: 0 };
    for (const m of run?.matches ?? []) c[m.level] += 1;
    return c;
  }, [run]);

  if (error) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link to="/job-switch" className="text-xs text-brand hover:underline">
          직무 전환으로 돌아가기
        </Link>
        <p className="text-sm text-neutral-400">{error}</p>
      </div>
    );
  }
  if (!run) {
    return (
      <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
        <LoaderCircle size={14} className="animate-spin" /> 불러오는 중…
      </p>
    );
  }

  const changeLead = async (lead: LeadField) => {
    const prev = run.lead;
    setRun({ ...run, lead });
    try {
      await updateRunLead(run.id, lead);
    } catch {
      setRun({ ...run, lead: prev });
      setActionError("순서를 저장하지 못했습니다.");
    }
  };

  const save = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    setActionError(null);
    try {
      const id = await saveRunAsPortfolio({ userId: session.user.id, run, projects });
      setRun({ ...run, saved_portfolio_id: id });
    } catch (e) {
      setActionError(e instanceof JobSwitchError ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    try {
      await deleteJobSwitchRun(run.id);
      navigate("/job-switch", { replace: true });
    } catch {
      setActionError("삭제하지 못했습니다.");
    }
  };

  const sourceLabel = (evidenceId: string) => {
    const ev = evidenceById.get(evidenceId);
    if (!ev) return null;
    const p = projects[ev.projectIndex];
    return { text: ev.text, where: `${p?.name || `프로젝트 ${ev.projectIndex + 1}`} · ${FIELD_NAMES[ev.field]}` };
  };

  const flagsFor = (pi: number, field: RewriteField, si: number) =>
    run.flags.filter((f) => f.projectIndex === pi && f.field === field && f.sentenceIndex === si);

  const total = Math.max(1, run.requirements.length);
  const stats = [
    { key: "full", label: "충족", value: counts.full, icon: CheckCircle2, ink: "#2f7d57", fill: "rgb(47 125 87 / 0.08)" },
    { key: "partial", label: "일부", value: counts.partial, icon: CircleDashed, ink: "#a8641c", fill: "rgb(168 100 28 / 0.08)" },
    { key: "none", label: "근거 없음", value: counts.none, icon: XCircle, ink: "#b3413a", fill: "rgb(179 65 58 / 0.08)" },
    { key: "flags", label: "확인 필요", value: run.flags.length, icon: AlertTriangle, ink: "#8a6a3f", fill: "rgb(138 106 63 / 0.08)" },
  ] as const;

  return (
    <div className="max-w-6xl space-y-6">
      {/* ── 머리: 무엇의 결과인지 + 할 일 ─────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/job-switch" className="text-xs text-brand hover:underline">
            ← 직무 전환
          </Link>
          <h1 className="text-xl font-heading mt-2">{run.target_job}</h1>
          <p className="text-xs text-neutral-500 mt-1">
            원본 · {source?.title ?? "(삭제된 포트폴리오)"}
            {run.role && run.role !== run.target_job && <> · 공고 직무명 {run.role}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirmDiscard ? (
            <span className="inline-flex items-center gap-2 text-sm text-neutral-400">
              지울까요?{run.saved_portfolio_id && " (저장한 포트폴리오는 남습니다)"}
              <button className="btn-secondary" onClick={() => void discard()}>
                지우기
              </button>
              <button className="text-neutral-500 hover:underline" onClick={() => setConfirmDiscard(false)}>
                취소
              </button>
            </span>
          ) : (
            <button className="btn-secondary" onClick={() => setConfirmDiscard(true)}>
              버리기
            </button>
          )}
          {run.saved_portfolio_id ? (
            <Link to={`/wizard/editor/${run.saved_portfolio_id}`} className="btn-primary">
              <CheckCircle2 size={16} strokeWidth={1.75} /> 저장됨 · 편집기에서 열기
            </Link>
          ) : (
            <button className="btn-primary disabled:opacity-50" disabled={saving} onClick={() => void save()}>
              {saving ? "저장하는 중…" : "새 포트폴리오로 저장"}
            </button>
          )}
        </div>
      </div>
      {actionError && <p className="text-sm text-brand">{actionError}</p>}

      {/* ── 현황 띠: 숫자 넷 + 비율 막대 ─────────────────────── */}
      <div>
        <div className="entry p-0 overflow-hidden grid grid-cols-4 divide-x divide-neutral-800/70">
          {stats.map((st) => (
            <div key={st.key} className="px-5 py-4" style={{ backgroundColor: st.fill }}>
              <div className="flex items-center gap-2">
                <st.icon size={15} strokeWidth={1.75} style={{ color: st.ink }} aria-hidden="true" />
                <span className="text-xs text-neutral-500">{st.label}</span>
              </div>
              <p className="mt-1.5 text-[28px] leading-none font-heading" style={{ color: st.ink }}>
                {st.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
          <span style={{ width: `${(counts.full / total) * 100}%`, backgroundColor: "#2f7d57" }} />
          <span style={{ width: `${(counts.partial / total) * 100}%`, backgroundColor: "#c98a3a" }} />
          <span style={{ width: `${(counts.none / total) * 100}%`, backgroundColor: "#c9635c" }} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* ── 요구사항 표 ─────────────────────────────────── */}
        <section className="entry">
          <h2 className="entry-title">공고 요구사항 {run.requirements.length}</h2>
          <ul>
            {run.requirements.map((req) => {
              const m = run.matches.find((x) => x.requirementId === req.id);
              const level = m?.level ?? "none";
              const Icon = LEVEL_ICON[level];
              const isOpen = open === req.id;
              return (
                <li key={req.id} className="row">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 text-left group"
                    onClick={() => setOpen(isOpen ? null : req.id)}
                    aria-expanded={isOpen}
                  >
                    <Icon size={18} strokeWidth={1.75} className="shrink-0" style={{ color: LEVEL_INK[level] }} aria-label={LEVEL_LABEL[level]} />
                    <span className="flex-1 text-sm text-neutral-200 break-keep group-hover:text-neutral-50">{req.text}</span>
                    {req.kind === "nice" && <span className="text-[11px] text-neutral-500 shrink-0">우대</span>}
                    <span className="text-xs shrink-0 w-14 text-right" style={{ color: LEVEL_INK[level] }}>
                      {LEVEL_LABEL[level]}
                    </span>
                    <ChevronDown
                      size={15}
                      strokeWidth={1.5}
                      className={`shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-2.5 ml-[30px] space-y-2 text-sm">
                      {level === "none" ? (
                        <p className="text-xs text-neutral-500">
                          원문에 근거가 없어 채우지 않았습니다. 해본 일이라면 원본에 먼저 적어 주세요.
                          {m?.downgraded && " (AI가 댄 근거가 원문에 없어 '근거 없음'으로 바꿈)"}
                        </p>
                      ) : (
                        <>
                          {m?.evidenceIds.map((id) => {
                            const src = sourceLabel(id);
                            if (!src) return null;
                            return (
                              <blockquote key={id} className="border-l-2 pl-3" style={{ borderColor: LEVEL_INK[level] }}>
                                <p className="text-neutral-300">{src.text}</p>
                                <p className="text-[11px] text-neutral-500 mt-0.5">{src.where}</p>
                              </blockquote>
                            );
                          })}
                          {m?.why && <p className="text-xs text-neutral-500">{m.why}</p>}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── 오른쪽: 맨 앞 항목 + 확인 필요 ─────────────────── */}
        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="entry">
            <p className="text-xs text-neutral-500">맨 앞에 둔 항목</p>
            <div className="mt-2 flex items-center gap-2">
              <ListOrdered size={18} strokeWidth={1.75} className="text-brand shrink-0" />
              <select
                className="field py-2 font-medium"
                value={run.lead}
                onChange={(e) => void changeLead(e.target.value as LeadField)}
                disabled={Boolean(run.saved_portfolio_id)}
                aria-label="맨 앞에 둘 항목"
              >
                {LEAD_FIELDS.map((f) => (
                  <option key={f} value={f} className="bg-neutral-900">
                    {FIELD_NAMES[f]}
                  </option>
                ))}
              </select>
            </div>
            {run.lead_reason && (
              <p className="mt-3 text-xs text-neutral-500 break-keep">
                <span className="text-neutral-300">왜?</span> {run.lead_reason}
              </p>
            )}
          </section>

          <section className="entry">
            <h2 className="entry-title">
              <AlertTriangle size={16} strokeWidth={1.75} style={{ color: "#8a6a3f" }} />
              확인 필요 {run.flags.length}
            </h2>
            {run.flags.length === 0 ? (
              <p className="text-xs text-neutral-500">원문에 없는 숫자·이름이 들어간 문장이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {run.flags.map((f, i) => (
                  <li key={i} className="text-sm">
                    <span className="badge bg-amber-500/10 text-amber-700">{FLAG_CHIP[f.kind](f.detail)}</span>
                    <p className="mt-1.5 text-neutral-200 break-keep">{f.sentence}</p>
                    {f.sources[0] && (
                      <p className="text-[11px] text-neutral-500 mt-1 break-keep">원문 · {f.sources.join(" / ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* ── 프로젝트별 비교 ───────────────────────────────────── */}
      {projects.map((p, pi) => {
        const original = source?.projects.find((sp) => sp.id === p.source_project_id);
        const fields: RewriteField[] = ["role", ...orderedFields(run.lead)];
        return (
          <section key={p.id} className="entry">
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <h2 className="entry-title mb-0">{p.name || `프로젝트 ${pi + 1}`}</h2>
              <span className="text-xs text-neutral-500 inline-flex items-center gap-1.5">
                원본 <ArrowRight size={12} strokeWidth={1.5} /> 재구성
              </span>
            </div>
            {fields.map((field) => {
              const before = String(original?.[field] ?? "").trim();
              const after = p.sentences?.[field] ?? [];
              if (!before && after.length === 0) return null;
              const isLead = field === run.lead;
              return (
                <div
                  key={field}
                  className="grid grid-cols-[104px_minmax(0,1fr)_minmax(0,1.3fr)] gap-x-6 py-3 border-t border-neutral-800/60 text-sm"
                >
                  <span className="pt-0.5">
                    <span className={`badge ${isLead ? "bg-brand/10 text-brand" : "bg-neutral-800/70 text-neutral-400"}`}>
                      {FIELD_NAMES[field]}
                    </span>
                    {isLead && <span className="block text-[11px] text-brand mt-1 ml-1">맨 앞</span>}
                  </span>
                  <p className="text-xs leading-relaxed text-neutral-500 whitespace-pre-line break-keep">{before || "—"}</p>
                  <div className="space-y-1.5">
                    {after.length === 0 && <p className="text-neutral-600">—</p>}
                    {after.map((st, si) => {
                      const flagged = flagsFor(pi, field, si).length > 0;
                      return (
                        <p key={si} className="text-neutral-100 break-keep">
                          {flagged && (
                            <AlertTriangle size={13} strokeWidth={2} className="inline mr-1 -mt-0.5" style={{ color: "#8a6a3f" }} aria-label="확인 필요" />
                          )}
                          <span className={flagged ? "underline decoration-amber-500/70 decoration-2 underline-offset-4" : ""}>
                            {st.text}
                          </span>
                          {st.requirements.map((rid) => (
                            <span
                              key={rid}
                              title={reqById.get(rid)?.text}
                              className="ml-1.5 align-middle badge bg-brand/10 text-brand"
                            >
                              {short(reqById.get(rid)?.text ?? rid)}
                            </span>
                          ))}
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {/* 저장하면 무엇이 어떻게 옮겨지는지 — 문단 대신 짧은 항목으로 */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-neutral-500">
        <li className="inline-flex items-center gap-1.5"><Lock size={12} strokeWidth={1.75} /> 원본은 그대로</li>
        <li className="inline-flex items-center gap-1.5"><Copy size={12} strokeWidth={1.75} /> 스타일·이미지·블록은 복사, 요약 문단은 원본 그대로</li>
        <li className="inline-flex items-center gap-1.5"><ClipboardList size={12} strokeWidth={1.75} /> 근거 없음 항목은 편집기 '부족한 부분'에 기록</li>
        <li className="inline-flex items-center gap-1.5"><Info size={12} strokeWidth={1.75} /> 합격 가능성은 예측하지 않습니다</li>
      </ul>
    </div>
  );
}

/** 요구사항 칩은 짧게. 전체 문장은 title 로. */
function short(text: string) {
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}
