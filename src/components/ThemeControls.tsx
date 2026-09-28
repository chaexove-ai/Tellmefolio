import { useState } from "react";
import { LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import {
  RADIUS_OPTIONS,
  THEME_FONTS,
  THEME_PRESETS,
  derivePalette,
  isEmptyTheme,
  type PortfolioTheme,
  type ThemeRadius,
} from "../lib/themeRules";
import { suggestTheme, ThemeError } from "../lib/theme";

/**
 * [2026-09-28] 분위기 — 말로 바꾸기(AI) · 예시 누르기 · 직접 고르기.
 *
 * 바꾸는 즉시 onChange 로 미리보기가 바뀌고, 저장은 편집기가 잠시 뒤에
 * 알아서 합니다(자동 저장과 같은 흐름). "템플릿 기본"은 테마를 비워
 * 템플릿 원래 모습으로 돌립니다.
 */
export default function ThemeControls({
  value,
  onChange,
  job,
}: {
  value: PortfolioTheme;
  onChange: (theme: PortfolioTheme) => void;
  job?: string | null;
}) {
  const [prompt, setPrompt] = useState(value.prompt ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const ask = async (text = prompt) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await suggestTheme({ prompt: text.trim(), current: value, job });
      onChange(r.theme);
      setNote(r.note || null);
    } catch (e) {
      setError(e instanceof ThemeError ? e.message : "분위기를 바꾸지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<PortfolioTheme>) => onChange({ ...value, ...patch });
  const swatch = (t: PortfolioTheme) => (t.bg && t.accent ? derivePalette(t.bg, t.accent) : null);

  return (
    <div className="w-full space-y-2.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={300}
          placeholder="원하는 분위기를 말해 보세요 — 예: 따뜻한 베이지에 세리프, 차분하게"
          className="field min-w-0 flex-1 py-1.5 text-sm"
          disabled={busy}
          aria-label="원하는 분위기"
        />
        <button type="submit" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" disabled={busy || !prompt.trim()}>
          {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? "고르는 중…" : "AI로 바꾸기"}
        </button>
      </form>
      {/* 요청 예시 칩 — 누르면 그 문장으로 바로 AI 에 요청합니다(v0 방식).
          아직 안 바꿨으면 크게 바꾸는 말, 바꾼 뒤에는 이어서 다듬는 말. */}
      <div className="flex flex-wrap gap-1.5">
        {(isEmptyTheme(value) ? START_CHIPS : REFINE_CHIPS).map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => {
              setPrompt(chip);
              void ask(chip);
            }}
            className="rounded-full border border-dashed border-neutral-700 px-2.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {(note || error) && (
        <p className={`text-xs break-keep ${error ? "text-red-500" : "text-neutral-500"}`}>{error ?? note}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onChange({});
            setNote(null);
          }}
          aria-pressed={isEmptyTheme(value)}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            isEmptyTheme(value) ? "border-brand/60 bg-brand/[0.08] text-brand" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
          }`}
        >
          <RotateCcw size={11} /> 템플릿 기본
        </button>
        {THEME_PRESETS.map((p) => {
          const pal = swatch(p.theme);
          const on = value.bg === p.theme.bg && value.accent === p.theme.accent;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange({ ...p.theme });
                setNote(null);
              }}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-brand/60 bg-brand/[0.08] text-brand" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              {pal && (
                <span className="flex overflow-hidden rounded-sm border border-black/10" aria-hidden="true">
                  <span className="block size-3" style={{ background: pal.bg }} />
                  <span className="block size-3" style={{ background: pal.accent }} />
                </span>
              )}
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setManual((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs text-neutral-500 underline-offset-4 hover:text-neutral-300 hover:underline"
          aria-expanded={manual}
        >
          {manual ? "직접 고르기 닫기" : "직접 고르기"}
        </button>
      </div>

      {manual && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-neutral-800 p-2.5 text-xs text-neutral-400">
          <label className="inline-flex items-center gap-1.5">
            바탕
            <input
              type="color"
              value={value.bg ?? "#0a0a0a"}
              onChange={(e) => set({ bg: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-neutral-700 bg-transparent"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            강조
            <input
              type="color"
              value={value.accent ?? "#22d3ee"}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-neutral-700 bg-transparent"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            제목 서체
            <select
              value={value.titleFont ?? ""}
              onChange={(e) => set({ titleFont: e.target.value || undefined })}
              className="field w-auto py-1 text-xs"
            >
              <option value="">템플릿 기본</option>
              {THEME_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            본문 서체
            <select
              value={value.bodyFont ?? ""}
              onChange={(e) => set({ bodyFont: e.target.value || undefined })}
              className="field w-auto py-1 text-xs"
            >
              <option value="">템플릿 기본</option>
              {THEME_FONTS.filter((f) => f.kind !== "display").map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <span className="inline-flex items-center gap-1">
            모서리
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => set({ radius: value.radius === r.id ? undefined : (r.id as ThemeRadius) })}
                aria-pressed={value.radius === r.id}
                className={`rounded px-2 py-0.5 ${value.radius === r.id ? "bg-brand/15 text-brand" : "hover:text-neutral-200"}`}
              >
                {r.label}
              </button>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** 처음 — 스타일을 크게 바꾸는 말 */
const START_CHIPS = ["브루탈리즘으로", "신문처럼 흑백", "따뜻한 종이 느낌", "형광 포인트 하나만", "차분한 다크 모드", "파스텔로 부드럽게"];
/** 바꾼 뒤 — 이어서 다듬는 말 */
const REFINE_CHIPS = ["더 차분하게", "더 과감하게", "강조색만 바꿔 줘", "밝은 배경으로", "어두운 배경으로", "제목 서체를 더 개성 있게"];
