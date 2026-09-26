import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, LoaderCircle } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  listMyPortfolios,
  updateJobColor,
  updatePortfolioJob,
  updatePortfolioListed,
  updatePortfolioVisibility,
  PortfolioError,
  type LibraryPortfolio,
} from "../lib/portfolios";
import Reveal from "../components/Reveal";
import GrainCover from "../components/GrainCover";
import LibraryTabs from "../components/LibraryTabs";
import { NewPortfolioButton } from "../components/NewPortfolio";
import { getMyProfile, FALLBACK_NICKNAME } from "../lib/profile";
import { countSubmissionsByPortfolio } from "../lib/submissions";

/**
 * [2026-09] mockData.portfolios(고정 4건, 직무·연도가 미리 정해져 있던
 * 목록) 대신 실제 portfolios 테이블을 읽습니다. 직무·연도 필터 옵션도
 * 더 이상 하드코딩하지 않고 실제 데이터에서 뽑습니다 — AI 초안 생성
 * 화면에서 직무를 자유롭게 입력할 수 있어서, 고정 목록으로는 실제 값과
 * 금방 어긋납니다.
 *
 * [2026-09 추가] "직무 색상 설정" 모달도 실제로 저장되게 고쳤습니다. 전에는
 * 프론트엔드/백엔드/디자인/PM/데이터라는 고정 5개 목록에(실제 앱에서 쓰는
 * 직무 이름과도 안 맞았음) uncontrolled <input type="color">만 있어서,
 * 색을 바꾸고 "저장"을 눌러도 모달만 닫히고 아무것도 남지 않았습니다.
 * 이제 목록 자체를 지금 가진 포트폴리오들의 실제 job 값에서 뽑아서
 * 만듭니다 — "직접 입력"으로 넣은 직무도 포트폴리오가 하나라도 있으면
 * 자동으로 항목에 나타납니다. 저장은 같은 job 값을 가진 포트폴리오들의
 * job_color 컬럼을 한 번에 그 색으로 바꾸는 식입니다(lib/portfolios.ts
 * updateJobColor).
 */
