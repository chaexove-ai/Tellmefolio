import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Lock, SlidersHorizontal, Upload } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import {
  listMyPortfolios,
  listPublicPortfolios,
  updatePortfolioListed,
  updatePortfolioVisibility,
  PortfolioError,
} from "../../lib/portfolios";
import type { LibraryPortfolio } from "../../lib/portfolios";
import Reveal from "../../components/Reveal";
import GrainCover from "../../components/GrainCover";
import DefaultAvatar from "../../components/DefaultAvatar";
import { getProfiles, getMyProfile, FALLBACK_NICKNAME } from "../../lib/profile";
import type { Profile } from "../../lib/profile";

/**
 * [2026-09-22] 실제 공개 포트폴리오를 읽습니다.
 *
 * 전에는 mockData.galleryItems("김지수", "박민준" …)를 그렸습니다. 없는
 * 사람의 없는 포트폴리오였고, 눌러도 아무것도 없었습니다.
 *
 * 목록 조건은 visibility='public' 이고 listed=true 인 것 전부입니다 —
 * user_id 조건은 없습니다. 내 것만 보이는 구조가 아니라, 누가 올렸든
 * 최근 수정순으로 섞입니다. 링크만 공유한 사람은 여기 나오지 않습니다.
 *
 * [여기서 바로 올립니다]
 * 올리는 기능이 내보내기 화면에만 있으면, 커뮤니티를 보다가 "나도 올려야지"
 * 한 사람이 내보내기까지 찾아 들어가야 합니다. 이 화면에서 바로 고르게
 * 합니다. 내보내기 쪽 체크박스는 그대로 둡니다 — 거기는 "만들기를 끝내고
 * 공유하는" 맥락이라 둘 다 자기 자리가 있습니다.
 *
 * [작성자 — 2026-09-23]
 * 이제 작성자를 표시합니다. profiles 테이블이 생겼고, 거기 닉네임은
 * 본인이 설정에서 바꿀 수 있습니다. 그전에는 "컬럼이 없고, 본인이 실명을
 * 넣겠다고 한 적 없는데 띄울 이유가 없다"고 적어뒀었는데, 앞쪽은
 * 해결됐고 뒤쪽은 설정 화면의 안내 문구와 아래 올리기 창의 안내로
 * 다룹니다 — 올리기 직전에 어떤 이름으로 뜨는지 보여줍니다.
 *
 * 프로필은 목록을 받은 뒤 한 번에 읽습니다. 60건을 한 건씩 조회하면
 * 요청이 60번 갑니다.
 *
 * [빠진 필터]
 * '구성 방식' 필터를 뺐습니다. 그런 컬럼이 없어서 골라도 아무것도 걸러지지
 * 않던 칸입니다.
 */
