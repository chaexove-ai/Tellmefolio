import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import GrainCover from "../../components/GrainCover";

const templates = [
  { id: "research", name: "연구노트", desc: "학술적이고 정제된 레이아웃" },
  { id: "live", name: "라이브에디터", desc: "개발자 감성의 다크 코드 스타일" },
  { id: "minimal", name: "클린 미니멀", desc: "여백 중심의 깔끔한 구성" },
  { id: "magazine", name: "매거진형", desc: "이미지 중심의 감각적인 레이아웃" },
];

type ColorTheme = "dark" | "light";
type LayoutDirection = "1col" | "2col";

interface StyleSettings {
  colorTheme: ColorTheme;
  font: string;
  layout: LayoutDirection;
}

const recommendations: Array<{ id: string; name: string; desc: string; style: StyleSettings }> = [
  {
    id: "r1",
    name: "심플 다크",
    desc: "다크 배경, Pretendard Bold, 2단 레이아웃",
    style: { colorTheme: "dark", font: "Pretendard", layout: "2col" },
  },
  {
    id: "r2",
    name: "뉴트럴 라이트",
    desc: "밝은 배경, Noto Sans KR, 1단 중앙 정렬",
    style: { colorTheme: "light", font: "Noto Sans KR", layout: "1col" },
  },
  {
    id: "r3",
    name: "테크 모노",
    desc: "코드 스타일, Spoqa Han Sans, 혼합 레이아웃",
    style: { colorTheme: "dark", font: "Spoqa Han Sans", layout: "2col" },
  },
];

/** [2026-09] 서체 목록 확장. 기본 3종(Pretendard·Noto Sans KR·Spoqa Han Sans)만
 * 있어 선택지가 좁다는 피드백을 받았습니다. 모두 한글을 지원하는 무료 웹폰트로
 * 골랐고, Gowun Batang 은 이 앱의 제목 서체를 본문에도 쓸 수 있게 넣었습니다. */
const fontOptions = [
  "Pretendard",
  "Noto Sans KR",
  "Spoqa Han Sans",
  "IBM Plex Sans KR",
  "Gothic A1",
  "Nanum Gothic",
  "Gowun Batang (세리프)",
];

/** 실제로 화면에 적용할 CSS font-family. Pretendard·Gowun Batang 은 index.html
 * 에서 앱 전체용으로 이미 로드돼 있어 그대로 이름만 씁니다. Spoqa Han Sans 는
 * 아직 별도 웹폰트 로딩을 연결하지 않아 대체 서체로 보입니다(아래
 * GOOGLE_FONT_HREF 에도 없음 — 셀렉트 옵션에 "로딩 준비 중"이라고 표시). */
const FONT_STACKS: Record<string, string> = {
  Pretendard: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif",
  "Noto Sans KR": "'Noto Sans KR', sans-serif",
  "Spoqa Han Sans": "'Spoqa Han Sans Neo', 'Noto Sans KR', sans-serif",
  "IBM Plex Sans KR": "'IBM Plex Sans KR', sans-serif",
  "Gothic A1": "'Gothic A1', sans-serif",
  "Nanum Gothic": "'Nanum Gothic', sans-serif",
  "Gowun Batang (세리프)": "'Gowun Batang', serif",
};

/** 위 서체 중 구글 폰트에서 새로 불러와야 하는 것만. Pretendard·Gowun Batang
 * 은 index.html에서 이미 로드돼 있어 여기 없습니다. */
const GOOGLE_FONT_HREF: Record<string, string> = {
  "Noto Sans KR": "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap",
  "IBM Plex Sans KR": "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap",
  "Gothic A1": "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700&display=swap",
  "Nanum Gothic": "https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap",
};

const STORAGE_KEY = "tellmefolio-wizard-style";
const DEFAULT_STYLE: StyleSettings = { colorTheme: "dark", font: fontOptions[0], layout: "1col" };

function loadStoredStyle(): { settings: StyleSettings; savedAt: number | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { settings: DEFAULT_STYLE, savedAt: null };
    const parsed = JSON.parse(raw) as Partial<StyleSettings & { savedAt: number }>;
    return {
      settings: {
        colorTheme: parsed.colorTheme === "light" ? "light" : "dark",
        font: typeof parsed.font === "string" && fontOptions.includes(parsed.font) ? parsed.font : DEFAULT_STYLE.font,
        layout: parsed.layout === "2col" ? "2col" : "1col",
      },
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : null,
    };
  } catch {
    return { settings: DEFAULT_STYLE, savedAt: null };
  }
}

