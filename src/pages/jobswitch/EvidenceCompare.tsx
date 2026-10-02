import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  FIELD_NAMES,
  type Evidence,
  type Flag,
  type JobSwitchProject,
  type RewriteField,
} from "../../lib/jobSwitch";
import type { PortfolioProjectRow } from "../../lib/portfolios";
import { splitSentenceLines } from "../../lib/splitSentences";

/**
 * 프로젝트 하나의 원본 → 재구성 비교 + '근거 보기'(인터랙션 1).
 *
 * 브리프 원칙 1 "근거는 문장 바로 위에서": 재구성 문장을 가리키면 그 문장이
 * 인용한 원문 문장이 하이라이트되고 두 문장이 선으로 이어집니다. 근거를 보려고
 * 요구사항 표나 사이드바로 시선을 옮기지 않게 하는 것이 목적입니다.
 *
 * - 호버: 미리보기(하이라이트 + 연결선). 스크롤하지 않습니다 — 호버로 화면이
 *   움직이면 커서 아래 문장이 바뀌어 깜빡입니다.
 * - 클릭·탭·Enter/Space: 고정. 근거가 화면 밖이면 그 위치로 스크롤합니다.
 *   다시 누르거나 Esc, 바깥 클릭으로 풉니다.
 * - Tab 으로 들어오면(키보드 초점) 고정과 같습니다.
 * - 모션 줄이기 설정: 선과 애니메이션 없이 하이라이트 색만 바뀝니다.
 *
 * 근거 위치는 ID(p0:outcome:2)의 문장 번호로 찾고, 그 자리 문장이 근거 원문과
 * 다르면(직무 전환 뒤 원본을 고친 경우) 같은 프로젝트에서 내용이 같은 문장을
 * 찾습니다. 그래도 없으면 문장 아래에 근거 원문을 따로 보여 줍니다.
 */

/** 시간·이징은 브리프 출발값. 프로토타입에서 맞춰 고칩니다 */
const MOTION = {
  highlight: "transition-colors duration-[180ms] ease-out",
  lineDraw: { duration: 240, easing: "ease-out" },
} as const;

type Active = { field: RewriteField; si: number; pinned: boolean } | null;
type Line = { key: string; d: string };

