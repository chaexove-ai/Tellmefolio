import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { listPublicPortfolios } from "../../lib/portfolios";
import type { LibraryPortfolio } from "../../lib/portfolios";
import Reveal from "../../components/Reveal";
import GrainCover from "../../components/GrainCover";

/**
 * [2026-09-22] 실제 공개 포트폴리오를 읽습니다.
 *
 * 전에는 mockData.galleryItems("김지수", "박민준" …)를 그렸습니다. 없는
 * 사람의 없는 포트폴리오였고, 눌러도 아무것도 없었습니다.
 *
 * 목록에 뜨는 조건은 두 가지를 모두 만족할 때입니다 — visibility='public'
 * 이고 listed=true. 링크만 공유한 사람은 여기 나오지 않습니다(공개와
 * 커뮤니티 게시를 나눈 이유는 20260922090000 마이그레이션 주석 참고).
 *
 * [빠진 필터]
 * '구성 방식(결과 중심형/문제-실행-결과형)' 필터를 뺐습니다. 그런 컬럼이
 * 없어서 mock 에서만 존재하던 값입니다. 고를 수는 있는데 아무것도
 * 걸러지지 않는 칸을 두느니 없는 편이 낫습니다.
 *
 * [작성자 이름]
 * 표시하지 않습니다. portfolios 에 작성자 이름 컬럼이 없고, 남의
 * auth.users 는 RLS 가 막습니다. 무엇보다 본인이 이름을 넣겠다고 한 적이
 * 없는데 커뮤니티에 실명을 띄울 이유가 없습니다.
 */
export default function Gallery() {
  const [items, setItems] = useState<LibraryPortfolio[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [job, setJob] = useState("전체 직무");
  const [year, setYear] = useState("전체 연도");

  useEffect(() => {
    let alive = true;
    listPublicPortfolios()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const jobs = useMemo(
    () => ["전체 직무", ...Array.from(new Set((items ?? []).map((g) => g.job)))],
    [items]
  );
  const years = useMemo(
    () => ["전체 연도", ...Array.from(new Set((items ?? []).map((g) => g.year)))],
    [items]
  );

  const filtered = (items ?? []).filter(
    (g) =>
      (job === "전체 직무" || g.job === job) &&
      (year === "전체 연도" || g.year === year)
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-heading">커뮤니티</h1>
        <p className="text-xs text-neutral-500 mt-1">
          작성자가 직접 커뮤니티에 올린 포트폴리오입니다. 열람만 가능하며, 내용을
          복제하거나 자신의 포트폴리오로 가져올 수 없습니다.
        </p>
      </div>

      {items !== null && items.length > 0 && (
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
        </div>
      )}

      {items === null && !loadError && (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      )}

      {loadError && (
        <p className="text-sm text-red-400">목록을 불러오지 못했습니다.</p>
      )}

      {items !== null && items.length === 0 && (
        <div className="entry p-8 text-center">
          <p className="text-sm text-neutral-300">아직 올라온 포트폴리오가 없습니다.</p>
          <p className="text-xs text-neutral-500 mt-2">
            내보내기 화면에서 공개한 뒤 "커뮤니티 목록에도 올리기"를 체크하면
            여기에 나타납니다.
          </p>
          <Link to="/library" className="btn-secondary inline-flex mt-5">
            내 서재로
          </Link>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((g, i) => (
            <Reveal key={g.id} delay={(i % 3) * 0.08}>
              {/* 공개 열람 페이지로 바로 보냅니다 — 방문자가 보는 화면과
                  같은 것을 보여주는 편이 정직하고, 화면도 하나면 됩니다. */}
              <Link
                to={`/p/${g.id}`}
                className="entry p-4 block hover:border-brand/40 hover:-translate-y-0.5 transition-all"
              >
                {/* seed 가 id 라 같은 포트폴리오는 항상 같은 그림입니다. */}
                <GrainCover seed={g.id} className="aspect-[4/3] rounded-xl mb-3" />
                <p className="font-medium text-neutral-100">{g.title}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {g.job} · {g.year}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {items !== null && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-neutral-500">조건에 맞는 포트폴리오가 없습니다.</p>
      )}
    </div>
  );
}
