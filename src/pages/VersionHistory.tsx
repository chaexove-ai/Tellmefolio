import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { versionHistory } from "../mockData";
import GrainCover from "../components/GrainCover";

export default function VersionHistory() {
  const { id } = useParams();
  const [selected, setSelected] = useState(versionHistory[1].id);
  const [showConfirm, setShowConfirm] = useState(false);

  const current = versionHistory.find((v) => v.current)!;
  const selectedEntry = versionHistory.find((v) => v.id === selected)!;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link to="/library/portfolios" className="text-xs text-brand hover:underline">
          포트폴리오 목록으로
        </Link>
        <h1 className="text-xl font-heading mt-2">버전 관리</h1>
        <p className="text-xs text-neutral-500">
          {id ?? "프로젝트 A"} 포트폴리오 · 총 {versionHistory.length}개 버전
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-sm text-neutral-500 mb-2">저장된 버전</h2>
          <ul>
            {versionHistory.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setSelected(v.id)}
                  className={`toc-link w-full text-left ${
                    v.id === selected ? "toc-link-active" : "toc-link-inactive"
                  }`}
                >
                  <p>
                    {v.label} {v.current && <span className="text-xs text-neutral-500">(현재)</span>}
                  </p>
                  <p className="text-xs text-neutral-600">{v.timestamp}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="entry">
            <p className="text-xs text-neutral-500">현재 작업본</p>
            <p className="text-sm font-medium mt-1 text-neutral-100">
              {current.timestamp} · {current.label}
            </p>
            {/* [2026-08] 빈 미리보기 자리 → 절차적 커버.
                seed 가 버전 id 라 두 미리보기가 서로 다른 그림이 됩니다 —
                "다른 버전을 보고 있다"가 시각적으로 구분됩니다. */}
            <GrainCover seed={current.id} className="mt-3 h-32 rounded-xl">
              <span className="grain-cover-label">현재 작업본 미리보기</span>
            </GrainCover>
          </div>

          <div className="entry">
            <p className="text-xs text-neutral-500">선택한 버전</p>
            <p className="text-sm font-medium mt-1 text-neutral-100">
              {selectedEntry.timestamp} · {selectedEntry.label}
            </p>
            <GrainCover seed={selectedEntry.id} className="mt-3 h-32 rounded-xl">
              <span className="grain-cover-label">선택 버전 미리보기</span>
            </GrainCover>
          </div>

          <div className="entry">
            <h3 className="entry-title">복원 전 확인 사항</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              이 버전으로 복원하면 현재 작업본은 새 버전으로 자동 저장됩니다. 복원
              이후에도 현재 작업본으로 다시 되돌릴 수 있습니다. AI 생성 콘텐츠와 직접
              편집 내용을 포함한 모든 변경 사항이 선택한 시점으로 되돌아갑니다.
            </p>
            <button className="btn-primary mt-4" onClick={() => setShowConfirm(true)}>
              이 버전으로 복원
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">버전 복원 확인</h2>
            <p className="text-sm text-neutral-300">
              {selectedEntry.timestamp} 버전으로 복원하시겠습니까?
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              현재 작업본은 새 이력으로 보존되며, 복원 후에도 다시 되돌릴 수 있습니다.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => setShowConfirm(false)}>
                복원하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
