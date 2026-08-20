import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * 화면을 옮길 때 스크롤을 맨 위로 올립니다.
 *
 * React Router 는 주소만 바꾸고 스크롤은 건드리지 않습니다. 그래서 아래쪽을
 * 보던 중에 다른 화면으로 가면, 새 화면이 중간부터 보입니다. 로그아웃 후
 * 랜딩이 중간에서 열리던 게 이 때문입니다.
 *
 * [뒤로 가기는 건드리지 않습니다]
 * 목록에서 항목을 열었다가 뒤로 왔을 때 보던 자리로 돌아가는 건 사용자가
 * 기대하는 동작입니다. POP(뒤로/앞으로)일 때는 그대로 둡니다.
 *
 * [useLayoutEffect 인 이유]
 * useEffect 로 하면 새 화면이 아래쪽에 그려진 뒤 위로 튀어 올라, 한 프레임
 * 동안 깜빡입니다. 그리기 전에 옮기면 그 깜빡임이 없습니다.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