export default function Gallery() {
  const { session, configured } = useAuth();
  const userId = session?.user?.id;

  const [items, setItems] = useState<LibraryPortfolio[] | null>(null);
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());
  const [loadError, setLoadError] = useState(false);

  const [job, setJob] = useState("전체 직무");
  const [year, setYear] = useState("전체 연도");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    listPublicPortfolios()
      .then((rows) => {
        setItems(rows);
        // 작성자 이름은 목록이 뜬 뒤에 붙습니다. 여기서 기다리면
        // 프로필 조회가 느릴 때 목록 전체가 같이 늦어집니다.
        void getProfiles(rows.map((r) => r.userId)).then(setAuthors);
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  const jobs = useMemo(
    () => ["전체 직무", ...Array.from(new Set((items ?? []).map((g) => g.job)))],
    [items]
  );
  const years = useMemo(
    () => ["전체 연도", ...Array.from(new Set((items ?? []).map((g) => g.year)))],
    [items]
  );

  const filtered = (items ?? []).filter(
    (g) =>
      (job === "전체 직무" || g.job === job) &&
      (year === "전체 연도" || g.year === year)
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading">커뮤니티</h1>
          <p className="text-xs text-neutral-500 mt-1">
            작성자가 직접 올린 포트폴리오입니다. 열람만 가능하며, 내용을 복제하거나
            자신의 포트폴리오로 가져올 수 없습니다.
          </p>
        </div>
        {configured && userId && (
          <button
            className="btn-secondary shrink-0 inline-flex items-center gap-1.5"
            onClick={() => setPickerOpen(true)}
          >
            <Upload size={14} aria-hidden="true" />
            올리기
          </button>
        )}
      </div>

      {notice && (
        <p className="entry py-3 text-sm text-neutral-200 border-l-2 border-l-brand">
          {notice}
        </p>
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-neutral-300">
          <SlidersHorizontal size={15} className="text-neutral-600 shrink-0" />
          <select className="field w-auto py-2" value={job} onChange={(e) => setJob(e.target.value)}>
            {jobs.map((j) => (
              <option key={j} className="bg-neutral-900">{j}</option>
            ))}
          </select>
          <select className="field w-auto py-2" value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} className="bg-neutral-900">{y}</option>
            ))}
          </select>
        </div>
      )}

      {items === null && !loadError && <p className="text-sm text-neutral-500">불러오는 중…</p>}
      {loadError && <p className="text-sm text-red-400">목록을 불러오지 못했습니다.</p>}

      {items !== null && items.length === 0 && (
        <div className="entry p-8 text-center">
          <p className="text-sm text-neutral-300">아직 올라온 포트폴리오가 없습니다.</p>
          <p className="text-xs text-neutral-500 mt-2">
            위 "올리기"에서 내 포트폴리오를 골라 처음으로 올려보세요.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((g, i) => (
            <Reveal key={g.id} delay={(i % 3) * 0.08}>
              {/* 공개 열람 페이지로 바로 보냅니다 — 방문자가 보는 화면과
                  같은 것을 보여주는 편이 정직하고, 화면도 하나면 됩니다. */}
              <Link
                to={`/p/${g.id}`}
                className="entry p-4 block hover:border-brand/40 hover:-translate-y-0.5 transition-all"
              >
                {/* seed 가 id 라 같은 포트폴리오는 항상 같은 그림이고,
                    색조는 그 포트폴리오의 직무 색을 따릅니다 — 목록에서
                    직무가 색으로 읽힙니다. */}
                <GrainCover seed={g.id} tint={g.jobColor} className="aspect-[4/3] rounded-xl mb-3" />
                <p className="font-medium text-neutral-100">{g.title}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {g.job} · {g.year}
                </p>
                <Author profile={authors.get(g.userId)} />
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {items !== null && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-neutral-500">조건에 맞는 포트폴리오가 없습니다.</p>
      )}

      {pickerOpen && userId && (
        <UploadPicker
          userId={userId}
          onClose={() => setPickerOpen(false)}
          onDone={(message) => {
            setPickerOpen(false);
            setNotice(message);
            setItems(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * 카드 맨 아래 작성자 줄.
 *
 * 프로필을 아직 못 읽었을 때(로딩 중이거나 조회 실패) 자리를 비워두지
 * 않고 같은 높이의 빈 줄을 둡니다 — 이름이 뒤늦게 붙으면서 카드 높이가
 * 변하면 그리드 전체가 한 번 출렁입니다.
 */
function Author({ profile }: { profile?: Profile }) {
  const name = profile?.nickname?.trim() || (profile ? FALLBACK_NICKNAME : "");
  return (
    <div className="mt-3 pt-3 border-t border-neutral-800/70 flex items-center gap-2 h-[30px]">
      {profile?.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
      ) : (
        // [2026-09-25] 사진이 없으면 빈 회색 원 대신 임시 아바타(DefaultAvatar).
        profile && (
          <DefaultAvatar seed={profile.id} name={profile.nickname} className="h-5 w-5 text-[10px]" />
        )
      )}
      <span className="text-xs text-neutral-400 truncate">{name}</span>
    </div>
  );
}

/**
 * 내 포트폴리오를 골라 커뮤니티에 올리고 내리는 창.
 *
 * 체크 상태는 "올릴 것"이고, 저장을 눌러야 반영됩니다 — 체크하자마자
 * 올라가면 잘못 누른 것을 되돌릴 방법이 없습니다.
 *
 * **비공개인 것을 고르면 공개로 함께 전환됩니다.** 커뮤니티 노출은
 * 링크 공개를 전제로 하기 때문인데(RLS 가 비공개 행을 아예 막습니다),
 * 사용자가 모르고 누를 일이 아니라 목록에서 그 행마다 표시하고 창 아래에도
 * 한 번 더 적습니다.
 */
function UploadPicker({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mine, setMine] = useState<LibraryPortfolio[] | null>(null);
  // 올리기 직전에 "어떤 이름으로 뜨는지"를 보여주기 위해 읽습니다.
  // 닉네임 기본값이 소셜 로그인의 실명이라, 재직 중인 사용자가 모르고
  // 실명으로 올리는 것을 막는 마지막 자리입니다.
  const [me, setMe] = useState<Profile | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listMyPortfolios(userId)
      .then((rows) => {
        if (!alive) return;
        setMine(rows);
        setChecked(new Set(rows.filter((r) => r.listed).map((r) => r.id)));
      })
      .catch(() => alive && setError("목록을 불러오지 못했습니다."));
    // 이름을 못 읽어도 올리기 자체는 막지 않습니다 — 아래 안내만 빠집니다.
    void getMyProfile(userId)
      .then((p) => alive && setMe(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = mine ?? [];
  const toAdd = rows.filter((r) => !r.listed && checked.has(r.id));
  const toRemove = rows.filter((r) => r.listed && !checked.has(r.id));
  const willGoPublic = toAdd.filter((r) => r.visibility === "비공개");
  const changed = toAdd.length + toRemove.length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const r of toAdd) {
        // 순서가 중요합니다 — 공개로 먼저 바꿔야 목록에 올렸을 때
        // 곧바로 열립니다. 반대면 잠깐 "목록엔 있는데 안 열리는" 상태가
        // 생깁니다.
        if (r.visibility === "비공개") {
          await updatePortfolioVisibility(r.id, "public");
        }
        await updatePortfolioListed(r.id, true);
      }
      for (const r of toRemove) {
        // 내릴 때는 공개까지 함께 닫지 않습니다. 링크를 이미 남에게
        // 보냈을 수 있어서, 목록에서 내리는 것과 링크를 끊는 것은
        // 서로 다른 결정입니다.
        await updatePortfolioListed(r.id, false);
      }

      const parts: string[] = [];
      if (toAdd.length) parts.push(`${toAdd.length}건을 올렸습니다`);
      if (toRemove.length) parts.push(`${toRemove.length}건을 내렸습니다`);
      onDone(parts.join(" · ") || "변경사항이 없습니다.");
    } catch (e) {
      setError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
      <div className="surface w-full max-w-lg">
        <h2 className="entry-title mb-1">커뮤니티에 올리기</h2>
        <p className="text-xs text-neutral-500 mb-4">
          올릴 포트폴리오를 고르세요. 체크를 풀면 커뮤니티에서 내려갑니다.
        </p>

        {mine === null && !error && <p className="text-sm text-neutral-500">불러오는 중…</p>}

        {mine !== null && rows.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-400">아직 만든 포트폴리오가 없습니다.</p>
            <Link to="/wizard" className="btn-secondary inline-flex mt-4">
              포트폴리오 만들기
            </Link>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
            {rows.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2.5 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="accent-brand shrink-0"
                  />
                  <span
                    aria-hidden="true"
                    className="w-[9px] h-[9px] rounded-[2px] shrink-0"
                    style={{ backgroundColor: p.jobColor }}
                  />
                  <span className="text-sm text-neutral-200 truncate flex-1 min-w-0">
                    {p.title}
                  </span>
                  <span className="text-xs text-neutral-600 shrink-0">{p.job}</span>
                  <span
                    className="text-xs shrink-0 inline-flex items-center gap-1 text-neutral-500"
                    title={p.visibility === "공개" ? "링크로 공개 중" : "비공개 — 올리면 공개로 바뀝니다"}
                  >
                    {p.visibility === "공개" ? (
                      <Globe size={11} aria-hidden="true" />
                    ) : (
                      <Lock size={11} aria-hidden="true" />
                    )}
                    {p.visibility}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && me && (
          <p className="text-xs text-neutral-400 mt-3 border-l-2 border-l-neutral-700 pl-3">
            커뮤니티에는{" "}
            <span className="text-neutral-200">
              {me.nickname.trim() || FALLBACK_NICKNAME}
            </span>{" "}
            으로 표시됩니다.{" "}
            <Link to="/settings" className="text-brand hover:underline">
              이름 바꾸기
            </Link>
          </p>
        )}

        {willGoPublic.length > 0 && (
          <p className="text-xs text-neutral-400 mt-3 border-l-2 border-l-brand pl-3">
            비공개 {willGoPublic.length}건이 함께 공개로 바뀝니다 — 커뮤니티에
            올리려면 링크가 열려 있어야 합니다. 재직 중이라면 회사 사람도 볼 수
            있다는 뜻입니다.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400 mt-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            onClick={() => void save()}
            disabled={saving || changed === 0}
          >
            {saving ? "저장 중…" : changed > 0 ? `저장 (${changed}건)` : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
