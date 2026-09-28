import { UserRound } from "lucide-react";

/**
 * 프로필 사진이 없을 때 보여주는 임시 아바타.
 *
 * [2026-09-25] 전에는 사진이 없으면 빈 회색 원이었습니다. 커뮤니티 카드에서
 * 사진 있는 사람 옆에 빈 원이 놓이면 "깨진 이미지"처럼 보이고, 사진 없는
 * 사람끼리는 전부 똑같아 구분이 안 됐습니다.
 *
 * - 색은 사용자 id 로 정합니다. 같은 사람은 어느 화면에서나 같은 색이고,
 *   다른 사람과는 대체로 다릅니다. 닉네임으로 정하지 않는 이유는, 이름을
 *   바꿀 때마다 색이 바뀌면 "같은 사람"이라는 단서가 사라지기 때문입니다.
 * - 가운데 글자는 닉네임 첫 글자입니다. 닉네임이 비어 있으면 사람 아이콘.
 * - 팔레트는 앱 톤(클레이·테라코타)에 맞춘 차분한 색 8개이고, 흰 글자를
 *   얹어도 읽히는 명도로 골랐습니다. 색을 무작위 hue 로 만들지 않는 이유는
 *   형광에 가까운 색이 나오면 카드 하나가 목록을 먹기 때문입니다
 *   (GrainCover 가 색조만 받는 것과 같은 이유).
 */

const PALETTE = [
  "#a0583a", // 테라코타
  "#8a6a3f", // 황토
  "#6f7a4b", // 올리브
  "#4f7a72", // 청록 회색
  "#5a6f8f", // 먹청
  "#7a5a86", // 자두
  "#8f5a6a", // 팥
  "#6b6158", // 흑갈
];

// FNV-1a — GrainCover 와 같은 해시
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 첫 글자(한글 한 음절, 영문은 대문자). 이모지처럼 두 칸짜리 글자도 안 깨지게 */
function initialOf(name: string) {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "";
}

interface DefaultAvatarProps {
  /** 색을 정하는 값. 사용자 id 를 넣으세요. */
  seed: string;
  /** 닉네임. 첫 글자를 가운데 씁니다. */
  name?: string;
  /** 크기 클래스. 예: "h-5 w-5 text-[10px]" */
  className?: string;
  /** 사람 아이콘 크기(글자가 없을 때) */
  iconSize?: number;
}

export default function DefaultAvatar({
  seed,
  name = "",
  className = "h-5 w-5 text-[10px]",
  iconSize = 12,
}: DefaultAvatarProps) {
  const color = PALETTE[hash(seed) % PALETTE.length];
  const initial = initialOf(name);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none text-white select-none ${className}`}
      style={{
        // 평평한 단색보다 위쪽이 살짝 밝은 편이 사진 자리처럼 보입니다.
        backgroundImage: `linear-gradient(160deg, ${color}cc 0%, ${color} 70%)`,
        backgroundColor: color,
      }}
    >
      {initial || <UserRound size={iconSize} strokeWidth={1.75} />}
    </span>
  );
}
