import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

/**
 * 해/달 아이콘이 있는 세그먼트 스위치. 지금 선택된 쪽에만 색이 채워져
 * 한눈에 현재 모드를 알 수 있습니다.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="다크·라이트 모드 전환"
      className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 p-1"
    >
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
          theme === "light" ? "bg-brand text-white" : "text-neutral-500"
        }`}
      >
        <Sun size={14} strokeWidth={2.25} />
      </span>
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
          theme === "dark" ? "bg-brand text-white" : "text-neutral-500"
        }`}
      >
        <Moon size={14} strokeWidth={2.25} />
      </span>
    </button>
  );
}