interface Props {
  project: JobSwitchProject;
  pi: number;
  original: PortfolioProjectRow | undefined;
  fields: RewriteField[];
  lead: string;
  evidenceById: Map<string, Evidence>;
  flagsFor: (pi: number, field: RewriteField, si: number) => Flag[];
  reqLabel: (rid: string) => string;
  reqTitle: (rid: string) => string | undefined;
}

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function EvidenceCompare({
  project: p,
  pi,
  original,
  fields,
  lead,
  evidenceById,
  flagsFor,
  reqLabel,
  reqTitle,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const scrollNext = useRef(false);
  const reduced = usePrefersReducedMotion();

  const [active, setActive] = useState<Active>(null);
  const [lit, setLit] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const activeEvidence = useMemo(() => {
    if (!active) return [];
    return p.sentences?.[active.field]?.[active.si]?.evidence ?? [];
  }, [active, p.sentences]);

  /* 원문 → 문장 조각. 칸마다 한 번만 쪼갭니다 */
  const pieces = useMemo(() => {
    const out = {} as Record<RewriteField, ReturnType<typeof splitSentenceLines>>;
    for (const f of fields) out[f] = splitSentenceLines(String(original?.[f] ?? ""));
    return out;
  }, [fields, original]);

  /* 활성 문장이 바뀌면: 근거 문장을 찾고 → 하이라이트 → 선 좌표 계산 */
  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root || !active) {
      setLit([]);
      setLines([]);
      setMissing([]);
      return;
    }
    const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-ev]"));
    const found: HTMLElement[] = [];
    const notFound: string[] = [];
    for (const id of activeEvidence) {
      const ev = evidenceById.get(id);
      if (!ev || ev.projectIndex !== pi) continue;
      const byId = spans.find((s) => s.dataset.ev === id);
      const el =
        byId && byId.textContent?.trim() === ev.text.trim()
          ? byId
          : spans.find((s) => s.textContent?.trim() === ev.text.trim());
      if (el) {
        if (!found.includes(el)) found.push(el);
      } else notFound.push(ev.text);
    }
    setLit(found.map((el) => el.dataset.ev!));
    setMissing(notFound);

    const from = root.querySelector<HTMLElement>(`[data-out="${active.field}:${active.si}"]`);
    const base = root.getBoundingClientRect();
    setSize({ w: base.width, h: base.height });
    if (!from || reduced) {
      setLines([]);
    } else {
      // 선은 두 열 사이 여백(24px)으로만 다닙니다 — 원문 글자 위를 가로지르면 근거를
      // 가리키는 선이 오히려 다른 문장을 가립니다. 근거 문장 자체는 하이라이트가 알려 줍니다.
      const outCol = from.closest<HTMLElement>("[data-col=out]")?.getBoundingClientRect();
      const a = from.getClientRects()[0] ?? from.getBoundingClientRect();
      const sx = (outCol?.left ?? a.left) - base.left - 4;
      const sy = a.top - base.top + a.height / 2;
      setLines(
        found.map((el) => {
          const srcCol = el.closest<HTMLElement>("[data-col=src]")?.getBoundingClientRect();
          // 여러 줄로 감긴 근거 문장은 첫 줄 높이에 잇습니다 — 문장이 시작하는 자리
          const b = el.getClientRects()[0] ?? el.getBoundingClientRect();
          const tx = (srcCol?.right ?? b.right) - base.left + 4;
          const ty = b.top - base.top + b.height / 2;
          const bend = Math.max(6, Math.abs(sx - tx) * 0.5);
          return { key: el.dataset.ev!, d: `M ${sx} ${sy} C ${sx - bend} ${sy}, ${tx + bend} ${ty}, ${tx} ${ty}` };
        }),
      );
    }

    if (scrollNext.current) {
      scrollNext.current = false;
      // 근거가 여럿이면 화면 밖에 있는 첫 근거로 갑니다. 다 보이면 움직이지 않습니다
      const away = found.find((el) => {
        const r = el.getBoundingClientRect();
        return r.top < 72 || r.bottom > window.innerHeight - 24;
      });
      away?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
  }, [active, activeEvidence, evidenceById, pi, reduced]);

  /* 선 그리기 240ms. 새로 그려진 선만 움직입니다 */
  useEffect(() => {
    if (reduced) return;
    for (const l of lines) {
      const el = pathRefs.current.get(l.key);
      el?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: MOTION.lineDraw.duration,
        easing: MOTION.lineDraw.easing,
      });
    }
    // 선 좌표만 바뀌어도(창 크기) 다시 그리면 산만하니 활성 문장이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.field, active?.si, reduced]);

  /* 창 크기가 바뀌면 좌표만 다시 */
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => setActive((a) => (a ? { ...a } : a)));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  /* 바깥을 누르면 고정을 풉니다 */
  useEffect(() => {
    if (!active?.pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element)?.closest?.("[data-out]")) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active?.pinned]);

  const isActive = (field: RewriteField, si: number) => active?.field === field && active.si === si;

  const pin = (field: RewriteField, si: number) => {
    scrollNext.current = true;
    setActive({ field, si, pinned: true });
  };
  const toggle = (field: RewriteField, si: number) => {
    if (active?.pinned && isActive(field, si)) setActive(null);
    else pin(field, si);
  };
  const onKey = (e: KeyboardEvent, field: RewriteField, si: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(field, si);
    } else if (e.key === "Escape") {
      setActive(null);
      (e.currentTarget as HTMLElement).blur();
    }
  };

  return (
    <section ref={sectionRef} className="entry relative">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="entry-title mb-0">{p.name || `프로젝트 ${pi + 1}`}</h2>
        <span className="text-xs text-neutral-500 inline-flex items-center gap-1.5">
          원본 <ArrowRight size={12} strokeWidth={1.5} /> 재구성
          <span className="hidden sm:inline text-neutral-600">· 문장을 가리키면 근거가 보입니다</span>
        </span>
      </div>

      {fields.map((field) => {
        const lineList = pieces[field] ?? [];
        const after = p.sentences?.[field] ?? [];
        if (lineList.length === 0 && after.length === 0) return null;
        const isLead = field === lead;
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

            {/* 원문 — 문장마다 근거 ID 를 붙여 둡니다 */}
            <div data-col="src" className="text-xs leading-relaxed text-neutral-500 break-keep space-y-1">
              {lineList.length === 0 && <p>—</p>}
              {lineList.map((line, li) => (
                <p key={li}>
                  {line.map((s, k) => {
                    const id = `p${pi}:${field}:${s.index}`;
                    const on = lit.includes(id);
                    return (
                      <span key={s.index}>
                        <span
                          data-ev={id}
                          className={`${MOTION.highlight} rounded-sm box-decoration-clone ${
                            on ? "bg-brand/15 text-neutral-100" : ""
                          }`}
                        >
                          {s.text}
                        </span>
                        {k < line.length - 1 && " "}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>

            {/* 재구성 */}
            <div data-col="out" className="space-y-1.5">
              {after.length === 0 && <p className="text-neutral-600">—</p>}
              {after.map((st, si) => {
                const flagged = flagsFor(pi, field, si).length > 0;
                const hasEvidence = st.evidence.length > 0;
                const me = isActive(field, si);
                return (
                  <div key={si}>
                    <p className="text-neutral-100 break-keep">
                      {flagged && (
                        <AlertTriangle
                          size={13}
                          strokeWidth={2}
                          className="inline mr-1 -mt-0.5"
                          style={{ color: "#8a6a3f" }}
                          aria-label="확인 필요"
                        />
                      )}
                      <span
                        data-out={`${field}:${si}`}
                        {...(hasEvidence
                          ? {
                              role: "button",
                              tabIndex: 0,
                              "aria-pressed": me && !!active?.pinned,
                              "aria-label": `${st.text} — 근거 보기`,
                              onMouseEnter: () => !active?.pinned && setActive({ field, si, pinned: false }),
                              onMouseLeave: () => setActive((a) => (a?.pinned ? a : null)),
                              onClick: () => toggle(field, si),
                              onKeyDown: (e: KeyboardEvent) => onKey(e, field, si),
                              onFocus: (e: FocusEvent<HTMLElement>) => {
                                if (e.currentTarget.matches(":focus-visible")) pin(field, si);
                              },
                            }
                          : {})}
                        className={[
                          MOTION.highlight,
                          "rounded-sm box-decoration-clone outline-none",
                          hasEvidence ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-brand/60" : "",
                          me ? "bg-brand/10" : "",
                          flagged ? "underline decoration-amber-500/70 decoration-2 underline-offset-4" : "",
                        ].join(" ")}
                      >
                        {st.text}
                      </span>
                      {st.requirements.map((rid) => (
                        <span
                          key={rid}
                          title={reqTitle(rid)}
                          className="ml-1.5 align-middle badge bg-brand/10 text-brand whitespace-nowrap"
                        >
                          {reqLabel(rid)}
                        </span>
                      ))}
                    </p>
                    {me && missing.length > 0 && (
                      <p className="mt-1 text-[11px] text-neutral-500 break-keep">
                        원본이 바뀌어 근거 위치를 찾지 못했습니다 · 근거: {missing.join(" / ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 연결선 — 원문 근거와 재구성 문장을 잇습니다. 클릭을 막지 않게 pointer-events 끔 */}
      {lines.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {lines.map((l) => (
            <path
              key={l.key}
              ref={(el) => {
                if (el) pathRefs.current.set(l.key, el);
                else pathRefs.current.delete(l.key);
              }}
              d={l.d}
              pathLength={1}
              strokeDasharray={1}
              className="fill-none stroke-brand"
              strokeWidth={1.25}
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
        </svg>
      )}
    </section>
  );
}
