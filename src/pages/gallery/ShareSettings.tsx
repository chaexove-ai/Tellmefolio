import { useState } from "react";
import { Link } from "react-router-dom";

export default function ShareSettings() {
  const [isPublic, setIsPublic] = useState(true);
  const [slug, setSlug] = useState("my-portfolio-slug");

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-heading">공유 페이지 설정</h1>

      <div className="entry">
        <h2 className="entry-title">공개 범위</h2>
        <label className="flex items-center justify-between text-sm">
          <span>
            공개 상태
            <p className="text-xs text-neutral-500 mt-1">
              공개로 설정하면 커뮤니티와 고유 URL에서 누구나 이 포트폴리오를
              열람할 수 있습니다.
            </p>
          </span>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={() => setIsPublic((v) => !v)}
            className="accent-brand h-5 w-5 shrink-0 ml-4"
          />
        </label>
      </div>

      <div className="entry">
        <h2 className="entry-title">고유 슬러그 URL</h2>
        <div className="flex items-center text-sm">
          <span className="text-neutral-500">tellmefolio.com/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
            className="field ml-1"
          />
        </div>
        <p className="text-xs text-neutral-600 mt-1">
          영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다. 중복된 슬러그는 사용할 수
          없습니다.
        </p>
      </div>

      {isPublic && (
        <p className="note border-brand text-sm">
          <span className="block text-neutral-400">
            현재 공개 주소: <span className="text-brand">tellmefolio.com/{slug}</span>
          </span>
          <span className="block text-xs text-neutral-500 mt-1">
            공개 상태에서는 커뮤니티 목록에도 자동으로 노출됩니다.
          </span>
        </p>
      )}

      <div className="flex items-center justify-between">
        <Link to="/community/stats" className="text-xs text-brand hover:underline">
          방문 통계 확인
        </Link>
        <button className="btn-primary">저장</button>
      </div>
    </div>
  );
}
