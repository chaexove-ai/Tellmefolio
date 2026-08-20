import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GrainCover from "../../components/GrainCover";

const templates = [
  { id: "research", name: "연구노트", desc: "학술적이고 정제된 레이아웃" },
  { id: "live", name: "라이브에디터", desc: "개발자 감성의 다크 코드 스타일" },
  { id: "minimal", name: "클린 미니멀", desc: "여백 중심의 깔끔한 구성" },
  { id: "magazine", name: "매거진형", desc: "이미지 중심의 감각적인 레이아웃" },
];

const recommendations = [
  { id: "r1", name: "심플 다크", desc: "다크 배경, Pretendard Bold, 2단열" },
  { id: "r2", name: "뉴트럴 라이트", desc: "밝은 배경, Noto Sans KR, 단열 중앙" },
  { id: "r3", name: "테크 모노", desc: "코드 스타일, Spoqa Han Sans, 혼합 레이아웃" },
];

export default function TemplateStyle() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState("research");
  const [moodInput, setMoodInput] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);

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
              {/* [2026-08] 템플릿마다 다른 썸네일. 이름만 나열돼 있어
                  "무엇이 다른지" 가 전혀 보이지 않았습니다. */}
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
                <button className="btn-secondary">이 스타일 적용</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">직접 편집</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-neutral-500">색상 테마</label>
            <select className="field mt-1">
              <option className="bg-neutral-900">라이트</option>
              <option className="bg-neutral-900">다크</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">서체</label>
            <select className="field mt-1">
              <option className="bg-neutral-900">Pretendard</option>
              <option className="bg-neutral-900">Noto Sans KR</option>
              <option className="bg-neutral-900">Spoqa Han Sans</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">레이아웃 방향</label>
            <select className="field mt-1">
              <option className="bg-neutral-900">단열</option>
              <option className="bg-neutral-900">2단열</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">대표 이미지</label>
            <button className="btn-secondary w-full mt-1">이미지 교체</button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-neutral-600">마지막 저장: 3분 전</p>
          <div className="flex gap-2">
            <button className="btn-secondary">변경 사항 되돌리기</button>
            <button className="btn-primary">스타일 저장</button>
          </div>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">실시간 미리보기</h2>
        {/* [2026-08] 템플릿을 바꾸면 커버도 함께 바뀝니다 —
            선택이 결과에 반영된다는 감각이 생깁니다. */}
        <GrainCover seed={`preview-${selectedTemplate}`} className="h-40 rounded-xl">
          <span className="grain-cover-label">
            현재 템플릿: {templates.find((t) => t.id === selectedTemplate)?.name}
          </span>
        </GrainCover>
      </div>
    </div>
  );
}
