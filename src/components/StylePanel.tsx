import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { htmlTemplates } from "../lib/htmlTemplates";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { useAuth } from "../auth/AuthProvider";
import { FONT_STACKS, DEFAULT_FONT } from "../lib/portfolioTheme";
import { shrinkImage, formatBytes } from "../lib/images";
import {
  updatePortfolioStyle,
  uploadCoverImage,
  getCoverImageUrl,
  PortfolioError,
  type ColorTheme,
  type LayoutDirection,
  type Density,
  type PortfolioRow,
  type TemplateId,
} from "../lib/portfolios";

/**
 * [2026-09] 템플릿/스타일 설정 페이지(/wizard/style/:id)를 없애고 편집기
 * 오른쪽, 미리보기 바로 위로 옮긴 것입니다.
 *
 * 별도 페이지였을 때는 스타일을 바꾸려면 편집기를 떠나야 했고, 그 페이지
 * 안에 또 자기만의 미리보기가 있었습니다(같은 것이 두 벌). 바꾸는 손과
 * 보이는 결과가 한 화면에 있으면 그럴 필요가 없습니다.
 *
 * 저장 모델은 옛 페이지 그대로 "고치고 → 저장" 입니다. 바꾸는 즉시
 * 미리보기에는 반영되지만(onStyleChange 로 부모에 올림) DB 기록은 저장을
 * 눌러야 일어납니다 — 표지 이미지가 이 흐름에 묶여 있기 때문입니다.
 * 파일을 고르자마자 버킷에 올려버리면 "되돌리기"를 눌러도 파일은 이미
 * 올라간 뒤라 되돌릴 것이 없어집니다.
 */

const fontOptions = Object.keys(FONT_STACKS);

/** 이름만 "AI 스타일 추천"이었을 뿐 고정된 3개를 그대로 적용하는
 *  목업이었습니다. 동작이 프리셋이니 이름도 프리셋으로 맞췄습니다 —
 *  실제 추천 기능이 생기면 그때 따로 만듭니다. */
const presets: Array<{ id: string; name: string; style: StyleDraft }> = [
  { id: "r1", name: "심플 다크", style: { color_theme: "dark", font: "Pretendard", layout: "2col", density: "normal" } },
  { id: "r2", name: "뉴트럴 라이트", style: { color_theme: "light", font: "Noto Sans KR", layout: "1col", density: "roomy" } },
  { id: "r3", name: "테크 모노", style: { color_theme: "dark", font: "Spoqa Han Sans", layout: "2col", density: "tight" } },
];

/** 구글 폰트에서 새로 받아야 하는 서체만. Pretendard·Gowun Batang 은
 *  index.html 에서 앱 전체용으로 이미 로드돼 있습니다. */
const GOOGLE_FONT_HREF: Record<string, string> = {
  "Noto Sans KR": "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap",
  "IBM Plex Sans KR": "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap",
  "Gothic A1": "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700&display=swap",
  "Nanum Gothic": "https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap",
};

interface StyleDraft {
  color_theme: ColorTheme;
  font: string;
  layout: LayoutDirection;
  density: Density;
}

interface FullDraft extends StyleDraft {
  template_id: TemplateId;
}

interface Props {
  portfolioId: string;
  /** 마운트 시점의 저장된 값. 이후 부모의 portfolio 는 이 패널이 올린
   *  값으로 바뀌므로 다시 받지 않습니다(되먹임 방지). */
  initial: Pick<PortfolioRow, "template_id" | "color_theme" | "font" | "layout" | "density">;
  /** DB에 저장돼 있는 표지의 공개 URL. "되돌리기"가 복원할 대상이라
   *  화면에 지금 보이는 표지(아직 안 올린 새 파일일 수 있음)와 반드시
   *  구분해야 합니다 — 한 값으로 합치면 되돌리기가 방금 고른 파일을
   *  "원래 것"으로 착각합니다. */
  savedCoverUrl: string | null;
  onStyleChange: (s: FullDraft) => void;
  /** 미리보기에 보여줄 표지만 바꿉니다(저장과 무관). */
  onCoverPreviewChange: (url: string | null) => void;
  /** 업로드까지 끝난 새 표지의 공개 URL. 저장된 값 자체가 바뀝니다. */
  onCoverSaved: (url: string) => void;
}

