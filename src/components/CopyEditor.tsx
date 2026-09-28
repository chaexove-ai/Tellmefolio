import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, X } from "lucide-react";
import { getTemplate } from "../lib/templateCache";
import { listEditableTexts, type EditableText } from "../lib/htmlTemplate";
import { FIELD_LABELS } from "../lib/buildTemplateData";
import type { PortfolioCopy } from "../lib/portfolios";

/**
 * [2026-09-28] 템플릿 고정 문구 바꾸기.
 *
 * "함께 일해요", "프로젝트", "사용한 도구 · 기술" 처럼 템플릿에 박혀 있던
 * 글자를 포트폴리오마다 바꿉니다. 바꿀 수 있는 자리는 템플릿이 스스로
 * 알려 줍니다(data-tf-text) — 템플릿을 추가해도 이 화면은 손대지 않습니다.
 *
 * 영어 칸은 "영어로 내보낼 때" 쓰입니다. 비워 두면 템플릿의 영어 기본 문구.
 * 고친 문구는 AI 번역을 거치지 않습니다 — 사용자가 쓴 그대로 나갑니다.
 *
 * 고치는 동안 미리보기가 바로 바뀌고(onPreview), 저장을 눌러야 DB 에 갑니다.
 * 취소하면 열기 전 값으로 되돌립니다.
 */
export default function CopyEditor({
  templateId,
  initial,
  onPreview,
  onSave,
  onClose,
}: {
  templateId: string;
  initial: PortfolioCopy;
  onPreview: (copy: PortfolioCopy) => void;
  onSave: (copy: PortfolioCopy) => Promise<boolean>;
  onClose: () => void;
}) {
  const [texts, setTexts] = useState<EditableText[] | null>(null);
  const [copy, setCopy] = useState<PortfolioCopy>({ ko: { ...(initial.ko ?? {}) }, en: { ...(initial.en ?? {}) } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTemplate(templateId)
      .then((html) => alive && setTexts(listEditableTexts(html)))
      .catch(() => alive && setTexts([]));
    return () => {
      alive = false;
    };
  }, [templateId]);

  const fieldTexts: EditableText[] = useMemo(
    () => FIELD_LABELS.map((f) => ({ key: f.copyKey, label: f.ko, ko: f.ko, en: f.en })),
    []
  );

  const set = (lang: "ko" | "en", key: string, value: string) => {
    const next: PortfolioCopy = { ...copy, [lang]: { ...(copy[lang] ?? {}), [key]: value } };
    setCopy(next);
    onPreview(next);
  };

  const cancel = () => {
    onPreview(initial);
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const ok = await onSave(copy);
    setSaving(false);
    if (ok) onClose();
    else setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  };

  const changed = (["ko", "en"] as const).some((l) => Object.values(copy[l] ?? {}).some((v) => v.trim()));

  const rows = (list: EditableText[]) =>
    list.map((t) => {
      const ko = copy.ko?.[t.key] ?? "";
      const en = copy.en?.[t.key] ?? "";
      return (
        <div key={t.key} className="grid grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-2 py-1.5">
          <span className="text-xs text-neutral-400 break-keep">{t.label}</span>
          <input
            value={ko}
            onChange={(e) => set("ko", t.key, e.target.value)}
            placeholder={t.ko}
            maxLength={200}
            className="field py-1.5 text-sm"
            aria-label={`${t.label} (한국어)`}
          />
          <input
            value={en}
            onChange={(e) => set("en", t.key, e.target.value)}
            placeholder={t.en}
            maxLength={200}
            className="field py-1.5 text-sm"
            aria-label={`${t.label} (영어)`}
          />
          {ko || en ? (
            <button
              type="button"
              onClick={() => {
                const next: PortfolioCopy = {
                  ko: { ...(copy.ko ?? {}), [t.key]: "" },
                  en: { ...(copy.en ?? {}), [t.key]: "" },
                };
                setCopy(next);
                onPreview(next);
              }}
              title="기본 문구로"
              aria-label={`${t.label} 기본 문구로`}
              className="grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <RotateCcw size={13} />
            </button>
          ) : (
            <span />
          )}
        </div>
      );
    });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) cancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="copy-editor-title" className="surface flex max-h-[88vh] w-full max-w-3xl flex-col p-0">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-5">
          <div>
            <h2 id="copy-editor-title" className="entry-title mb-1">
              문구 바꾸기
            </h2>
            <p className="text-xs text-neutral-500 break-keep">
              템플릿에 들어 있는 글자를 내 말로 바꿔요. 비워 두면 기본 문구(흐린 글씨)가 그대로 나가요. 바꾸는 대로
              미리보기에 보여요.
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="닫기"
            className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] gap-2 pb-2 text-[11px] text-neutral-500">
            <span />
            <span>한국어</span>
            <span>영어 — 영어로 내보낼 때</span>
            <span />
          </div>

          {texts === null ? (
            <p className="inline-flex items-center gap-2 py-6 text-sm text-neutral-500">
              <LoaderCircle size={14} className="animate-spin" /> 불러오는 중…
            </p>
          ) : (
            <>
              <h3 className="mt-2 text-xs font-medium text-neutral-300">화면 문구</h3>
              <div className="divide-y divide-neutral-800/60">{rows(texts)}</div>
              <h3 className="mt-5 text-xs font-medium text-neutral-300">케이스 스터디 칸 이름</h3>
              <div className="divide-y divide-neutral-800/60">{rows(fieldTexts)}</div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-800 p-4">
          <p className="text-xs text-neutral-500 break-keep">
            {error ?? "“Tellmefolio로 만들었습니다” 꼬리말은 바꿀 수 없어요."}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-secondary" onClick={cancel} disabled={saving}>
              취소
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? "저장 중…" : changed ? "저장" : "기본 문구로 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
