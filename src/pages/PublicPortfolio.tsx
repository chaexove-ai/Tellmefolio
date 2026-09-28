import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCoverImageUrl,
  getPublicPortfolio,
  listProjectImages,
  updatePortfolioListed,
  updatePortfolioVisibility,
} from "../lib/portfolios";
import { getSupabase } from "../lib/supabase";
import type { PortfolioProjectRow, PortfolioRow, ProjectImageMap } from "../lib/portfolios";
import TemplateFrame from "../components/TemplateFrame";
import { useAuth } from "../auth/AuthProvider";
import { getMyBookmarkIds, recordView, setBookmark } from "../lib/engagement";
import { Bookmark, BookmarkCheck, PenLine, UserRound } from "lucide-react";

import { listBlocks, type BlockMap } from "../lib/blocks";
/** 프로젝트 이미지를 템플릿이 쓰는 모양으로 읽습니다.
 *  PDF·공개 링크 둘 다 이 경로를 씁니다 — 편집기와 다른 방법으로 읽으면
 *  "편집기엔 보이는데 PDF엔 없는" 상태가 생깁니다. */
async function loadImageMap(projectIds: string[]): Promise<ProjectImageMap> {
  const rows = await listProjectImages(projectIds);
  const out: ProjectImageMap = {};
  for (const r of rows) {
    const url = await getCoverImageUrl(r.storage_path);
    (out[r.project_id] ??= []).push({ id: r.id, url, caption: r.caption });
  }
  return out;
}


/**
 * 공개된 포트폴리오를 **로그인 없이** 보는 화면. `/p/:id`.
 *
 * [왜 필요했나]
 * visibility 컬럼과 RLS 는 처음부터 있었는데 이 화면이 없어서, 공개로
 * 바꿔도 남에게 보여줄 주소가 없었습니다. 포트폴리오 서비스에서 "만들고 →
 * 공개하고 → 링크를 보낸다"가 끝까지 되는 건 이 화면이 생긴 지금부터입니다.
 *
 * [왜 AppLayout 밖인가]
 * 사이드바·내 서재·계정 메뉴는 방문자에게 의미가 없습니다. 남의
 * 포트폴리오를 보러 온 사람에게 이 서비스의 내부 구조를 보여줄 이유가
 * 없어서, 레이아웃 없이 본문만 그립니다. 대신 맨 아래에 작은 출처 표시를
 * 둡니다 — 이 링크를 받은 사람이 "이게 뭐로 만든 거지"를 알 수 있어야
 * 하고, 사실상 이 서비스의 유일한 유기적 유입 경로이기도 합니다.
 *
 * [데스크탑 게이트를 적용하지 않습니다]
 * 앱 본체는 1200px 미만을 막지만 이 화면은 예외입니다. 공유 링크는
 * 대부분 휴대폰에서 열립니다 — 채용 담당자가 메신저로 받은 링크를 폰에서
 * 눌렀을 때 "데스크탑에서 봐주세요"가 뜨면 그걸로 끝입니다.
 */
