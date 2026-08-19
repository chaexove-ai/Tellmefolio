import { useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, ImageOff } from "lucide-react";
import { galleryItems } from "../../mockData";
import Reveal from "../../components/Reveal";

export default function Gallery() {
  const [job, setJob] = useState("전체 직무");
  const [year, setYear] = useState("전체 연도");
  const [structure, setStructure] = useState("전체");

  const jobs = ["전체 직무", ...Array.from(new Set(galleryItems.map((g) => g.job)))];
  const years = ["전체 연도", ...Array.from(new Set(galleryItems.map((g) => String(g.year))))];

  const filtered = galleryItems.filter(
    (g) =>
      (job === "전체 직무" || g.job === job) &&
      (year === "전체 연도" || String(g.year) === year) &&
      (structure === "전체" || g.structure === structure)
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-heading">커뮤니티 갤러리</h1>
        <p className="text-xs text-neutral-500 mt-1">
          다른 사용자의 포트폴리오는 열람만 가능하며, 내용을 복제하거나 자신의
          포트폴리오로 가져올 수 없습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-neutral-300">
        <SlidersHorizontal size={15} className="text-neutral-600 shrink-0" />
        <select className="field w-auto py-2" value={job} onChange={(e) => setJob(e.target.value)}>
          {jobs.map((j) => (
            <option key={j} className="bg-neutral-900">{j}</option>
          ))}
        </select>
        <select className="field w-auto py-2" value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => (
            <option key={y} className="bg-neutral-900">{y}</option>
          ))}
        </select>
        <select className="field w-auto py-2" value={structure} onChange={(e) => setStructure(e.target.value)}>
          <option className="bg-neutral-900">전체</option>
          <option className="bg-neutral-900">결과 중심형</option>
          <option className="bg-neutral-900">문제-실행-결과형</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((g, i) => (
          <Reveal key={g.id} delay={(i % 3) * 0.08}>
            <Link to={`/gallery/${g.id}`} className="entry p-4 block hover:border-brand/40 hover:-translate-y-0.5 transition-all">
              <div className="aspect-[4/3] rounded-xl bg-neutral-800/60 mb-3 flex items-center justify-center text-neutral-600">
                <ImageOff size={22} strokeWidth={1.5} />
              </div>
              <p className="font-medium text-neutral-100">{g.title}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {g.job} · {g.structure}
              </p>
              <p className="text-xs text-neutral-600 mt-1">
                작성 {g.author} · {g.year}
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
