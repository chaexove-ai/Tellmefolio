import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface SourceItem {
  id: string;
  label: string;
  meta: string;
  selected: boolean;
}

export default function SourceInput() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([
    { id: "repo1", label: "portfolio-2024", meta: "github.com/username/portfolio-2024", selected: true },
    { id: "repo2", label: "ai-side-project", meta: "github.com/username/ai-side-project", selected: true },
    { id: "pdf1", label: "이력서_2025.pdf", meta: "1.2MB", selected: true },
    { id: "pdf2", label: "프로젝트_발표자료.pdf", meta: "3.8MB", selected: true },
    { id: "link1", label: "노션 포트폴리오", meta: "notion.so/username/portfolio", selected: true },
  ]);

  const toggle = (id: string) =>
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));

  const addRepo = () => {
    if (!repoUrl.trim()) return;
    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: repoUrl.split("/").pop() || repoUrl, meta: repoUrl, selected: true },
    ]);
    setRepoUrl("");
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "웹 링크", meta: linkUrl, selected: true },
    ]);
    setLinkUrl("");
  };

  const hasSelection = sources.some((s) => s.selected) || note.trim().length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/wizard" className="text-xs text-brand hover:underline">
          이전 단계로
        </Link>
        <h1 className="text-xl font-heading mt-2">원본 자료 입력</h1>
        <p className="text-sm text-neutral-400 mt-1">
          포트폴리오 생성에 사용할 원본 자료를 등록하세요. 여러 형식의 자료를 함께
          추가할 수 있습니다.
        </p>
      </div>

      <div className="entry">
        <h2 className="entry-title">GitHub 리포지토리</h2>
        <div className="flex gap-2 items-end">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="GitHub 리포지토리 URL (예: https://github.com/username/repo)"
            className="field flex-1"
          />
          <button className="btn-secondary" onClick={addRepo}>
            리포지토리 연결
          </button>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">PDF 문서 업로드</h2>
        <div className="border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-400">
          PDF 파일을 끌어다 놓거나 클릭해서 선택하세요
          <p className="text-xs text-neutral-600 mt-1">최대 20MB · PDF 형식 지원</p>
          <button className="btn-secondary mt-3">파일 선택</button>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">웹 링크</h2>
        <div className="flex gap-2 items-end">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="참고할 웹 페이지 URL을 입력하세요"
            className="field flex-1"
          />
          <button className="btn-secondary" onClick={addLink}>
            링크 추가
          </button>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">직접 작성 메모</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="경력 사항, 프로젝트 설명, 성과 등을 자유롭게 작성하세요"
          rows={4}
          className="field-area"
        />
        <p className="text-xs text-neutral-600 mt-1">
          작성한 내용은 AI 초안 생성의 기초 자료로 활용됩니다.
        </p>
      </div>

      <div className="entry">
        <h2 className="entry-title">포트폴리오 반영 범위</h2>
        <p className="text-xs text-neutral-500 mb-3">AI 초안 생성에 반영할 자료를 선택하세요</p>
        <ul className="space-y-2 text-sm">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.selected}
                onChange={() => toggle(s.id)}
                className="accent-brand"
              />
              <span className="text-neutral-200">{s.label}</span>
              <span className="text-xs text-neutral-500">{s.meta}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-600 mt-3">
          선택 해제한 자료는 AI 초안 생성에 포함되지 않으며, 언제든지 다시 선택할 수
          있습니다.
        </p>
      </div>

      <button
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!hasSelection}
        onClick={() => navigate("/wizard/draft")}
      >
        AI 초안 생성 시작
      </button>
    </div>
  );
}
