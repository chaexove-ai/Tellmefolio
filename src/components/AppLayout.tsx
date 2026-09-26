import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import DesktopOnly, { DESKTOP_MIN_WIDTH } from "./DesktopOnly";
import { Home, LibraryBig, Plus, Repeat, Users, Settings, Menu, X } from "lucide-react";
import { NewPortfolioProvider, useNewPortfolio } from "./NewPortfolio";
import RouteFallback from "./RouteFallback";
import UserMenu from "./UserMenu";

/**
 * [09-26] 사이드바 정리. "생성"을 빼고 맨 위 "＋ 새 포트폴리오" 버튼(선택 창)으로,
 * "내 포트폴리오"를 새로 넣었습니다. 불은 주소 앞부분으로 켭니다 — 편집기·
 * 내보내기·제출 기록에 있을 때도 "내 포트폴리오"가 켜져야 지금 어디인지 압니다
 * (전에는 기존 포트폴리오를 고쳐도 "생성"에 불이 들어왔습니다).
 */
const navItems: Array<{ to: string; label: string; icon: typeof Home; match: (path: string) => boolean }> = [
  { to: "/library", label: "홈", icon: Home, match: (p) => p === "/library" },
  {
    to: "/library/portfolios",
    label: "내 포트폴리오",
    icon: LibraryBig,
    match: (p) =>
      p.startsWith("/library/portfolios") ||
      p.startsWith("/submissions") ||
      p.startsWith("/wizard/editor") ||
      p.startsWith("/wizard/export"),
  },
  { to: "/job-switch", label: "직무 전환", icon: Repeat, match: (p) => p.startsWith("/job-switch") },
  { to: "/community", label: "커뮤니티", icon: Users, match: (p) => p.startsWith("/community") },
  { to: "/settings", label: "설정", icon: Settings, match: (p) => p.startsWith("/settings") },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const openNew = useNewPortfolio();
  return (
    <nav className="flex-1 mt-8 space-y-1">
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          openNew();
        }}
        className="btn-primary mb-5 flex w-full items-center justify-center gap-1.5"
      >
        <Plus size={16} strokeWidth={2.25} />새 포트폴리오
      </button>
      {navItems.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`toc-link ${active ? "toc-link-active" : "toc-link-inactive"}`}
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 인증 이후 화면 전반에서 쓰이는 공통 레이아웃.
 * 데스크톱은 좌측 고정 사이드바, 모바일(md 미만)은 상단 바 + 햄버거로
 * 여는 오프캔버스 드로어로 같은 내비게이션을 보여줍니다.
 */
/** 창 폭이 데스크탑 기준을 넘는지. matchMedia 를 쓰는 이유는 resize 이벤트와
 *  달리 기준을 넘나드는 순간에만 한 번 알려주기 때문입니다 — 드래그하는 동안
 *  매 픽셀마다 리렌더하지 않습니다. */
function useIsDesktop(): boolean {
  const query = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
  const [ok, setOk] = useState(
    () => typeof window === "undefined" || window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setOk(e.matches);
    mq.addEventListener("change", onChange);
    setOk(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return ok;
}

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isDesktop = useIsDesktop();

  // 라우트가 바뀌면 모바일 드로어를 자동으로 닫습니다.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // 드로어가 열려 있는 동안 배경 스크롤을 막습니다.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // [2026-09] 좁은 창에서는 앱 화면 대신 안내만 보여줍니다. CSS 로 숨기지
  // 않고 렌더 자체를 바꾸는 이유는, 숨기기만 하면 뒤에서 편집기와 미리보기가
  // 계속 살아 있어 GSAP·ResizeObserver 가 보이지도 않는 화면을 계속
  // 계산하기 때문입니다.
  if (!isDesktop) return <DesktopOnly />;

  return (
    <NewPortfolioProvider>
    <div className="min-h-screen flex bg-neutral-950">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-neutral-800 flex-col px-4 py-8">
        {/* 좌상단 로고는 홈으로 가는 버튼이라는 게 오래된 관습입니다.
            span 으로 두면 눌러도 아무 일이 없어서, 사용자는 "안 눌린다"가
            아니라 "다른 홈이 있나"로 해석합니다. */}
        <Link to="/library" className="text-lg font-heading text-neutral-100 px-2 hover:text-brand transition-colors">
          Tellmefolio
        </Link>
        <NavList />
        <div className="pt-6 border-t border-neutral-800 px-2 space-y-4">
          {/* 다크 테마를 감추면서 토글을 내렸습니다 — index.html 주석 참고 */}
          {/* [2026-09] AI 사용량 배지를 내렸습니다 — 한도를 정한 적이 없는데
              "N회 남음"이라는 하드코딩된 숫자가 떠 있었습니다. */}
          <UserMenu />
        </div>
      </aside>

      {/* 모바일 상단 바 */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-neutral-950">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="메뉴 열기"
          className="text-neutral-400 hover:text-neutral-100 p-1 -ml-1"
        >
          <Menu size={22} />
        </button>
        <Link to="/library" className="text-base font-heading text-neutral-100">Tellmefolio</Link>
        {/* 다크 테마를 감추면서 토글을 내렸습니다 — index.html 주석 참고 */}
      </header>

      {/* 모바일 드로어 */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[80%] bg-neutral-950 border-r border-neutral-800 flex flex-col px-4 py-6 overflow-y-auto">
            <div className="flex items-center justify-between px-2">
              <Link
                to="/library"
                onClick={() => setDrawerOpen(false)}
                className="text-lg font-heading text-neutral-100"
              >
                Tellmefolio
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="메뉴 닫기"
                className="text-neutral-400 hover:text-neutral-100 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
            <div className="pt-6 border-t border-neutral-800 px-2 space-y-4">
              <UserMenu onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 py-6 pt-20 md:px-10 md:py-10 md:pt-10">
        {/* 라우트 청크를 내려받는 동안에도 사이드바는 그대로 남습니다. */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
    </NewPortfolioProvider>
  );
}
