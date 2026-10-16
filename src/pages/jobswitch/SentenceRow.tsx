import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CircleDashed, PenLine, Trash2, Undo2 } from "lucide-react";
import {
  unsupportedTokens,
  type Evidence,
  type Flag,
  type Match,
  type Requirement,
  type ReviewStatus,
  type Sentence,
} from "../../lib/jobSwitch";

/**
 * 직무 전환 결과의 문장 한 줄 — 근거 보기와 채택·고치기·원문으로 되돌리기.
 * 설계: docs/sentence-review-design.md 3절.
 *
 * 문장을 누르면 바로 아래에 펼칩니다. 한 번에 하나만(부모가 openKey 로 관리).
 */

export type Attention = "flag" | "weak" | null;

/** 확인이 필요한 정도. 서버 경고가 먼저, 다음이 근거 약함(대응 요구사항 중 partial) */
export function attentionOf(s: Sentence, flags: Flag[], levelOf: (rid: string) => Match["level"] | undefined): Attention {
  if (flags.length > 0) return "flag";
  if (s.requirements.some((rid) => levelOf(rid) === "partial")) return "weak";
  return null;
}

export const FLAG_TEXT: Record<Flag["kind"], (d: string) => string> = {
  number: (d) => `원문에 없는 숫자 ${d}`,
  term: (d) => `원문에 없는 이름 ${d}`,
  no_evidence: () => "근거 문장 없음",
};

const STATUS: Record<ReviewStatus, { label: string; icon: typeof Check; ink: string }> = {
  accepted: { label: "채택", icon: Check, ink: "#2f7d57" },
  edited: { label: "고침", icon: PenLine, ink: "#2f7d57" },
  reverted: { label: "원문", icon: Undo2, ink: "#2f7d57" },
  deleted: { label: "지움", icon: Trash2, ink: "#8a8a8a" },
};

const WARN_INK = "#8a6a3f";
const WEAK_INK = "#a8641c";

interface Props {
  domId: string;
  sentence: Sentence;
  flags: Flag[];
  evidenceById: Map<string, Evidence>;
  reqById: Map<string, Requirement>;
  matchById: Map<string, Match>;
  /** 증거 위치 표시용 "프로젝트 · 필드" */
  whereOf: (e: Evidence) => string;
  /** 고친 문장 다시 검사할 원문 전체(프로젝트 이름·스택·6필드) */
  whole: string;
  open: boolean;
  onToggle: () => void;
  /** 결정 반영. 실패하면 부모가 되돌리고 알립니다 */
  onChange: (next: Sentence) => void;
  readOnly: boolean;
  busy: boolean;
  requirementChip: (rid: string) => ReactNode;
}

