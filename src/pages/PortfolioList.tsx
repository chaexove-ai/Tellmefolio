import { useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { portfolios as initialPortfolios } from "../mockData";
import Reveal from "../components/Reveal";

const jobOptions = ["전체", "프론트엔드", "백엔드", "UX 디자인", "풀스택"];
const yearOptions = ["전체", "2024", "2023"];

export default function PortfolioList() {
  const [job, setJob] = useState("전체");
  const [year, setYear] = useState("전체");
  const [sort, setSort] = useState<"최근 수정순" | "연도순" | "직무순">("최근 수정순");
  const [showColorModal, setShowColorModal] = useState(false);

  let list = initialPortfolios.filter(
    (p) => (job === "전체" || p.job === job) && (year === "전체" || String(p.year) === year)
  );

  if (sort === "연도순") list = [...list].sort((a, b) => b.year - a.year);
  if (sort === "직무순") list = [...list].sort((a, b) => a.job.localeCompare(b.job));
  if (sort === "최근 수정순")
    list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading">내 서재</h1>
        <div className="flex gap-4 items-center">
          <button className="text-xs text-brand hover:underline" onClick={() => setShowColorModal(true)}>
            직무 색상 설정
          </button>
          <Link to="/wizard" className="btn-primary">
            새 포트폴리오 만들기
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-neutral-300">
        <SlidersHorizontal size={15} className="text-neutral-600 shrink-0" />
        <select className="field w-auto py-2" value={year} onChange={(e) => setYear(e.target.value)}>
          {yearOptions.map((y) => (
            <option key={y} className="bg-neutral-900">{y}</option>
          ))}
        </select>
        <select className="field w-auto py-2" value={job} onChange={(e) => setJob(e.target.value)}>
          {jobOptions.map((j) => (
            <option key={j} className="bg-neutral-900">{j}</option>
          ))}
        </select>
        <select
          className="field w-auto py-2"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option className="bg-neutral-900">최근 수정순</option>
          <option className="bg-neutral-900">연도순</option>
          <option className="bg-neutral-900">직무순</option>
        </select>
      </div>

      <div className="space-y-4">
        {list.map((p, i) => (
          <Reveal key={p.id} delay={(i % 4) * 0.06}>
            <div className="entry flex items-start justify-between">
              <div>
                <span
                  className="badge mb-2"
                  style={{ backgroundColor: `${p.jobColor}22`, color: p.jobColor }}
                >
                  {p.job}
                </span>
                <p className="font-medium text-neutral-100">{p.title}</p>
                <p className="text-xs text-neutral-500 mt-1">마지막 수정 {p.updatedAt}</p>
                <Link
                  to={`/library/portfolios/${p.id}/versions`}
                  className="text-xs text-brand hover:underline mt-2 inline-block"
                >
                  버전 관리
                </Link>
              </div>
              <span className="badge bg-neutral-800 text-neutral-300 shrink-0">{p.visibility}</span>
            </div>
          </Reveal>
        ))}
      </div>

      {showColorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-md">
            <h2 className="entry-title mb-1">직무 색상 설정</h2>
            <p className="text-xs text-neutral-400 mb-4">
              직무 구분에 사용할 색상을 지정합니다. 설정한 색상은 목록의 직무 태그에
              반영됩니다.
            </p>
            <div className="space-y-2 text-sm">
              {["프론트엔드", "백엔드", "디자인", "PM", "데이터"].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <span>{j}</span>
                  <input type="color" defaultValue="#3b82f6" className="h-6 w-10 rounded" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowColorModal(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => setShowColorModal(false)}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
