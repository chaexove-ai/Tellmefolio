import { useEffect, useMemo, useState } from "react";
import BackLink from "../../components/BackLink";
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
  FileText,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import {
  deleteJobSwitchRun,
  getJobSwitchRun,
  joinSentences,
  orderedFields,
  saveRunAsPortfolio,
  updateProjectSentences,
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
  type Sentence,
} from "../../lib/jobSwitch";
import SentenceRow, { attentionOf, FLAG_TEXT } from "./SentenceRow";
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
 *     [10-16] 문장을 누르면 그 문장이 인용한 근거가 펼쳐지고, 그대로 쓰기·고치기·
 *     원문으로 되돌리기를 고릅니다. 설계: docs/sentence-review-design.md
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
  const [confirmSave, setConfirmSave] = useState(false);
  /** 펼친 문장. `${pi}-${field}-${si}` */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
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
  const matchById = useMemo(() => new Map((run?.matches ?? []).map((m) => [m.requirementId, m])), [run]);
  // [09-26] 어학·학위·경력 연수 같은 이력서 요건은 프로젝트에서 근거를 찾지 않고 따로 보여 줍니다.
  const projectReqs = useMemo(() => (run?.requirements ?? []).filter((r) => r.scope !== "profile"), [run]);
  const profileReqs = useMemo(() => (run?.requirements ?? []).filter((r) => r.scope === "profile"), [run]);
  const counts = useMemo(() => {
    const c = { full: 0, partial: 0, none: 0 };
    for (const m of run?.matches ?? []) c[m.level] += 1;
    return c;
  }, [run]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink to="/job-switch">직무 전환</BackLink>
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

  const save = async (force = false) => {
    if (!session?.user?.id) return;
    if (!force && pending.length > 0) {
      setConfirmSave(true);
      return;
    }
    setConfirmSave(false);
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

  const fieldsOf = (lead: LeadField): RewriteField[] => ["role", ...orderedFields(lead)];
  const levelOf = (rid: string) => matchById.get(rid)?.level;
  const keyOf = (pi: number, field: RewriteField, si: number) => `${pi}-${field}-${si}`;

  /** 확인할 문장 — 서버 경고 또는 근거 약함. 화면 순서대로 */
  const targets = projects.flatMap((p, pi) =>
    fieldsOf(run.lead).flatMap((field) =>
      (p.sentences?.[field] ?? []).flatMap((st, si) => {
        const fl = flagsFor(pi, field, si);
        const att = attentionOf(st, fl, levelOf);
        return att ? [{ key: keyOf(pi, field, si), pi, field, si, st, fl, att }] : [];
      })
    )
  );
  const pending = targets.filter((t) => !t.st.review);
  const readOnly = Boolean(run.saved_portfolio_id);

  const goTo = (key: string) => {
    setOpenKey(key);
    requestAnimationFrame(() => document.getElementById(`sent-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  /** 문장 결정 반영 — 화면을 먼저 바꾸고 저장, 실패하면 되돌립니다 */
  const changeSentence = async (pi: number, field: RewriteField, si: number, next: Sentence) => {
    const prev = projects;
    const p = projects[pi];
    const list = (p.sentences?.[field] ?? []).map((x, i) => (i === si ? next : x));
    const sentences = { ...p.sentences, [field]: list };
    setProjects(projects.map((x, i) => (i === pi ? { ...x, sentences, [field]: joinSentences(list) } : x)));
    setBusyKey(keyOf(pi, field, si));
    setActionError(null);
    try {
      await updateProjectSentences(p.id, field, sentences);
      // 결정했으면 다음 확인할 문장으로 넘어갈 수 있게 닫지 않고 둡니다
    } catch (e) {
      setProjects(prev);
      setActionError(e instanceof JobSwitchError ? e.message : "문장 결정을 저장하지 못했습니다.");
    } finally {
      setBusyKey(null);
    }
  };

  const total = Math.max(1, projectReqs.length);
  const stats = [
    { key: "full", label: "충족", value: counts.full, icon: CheckCircle2, ink: "#2f7d57", fill: "rgb(47 125 87 / 0.08)" },
    { key: "partial", label: "일부", value: counts.partial, icon: CircleDashed, ink: "#a8641c", fill: "rgb(168 100 28 / 0.08)" },
    { key: "none", label: "근거 없음", value: counts.none, icon: XCircle, ink: "#b3413a", fill: "rgb(179 65 58 / 0.08)" },
    { key: "flags", label: "확인할 문장", value: targets.length, icon: AlertTriangle, ink: "#8a6a3f", fill: "rgb(138 106 63 / 0.08)" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── 머리: 무엇의 결과인지 + 할 일 ─────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink to="/job-switch">직무 전환</BackLink>
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
      {confirmSave && !readOnly && (
        <div role="alert" className="entry flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-neutral-300 break-keep">
            확인 안 한 문장이 <b>{pending.length}개</b> 있어요. 저장하면 AI 문장 그대로 들어갑니다.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary py-1.5 text-sm"
              onClick={() => {
                setConfirmSave(false);
                if (pending[0]) goTo(pending[0].key);
              }}
            >
              검토하러 가기
            </button>
            <button className="btn-secondary py-1.5 text-sm" onClick={() => void save(true)}>
              그대로 저장
            </button>
          </div>
        </div>
      )}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* ── 요구사항 표 ─────────────────────────────────── */}
        <section className="entry">
          <h2 className="entry-title">프로젝트로 보여 줄 요구사항 {projectReqs.length}</h2>
          <ul>
            {projectReqs.map((req) => {
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

          {profileReqs.length > 0 && (
            <div className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="text-sm font-medium text-neutral-300">이력서로 확인할 요건 {profileReqs.length}</h3>
              <p className="mt-1 text-xs text-neutral-500 break-keep">
                어학·학위·경력 연수처럼 프로젝트가 아니라 이력서·지원서에서 보여 주는 요건이에요. 프로젝트에서 억지로 근거를 찾지 않았어요.
              </p>
              <ul className="mt-2">
                {profileReqs.map((req) => (
                  <li key={req.id} className="row flex items-center gap-3">
                    <FileText size={17} strokeWidth={1.75} className="shrink-0 text-neutral-500" aria-hidden="true" />
                    <span className="flex-1 text-sm text-neutral-300 break-keep">{req.text}</span>
                    {req.kind === "nice" && <span className="text-[11px] text-neutral-500 shrink-0">우대</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── 오른쪽: 맨 앞 항목 + 확인 필요 ─────────────────── */}
        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6">
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

          <section className="entry" aria-labelledby="review-queue">
            <h2 id="review-queue" className="entry-title">
              <AlertTriangle size={16} strokeWidth={1.75} style={{ color: "#8a6a3f" }} />
              확인할 문장
              {targets.length > 0 && (
                <span className="ml-auto text-xs font-normal text-neutral-500">
                  검토 {targets.length - pending.length} / {targets.length}
                </span>
              )}
            </h2>
            {targets.length === 0 ? (
              <p className="text-xs text-neutral-500 break-keep">
                자동 검사에 걸린 문장이 없어요. 자동 검사는 숫자와 영문 이름만 봅니다 — 문장을 누르면 근거를 볼 수 있어요.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-neutral-500 break-keep mb-2">
                  원문에 없는 숫자·이름이 들어갔거나(⚠), 근거가 약한 요구사항에 맞춘(◌) 문장이에요. 자동 검사는 표현 과장을 잡지 못합니다.
                </p>
                <ul className="space-y-1">
                  {targets.map((t) => {
                    const done = Boolean(t.st.review);
                    const reason = t.att === "flag" ? FLAG_TEXT[t.fl[0].kind](t.fl[0].detail) : "근거 약함";
                    return (
                      <li key={t.key}>
                        <button
                          type="button"
                          onClick={() => goTo(t.key)}
                          aria-current={openKey === t.key}
                          className={`w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-neutral-800/50 ${openKey === t.key ? "bg-neutral-800/50" : ""}`}
                        >
                          <span className="flex items-center gap-2">
                            {t.att === "flag" ? (
                              <AlertTriangle size={13} strokeWidth={2} className="shrink-0" style={{ color: "#8a6a3f" }} aria-hidden="true" />
                            ) : (
                              <CircleDashed size={13} strokeWidth={2} className="shrink-0" style={{ color: "#a8641c" }} aria-hidden="true" />
                            )}
                            <span className={`flex-1 truncate ${done ? "text-neutral-500" : "text-neutral-200"}`}>{reason}</span>
                            {done ? (
                              <span className="text-[11px] text-[#2f7d57] shrink-0">완료</span>
                            ) : (
                              <span className="text-[11px] text-neutral-500 shrink-0">미확인</span>
                            )}
                          </span>
                          <span className="block mt-0.5 ml-[21px] text-[11px] text-neutral-500 truncate">{t.st.review?.ai_text ?? t.st.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {pending.length > 0 && !readOnly && (
                  <button type="button" className="btn-secondary mt-3 w-full py-1.5 text-sm" onClick={() => goTo(pending[0].key)}>
                    다음 확인할 문장 <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </section>
        </aside>
      </div>

      {/* ── 프로젝트별 비교 ───────────────────────────────────── */}
      {projects.map((p, pi) => {
        const original = source?.projects.find((sp) => sp.id === p.source_project_id);
        const fields = fieldsOf(run.lead);
        // 고친 문장을 다시 검사할 원문 — 서버 verifyProject 와 같은 범위(이름·스택·6필드)
        const whole = original
          ? [original.name, ...(original.stack ?? []), ...(["context", "role", "problem", "execution", "outcome", "reflection"] as const).map((f) => String(original[f] ?? ""))].join("\n")
          : "";
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
                  className="grid grid-cols-1 gap-y-2 md:grid-cols-[104px_minmax(0,1fr)_minmax(0,1.3fr)] gap-x-6 py-3 border-t border-neutral-800/60 text-sm"
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
                      const key = keyOf(pi, field, si);
                      return (
                        <SentenceRow
                          key={si}
                          domId={`sent-${key}`}
                          sentence={st}
                          flags={flagsFor(pi, field, si)}
                          evidenceById={evidenceById}
                          reqById={reqById}
                          matchById={matchById}
                          whereOf={(e) => {
                            const src = sourceLabel(e.id);
                            return src?.where ?? "";
                          }}
                          whole={whole}
                          open={openKey === key}
                          onToggle={() => setOpenKey(openKey === key ? null : key)}
                          onChange={(next) => void changeSentence(pi, field, si, next)}
                          readOnly={readOnly}
                          busy={busyKey === key}
                          requirementChip={(rid) => (
                            <span
                              key={rid}
                              title={reqById.get(rid)?.text}
                              className="ml-1.5 align-middle badge bg-brand/10 text-brand whitespace-nowrap"
                            >
                              {reqById.get(rid)?.label || short(reqById.get(rid)?.text ?? rid)}
                            </span>
                          )}
                        />
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
