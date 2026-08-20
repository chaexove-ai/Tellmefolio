import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import RouteFallback from "../components/RouteFallback";

/**
 * 로그인한 사용자만 통과시키는 라우트 감싸개.
 *
 * 세션 확인이 끝나기 전에는 아무 판단도 하지 않습니다. 여기서 서두르면
 * 새로고침할 때마다 로그인 화면으로 튕깁니다.
 *
 * 튕겨낼 때는 원래 가려던 주소를 state 에 실어 보냅니다. 로그인이 끝나면
 * 그 자리로 되돌려 보내기 위한 것입니다.
 */
export default function RequireAuth() {
  const { session, loading, configured } = useAuth();
  const location = useLocation();

  if (loading) return <RouteFallback />;

  // 설정 전에는 잠그지 않습니다. 화면을 둘러볼 수 있어야 해서입니다.
  if (!configured) return <Outlet />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
