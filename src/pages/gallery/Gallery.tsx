import { useEffect, useMemo, useRef, useState } from "react";
import { NewPortfolioButton } from "../../components/NewPortfolio";
import { Link, useSearchParams } from "react-router-dom";
import { Globe, Lock, SlidersHorizontal, Upload, Bookmark, BookmarkCheck, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import {
  listMyPortfolios,
  searchPublicPortfolios,
  listCommunityFacets,
  cleanSearch,
  COMMUNITY_PAGE_SIZE,
  updatePortfolioListed,
  updatePortfolioVisibility,
  PortfolioError,
} from "../../lib/portfolios";
import type { LibraryPortfolio } from "../../lib/portfolios";
import Reveal from "../../components/Reveal";
import DefaultAvatar from "../../components/DefaultAvatar";
import PortfolioThumb from "../../components/PortfolioThumb";
import { getMyBookmarkIds, listBookmarkedPortfolios, setBookmark } from "../../lib/engagement";
import { getProfiles, getMyProfile, FALLBACK_NICKNAME } from "../../lib/profile";
import type { Profile } from "../../lib/profile";

/**
 * [2026-09-22] 실제 공개 포트폴리오를 읽습니다.
 *
 * 전에는 mockData.galleryItems("김지수", "박민준" …)를 그렸습니다. 없는
 * 사람의 없는 포트폴리오였고, 눌러도 아무것도 없었습니다.
 *
 * 목록 조건은 visibility='public' 이고 listed=true 인 것 전부입니다 —
 * user_id 조건은 없습니다. 내 것만 보이는 구조가 아니라, 누가 올렸든
 * 최근 수정순으로 섞입니다. 링크만 공유한 사람은 여기 나오지 않습니다.
 *
 * [여기서 바로 올립니다]
 * 올리는 기능이 내보내기 화면에만 있으면, 커뮤니티를 보다가 "나도 올려야지"
 * 한 사람이 내보내기까지 찾아 들어가야 합니다. 이 화면에서 바로 고르게
 * 합니다. 내보내기 쪽 체크박스는 그대로 둡니다 — 거기는 "만들기를 끝내고
 * 공유하는" 맥락이라 둘 다 자기 자리가 있습니다.
 *
 * [작성자 — 2026-09-23]
 * 이제 작성자를 표시합니다. profiles 테이블이 생겼고, 거기 닉네임은
 * 본인이 설정에서 바꿀 수 있습니다. 그전에는 "컬럼이 없고, 본인이 실명을
 * 넣겠다고 한 적 없는데 띄울 이유가 없다"고 적어뒀었는데, 앞쪽은
 * 해결됐고 뒤쪽은 설정 화면의 안내 문구와 아래 올리기 창의 안내로
 * 다룹니다 — 올리기 직전에 어떤 이름으로 뜨는지 보여줍니다.
 *
 * 프로필은 목록을 받은 뒤 한 번에 읽습니다. 30건을 한 건씩 조회하면
 * 요청이 30번 갑니다.
 *
 * [검색·쪽 나누기 — 2026-09-28]
 * 커뮤니티가 커질 것에 대비해, 최근 60건을 받아 화면에서 거르던 것을
 * 서버 검색(lib/portfolios searchPublicPortfolios)과 30건씩 쪽 나누기로
 * 바꿨습니다. 검색어·필터·쪽·탭은 주소(?q=&job=&year=&page=&tab=)에 둡니다.
 * "참고할게요 / 참고한 포트폴리오"는 "북마크"로 이름을 바꿨습니다.
 *
 * [빠진 필터]
 * '구성 방식' 필터를 뺐습니다. 그런 컬럼이 없어서 골라도 아무것도 걸러지지
 * 않던 칸입니다.
 */
export default function Gallery() {
  const { session, configured } = useAuth();
  const userId = session?.user?.id;

  // [09-28] 검색·필터·쪽·탭을 주소에 둡니다 — 카드를 열었다가 뒤로 오면
  // 보던 검색어와 쪽 그대로 돌아옵니다. 링크로 남에게 보낼 수도 있습니다.
  const [params, setParams] = useSearchParams();
  const tab: "all" | "bookmarks" = params.get("tab") === "bookmarks" && userId ? "bookmarks" : "all";
  const q = params.get("q") ?? "";
  const job = params.get("job") ?? "";
  const year = params.get("year") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  /** 주소 값을 바꿉니다. 쪽 말고 다른 것이 바뀌면 1쪽으로 돌아갑니다. */
  const update = (patch: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: !("page" in patch) && !("tab" in patch) }
    );
  };

  // 검색창 — 치는 동안은 화면만, 멈추면(0.3초) 주소와 목록이 바뀝니다
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft.trim() === q) return;
    const t = setTimeout(() => update({ q: draft.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const [result, setResult] = useState<{ rows: LibraryPortfolio[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState<{ jobs: string[]; years: string[] } | null>(null);
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // 북마크 — 내가 누른 것만 알고, 남의 수는 모릅니다(주인에게만 보임)
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<LibraryPortfolio[] | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const addAuthors = (rows: LibraryPortfolio[]) =>
    void getProfiles(rows.map((r) => r.userId)).then((m) => setAuthors((prev) => new Map([...prev, ...m])));

  // 전체 탭: 서버에서 거르고 30건씩
  useEffect(() => {
    if (tab !== "all") return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    searchPublicPortfolios({ q, job: job || null, year: year || null, page })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        // 작성자 이름은 목록이 뜬 뒤에 붙습니다(프로필 조회가 느려도 목록은 먼저)
        addAuthors(r.rows);
      })
      .catch(() => alive && setLoadError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, job, year, page, reloadKey]);

  useEffect(() => {
    listCommunityFacets().then(setFacets).catch(() => setFacets({ jobs: [], years: [] }));
  }, [reloadKey]);

  useEffect(() => {
    if (!userId) return;
    getMyBookmarkIds().then(setBookmarks).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (tab !== "bookmarks") return;
    setSaved(null);
    listBookmarkedPortfolios()
      .then((rows) => {
        setSaved(rows);
        addAuthors(rows);
      })
      .catch(() => setSaved([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 쪽을 넘기면 목록 맨 위로
  const topRef = useRef<HTMLDivElement>(null);
  const goPage = (n: number) => {
    update({ page: n > 1 ? String(n) : null });
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleBookmark = async (id: string) => {
    const on = !bookmarks.has(id);
    const next = new Set(bookmarks);
    if (on) next.add(id);
    else next.delete(id);
    setBookmarks(next);
    try {
      await setBookmark(id, on);
    } catch {
      setBookmarks(bookmarks);
    }
  };

  // 북마크 탭: 많아야 수백 건이라 화면에서 거르고 나눕니다
  const savedFiltered = useMemo(() => {
    const needle = cleanSearch(q).toLowerCase();
    return (saved ?? []).filter((g) => {
      if (job && g.job !== job) return false;
      if (year && g.year !== year) return false;
      if (!needle) return true;
      const author = authors.get(g.userId)?.nickname ?? "";
      return [g.title, g.job, g.summary, author].some((t) => t.toLowerCase().includes(needle));
    });
  }, [saved, q, job, year, authors]);

  const jobs = tab === "all" ? facets?.jobs ?? [] : [...new Set((saved ?? []).map((g) => g.job))].sort();
  const years =
    tab === "all" ? facets?.years ?? [] : [...new Set((saved ?? []).map((g) => g.year))].sort().reverse();

  const total = tab === "all" ? result?.total ?? 0 : savedFiltered.length;
  const pages = Math.max(1, Math.ceil(total / COMMUNITY_PAGE_SIZE));
  const shown =
    tab === "all"
      ? result?.rows ?? []
      : savedFiltered.slice((page - 1) * COMMUNITY_PAGE_SIZE, page * COMMUNITY_PAGE_SIZE);
  const ready = tab === "all" ? result !== null : saved !== null;
  const filtering = Boolean(q || job || year);

  // 없는 쪽(예: 검색 뒤 결과가 줄었는데 주소는 5쪽)이면 마지막 쪽으로
  useEffect(() => {
    if (ready && !loading && page > pages) update({ page: pages > 1 ? String(pages) : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loading, page, pages]);

  return (
    <div ref={topRef} className="max-w-4xl space-y-6 scroll-mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading">커뮤니티</h1>
          <p className="text-xs text-neutral-500 mt-1">
            작성자가 직접 올린 포트폴리오입니다. 열람만 가능하며, 내용을 복제하거나
            자신의 포트폴리오로 가져올 수 없습니다.
          </p>
        </div>
        {configured && userId && (
          <button
            className="btn-secondary shrink-0 inline-flex items-center gap-1.5"
            onClick={() => setPickerOpen(true)}
          >
            <Upload size={14} aria-hidden="true" />
            올리기
          </button>
        )}
      </div>

      {userId && (
        <nav className="flex gap-6 border-b border-neutral-800">
          {([
            ["all", "전체"],
            ["bookmarks", `북마크${bookmarks.size ? ` ${bookmarks.size}` : ""}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ tab: key === "all" ? null : key })}
              aria-current={tab === key ? "page" : undefined}
              className={`-mb-px border-b-2 py-2.5 text-sm transition-colors ${
                tab === key ? "border-neutral-100 font-medium text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {key === "bookmarks" && <Bookmark size={13} strokeWidth={2} className="mr-1 inline -mt-0.5" />}
              {label}
            </button>
          ))}
        </nav>
      )}

      {notice && (
        <p className="entry py-3 text-sm text-neutral-200 border-l-2 border-l-brand">
          {notice}
        </p>
      )}

      {/* 검색 · 필터 */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-neutral-300">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">검색</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            role="searchbox"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ q: draft.trim() || null });
            }}
            placeholder="제목·직무·작성자로 검색"
            maxLength={40}
            className="field w-full py-2 pl-9 pr-9"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                update({ q: null });
              }}
              aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <X size={14} />
            </button>
          )}
        </label>
        <SlidersHorizontal size={15} className="text-neutral-600 shrink-0" aria-hidden="true" />
        <select
          aria-label="직무"
          className="field w-auto py-2"
          value={job}
          onChange={(e) => update({ job: e.target.value || null })}
        >
          <option value="" className="bg-neutral-900">전체 직무</option>
          {job && !jobs.includes(job) && <option className="bg-neutral-900">{job}</option>}
          {jobs.map((j) => (
            <option key={j} className="bg-neutral-900">{j}</option>
          ))}
        </select>
        <select
          aria-label="연도"
          className="field w-auto py-2"
          value={year}
          onChange={(e) => update({ year: e.target.value || null })}
        >
          <option value="" className="bg-neutral-900">전체 연도</option>
          {year && !years.includes(year) && <option className="bg-neutral-900">{year}</option>}
          {years.map((y) => (
            <option key={y} className="bg-neutral-900">{y}</option>
          ))}
        </select>
      </div>

      {ready && (total > 0 || filtering) && (
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>
            {q ? (
              <>
                <span className="text-neutral-200">“{q}”</span> 검색 결과{" "}
              </>
            ) : filtering ? (
              "조건에 맞는 "
            ) : tab === "bookmarks" ? (
              "북마크 "
            ) : (
              "전체 "
            )}
            <span className="text-neutral-200">{total.toLocaleString()}</span>개
            {pages > 1 && ` · ${page} / ${pages}쪽`}
          </span>
          {filtering && (
            <button
              type="button"
              className="btn-ghost-muted ml-auto"
              onClick={() => {
                setDraft("");
                update({ q: null, job: null, year: null });
              }}
            >
              <X size={13} /> 조건 지우기
            </button>
          )}
        </div>
      )}

      {!ready && !loadError && <p className="text-sm text-neutral-500">불러오는 중…</p>}
      {loadError && tab === "all" && <p className="text-sm text-red-400">목록을 불러오지 못했습니다.</p>}

      {ready && total === 0 && !filtering && tab === "all" && (
        <div className="entry p-8 text-center">
          <p className="text-sm text-neutral-300">아직 올라온 포트폴리오가 없습니다.</p>
          <p className="text-xs text-neutral-500 mt-2">
            위 "올리기"에서 내 포트폴리오를 골라 처음으로 올려보세요.
          </p>
        </div>
      )}

      {ready && total === 0 && !filtering && tab === "bookmarks" && (
        <div className="entry p-8 text-center">
          <p className="text-sm text-neutral-300">아직 북마크한 포트폴리오가 없어요.</p>
          <p className="mt-2 text-xs text-neutral-500">
            카드 오른쪽 위 책갈피나, 열어 본 포트폴리오의 "북마크"를 누르면 여기 모여요.
          </p>
        </div>
      )}

      {ready && total === 0 && filtering && (
        <div className="entry p-8 text-center">
          <p className="text-sm text-neutral-300">
            {q ? `“${q}”에 맞는 포트폴리오가 없어요.` : "조건에 맞는 포트폴리오가 없어요."}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            다른 낱말로 찾거나, 직무·연도 조건을 풀어 보세요.
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${loading ? "opacity-50" : ""}`}
          aria-busy={loading}
        >
          {shown.map((g, i) => (
            <Reveal key={g.id} delay={(i % 3) * 0.08}>
              {/* 공개 열람 페이지로 바로 보냅니다 — 방문자가 보는 화면과
                  같은 것을 보여주는 편이 정직하고, 화면도 하나면 됩니다. */}
              <Link
                to={`/p/${g.id}`}
                className="entry p-4 block hover:border-brand/40 hover:-translate-y-0.5 transition-all"
              >
                {/* [2026-09-23] 그 포트폴리오의 실제 첫 화면입니다.
                    못 그리면 그라디언트가 그대로 남습니다(PortfolioThumb). */}
                <div className="relative">
                  <PortfolioThumb portfolio={g} className="aspect-[4/3] rounded-xl mb-3" />
                  {userId && g.userId !== userId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleBookmark(g.id);
                      }}
                      aria-pressed={bookmarks.has(g.id)}
                      aria-label={bookmarks.has(g.id) ? "북마크 지우기" : "북마크"}
                      title={bookmarks.has(g.id) ? "북마크됨 — 누르면 지워요" : "북마크 — 작성자에게는 수만 보여요"}
                      className={`absolute right-2 top-2 grid size-8 place-items-center rounded-full shadow-sm transition-colors ${
                        bookmarks.has(g.id) ? "bg-brand-solid text-white" : "bg-white/95 text-[#2a211b] hover:bg-white"
                      }`}
                    >
                      {bookmarks.has(g.id) ? <BookmarkCheck size={15} strokeWidth={2} /> : <Bookmark size={15} strokeWidth={2} />}
                    </button>
                  )}
                </div>
                <p className="font-medium text-neutral-100">{g.title}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {g.job} · {g.year}
                </p>
                <Author profile={authors.get(g.userId)} />
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {pages > 1 && <Pager page={Math.min(page, pages)} pages={pages} onGo={goPage} />}

      {pickerOpen && userId && (
        <UploadPicker
          userId={userId}
          onClose={() => setPickerOpen(false)}
          onDone={(message) => {
            setPickerOpen(false);
            setNotice(message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

/** 보여 줄 쪽 번호: 1 … 4 5 [6] 7 8 … 20 */
function pageList(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const lo = Math.max(2, Math.min(page - 1, pages - 4));
  const hi = Math.min(pages - 1, Math.max(page + 1, 5));
  if (lo > 2) out.push("…");
  for (let n = lo; n <= hi; n++) out.push(n);
  if (hi < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (n: number) => void }) {
  const cell = "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm transition-colors";
  return (
    <nav aria-label="쪽 이동" className="flex items-center justify-center gap-1 pt-2">
      <button
        type="button"
        onClick={() => onGo(page - 1)}
        disabled={page <= 1}
        aria-label="이전 쪽"
        className={`${cell} text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        <ChevronLeft size={16} />
      </button>
      {pageList(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap${i}`} className={`${cell} text-neutral-600`} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onGo(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${cell} ${
              n === page ? "bg-brand-solid font-medium text-white" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onGo(page + 1)}
        disabled={page >= pages}
        aria-label="다음 쪽"
        className={`${cell} text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

/**
 * 카드 맨 아래 작성자 줄.
 *
 * 프로필을 아직 못 읽었을 때(로딩 중이거나 조회 실패) 자리를 비워두지
 * 않고 같은 높이의 빈 줄을 둡니다 — 이름이 뒤늦게 붙으면서 카드 높이가
 * 변하면 그리드 전체가 한 번 출렁입니다.
 */
function Author({ profile }: { profile?: Profile }) {
  const name = profile?.nickname?.trim() || (profile ? FALLBACK_NICKNAME : "");

  // [2026-09-23] 사진을 안 올린 사람은 빈 동그라미였습니다. 밝은 테마에서
  // 거의 안 보여서 그 사람만 줄이 비어 보였습니다. 이름 첫 글자를 넣으면
  // 비어 보이지 않으면서 사람끼리 구분도 됩니다 — 사진 없는 것이 기본
  // 상태인데 그게 결함처럼 보여서는 안 됩니다.

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800/70 flex items-center gap-2 h-[30px]">
      {profile?.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
      ) : (
        // [2026-09-25] 사진이 없으면 빈 회색 원 대신 임시 아바타(DefaultAvatar).
        profile && (
          <DefaultAvatar seed={profile.id} name={profile.nickname} className="h-5 w-5 text-[10px]" />
        )
      )}
      <span className="text-xs text-neutral-400 truncate">{name}</span>
    </div>
  );
}

/**
 * 내 포트폴리오를 골라 커뮤니티에 올리고 내리는 창.
 *
 * 체크 상태는 "올릴 것"이고, 저장을 눌러야 반영됩니다 — 체크하자마자
 * 올라가면 잘못 누른 것을 되돌릴 방법이 없습니다.
 *
 * **비공개인 것을 고르면 공개로 함께 전환됩니다.** 커뮤니티 노출은
 * 링크 공개를 전제로 하기 때문인데(RLS 가 비공개 행을 아예 막습니다),
 * 사용자가 모르고 누를 일이 아니라 목록에서 그 행마다 표시하고 창 아래에도
 * 한 번 더 적습니다.
 */
function UploadPicker({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mine, setMine] = useState<LibraryPortfolio[] | null>(null);
  // 올리기 직전에 "어떤 이름으로 뜨는지"를 보여주기 위해 읽습니다.
  // 닉네임 기본값이 소셜 로그인의 실명이라, 재직 중인 사용자가 모르고
  // 실명으로 올리는 것을 막는 마지막 자리입니다.
  const [me, setMe] = useState<Profile | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listMyPortfolios(userId)
      .then((rows) => {
        if (!alive) return;
        setMine(rows);
        setChecked(new Set(rows.filter((r) => r.listed).map((r) => r.id)));
      })
      .catch(() => alive && setError("목록을 불러오지 못했습니다."));
    // 이름을 못 읽어도 올리기 자체는 막지 않습니다 — 아래 안내만 빠집니다.
    void getMyProfile(userId)
      .then((p) => alive && setMe(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = mine ?? [];
  const toAdd = rows.filter((r) => !r.listed && checked.has(r.id));
  const toRemove = rows.filter((r) => r.listed && !checked.has(r.id));
  const willGoPublic = toAdd.filter((r) => r.visibility === "비공개");
  const changed = toAdd.length + toRemove.length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const r of toAdd) {
        // 순서가 중요합니다 — 공개로 먼저 바꿔야 목록에 올렸을 때
        // 곧바로 열립니다. 반대면 잠깐 "목록엔 있는데 안 열리는" 상태가
        // 생깁니다.
        if (r.visibility === "비공개") {
          await updatePortfolioVisibility(r.id, "public");
        }
        await updatePortfolioListed(r.id, true);
      }
      for (const r of toRemove) {
        // 내릴 때는 공개까지 함께 닫지 않습니다. 링크를 이미 남에게
        // 보냈을 수 있어서, 목록에서 내리는 것과 링크를 끊는 것은
        // 서로 다른 결정입니다.
        await updatePortfolioListed(r.id, false);
      }

      const parts: string[] = [];
      if (toAdd.length) parts.push(`${toAdd.length}건을 올렸습니다`);
      if (toRemove.length) parts.push(`${toRemove.length}건을 내렸습니다`);
      onDone(parts.join(" · ") || "변경사항이 없습니다.");
    } catch (e) {
      setError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
      <div className="surface w-full max-w-lg">
        <h2 className="entry-title mb-1">커뮤니티에 올리기</h2>
        <p className="text-xs text-neutral-500 mb-4">
          올릴 포트폴리오를 고르세요. 체크를 풀면 커뮤니티에서 내려갑니다.
        </p>

        {mine === null && !error && <p className="text-sm text-neutral-500">불러오는 중…</p>}

        {mine !== null && rows.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-400">아직 만든 포트폴리오가 없습니다.</p>
            <NewPortfolioButton className="btn-secondary inline-flex mt-4">
              새 포트폴리오
            </NewPortfolioButton>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
            {rows.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2.5 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="accent-brand shrink-0"
                  />
                  <span
                    aria-hidden="true"
                    className="w-[9px] h-[9px] rounded-[2px] shrink-0"
                    style={{ backgroundColor: p.jobColor }}
                  />
                  <span className="text-sm text-neutral-200 truncate flex-1 min-w-0">
                    {p.title}
                  </span>
                  <span className="text-xs text-neutral-600 shrink-0">{p.job}</span>
                  <span
                    className="text-xs shrink-0 inline-flex items-center gap-1 text-neutral-500"
                    title={p.visibility === "공개" ? "링크로 공개 중" : "비공개 — 올리면 공개로 바뀝니다"}
                  >
                    {p.visibility === "공개" ? (
                      <Globe size={11} aria-hidden="true" />
                    ) : (
                      <Lock size={11} aria-hidden="true" />
                    )}
                    {p.visibility}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && me && (
          <p className="text-xs text-neutral-400 mt-3 border-l-2 border-l-neutral-700 pl-3">
            커뮤니티에는{" "}
            <span className="text-neutral-200">
              {me.nickname.trim() || FALLBACK_NICKNAME}
            </span>{" "}
            으로 표시됩니다.{" "}
            <Link to="/settings" className="link-inline">
              이름 바꾸기
            </Link>
          </p>
        )}

        {willGoPublic.length > 0 && (
          <p className="text-xs text-neutral-400 mt-3 border-l-2 border-l-brand pl-3">
            비공개 {willGoPublic.length}건이 함께 공개로 바뀝니다 — 커뮤니티에
            올리려면 링크가 열려 있어야 합니다. 재직 중이라면 회사 사람도 볼 수
            있다는 뜻입니다.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400 mt-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            onClick={() => void save()}
            disabled={saving || changed === 0}
          >
            {saving ? "저장 중…" : changed > 0 ? `저장 (${changed}건)` : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