export default function StylePanel({
  portfolioId,
  initial,
  savedCoverUrl,
  onStyleChange,
  onCoverPreviewChange,
  onCoverSaved,
}: Props) {
  const { session } = useAuth();
  // [2026-09-22] 기본을 접힘으로 바꿨습니다.
  //
  // 템플릿·색·나열·여백·서체·표지·프리셋까지 컨트롤이 18개인데, 전부
  // 펼쳐진 채 편집 화면 첫 인상을 차지하고 있었습니다. 이 값들은 한 번
  // 정하면 거의 안 건드립니다 — 글을 쓰는 동안 계속 보일 이유가 없습니다.
  // 접힌 줄이 현재 설정을 한 줄로 요약하므로 "지금 뭐가 걸려 있는지"는
  // 그대로 보입니다.
  const [open, setOpen] = useState(false);

  const [draft, setDraft] = useState<FullDraft>({
    template_id: initial.template_id,
    color_theme: initial.color_theme,
    font: fontOptions.includes(initial.font) ? initial.font : DEFAULT_FONT,
    layout: initial.layout,
    density: initial.density,
  });
  const [snapshot, setSnapshot] = useState<FullDraft>(draft);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  // [2026-09] 표지를 올리기 전에 줄입니다. 줄인 결과를 안내에 쓰려고
  // 크기를 들고 있습니다 — 4.2MB 가 180KB 가 됐다는 걸 보여주면,
  // 사용자가 "화질이 깎였나" 대신 "빨라지겠네"로 읽습니다.
  const [shrinkNote, setShrinkNote] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(savedCoverUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<FullDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onStyleChange(next);
  };

  // "n분 전" 이 오래 열어둬도 최신으로 보이게 30초마다 다시 그립니다.
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // 고른 서체만 받습니다 — 7종을 처음부터 다 불러오면 안 쓸 폰트까지
  // 네트워크를 태웁니다.
  useEffect(() => {
    const href = GOOGLE_FONT_HREF[draft.font];
    if (!href) return;
    if (document.querySelector(`link[data-wizard-font="${draft.font}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.wizardFont = draft.font;
    document.head.appendChild(link);
  }, [draft.font]);

  // 저장된 표지 URL 은 편집기가 비동기로 받아오기 때문에 이 패널이
  // 마운트된 뒤에 도착할 수 있습니다. 아직 새 파일을 고르지 않았을
  // 때만 따라갑니다 — 고른 뒤에 덮어쓰면 사용자가 방금 고른 그림이
  // 사라집니다. (coverFile 을 의존성에 넣지 않는 이유도 같습니다:
  // 파일을 고르는 순간 이 effect 가 다시 돌면 안 됩니다.)
  useEffect(() => {
    if (!coverFile) setCoverPreview(savedCoverUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCoverUrl]);

  // object URL 은 브라우저 메모리를 잡고 있으므로 반드시 해제합니다.
  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const dirty =
    coverFile !== null ||
    draft.template_id !== snapshot.template_id ||
    draft.color_theme !== snapshot.color_theme ||
    draft.font !== snapshot.font ||
    draft.layout !== snapshot.layout ||
    draft.density !== snapshot.density;

  const pickCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setPreparing(true);
    setShrinkNote(null);
    // 실패해도 원본을 돌려주므로 여기서 예외를 걱정하지 않습니다.
    const result = await shrinkImage(picked);
    setPreparing(false);

    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    const url = URL.createObjectURL(result.file);
    setCoverFile(result.file);
    setCoverPreview(url);
    onCoverPreviewChange(url);
    setShrinkNote(
      result.changed
        ? `${formatBytes(result.originalBytes)} → ${formatBytes(result.bytes)}로 줄였습니다`
        : null
    );
  };

  const revert = () => {
    setDraft(snapshot);
    onStyleChange(snapshot);
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(savedCoverUrl);
    onCoverPreviewChange(savedCoverUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShrinkNote(null);
    setSaveError(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      let cover_image_path: string | undefined;
      if (coverFile) {
        if (!session?.user?.id) {
          throw new PortfolioError("로그인 정보를 확인할 수 없어 표지를 올릴 수 없습니다.");
        }
        cover_image_path = await uploadCoverImage({
          userId: session.user.id,
          portfolioId,
          file: coverFile,
        });
      }
      await updatePortfolioStyle(portfolioId, {
        ...draft,
        ...(cover_image_path ? { cover_image_path } : {}),
      });
      setSnapshot(draft);
      if (cover_image_path) {
        // 방금 올린 파일의 진짜 공개 URL로 바꿉니다. 화면에 띄워둔
        // blob URL 은 이 탭에서만 유효한 임시 주소라, 저장된 값으로
        // 그대로 두면 다음 "되돌리기"가 복원할 대상이 되지 못합니다.
        const url = await getCoverImageUrl(cover_image_path);
        if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
        setCoverPreview(url);
        onCoverSaved(url);
      }
      setCoverFile(null);
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof PortfolioError ? e.message : "스타일을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 px-3 py-2.5 space-y-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-xs font-medium text-neutral-300">템플릿 · 표지</span>
        <span className="flex items-center gap-1.5 min-w-0">
          {!open && (
            <span className="truncate text-xs text-neutral-600">
              {htmlTemplates.find((t) => t.id === draft.template_id)?.name ?? "템플릿 선택"}
            </span>
          )}
          {dirty && <span className="size-1.5 rounded-full bg-brand shrink-0" aria-label="저장 안 됨" />}
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        // 패널이 남는 폭을 전부 가져가면서 넓어졌기 때문에, 라벨/값을
        // 세로로 쌓는 대신 가로로 흘리고 폭이 모자랄 때만 줄바꿈합니다.
        // 세로로 쌓으면 넓은 화면에서 오른쪽이 비고 미리보기가 그만큼
        // 아래로 밀립니다.
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            {/* [2026-09-23] 템플릿이 HTML 파일이 되면서 색·나열·여백·서체
                설정을 뺐습니다. 그 넷은 React 템플릿이 "알아서 배치해주는"
                장치였는데, 이제 디자인은 템플릿이 통째로 들고 있어서 할
                일이 없습니다. 남겨두면 눌러도 아무 변화가 없는 칸이 됩니다.

                대신 템플릿 자체가 늘어납니다 — 고르는 재미는 그쪽으로
                옮겨갑니다(docs/editor-freedom.md). */}
            <Group label="템플릿">
              <div className="flex flex-wrap gap-1.5">
                {htmlTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ template_id: t.id })}
                    aria-pressed={draft.template_id === t.id}
                    title={t.desc}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      draft.template_id === t.id
                        ? "border-brand/60 bg-brand/[0.08] text-brand"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </Group>

            <Group label="표지">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt=""
                  className="h-8 w-12 rounded object-cover border border-neutral-800 shrink-0"
                />
              ) : (
                <span className="h-8 w-12 rounded border border-dashed border-neutral-800 shrink-0" />
              )}
              <div className="min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void pickCover(e)}
                  disabled={preparing}
                  className="block w-[160px] text-xs text-neutral-500 file:mr-2 file:rounded file:border-0 file:bg-neutral-800 file:px-2 file:py-1 file:text-xs file:text-neutral-300 disabled:opacity-50"
                />
                {preparing && (
                  <p className="text-xs text-neutral-500 mt-1">이미지 준비 중…</p>
                )}
                {!preparing && shrinkNote && (
                  <p className="text-xs text-neutral-500 mt-1">{shrinkNote}</p>
                )}
              </div>
            </Group>

            
          </div>

          {saveError && (
            <p role="alert" className="text-xs text-brand">
              {saveError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 mt-1 pt-2.5 border-t border-neutral-800/70">
            <span className="text-xs text-neutral-600 truncate">
              마지막 저장: {formatRelativeTime(lastSavedAt)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="text-xs text-neutral-500 hover:text-brand disabled:opacity-40"
                disabled={!dirty || saving}
                onClick={revert}
              >
                되돌리기
              </button>
              <button
                type="button"
                className="btn-primary text-xs px-2.5 py-1 disabled:opacity-40 inline-flex items-center gap-1"
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving ? (
                  <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                )}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-600 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
            value === o.value ? "bg-brand/[0.12] text-brand" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
