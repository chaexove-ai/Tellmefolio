import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LibraryBig, Sparkles, Repeat, Users, Settings, Menu, X } from "lucide-react";
import AIUsageBadge from "./AIUsageBadge";
import RouteFallback from "./RouteFallback";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { to: "/library", label: "내 서재", icon: LibraryBig },
  { to: "/wizard", label: "생성", icon: Sparkles },
  { to: "/job-switch", label: "직무 전환", icon: Repeat },
  { to: "/gallery", label: "커뮤니티", icon: Users },
  { to: "/settings", label: "설정", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 mt-8 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `toc-link ${isActive ? "toc-link-active" : "toc-link-inactive"}`
          }
        >
          <item.icon size={18} strokeWidth={2} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * 인증 이후 화면 전반에서 쓰이는 공통 레이아웃.
 * 데스크톱은 좌측 고정 사이드바, 모바일(md 미만)은 상단 바 + 햄버거로
 * 여는 오프캔버스 드로어로 같은 내비게이션을 보여줍니다.
 */
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

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

  return (
    <div className="min-h-screen flex bg-neutral-950">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-neutral-800 flex-col px-4 py-8">
        <span className="text-lg font-heading text-neutral-100 px-2">Tellmefolio</span>
        <NavList />
        <div className="pt-6 border-t border-neutral-800 px-2 space-y-4">
          <AIUsageBadge />
          <ThemeToggle />
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
        <span className="text-base font-heading text-neutral-100">Tellmefolio</span>
        <ThemeToggle />
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
              <span className="text-lg font-heading text-neutral-100">Tellmefolio</span>
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
              <AIUsageBadge />
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
  );
}