export default function PublicPortfolio() {
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectRow[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ProjectImageMap>({});
  const [blocks, setBlocks] = useState<BlockMap>({});
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const [bookmarked, setBookmarked] = useState<boolean | null>(null);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  // [09-28] 주인이 자기 비공개 포트폴리오 링크를 열었을 때(제출 기록 등에서).
  // 전에는 남과 같은 "공개되지 않은 포트폴리오"가 뜨고, 버튼이 로그인 전 첫 화면으로 보냈습니다.
  const [ownPrivate, setOwnPrivate] = useState<{ id: string; title: string } | null>(null);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (!id) {
      setState("missing");
      return;
    }
    let alive = true;

    getPublicPortfolio(id)
      .then(async (result) => {
        if (!alive) return;
        if (!result) {
          // 비공개라 공개 조회에 안 잡혔을 수 있습니다. 주인이면 RLS 가 읽게 해 줍니다.
          const sb = await getSupabase();
          const { data } = sb
            ? await sb.from("portfolios").select("id, title, user_id").eq("id", id).maybeSingle()
            : { data: null };
          if (!alive) return;
          if (data && me && data.user_id === me) setOwnPrivate({ id: data.id, title: data.title });
          setState("missing");
          return;
        }
        setPortfolio(result.portfolio);
        setProjects(result.projects);
        setState("ok");
        // [09-28] 조회 1회 — 같은 사람은 하루 한 번, 주인 본인은 세지 않음(서버에서 거름)
        void recordView(result.portfolio.id);

        // 이미지는 본문이 뜬 뒤에 붙습니다. 이미지를 기다리느라 글까지
        // 늦게 보이면, 링크를 연 사람에게 빈 화면이 더 길어집니다.
        loadImageMap(result.projects.map((p) => p.id))
          .then((m) => alive && setImages(m))
          .catch(() => {});

        listBlocks(result.portfolio.id)
          .then((m) => alive && setBlocks(m))
          .catch(() => {});

        if (result.portfolio.cover_image_path) {
          try {
            const url = await getCoverImageUrl(result.portfolio.cover_image_path);
            if (alive) setCoverUrl(url);
          } catch {
            // 표지를 못 불러와도 본문은 보여줍니다 — 템플릿이 null 을 처리합니다.
          }
        }
      })
      .catch(() => alive && setState("missing"));

    return () => {
      alive = false;
    };
  }, [id, me]);

  // 로그인한 남이 보고 있을 때만 "북마크"를 띄웁니다.
  useEffect(() => {
    if (!me || !portfolio || portfolio.user_id === me) return;
    getMyBookmarkIds()
      .then((ids) => setBookmarked(ids.has(portfolio.id)))
      .catch(() => setBookmarked(false));
  }, [me, portfolio]);

  // [09-28] 주인이 자기 공개 페이지를 볼 때 — 편집하기 · 커뮤니티 올리기/내리기
  const isOwner = Boolean(me && portfolio && portfolio.user_id === me);
  const [confirmUnlist, setConfirmUnlist] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const setListed = async (listed: boolean) => {
    if (!portfolio) return;
    setListBusy(true);
    setListError(null);
    try {
      await updatePortfolioListed(portfolio.id, listed);
      setPortfolio({ ...portfolio, listed });
      setConfirmUnlist(false);
    } catch {
      setListError(listed ? "올리지 못했어요" : "내리지 못했어요");
    } finally {
      setListBusy(false);
    }
  };

  const toggleBookmark = async () => {
    if (!portfolio || bookmarked === null) return;
    const next = !bookmarked;
    setBookmarkBusy(true);
    setBookmarked(next);
    try {
      await setBookmark(portfolio.id, next);
    } catch {
      setBookmarked(!next);
    } finally {
      setBookmarkBusy(false);
    }
  };

  // 공유 링크는 미리보기 카드로 먼저 읽힙니다. 이 앱은 CSR 이라 크롤러가
  // 보는 건 여전히 index.html 이지만, 최소한 브라우저 탭과 방문 기록에는
  // 제목이 남습니다.
  useEffect(() => {
    if (!portfolio) return;
    const previous = document.title;
    document.title = `${portfolio.title} — Tellmefolio`;
    return () => {
      document.title = previous;
    };
  }, [portfolio]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      </div>
    );
  }

  if (state === "missing" && ownPrivate) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-heading text-neutral-200">지금 비공개예요</h1>
          <p className="text-sm text-neutral-500 mt-3 break-keep">
            “{ownPrivate.title}”은(는) 비공개라, 이 링크를 받은 사람에게는 "공개되지 않은 포트폴리오"로 보여요.
            내 화면에서만 이 안내가 나와요.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={reopening}
              onClick={async () => {
                setReopening(true);
                try {
                  await updatePortfolioVisibility(ownPrivate.id, "public");
                  window.location.reload();
                } finally {
                  setReopening(false);
                }
              }}
            >
              {reopening ? "바꾸는 중…" : "다시 공개하기"}
            </button>
            <Link to={`/wizard/editor/${ownPrivate.id}`} className="btn-secondary">
              편집기로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "missing" || !portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-heading text-neutral-200">
            공개되지 않은 포트폴리오입니다
          </h1>
          <p className="text-sm text-neutral-500 mt-3">
            링크가 잘못되었거나, 작성자가 공개를 해제했을 수 있습니다.
          </p>
          {/* 로그인한 사람을 로그인 전 첫 화면으로 보내지 않습니다 */}
          <Link to={me ? "/library" : "/"} className="btn-secondary inline-flex mt-6">
            {me ? "홈으로" : "Tellmefolio 둘러보기"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TemplateFrame
        portfolio={portfolio}
        projects={projects}
        images={images}
        blocks={blocks}
        coverUrl={coverUrl}
        fullWidth
      />

      {bookmarked !== null && (
        <button
          type="button"
          onClick={() => void toggleBookmark()}
          disabled={bookmarkBusy}
          title="커뮤니티의 북마크 탭에 모아 둬요. 작성자에게는 누가 눌렀는지 없이 수만 보여요."
          className={`fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-colors ${
            bookmarked ? "bg-brand-solid text-white" : "bg-white text-[#2a211b] border border-[#d9cfc4] hover:border-[#a05829]"
          }`}
        >
          {bookmarked ? <BookmarkCheck size={16} strokeWidth={2} /> : <Bookmark size={16} strokeWidth={2} />}
          {bookmarked ? "북마크됨" : "북마크"}
        </button>
      )}

      {isOwner && portfolio && (
        <div className="fixed bottom-5 right-5 z-20 flex items-center gap-1 rounded-full border border-[#d9cfc4] bg-white p-1 pl-4 text-sm text-[#2a211b] shadow-lg">
          <span className="inline-flex items-center gap-1.5 pr-2 text-xs text-[#7a6a5c]">
            <UserRound size={14} strokeWidth={2} aria-hidden="true" /> 내 포트폴리오
          </span>
          {confirmUnlist ? (
            <>
              <span className="px-2 text-xs text-[#7a6a5c]">커뮤니티에서 내릴까요? 링크는 그대로 열려요</span>
              <button
                type="button"
                onClick={() => void setListed(false)}
                disabled={listBusy}
                className="rounded-full bg-[#a05829] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#8a4a22] disabled:opacity-60"
              >
                내리기
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnlist(false)}
                className="rounded-full px-3 py-1.5 text-xs text-[#7a6a5c] hover:bg-[#f3ede6]"
              >
                취소
              </button>
            </>
          ) : (
            <>
              {listError && <span className="px-2 text-xs text-[#b42318]">{listError}</span>}
              {portfolio.listed ? (
                <button
                  type="button"
                  onClick={() => setConfirmUnlist(true)}
                  className="rounded-full px-3.5 py-1.5 text-xs hover:bg-[#f3ede6]"
                >
                  커뮤니티에서 내리기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setListed(true)}
                  disabled={listBusy}
                  title="공개 링크는 이미 열려 있어요. 커뮤니티 목록에도 보이게 합니다."
                  className="rounded-full px-3.5 py-1.5 text-xs hover:bg-[#f3ede6] disabled:opacity-60"
                >
                  커뮤니티에 올리기
                </button>
              )}
              <Link
                to={`/wizard/editor/${portfolio.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#a05829] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#8a4a22]"
              >
                <PenLine size={13} strokeWidth={2} /> 편집하기
              </Link>
            </>
          )}
        </div>
      )}

      <footer className="py-10 text-center">
        <Link
          to="/"
          className="text-xs text-neutral-500 hover:text-brand transition-colors"
        >
          Tellmefolio로 만든 포트폴리오입니다
        </Link>
      </footer>
    </div>
  );
}
