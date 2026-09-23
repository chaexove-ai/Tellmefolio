/**
 * 프로필 — 커뮤니티에 "누가 올렸는지"를 붙이기 위한 최소한의 정보.
 *
 * [왜 별도 테이블인가]
 * auth.users 는 클라이언트에서 남의 행을 읽을 수 없습니다. 당연합니다,
 * 거기엔 이메일이 들어 있습니다. 커뮤니티에서 남의 닉네임을 보여주려면
 * "공개해도 되는 것만" 담은 테이블이 따로 있어야 합니다. profiles 에
 * 이메일을 넣지 않는 것이 이 설계의 전부입니다.
 *
 * [닉네임 기본값이 실명이라는 점]
 * 가입 시 소셜 로그인의 이름이 그대로 들어갑니다(마이그레이션의
 * handle_new_user 트리거). 편하지만, 구직용 서비스라 재직 중인
 * 사용자가 아무 설정 없이 커뮤니티에 올리면 실명이 노출됩니다.
 * 그래서 설정 화면에 "커뮤니티에 이 이름으로 표시됩니다"를 반드시
 * 같이 둡니다 — 그 문구가 이 기본값과 한 쌍입니다.
 */

import { getSupabase } from "./supabase";
import { PortfolioError } from "./portfolios";
import { shrinkImage } from "./images";

export const AVATAR_BUCKET = "avatars";

export interface Profile {
  id: string;
  nickname: string;
  avatarPath: string | null;
  /** 바로 <img src> 에 쓸 수 있는 주소. 사진이 없으면 null. */
  avatarUrl: string | null;
}

/** 닉네임이 비어 있을 때 화면에 쓸 이름. 빈 칸으로 두지 않습니다. */
export const FALLBACK_NICKNAME = "이름 없는 사용자";

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new PortfolioError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

interface ProfileRow {
  id: string;
  nickname: string | null;
  avatar_path: string | null;
}

