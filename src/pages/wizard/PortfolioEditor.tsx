import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface EvidenceItem {
  id: string;
  label: string;
  source: string;
  status: "확인 완료" | "검토 필요";
}

const evidenceItems: EvidenceItem[] = [
  { id: "e1", label: "핵심 성과 수치", source: "GitHub 리포지토리 — README.md 3행", status: "확인 완료" },
  { id: "e2", label: "담당 역할 서술", source: "업로드 PDF — 경력기술서 2페이지", status: "검토 필요" },
  { id: "e3", label: "프로젝트 기간", source: "텍스트 메모 — 프로젝트 메모 1항", status: "검토 필요" },
];

const mismatchItems = [
  {
    id: "m1",
    label: "경력 기간 불일치 가능성",
    detail: "이력서: 2021.03 – 2023.08 / 포트폴리오: 2021.06 – 2023.08",
  },
  {
    id: "m2",
    label: "성과 수치 표현 차이",
    detail: "이력서: 전환율 12% 개선 / 포트폴리오: 전환율 15% 향상",
  },
];

export default function PortfolioEditor() {
  const navigate = useNavigate();
  const [sentence, setSentence] = useState("");
  const [showRefine, setShowRefine] = useState(false);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/wizard/draft" className="text-xs text-brand hover:underline">
          AI 초안 생성으로 돌아가기
        </Link>
        <button
          className="btn-primary"
          onClick={() => navigate("/wizard/style")}
        >
          템플릿/스타일 설정
        </button>
      </div>
      <h1 className="text-xl font-heading">포트폴리오 편집기</h1>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">프로젝트 개요</h2>
        <input placeholder="프로젝트 제목" className="field" />
        <textarea placeholder="맥락 및 배경" rows={2} className="field-area" />
        <input placeholder="담당 역할" className="field" />
        <textarea placeholder="문제 정의" rows={2} className="field-area" />
        <textarea placeholder="실행 내용" rows={2} className="field-area" />
        <textarea placeholder="핵심 성과 및 수치" rows={2} className="field-area" />
        <textarea placeholder="배운 점 및 회고" rows={2} className="field-area" />
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">AI 문장 다듬기</h2>
        <p className="text-xs text-neutral-400">
          다듬을 문장을 선택하거나 아래에 붙여넣어 목표 직무에 맞는 케이스 스터디
          문장으로 개선할 수 있습니다.
        </p>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="다듬을 문장 입력"
          rows={2}
          className="field-area"
        />
        <button
          className="btn-secondary disabled:opacity-40"
          disabled={!sentence.trim()}
          onClick={() => setShowRefine(true)}
        >
          AI 문장 다듬기 요청
        </button>

        {showRefine && (
          <div className="border-t border-neutral-800 pt-3 mt-3">
            <p className="text-xs text-neutral-500 mb-2">
              아래 개선안을 원문과 비교하고 적용 여부를 직접 결정하세요. AI는 사실이나
              의도를 임의로 변경하지 않습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
              <div className="sm:pr-6 pb-4 sm:pb-0">
                <p className="text-xs text-neutral-500 mb-1">원문</p>
                {sentence}
              </div>
              <div className="sm:pl-6 pt-4 sm:pt-0">
                <p className="text-xs text-neutral-500 mb-1">AI 개선안</p>
                {sentence
                  ? `${sentence} (핵심 성과와 역할을 강조한 케이스 스터디 문장으로 개선된 예시입니다.)`
                  : ""}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary" onClick={() => setShowRefine(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => setShowRefine(false)}>
                개선안 적용
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="entry space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="entry-title mb-0">AI 근거 및 사실 확인</h2>
          <span className="badge bg-amber-500/15 text-amber-400">
            {evidenceItems.filter((e) => e.status === "검토 필요").length}건 검토 필요
          </span>
        </div>
        <p className="text-xs text-neutral-400">
          AI가 제안한 문장별 원본 자료와 근거를 확인하고 사실 여부를 직접 표시하세요.
        </p>
        <ul>
          {evidenceItems.map((e) => (
            <li key={e.id} className="row text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-200">{e.label}</span>
                <span
                  className={`badge ${
                    e.status === "확인 완료"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {e.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">연결 원본: {e.source}</p>
              <div className="flex gap-3 mt-2 text-xs">
                <button className="text-brand hover:underline">원본 보기</button>
                <button className="text-neutral-400 hover:underline">불일치 표시</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="entry space-y-3">
        <h2 className="entry-title mb-0">이력서·포트폴리오 불일치 확인</h2>
        <p className="text-xs text-neutral-400">
          경력 기간, 소속과 역할, 프로젝트명, 성과 수치의 불일치 가능성 항목을
          자동으로 탐지합니다.
        </p>
        <ul>
          {mismatchItems.map((m) => (
            <li key={m.id} className="row text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-200">{m.label}</span>
                <button className="text-xs text-brand hover:underline">확인</button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{m.detail}</p>
            </li>
          ))}
        </ul>
        <button className="text-xs text-brand hover:underline">전체 불일치 항목 보기</button>
      </div>

      <div className="entry flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-200">마지막 자동 저장: 방금 전</p>
          <button className="text-xs text-brand hover:underline mt-1">변경 이력 확인</button>
          <p className="text-xs text-neutral-600 mt-1">
            AI 생성, 직접 수정, 저장 시점이 버전으로 기록됩니다. 원하는 버전으로
            되돌릴 수 있습니다.
          </p>
        </div>
        <button className="btn-secondary">수동 저장</button>
      </div>
    </div>
  );
}