export default function SentenceRow(p: Props) {
  const { sentence: s, flags } = p;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.text);
  const firstAction = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const levelOf = (rid: string) => p.matchById.get(rid)?.level;
  const attention = attentionOf(s, flags, levelOf);
  const status = s.review?.status;
  const aiText = s.review?.ai_text ?? s.text;
  const cited = s.evidence.map((id) => p.evidenceById.get(id)).filter((e): e is Evidence => Boolean(e));
  const weakReqs = s.requirements.filter((rid) => levelOf(rid) === "partial");
  const panelId = `${p.domId}-panel`;

  // 펼치면 첫 버튼으로, 닫히면 문장으로 포커스를 돌립니다
  const wasOpen = useRef(p.open);
  useEffect(() => {
    if (p.open && !wasOpen.current) firstAction.current?.focus();
    if (!p.open && wasOpen.current) trigger.current?.focus();
    wasOpen.current = p.open;
    if (!p.open) setEditing(false);
  }, [p.open]);
  useEffect(() => {
    if (editing) textarea.current?.focus();
  }, [editing]);

  const decide = (next: Partial<Sentence> & { status: ReviewStatus | null }) => {
    const { status: st, ...rest } = next;
    p.onChange({
      ...s,
      ...rest,
      review: st ? { status: st, ai_text: aiText, at: new Date().toISOString() } : undefined,
    });
  };

  const accept = () => decide({ status: "accepted", text: aiText });
  const revert = () => decide({ status: "reverted", text: cited.map((e) => e.text).join(" ") });
  const remove = () => decide({ status: "deleted", text: "" });
  const undo = () => decide({ status: null, text: aiText });
  const saveEdit = () => {
    const t = draft.trim();
    if (!t) return;
    setEditing(false);
    if (t === aiText) decide({ status: "accepted", text: aiText });
    else decide({ status: "edited", text: t });
  };

  // 고친 문장에 새로 들어간 숫자·이름(서버와 같은 규칙). 막지 않고 알리기만 합니다
  // 원본 포트폴리오가 지워져 원문이 없으면 검사하지 않습니다(전부 걸리는 소음)
  const newTokens = status === "edited" && p.whole ? unsupportedTokens(s.text, p.whole) : [];
  const editTokens = editing && p.whole ? unsupportedTokens(draft, p.whole) : [];

  const Lead = status ? STATUS[status].icon : attention === "flag" ? AlertTriangle : attention === "weak" ? CircleDashed : null;
  const leadInk = status ? STATUS[status].ink : attention === "flag" ? WARN_INK : WEAK_INK;
  const leadLabel = status ? STATUS[status].label : attention === "flag" ? "확인 필요" : attention === "weak" ? "근거 약함" : "";

  return (
    <div id={p.domId} className="scroll-mt-24">
      <p className="break-keep">
        <button
          ref={trigger}
          type="button"
          onClick={p.onToggle}
          aria-expanded={p.open}
          aria-controls={panelId}
          className={`text-left rounded-sm -mx-1 px-1 hover:bg-neutral-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
            p.open ? "bg-neutral-800/50" : ""
          }`}
        >
          {Lead && (
            <Lead size={13} strokeWidth={2} className="inline mr-1 -mt-0.5" style={{ color: leadInk }} aria-label={leadLabel} />
          )}
          {status === "deleted" ? (
            <span className="text-neutral-500 line-through">{aiText}</span>
          ) : (
            <span
              className={`text-neutral-100 ${
                !status && attention === "flag" ? "underline decoration-amber-500/70 decoration-2 underline-offset-4" : ""
              }`}
            >
              {!status ? highlight(s.text, flags) : s.text}
            </span>
          )}
        </button>
        {s.requirements.map((rid) => p.requirementChip(rid))}
        {/* 이유를 문장 바로 옆에 — 사이드바까지 가지 않아도 되게 */}
        {!status && flags.map((f, i) => (
          <span key={i} className="ml-1.5 align-middle badge bg-amber-500/10 text-amber-700 max-w-full break-all">
            {FLAG_TEXT[f.kind](f.detail)}
          </span>
        ))}
        {!status && attention === "weak" && (
          <span className="ml-1.5 align-middle badge whitespace-nowrap" style={{ color: WEAK_INK, backgroundColor: "rgb(168 100 28 / 0.08)" }}>
            근거 약함
          </span>
        )}
        {status && (
          <span className="ml-1.5 align-middle text-[11px] whitespace-nowrap" style={{ color: STATUS[status].ink }}>
            {STATUS[status].label}
          </span>
        )}
      </p>

      {p.open && (
        <div id={panelId} role="region" aria-label="이 문장의 근거" className="mt-2 mb-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-3 text-sm [overflow-wrap:anywhere]">
          <div>
            <p className="text-[11px] text-neutral-500 mb-1.5">이 문장의 근거</p>
            {cited.length === 0 ? (
              <p className="text-xs text-neutral-400">AI가 근거 문장을 대지 않았어요. 원문에 없는 내용일 수 있습니다.</p>
            ) : (
              <div className="space-y-2">
                {cited.map((e) => (
                  <blockquote key={e.id} className="border-l-2 pl-3" style={{ borderColor: "#2f7d57" }}>
                    <p className="text-neutral-300 break-keep">{e.text}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{p.whereOf(e)}</p>
                  </blockquote>
                ))}
              </div>
            )}
          </div>

          {status && status !== "accepted" && (
            <p className="text-xs text-neutral-500 break-keep">
              <span className="text-neutral-400">AI가 쓴 문장 ·</span> {aiText}
            </p>
          )}

          {weakReqs.map((rid) => {
            const m = p.matchById.get(rid);
            return (
              <div key={rid} className="text-xs break-keep">
                <p style={{ color: WEAK_INK }} className="inline-flex items-center gap-1.5">
                  <CircleDashed size={12} strokeWidth={2} aria-hidden="true" /> 근거 약함 — {p.reqById.get(rid)?.text ?? rid}
                </p>
                {m?.why && <p className="text-neutral-500 mt-0.5 ml-[18px]">AI 판단: {m.why}</p>}
              </div>
            );
          })}

          {newTokens.length > 0 && (
            <p className="text-xs rounded-md bg-amber-500/10 px-3 py-2 text-amber-700 break-keep">
              고친 문장에 원문에 없던 {newTokens.map((t) => `${t.kind === "number" ? "숫자" : "이름"} "${t.detail}"`).join(", ")}이(가) 있어요. 사실이 맞는지 한 번 더 확인하세요.
            </p>
          )}

          <p className="text-[11px] text-neutral-500 break-keep">
            자동 검사는 숫자와 영문 이름만 봅니다. 원문보다 큰 표현(역할·방법·성과)이 없는지 직접 확인하세요.
          </p>

          {p.readOnly ? (
            <p className="text-xs text-neutral-500">저장한 결과예요. 고치려면 편집기에서 여세요.</p>
          ) : editing ? (
            <div className="space-y-2">
              <label htmlFor={`${p.domId}-edit`} className="sr-only">문장 고치기</label>
              <textarea
                id={`${p.domId}-edit`}
                ref={textarea}
                className="field w-full min-h-[84px] text-sm leading-relaxed"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
                }}
              />
              {editTokens.length > 0 && (
                <p className="text-[11px] text-amber-700">
                  원문에 없는 {editTokens.map((t) => `"${t.detail}"`).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary py-1.5 text-sm disabled:opacity-50" disabled={!draft.trim() || p.busy} onClick={saveEdit}>
                  고친 문장으로 쓰기
                </button>
                <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => setEditing(false)}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {!status ? (
                <>
                  <button ref={firstAction} type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={accept}>
                    <Check size={14} strokeWidth={2} aria-hidden="true" /> 그대로 쓰기
                  </button>
                  <button type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={() => { setDraft(s.text); setEditing(true); }}>
                    <PenLine size={14} strokeWidth={2} aria-hidden="true" /> 고치기
                  </button>
                  {cited.length > 0 ? (
                    <button type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={revert}>
                      <Undo2 size={14} strokeWidth={2} aria-hidden="true" /> 원문으로 되돌리기
                    </button>
                  ) : (
                    <button type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={remove}>
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" /> 지우기
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button ref={firstAction} type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={undo}>
                    결정 취소 (AI 문장으로)
                  </button>
                  {status !== "deleted" && (
                    <button type="button" className="btn-secondary py-1.5 text-sm" disabled={p.busy} onClick={() => { setDraft(s.text); setEditing(true); }}>
                      <PenLine size={14} strokeWidth={2} aria-hidden="true" /> 다시 고치기
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 경고에 걸린 숫자·이름을 문장 안에서 표시합니다 */
function highlight(text: string, flags: Flag[]): ReactNode {
  const tokens = flags.filter((f) => f.kind !== "no_evidence" && f.detail).map((f) => f.detail);
  if (tokens.length === 0) return text;
  const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  // 숫자 경고는 "1200" 처럼 쉼표 없이 오므로 원문의 "1,200" 도 잡히게 합니다
  const pattern = esc.map((t) => (/^\d+$/.test(t) ? t.split("").join(",?") : t)).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-amber-500/25 text-inherit px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}