export default function PortfolioList() {
  const { session, configured } = useAuth();
  const [portfolios, setPortfolios] = useState<LibraryPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [job, setJob] = useState("전체");
  const [year, setYear] = useState("전체");
  const [sort, setSort] = useState<"최근 수정순" | "연도순" | "직무순">("최근 수정순");
  const [showColorModal, setShowColorModal] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [savingColors, setSavingColors] = useState(false);
  const [colorSaveError, setColorSaveError] = useState<string | null>(null);

  // [2026-09] 직무 배지를 클릭하면 바로 이름을 고칠 수 있게 하는 상태.
  // editingJobId 가 그 카드의 id 와 같을 때만 배지가 입력창으로 바뀝니다.
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [jobEditError, setJobEditError] = useState<string | null>(null);

  // [2026-09-25] 카드에서 바로 커뮤니티에 올리고 내리기.
  // 비공개인 것을 올리면 공개 링크도 같이 열리므로 그때만 확인창을 띄웁니다.
  const [listingId, setListingId] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<LibraryPortfolio | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  /** 포트폴리오 id → 제출 기록 수 (카드의 "제출 기록 N") */
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!configured) return;
    countSubmissionsByPortfolio().then(setSubmissionCounts).catch(() => setSubmissionCounts({}));
  }, [configured]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!configured || !uid) return;
    getMyProfile(uid)
      .then((p) => setNickname(p.nickname.trim()))
      .catch(() => setNickname(""));
  }, [configured, session?.user?.id]);

  const setListed = async (p: LibraryPortfolio, listed: boolean, alsoPublic = false) => {
    setListingId(p.id);
    setListError(null);
    try {
      if (alsoPublic) await updatePortfolioVisibility(p.id, "public");
      await updatePortfolioListed(p.id, listed);
      setPortfolios((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, listed, visibility: alsoPublic ? "공개" : row.visibility } : row
        )
      );
      setConfirmFor(null);
    } catch (e) {
      setListError(e instanceof PortfolioError ? e.message : "커뮤니티 설정을 바꾸지 못했습니다.");
    } finally {
      setListingId(null);
    }
  };

  const toggleListed = (p: LibraryPortfolio) => {
    if (p.listed) return void setListed(p, false); // 내리기는 확인 없이. 공개 링크는 그대로 둡니다
    if (p.visibility === "공개") return void setListed(p, true);
    setListError(null);
    setConfirmFor(p);
  };

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError(null);
    listMyPortfolios(userId)
      .then((list) => {
        if (alive) setPortfolios(list);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [configured, session?.user?.id]);

  const jobOptions = useMemo(
    () => ["전체", ...Array.from(new Set(portfolios.map((p) => p.job))).sort()],
    [portfolios]
  );
  const yearOptions = useMemo(
    () => ["전체", ...Array.from(new Set(portfolios.map((p) => p.year))).sort().reverse()],
    [portfolios]
  );

  // job → 지금 그 직무를 가진 포트폴리오들 중 가장 최근에 수정된 것의
  // job_color. portfolios 가 이미 최근 수정순으로 정렬돼 있어서, 처음
  // 만나는 값을 대표색으로 씁니다. "직무 미지정"은 실제 job 컬럼 값이
  // 아니라 화면용 대체 문구(toLibraryPortfolio)라 색을 매길 대상이
  // 아니므로 뺍니다.
  const realJobColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of portfolios) {
      if (p.job === "직무 미지정") continue;
      if (!map.has(p.job)) map.set(p.job, p.jobColor);
    }
    return map;
  }, [portfolios]);

  const openColorModal = () => {
    setColors(Object.fromEntries(realJobColors));
    setColorSaveError(null);
    setShowColorModal(true);
  };

  /** 색이 실제로 바뀐 직무만 골라 한 번에 저장합니다. 안 바뀐 직무까지
   *  매번 업데이트를 날릴 이유가 없습니다. */
  const saveColors = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const changed = Object.entries(colors).filter(([job, color]) => realJobColors.get(job) !== color);
    if (changed.length === 0) {
      setShowColorModal(false);
      return;
    }
    setSavingColors(true);
    setColorSaveError(null);
    try {
      await Promise.all(changed.map(([job, color]) => updateJobColor(userId, job, color)));
      const changedMap = new Map(changed);
      setPortfolios((prev) =>
        prev.map((p) => (changedMap.has(p.job) ? { ...p, jobColor: changedMap.get(p.job)! } : p))
      );
      setShowColorModal(false);
    } catch (e) {
      setColorSaveError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
    } finally {
      setSavingColors(false);
    }
  };

  /** 배지 입력창에서 벗어나거나 Enter를 누르면 호출됩니다. 값이 원래
   *  값과 같으면(그냥 클릭했다 취소한 경우 포함) 서버에 요청하지 않고
   *  바로 편집 모드만 닫습니다. */
  const handleSaveJob = async (p: LibraryPortfolio, rawValue: string) => {
    setEditingJobId(null);
    const nextValue = rawValue.trim() || "직무 미지정";
    if (nextValue === p.job) return;
    setSavingJobId(p.id);
    setJobEditError(null);
    try {
      await updatePortfolioJob(p.id, rawValue);
      setPortfolios((prev) => prev.map((row) => (row.id === p.id ? { ...row, job: nextValue } : row)));
    } catch (e) {
      setJobEditError(e instanceof PortfolioError ? e.message : "직무를 수정하지 못했습니다.");
    } finally {
      setSavingJobId(null);
    }
  };

  let list = portfolios.filter(
    (p) => (job === "전체" || p.job === job) && (year === "전체" || p.year === year)
  );

  if (sort === "연도순") list = [...list].sort((a, b) => b.year.localeCompare(a.year));
  if (sort === "직무순") list = [...list].sort((a, b) => a.job.localeCompare(b.job));
  if (sort === "최근 수정순")
    list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  // [2026-09-25] 데스크탑 전용이 된 뒤에도 max-w-3xl 한 줄 목록이라 화면
  // 오른쪽 절반이 비어 있었습니다. 표지가 있는 카드 격자로 바꿔 남는 폭을
  // 씁니다. 홈의 책장이 "훑어보기"라면 이 화면은 "찾고 정리하기"입니다 —
  // 필터·정렬·직무 이름/색 일괄 수정이 여기에만 있습니다.
  return (
    <div className="space-y-6">
      <LibraryTabs
        portfolioCount={portfolios.length}
        actions={
          <button className="text-xs text-brand hover:underline" onClick={openColorModal}>
            직무 색상 설정
          </button>
        }
      />

      {!configured ? (
        <p className="text-sm text-neutral-500">
          Supabase 설정이 없어 서재를 불러올 수 없습니다.
        </p>
      ) : loading ? (
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          불러오는 중입니다.
        </p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-brand">
          {loadError}
        </p>
      ) : portfolios.length === 0 ? (
        <div className="entry">
          <p className="text-sm text-neutral-400">
            아직 만든 포트폴리오가 없습니다.{" "}
            <NewPortfolioButton className="text-brand hover:underline">
              지금 첫 포트폴리오를 만들어보세요
            </NewPortfolioButton>
            .
          </p>
        </div>
      ) : (
        <>
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

          {listError && !confirmFor && (
            <p role="alert" className="text-xs text-brand">
              {listError}
            </p>
          )}

          {jobEditError && (
            <p role="alert" className="text-xs text-brand">
              {jobEditError}
            </p>
          )}

          {list.length === 0 ? (
            <p className="text-sm text-neutral-500">조건에 맞는 포트폴리오가 없습니다.</p>
          ) : (
            <div className="grid gap-5 grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {list.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 0.06} className="h-full">
                  <article className="entry p-0 overflow-hidden h-full flex flex-col transition-colors hover:border-neutral-700">
                    <Link to={`/wizard/editor/${p.id}`} className="relative block" aria-label={`${p.title} 편집하기`}>
                      <GrainCover seed={p.id} tint={p.jobColor} className="aspect-[16/9] w-full" />
                      <span
                        className={`badge absolute top-3 right-3 shadow-sm ${
                          p.visibility === "공개" ? "bg-white/85 text-emerald-700" : "bg-white/85 text-neutral-600"
                        }`}
                      >
                        {p.visibility}
                      </span>
                    </Link>

                    <div className="p-5 flex-1 flex flex-col">
                      {editingJobId === p.id ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={p.job === "직무 미지정" ? "" : p.job}
                          placeholder="직무 입력"
                          onBlur={(e) => void handleSaveJob(p, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingJobId(null);
                          }}
                          className="badge self-start bg-transparent border outline-none w-40 max-w-full"
                          style={{ borderColor: p.jobColor, color: p.jobColor }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingJobId(p.id)}
                          disabled={savingJobId === p.id}
                          title="눌러서 직무 수정"
                          className="badge self-start hover:opacity-75 transition-opacity disabled:opacity-50"
                          style={{ backgroundColor: `${p.jobColor}22`, color: p.jobColor }}
                        >
                          {savingJobId === p.id ? "저장 중…" : p.job}
                        </button>
                      )}

                      <Link
                        to={`/wizard/editor/${p.id}`}
                        className="mt-2.5 font-medium text-neutral-100 leading-snug line-clamp-2 break-keep hover:text-brand"
                      >
                        {p.title}
                      </Link>
                      <p className="text-xs text-neutral-500 mt-1.5">
                        {p.year} · 마지막 수정 {p.updatedAt.slice(0, 10)}
                      </p>

                      <div className="mt-auto pt-4 flex items-center gap-4 text-xs">
                        <Link to={`/wizard/editor/${p.id}`} className="text-brand hover:underline">
                          편집하기
                        </Link>
                        <Link to={`/wizard/export/${p.id}`} className="text-neutral-400 hover:underline">
                          내보내기
                        </Link>
                        <Link to={`/library/portfolios/${p.id}/versions`} className="text-neutral-400 hover:underline">
                          제출 기록{submissionCounts[p.id] ? ` ${submissionCounts[p.id]}` : ""}
                        </Link>

                        <label className="ml-auto inline-flex items-center gap-2 cursor-pointer select-none text-neutral-500">
                          커뮤니티
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.listed}
                            aria-label={`${p.title} 커뮤니티에 ${p.listed ? "내리기" : "올리기"}`}
                            disabled={listingId === p.id}
                            onClick={() => toggleListed(p)}
                            className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                              p.listed ? "bg-brand-solid" : "bg-neutral-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                p.listed ? "translate-x-4" : ""
                              }`}
                            />
                          </button>
                        </label>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}

      {confirmFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="list-confirm-title">
            <h2 id="list-confirm-title" className="entry-title mb-1">
              커뮤니티에 올릴까요?
            </h2>
            <p className="text-sm text-neutral-400 mb-4 break-keep">“{confirmFor.title}”</p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-brand">•</span>
                <span className="text-neutral-300 break-keep">
                  지금 <b className="text-neutral-100">비공개</b>라서 공개 링크도 함께 열립니다.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand">•</span>
                <span className="text-neutral-300 break-keep">재직 중이라면 회사 사람도 볼 수 있습니다.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand">•</span>
                <span className="text-neutral-300 break-keep">
                  커뮤니티에는 <b className="text-neutral-100">{nickname || FALLBACK_NICKNAME}</b>{euro(nickname || FALLBACK_NICKNAME)} 표시됩니다.{" "}
                  <Link to="/settings" className="text-brand hover:underline">
                    이름 바꾸기
                  </Link>
                </span>
              </li>
            </ul>
            {listError && (
              <p role="alert" className="text-xs text-brand mt-3">
                {listError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirmFor(null)} disabled={listingId !== null}>
                취소
              </button>
              <button
                className="btn-primary disabled:opacity-40"
                onClick={() => void setListed(confirmFor, true, true)}
                disabled={listingId !== null}
              >
                {listingId ? "올리는 중" : "공개하고 올리기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showColorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-md">
            <h2 className="entry-title mb-1">직무 색상 설정</h2>
            <p className="text-xs text-neutral-400 mb-4">
              지금 가진 포트폴리오들의 직무별로 색을 지정합니다. 같은 직무를 가진
              포트폴리오는 목록에서 모두 이 색으로 바뀝니다.
            </p>

            {Object.keys(colors).length === 0 ? (
              <p className="text-sm text-neutral-500">
                아직 색을 정할 직무가 없습니다. 포트폴리오를 만들면 여기 자동으로
                나타납니다.
              </p>
            ) : (
              <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {Object.entries(colors).map(([j, color]) => (
                  <div key={j} className="flex items-center justify-between gap-3">
                    <span className="text-neutral-200 truncate">{j}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColors((prev) => ({ ...prev, [j]: e.target.value }))}
                      className="h-6 w-10 rounded shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}

            {colorSaveError && (
              <p role="alert" className="text-xs text-brand mt-3">
                {colorSaveError}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn-secondary"
                onClick={() => setShowColorModal(false)}
                disabled={savingColors}
              >
                취소
              </button>
              <button
                className="btn-primary disabled:opacity-40"
                onClick={() => void saveColors()}
                disabled={savingColors || Object.keys(colors).length === 0}
              >
                {savingColors ? "저장하는 중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 받침에 따라 "로"/"으로". 한글이 아니면(영문 닉네임 등) "(으)로" */
function euro(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "(으)로";
  const jong = code % 28;
  return jong === 0 || jong === 8 ? "로" : "으로"; // 받침 없음 또는 ㄹ → "로"
}
