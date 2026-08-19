import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PortfolioList from "./pages/PortfolioList";
import VersionHistory from "./pages/VersionHistory";

import WizardOverview from "./pages/wizard/WizardOverview";
import SourceInput from "./pages/wizard/SourceInput";
import AIDraftGeneration from "./pages/wizard/AIDraftGeneration";
import PortfolioEditor from "./pages/wizard/PortfolioEditor";
import TemplateStyle from "./pages/wizard/TemplateStyle";
import Export from "./pages/wizard/Export";

import JobSwitchRequest from "./pages/jobswitch/JobSwitchRequest";
import JobSwitchResult from "./pages/jobswitch/JobSwitchResult";

import Gallery from "./pages/gallery/Gallery";
import GalleryDetail from "./pages/gallery/GalleryDetail";
import ShareSettings from "./pages/gallery/ShareSettings";
import VisitStats from "./pages/gallery/VisitStats";

import AccountSettings from "./pages/account/AccountSettings";
import SocialAccountManage from "./pages/account/SocialAccountManage";
import DataManage from "./pages/account/DataManage";

export default function App() {
  return (
    <Routes>
      {/* 인증 및 온보딩 */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* 로그인 이후 공통 레이아웃 */}
      <Route element={<AppLayout />}>
        {/* 내 서재 */}
        <Route path="/library" element={<Dashboard />} />
        <Route path="/library/portfolios" element={<PortfolioList />} />
        <Route path="/library/portfolios/:id/versions" element={<VersionHistory />} />

        {/* 포트폴리오 생성 위저드 */}
        <Route path="/wizard" element={<WizardOverview />} />
        <Route path="/wizard/source" element={<SourceInput />} />
        <Route path="/wizard/draft" element={<AIDraftGeneration />} />
        <Route path="/wizard/editor" element={<PortfolioEditor />} />
        <Route path="/wizard/style" element={<TemplateStyle />} />
        <Route path="/wizard/export" element={<Export />} />

        {/* 직무 전환 재구성 */}
        <Route path="/job-switch" element={<JobSwitchRequest />} />
        <Route path="/job-switch/result" element={<JobSwitchResult />} />

        {/* 커뮤니티 갤러리 및 공유 */}
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/gallery/:id" element={<GalleryDetail />} />
        <Route path="/gallery/share" element={<ShareSettings />} />
        <Route path="/gallery/stats" element={<VisitStats />} />

        {/* 계정 및 데이터 관리 */}
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/settings/social" element={<SocialAccountManage />} />
        <Route path="/settings/data" element={<DataManage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