function publicUrl(sb: Awaited<ReturnType<typeof requireClient>>, path: string | null) {
  if (!path) return null;
  return sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

function toProfile(
  sb: Awaited<ReturnType<typeof requireClient>>,
  row: ProfileRow
): Profile {
  return {
    id: row.id,
    nickname: row.nickname?.trim() ?? "",
    avatarPath: row.avatar_path,
    avatarUrl: publicUrl(sb, row.avatar_path),
  };
}

/**
 * 내 프로필. 없으면 만들어서 돌려줍니다.
 *
 * 가입 트리거가 만들어두기 때문에 보통은 이미 있습니다. 그래도 없는
 * 경우를 처리하는 이유는, 트리거가 생기기 전에 가입한 계정이나 트리거가
 * 어떤 이유로 실패한 계정에서 이 화면이 통째로 안 뜨는 것을 막기
 * 위해서입니다 — 프로필이 없다고 설정 화면이 깨지면 고칠 방법이 없습니다.
 */
export async function getMyProfile(userId: string): Promise<Profile> {
  const sb = await requireClient();

  const { data, error } = await sb
    .from("profiles")
    .select("id, nickname, avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new PortfolioError("프로필을 불러오지 못했습니다.");
  if (data) return toProfile(sb, data as ProfileRow);

  const { data: created, error: insertError } = await sb
    .from("profiles")
    .insert({ id: userId, nickname: "" })
    .select("id, nickname, avatar_path")
    .single();

  if (insertError || !created) {
    throw new PortfolioError("프로필을 만들지 못했습니다.");
  }
  return toProfile(sb, created as ProfileRow);
}

/** 닉네임 저장. 빈 문자열도 허용합니다 — 지우고 싶을 수 있습니다. */
export async function updateNickname(userId: string, nickname: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb
    .from("profiles")
    .update({ nickname: nickname.trim().slice(0, 40), updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new PortfolioError("닉네임을 저장하지 못했습니다.");
}

/**
 * 프로필 사진 업로드.
 *
 * 경로는 `${userId}/avatar.webp` 하나로 고정합니다. 매번 새 이름을 주면
 * 이전 파일이 Storage 에 계속 쌓입니다 — 표지 이미지에서 이미 겪었고,
 * 거기서는 올릴 때마다 옛 파일을 지우는 코드를 따로 두어야 했습니다.
 * 한 자리를 덮어쓰면 그 코드 자체가 필요 없습니다.
 *
 * 덮어써도 브라우저가 옛 사진을 계속 보여주는 문제가 남는데, 그건
 * 주소 뒤에 저장 시각을 붙여 피합니다(아래 avatarUrlWithStamp).
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ avatarPath: string; avatarUrl: string | null }> {
  const sb = await requireClient();

  // 아바타는 화면에서 40~80px 로 그려집니다. 표지 기준(1600px)을 그대로
  // 쓰면 프로필 사진 한 장이 표지만 한 용량으로 올라갑니다.
  const shrunk = await shrinkImage(file, { maxEdge: 512, skipUnderBytes: 40 * 1024 });

  const ext = shrunk.file.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg");
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(path, shrunk.file, { upsert: true, contentType: shrunk.file.type });

  if (uploadError) throw new PortfolioError("사진을 올리지 못했습니다.");

  // 확장자가 바뀌면 옛 파일이 남습니다(예: avatar.jpg → avatar.webp).
  // 같은 폴더에서 방금 올린 것 말고는 전부 지웁니다.
  try {
    const { data: files } = await sb.storage.from(AVATAR_BUCKET).list(userId);
    const stale = (files ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== path);
    if (stale.length > 0) await sb.storage.from(AVATAR_BUCKET).remove(stale);
  } catch {
    // 정리 실패는 업로드를 되돌릴 이유가 아닙니다. 남은 파일은
    // 계정 삭제 때 폴더째 지워집니다.
  }

  const { error } = await sb
    .from("profiles")
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new PortfolioError("사진 경로를 저장하지 못했습니다.");

  // 닉네임까지 담은 Profile 을 돌려주지 않습니다 — 여기서 닉네임을 읽지
  // 않으므로 빈 문자열이 들어가고, 호출부가 그걸 그대로 화면에 쓰면
  // 방금 저장한 이름이 사라진 것처럼 보입니다.
  return { avatarPath: path, avatarUrl: publicUrl(sb, path) };
}

/** 프로필 사진 제거. 파일과 경로를 같이 지웁니다. */
export async function removeAvatar(userId: string, path: string | null): Promise<void> {
  const sb = await requireClient();

  const { error } = await sb
    .from("profiles")
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new PortfolioError("사진을 지우지 못했습니다.");

  // 경로를 먼저 지운 뒤 파일을 지웁니다. 순서가 반대면, 파일 삭제가
  // 성공하고 경로 갱신이 실패했을 때 화면에 깨진 이미지가 남습니다.
  if (path) {
    try {
      await sb.storage.from(AVATAR_BUCKET).remove([path]);
    } catch {
      /* 위 주석대로 */
    }
  }
}

/**
 * 같은 주소를 덮어썼을 때 브라우저가 옛 사진을 계속 보여주는 것을 피합니다.
 * 저장 시각을 붙여 주소를 다르게 만듭니다.
 */
export function avatarUrlWithStamp(url: string | null, stamp: string | number): string | null {
  if (!url) return null;
  return `${url}?v=${encodeURIComponent(String(stamp))}`;
}

/**
 * 여러 사람의 프로필을 한 번에 읽습니다 — 커뮤니티 목록용.
 *
 * 목록에 60건이 뜨는데 한 건씩 조회하면 요청이 60번 갑니다. RLS 의 읽기
 * 정책이 전체 공개라 남의 닉네임도 이 한 번으로 옵니다.
 */
export async function getProfiles(userIds: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, Profile>();
  if (unique.length === 0) return map;

  const sb = await requireClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, nickname, avatar_path")
    .in("id", unique);

  // 작성자 이름을 못 읽었다고 목록 자체를 막지 않습니다 — 목록의 본체는
  // 포트폴리오이고, 이름은 곁들이는 정보입니다.
  if (error || !data) return map;

  for (const row of data as ProfileRow[]) {
    map.set(row.id, toProfile(sb, row));
  }
  return map;
}