function formatRelativeTime(ms: number | null): string {
  if (ms === null) return "아직 저장하지 않음";
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.round(diffHour / 24)}일 전`;
}

/**
 * [2026-09] "직접 편집" 패널이 셀렉트만 나열돼 있고 아무것도 하지 않는다는
 * 문제를 고쳤습니다. 서버에 저장할 곳이 없는(포트폴리오별 스타일을 담는
 * 테이블/필드가 아직 없는) 상태라 "저장"을 진짜 백엔드에 연결할 수는
 * 없었지만, 그 안에서 진짜로 되는 일은 진짜로 만들었습니다.
 *
 *   - 색상 테마·서체·레이아웃 방향은 실제 React 상태이고, 아래 "실시간
 *     미리보기"에 그대로 반영됩니다(더 이상 selectedTemplate 하나만 보고
 *     있지 않습니다).
 *   - 서체는 진짜로 로드됩니다 — 구글 폰트 서체는 선택 시점에 <link> 를
 *     주입하고, Pretendard/Gowun Batang 은 index.html에서 이미 전역
 *     로드돼 있어 이름만 그대로 씁니다. Spoqa Han Sans 만 아직 로딩을
 *     연결하지 않아 옵션에 "로딩 준비 중"이라고 정직하게 표시합니다.
 *   - "대표 이미지 교체"는 실제 파일 선택 + object URL 미리보기입니다.
 *     다만 올릴 서버가 없어 새로고침하면 사라진다고 바로 옆에 적어둡니다.
 *   - "스타일 저장"은 브라우저 localStorage 에 저장합니다(포트폴리오별이
 *     아니라 이 마법사 세션 전체에 하나 — 여러 포트폴리오를 구분해서
 *     저장하려면 포트폴리오 id 별 필드가 생긴 다음에 다시 손봐야 합니다).
 *     "되돌리기"는 마지막 저장 시점 값으로 되돌리고, 저장 전에는 두 버튼
 *     다 비활성화됩니다(되돌릴 것도 저장할 것도 없으므로).
 *   - "AI 스타일 추천"의 "이 스타일 적용" 버튼도 이번에 실제로 위 세 값을
 *     채우도록 연결했습니다 — 안 그러면 옆에 진짜로 동작하는 셀렉트를 두고
 *     이 버튼만 죽어 있는 게 더 이상해 보였습니다.
 */
export default function TemplateStyle() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState("research");
  const [moodInput, setMoodInput] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);

  const [stored] = useState(loadStoredStyle);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(stored.settings.colorTheme);
  const [font, setFont] = useState(stored.settings.font);
  const [layout, setLayout] = useState<LayoutDirection>(stored.settings.layout);
  const [savedSnapshot, setSavedSnapshot] = useState<StyleSettings>(stored.settings);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(stored.savedAt);
  const [, forceTick] = useState(0);

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // "n분 전" 표시가 페이지를 오래 열어 둬도 계속 최신으로 보이도록 30초마다
  // 다시 그립니다. 값 자체(lastSavedAt)는 안 바뀌니 forceTick 으로만 리렌더.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // 구글 폰트 서체를 고르면 그때 <link> 를 넣습니다. 처음부터 7종을 다
  // 불러오면 안 쓸 폰트까지 네트워크를 태우게 되니, 고른 것만 받습니다.
  useEffect(() => {
    const href = GOOGLE_FONT_HREF[font];
    if (!href) return;
    if (document.querySelector(`link[data-wizard-font="${font}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.wizardFont = font;
    document.head.appendChild(link);
  }, [font]);

  // object URL은 브라우저 메모리를 잡고 있으므로 새 이미지로 바꾸거나
  // 화면을 떠날 때 반드시 해제합니다.
  useEffect(() => {
    return () => {
      if (coverImageUrl) URL.revokeObjectURL(coverImageUrl);
    };
  }, [coverImageUrl]);

  const isDirty =
    colorTheme !== savedSnapshot.colorTheme || font !== savedSnapshot.font || layout !== savedSnapshot.layout;

  const applyStyle = (style: StyleSettings) => {
    setColorTheme(style.colorTheme);
    setFont(style.font);
    setLayout(style.layout);
  };

  const handleSave = () => {
    const now = Date.now();
    const snapshot: StyleSettings = { colorTheme, font, layout };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: now }));
    } catch {
      // localStorage가 막혀 있어도(프라이빗 모드 등) 화면 상태는 그대로 반영합니다.
    }
    setSavedSnapshot(snapshot);
    setLastSavedAt(now);
  };

  const handleRevert = () => applyStyle(savedSnapshot);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverImageUrl) URL.revokeObjectURL(coverImageUrl);
    setCoverImageUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const previewBg = colorTheme === "dark" ? "#0a0a0a" : "#faf7f1";
  const previewFg = colorTheme === "dark" ? "#fafafa" : "#171310";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/wizard/editor" className="text-xs text-brand hover:underline">
          편집기로 돌아가기
        </Link>
        <button className="btn-primary" onClick={() => navigate("/wizard/export")}>
          내보내기
        </button>
      </div>
      <h1 className="text-xl font-heading">템플릿 / 스타일 설정</h1>

      <div className="entry">
        <h2 className="entry-title">디자인 템플릿</h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`text-left rounded-sm border p-3 text-sm ${
                selectedTemplate === t.id
                  ? "border-brand bg-brand/10"
                  : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <GrainCover seed={`tpl-${t.id}`} className="h-16 rounded-sm mb-2.5" />
              <p className="font-medium text-neutral-100">{t.name}</p>
              <p className="text-xs text-neutral-400 mt-1">{t.desc}</p>
              <p className="text-xs mt-2">
                {selectedTemplate === t.id ? (
                  <span className="text-brand">현재 적용됨</span>
                ) : (
                  <span className="text-neutral-500">선택</span>
                )}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">AI 스타일 추천</h2>
        <div className="flex gap-2 items-end">
          <input
            value={moodInput}
            onChange={(e) => setMoodInput(e.target.value)}
            placeholder="원하는 분위기를 입력하세요 (예: 다크하고 개발자스럽게)"
            className="field flex-1"
          />
          <button
            className="btn-secondary disabled:opacity-40"
            disabled={!moodInput.trim()}
            onClick={() => setShowRecommendations(true)}
          >
            AI 추천 받기
          </button>
        </div>

        {showRecommendations && (
          <div className="mt-4">
            {recommendations.map((r) => (
              <div key={r.id} className="row flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-neutral-100">{r.name}</p>
                  <p className="text-xs text-neutral-400">{r.desc}</p>
                </div>
                <button className="btn-secondary" onClick={() => applyStyle(r.style)}>
                  이 스타일 적용
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">직접 편집</h2>
        <p className="text-xs text-neutral-600">
          아래 설정은 이 브라우저에만 저장되고, 내보내기 결과물에는 아직 반영되지
          않습니다 — 먼저 실시간 미리보기에서 느낌을 잡아 보세요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-neutral-500">색상 테마</label>
            <select
              value={colorTheme}
              onChange={(e) => setColorTheme(e.target.value as ColorTheme)}
              className="field mt-1"
            >
              <option value="light" className="bg-neutral-900">
                라이트
              </option>
              <option value="dark" className="bg-neutral-900">
                다크
              </option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">서체</label>
            <select value={font} onChange={(e) => setFont(e.target.value)} className="field mt-1">
              {fontOptions.map((f) => (
                <option key={f} value={f} className="bg-neutral-900">
                  {f}
                  {f === "Spoqa Han Sans" ? " · 로딩 준비 중" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">레이아웃 방향</label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as LayoutDirection)}
              className="field mt-1"
            >
              <option value="1col" className="bg-neutral-900">
                1단 — 한 줄로 이어보기
              </option>
              <option value="2col" className="bg-neutral-900">
                2단 — 좌우로 나눠보기
              </option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">대표 이미지</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <button
              type="button"
              className="btn-secondary w-full mt-1"
              onClick={() => fileInputRef.current?.click()}
            >
              {coverImageUrl ? "다른 이미지로 교체" : "이미지 교체"}
            </button>
            {coverImageUrl && (
              <p className="text-[11px] text-neutral-600 mt-1">
                미리보기에만 반영돼요 — 새로고침하면 초기화됩니다.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-neutral-600">
            마지막 저장: {formatRelativeTime(lastSavedAt)}
            {isDirty && <span className="text-amber-400 ml-1.5">· 저장되지 않은 변경 사항</span>}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary disabled:opacity-40"
              disabled={!isDirty}
              onClick={handleRevert}
            >
              변경 사항 되돌리기
            </button>
            <button className="btn-primary disabled:opacity-40" disabled={!isDirty} onClick={handleSave}>
              스타일 저장
            </button>
          </div>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">실시간 미리보기</h2>
        <div
          className={`rounded-xl overflow-hidden border ${
            colorTheme === "dark" ? "border-white/10" : "border-black/10"
          } ${layout === "2col" ? "grid grid-cols-1 sm:grid-cols-2" : ""}`}
          style={{ background: previewBg, color: previewFg, fontFamily: FONT_STACKS[font] }}
        >
          <div className="relative h-40">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <GrainCover seed={`preview-${selectedTemplate}`} className="absolute inset-0 h-full w-full" />
            )}
          </div>
          <div className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs opacity-60">현재 템플릿</p>
            <p className="font-medium">{templates.find((t) => t.id === selectedTemplate)?.name}</p>
            <p className="text-xs opacity-60 mt-2">
              {font} · {layout === "2col" ? "2단 레이아웃" : "1단 레이아웃"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
