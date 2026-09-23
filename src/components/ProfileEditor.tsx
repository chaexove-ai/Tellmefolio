import { useEffect, useRef, useState } from "react";
import { LoaderCircle, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  avatarUrlWithStamp,
  getMyProfile,
  removeAvatar,
  updateNickname,
  uploadAvatar,
  FALLBACK_NICKNAME,
} from "../lib/profile";

/**
 * 닉네임과 프로필 사진 편집.
 *
 * [왜 계정 설정 맨 위인가]
 * 이 화면의 나머지는 "연결 상태", "데이터 삭제" 처럼 문제가 생겼을 때
 * 찾아오는 자리입니다. 닉네임은 반대로 커뮤니티에 올리기 전에 한 번
 * 보게 해야 하는 값이라, 들어오자마자 보이는 자리에 둡니다.
 *
 * [노출 문구를 왜 크게 적는가]
 * 닉네임 기본값이 소셜 로그인의 실명입니다. 구직용 서비스라 재직 중인
 * 사용자가 많고, 아무것도 안 만진 채 커뮤니티에 올리면 실명이 그대로
 * 목록에 뜹니다. 그걸 막는 단계를 하나 더 두는 대신(등록할 때마다 묻기),
 * 이 자리에서 한 번 분명히 알리는 쪽을 택했습니다. 그러면 문구가
 * 제 몫을 해야 합니다 — 회색 작은 글씨로 흘리면 안 됩니다.
 */
export default function ProfileEditor() {
  const { session, configured } = useAuth();
  const userId = session?.user?.id;

  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "name" | "photo">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!configured || !userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    getMyProfile(userId)
      .then((p) => {
        if (!alive) return;
        setNickname(p.nickname);
        setSavedNickname(p.nickname);
        setAvatarPath(p.avatarPath);
        setAvatarUrl(p.avatarUrl);
      })
      .catch(() => alive && setError("프로필을 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [configured, userId]);

  const saveName = async () => {
    if (!userId) return;
    setBusy("name");
    setError(null);
    setNotice(null);
    try {
      await updateNickname(userId, nickname);
      setSavedNickname(nickname.trim());
      setNotice("닉네임을 저장했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async (file: File) => {
    if (!userId) return;
    setBusy("photo");
    setError(null);
    setNotice(null);
    try {
      const next = await uploadAvatar(userId, file);
      setAvatarPath(next.avatarPath);
      // 경로가 고정이라 주소가 그대로입니다. 시각을 붙이지 않으면
      // 브라우저가 방금 올린 사진 대신 옛 사진을 계속 보여줍니다.
      setAvatarUrl(avatarUrlWithStamp(next.avatarUrl, Date.now()));
      setNotice("사진을 바꿨습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 올리지 못했습니다.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dropPhoto = async () => {
    if (!userId) return;
    setBusy("photo");
    setError(null);
    setNotice(null);
    try {
      await removeAvatar(userId, avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
      setNotice("사진을 지웠습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 지우지 못했습니다.");
    } finally {
      setBusy(null);
    }
  };

  if (!configured) return null;

  const shown = nickname.trim() || FALLBACK_NICKNAME;
  const nameChanged = nickname.trim() !== savedNickname;

  return (
    <div className="entry space-y-4">
      <h2 className="entry-title mb-0 inline-flex items-center gap-2">
        <UserRound size={16} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
        프로필
      </h2>

      {loading ? (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      ) : (
        <>
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover border border-neutral-800"
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-full border border-neutral-800 bg-neutral-900
                    flex items-center justify-center text-neutral-600"
                  aria-hidden="true"
                >
                  <UserRound size={24} strokeWidth={1.5} />
                </div>
              )}
              <div className="mt-2 flex flex-col items-center gap-1">
                <button
                  type="button"
                  className="text-xs text-brand hover:underline disabled:opacity-40"
                  disabled={busy !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  {busy === "photo" ? "올리는 중…" : avatarUrl ? "사진 바꾸기" : "사진 올리기"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-40"
                    disabled={busy !== null}
                    onClick={() => void dropPhoto()}
                  >
                    지우기
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickPhoto(f);
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <label htmlFor="nickname" className="block text-sm text-neutral-300 mb-1.5">
                닉네임
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="nickname"
                  className="field py-1.5 text-sm max-w-xs"
                  value={nickname}
                  maxLength={40}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameChanged) void saveName();
                  }}
                  placeholder={FALLBACK_NICKNAME}
                />
                <button
                  type="button"
                  className="btn-primary shrink-0 px-3 py-1.5 text-xs disabled:opacity-40 inline-flex items-center gap-1.5"
                  disabled={!nameChanged || busy !== null}
                  onClick={() => void saveName()}
                >
                  {busy === "name" && (
                    <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
                  )}
                  저장
                </button>
              </div>

              {/* 이 문구가 닉네임 기본값(소셜 실명)과 한 쌍입니다.
                  위 컴포넌트 주석 참고 — 작게 흘리면 안 되는 자리입니다. */}
              <p className="mt-3 text-sm text-neutral-300 border-l-2 border-l-brand pl-3 leading-relaxed">
                커뮤니티에 올린 포트폴리오에는{" "}
                <span className="text-neutral-100 font-medium">{shown}</span> 으로 표시됩니다.
                <span className="block text-xs text-neutral-500 mt-1">
                  재직 중이라면 실명 대신 다른 이름을 쓰는 편이 안전합니다. 커뮤니티에
                  올리지 않은 포트폴리오에는 이름이 붙지 않습니다.
                </span>
              </p>
            </div>
          </div>

          {notice && <p className="text-xs text-neutral-400">{notice}</p>}
          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
