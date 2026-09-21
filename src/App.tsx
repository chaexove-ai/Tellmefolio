import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RouteFallback from "./components/RouteFallback";
import RequireAuth from "./auth/RequireAuth";
import ScrollToTop from "./components/ScrollToTop";

/**
 * 랜딩(/)만 정적으로 불러옵니다. 첫 진입 화면이라 지연 로딩할 이유가 없고,
 * GSAP ScrollTrigger 를 쓰기 때문에 Suspense 로 한 번 걸렀다가 마운트되면
 * 트리거 위치 계산이 어긋납니다.
 *
 * 나머지 라우트는 전부 로그인 이후 화면이라 첫 방문자가 내려받을 이유가
 * 없습니다. React.lazy 로 분리해 실제로 들어갈 때만 청크를 받습니다.
 */
import Landing from "./pages/Landing";

const Login = lazy(() => import("./pages/Login"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const PortfolioList = lazy(() => import("./pages/PortfolioList"));
const VersionHistory = lazy(() => import("./pages/VersionHistory"));

const WizardOverview = lazy(() => import("./pages/wizard/WizardOverview"));
const SourceInput = lazy(() => import("./pages/wizard/SourceInput"));
const AIDraftGeneration = lazy(() => import("./pages/wizard/AIDraftGeneration"));
const PortfolioEditor = lazy(() => import("./pages/wizard/PortfolioEditor"));
const Export = lazy(() => import("./pages/wizard/Export"));

const JobSwitchRequest = lazy(() => import("./pages/jobswitch/JobSwitchRequest"));
const JobSwitchResult = lazy(() => import("./pages/jobswitch/JobSwitchResult"));

const Gallery = lazy(() => import("./pages/gallery/Gallery"));
const GalleryDetail = lazy(() => import("./pages/gallery/GalleryDetail"));
const ShareSettings = lazy(() => import("./pages/gallery/ShareSettings"));
const VisitStats = lazy(() => import("./pages/gallery/VisitStats"));

const AccountSettings = lazy(() => import("./pages/account/AccountSettings"));
const SocialAccountManage = lazy(() => import("./pages/account/SocialAccountManage"));
const DataManage = lazy(() => import("./pages/account/DataManage"));

function StyleRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/wizard/editor/${id}` : "/wizard"} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* 인증 및 온보딩 */}
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          <Suspense fallback={<RouteFallback />}>
            <Login />
          </Suspense>
        }
      />

      {/* 로그인 이후 공통 레이아웃.
          Suspense 는 AppLayout 안쪽(Outlet 자리)에 있습니다. 여기서 감싸면
          페이지를 옮길 때마다 사이드바까지 같이 사라졌다 돌아옵니다. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
        {/* 내 서재 */}
        <Route path="/library" element={<Dashboard />} />
        <Route path="/library/portfolios" element={<PortfolioList />} />
        <Route path="/library/portfolios/:id/versions" element={<VersionHistory />} />

        {/* 포트폴리오 생성 위저드.
            editor/style/export 는 :id 가 필요합니다 — [2026-09] 마법사가
            실제 portfolios 테이블에 저장하도록 바뀌면서, "지금 만들고 있는
            포트폴리오가 어느 행인지"를 주소에 직접 담습니다. 전에는
            location.state 로만 넘겨서 새로고침하면 통째로 사라졌습니다. */}
        <Route path="/wizard" element={<WizardOverview />} />
        <Route path="/wizard/source" element={<SourceInput />} />
        <Route path="/wizard/draft" element={<AIDraftGeneration />} />
        <Route path="/wizard/editor/:id" element={<PortfolioEditor />} />
        {/* [2026-09] 템플릿/스타일 설정 페이지를 편집기 오른쪽 패널로
            합쳤습니다. 바꾸는 손과 보이는 결과가 떨어져 있을 이유가 없고,
            그 페이지에는 편집기와 별개의 미리보기가 또 하나 있었습니다.
            이미 배포된 주소라 링크가 남아 있을 수 있어 리다이렉트만 둡니다. */}
        <Route path="/wizard/style/:id" element={<StyleRedirect />} />
        <Route path="/wizard/export/:id" element={<Export />} />

        {/* 직무 전환 재구성 */}
        <Route path="/job-switch" element={<JobSwitchRequest />} />
        <Route path="/job-switch/result" element={<JobSwitchResult />} />

        {/* 커뮤니티 및 공유.
            이름이 사이드바("커뮤니티")·랜딩("갤러리")·라우트(/gallery)로
            갈려 있어서 /community 로 통일했습니다. 이미 배포된 주소가
            있으니 옛 경로는 아래에서 넘겨줍니다. */}
        <Route path="/community" element={<Gallery />} />
        <Route path="/community/:id" element={<GalleryDetail />} />
        <Route path="/community/share" element={<ShareSettings />} />
        <Route path="/community/stats" element={<VisitStats />} />

        <Route path="/gallery" element={<Navigate to="/community" replace />} />
        <Route path="/gallery/*" element={<Navigate to="/community" replace />} />

        {/* 계정 및 데이터 관리 */}
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/settings/social" element={<SocialAccountManage />} />
        <Route path="/settings/data" element={<DataManage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
