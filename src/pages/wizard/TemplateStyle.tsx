import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, LoaderCircle } from "lucide-react";
import GrainCover from "../../components/GrainCover";
import { templates } from "../../lib/templates";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import {
  getPortfolio,
  updatePortfolioStyle,
  PortfolioError,
  type ColorTheme,
  type LayoutDirection,
  type TemplateId,
} from "../../lib/portfolios";

interface StyleSettings {
  colorTheme: ColorTheme;
  font: string;
  layout: LayoutDirection;
}

/** 저장 대상 전체(템플릿 포함). AI 추천은 템플릿까지는 안 건드리므로
 *  applyStyle 쪽은 여전히 StyleSettings(3개)만 씁니다. */
interface FullStyle extends StyleSettings {
  templateId: TemplateId;
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

const DEFAULT_FONT = fontOptions[0];

/**
 * [2026-09] localStorage 대신 실제 portfolios 테이블에 저장합니다.
 *
 * 전에는 "스타일 저장"이 브라우저 localStorage 에 하나만 저장돼서 포트폴리오가
 * 여러 개면 서로 설정을 덮어썼습니다(이 마법사 세션 전체에 값이 하나뿐이라고
 * 코드 주석에도 적어뒀던 그 문제). 이제 :id 로 들어온 포트폴리오의
 * template_id/color_theme/font/layout 컬럼을 직접 읽고 씁니다.
 *
 * 디자인 템플릿 카드도 이번에 저장 대상에 포함했습니다 — 전에는 선택만 되고
 * 어디에도 저장되지 않는 화면 전용 상태였는데, 스키마에 template_id 컬럼이
 * 이미 있어서 색상 테마·서체·레이아웃과 같은 저장/되돌리기 흐름에 자연스럽게
 * 넣었습니다.
 *
 * 대표 이미지는 여전히 로컬 미리보기만 됩니다 — 마이그레이션 주석에도 있듯
 * Storage 버킷 연결은 다음 단계라 cover_image_path 컬럼은 아직 안 씁니다.
 */
export default function TemplateStyle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("research");
  const [moodInput, setMoodInput] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);

  const [colorTheme, setColorTheme] = useState<ColorTheme>("dark");
  const [font, setFont] = useState(DEFAULT_FONT);
  const [layout, setLayout] = useState<LayoutDirection>("1col");
  const [savedSnapshot, setSavedSnapshot] = useState<FullStyle | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) {
      setLoadError("포트폴리오 id가 없습니다.");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getPortfolio(id)
      .then((p) => {
        if (!alive) return;
        const snapshot: FullStyle = {
          templateId: p.template_id,
          colorTheme: p.color_theme,
          font: fontOptions.includes(p.font) ? p.font : DEFAULT_FONT,
          layout: p.layout,
        };
        setSelectedTemplate(snapshot.templateId);
        setColorTheme(snapshot.colorTheme);
        setFont(snapshot.font);
        setLayout(snapshot.layout);
        setSavedSnapshot(snapshot);
        setLastSavedAt(new Date(p.updated_at).getTime());
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  // "n분 전" 표시가 페이지를 오래 열어 둬도 계속 최신으로 보이도록 30초마다
  // 다시 그립니다. 값 자체(lastSavedAt)는 안 바뀌니 forceTick 으로만 리렌더.
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
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
    !savedSnapshot ||
    selectedTemplate !== savedSnapshot.templateId ||
    colorTheme !== savedSnapshot.colorTheme ||
    font !== savedSnapshot.font ||
    layout !== savedSnapshot.layout;

  const applyStyle = (style: StyleSettings) => {
    setColorTheme(style.colorTheme);
    setFont(style.font);
    setLayout(style.layout);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updatePortfolioStyle(id, {
        template_id: selectedTemplate,
        color_theme: colorTheme,
        font,
        layout,
      });
      const snapshot: FullStyle = { templateId: selectedTemplate, colorTheme, font, layout };
      setSavedSnapshot(snapshot);
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (!savedSnapshot) return;
    setSelectedTemplate(savedSnapshot.templateId);
    setColorTheme(savedSnapshot.colorTheme);
    setFont(savedSnapshot.font);
    setLayout(savedSnapshot.layout);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverImageUrl) URL.revokeObjectURL(coverImageUrl);
    setCoverImageUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const previewBg = colorTheme === "dark" ? "#0a0a0a" : "#faf7f1";
  const previewFg = colorTheme === "dark" ? "#fafafa" : "#171310";

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          불러오는 중입니다.
        </p>
      </div>
    );
  }

  if (loadError || !id) {
    return (
      <div className="max-w-3xl space-y-2">
        <p role="alert" className="text-sm text-brand">
          {loadError ?? "포트폴리오를 찾을 수 없습니다."}
        </p>
        <Link to="/wizard/source" className="text-xs text-brand hover:underline">
          원본 자료 입력부터 다시 시작하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/wizard/editor/${id}`} className="text-xs text-brand hover:underline">
          편집기로 돌아가기
        </Link>
        <button className="btn-primary" onClick={() => navigate(`/wizard/export/${id}`)}>
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
          아래 설정은 "스타일 저장"을 눌러야 이 포트폴리오에 반영됩니다 — 먼저
          실시간 미리보기에서 느낌을 잡아 보세요.
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
              className="btn-secondary disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
              disabled={!isDirty || saving}
              onClick={handleRevert}
            >
              변경 사항 되돌리기
            </button>
            {/* [2026-09] 저장 완료 상태에서 btn-primary(진한 브랜드색)가
                disabled:opacity-40 만으로는 여전히 "눌러도 되는" 색으로
                보인다는 피드백을 받았습니다 — 저장 완료 시 라벨과 아이콘
                자체를 바꿔서("저장됨" + 체크) 눌러도 되는 상태인지 색만으로
                판단하지 않아도 되게 했습니다. */}
            <button
              className="btn-primary disabled:bg-neutral-700 disabled:text-neutral-400 disabled:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              disabled={!isDirty || saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                "저장하는 중"
              ) : isDirty ? (
                "스타일 저장"
              ) : (
                <>
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  저장됨
                </>
              )}
            </button>
          </div>
        </div>
        {saveError && (
          <p role="alert" className="text-xs text-brand">
            {saveError}
          </p>
        )}
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
