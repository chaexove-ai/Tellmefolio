import { useCallback, useEffect, useState } from "react";
import { readSession, writeSession, WIZARD_SOURCE_KEY } from "../../lib/sessionState";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  Check,
  FileText,
  Inbox,
  Info,
  Link2,
  RefreshCw,
  Star,
  StickyNote,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { GitHubIcon } from "../../components/BrandIcons";
import {
  fetchMaterials,
  fetchRepo,
  fetchUserRepos,
  parseRepoInput,
  GitHubError,
  type GitHubRepo,
} from "../../lib/github";

/**
 * [2026-08-20] GitHub 저장소 목록을 실제 API 로 바꿨습니다.
 *
 * 이전에는 portfolio-2024 같은 가짜 항목이 박혀 있었습니다. 지금은 로그인한
 * 계정의 공개 저장소를 최근 수정순으로 가져옵니다.
 *
 * [공개 저장소만 다루는 이유]
 * 비공개까지 읽으려면 GitHub 의 `repo` 권한이 필요한데, 그건 비공개 코드에
 * 대한 읽기·쓰기 전권입니다. 포트폴리오 도구가 요구할 수준이 아니라서
 * 받지 않기로 했고, 대신 화면에서 그 이유를 밝힙니다. 안 보이는 이유를
 * 말해주지 않으면 사용자는 "내 저장소가 왜 없지"에서 멈춥니다.
 *
 * [2026-09 리디자인] "추가"와 "반영 범위 선택"으로 나뉘어 있던 목록을
 * 자료함 하나로 합쳤습니다. GitHub·웹 링크·메모는 각각 자료함 위 "빠른 추가"
 * 버튼으로 열리는 패널에서 넣고, 자료함에는 바로 체크된 채로 올라갑니다.
 * 저장소 체크박스를 껐다 켜는 것과 자료함 행의 제거 버튼은 같은 selected
 * 상태를 공유합니다 — 자료함에서 빼면 패널 목록에서도 자동으로 해제됩니다.
 *
 * PDF 업로드는 아직 실제로 동작하지 않아 "준비 중" 배지로 비활성화해뒀습니다.
 */

interface LinkSource {
  id: string;
  label: string;
  meta: string;
}

type QuickAddPanel = "github" | "link" | "memo" | null;

export default function SourceInput() {
  const navigate = useNavigate();
  const { githubLogin, signIn } = useAuth();

  // [09-26] 자료함을 탭 안에 임시 저장합니다. 다음 화면에서 "원본 자료 수정"으로
  // 돌아오거나 새로고침해도 고른 저장소·링크·메모가 그대로 있습니다.
  const [saved] = useState(() =>
    readSession<{ selectedRepos: GitHubRepo[]; excluded: string[]; links: LinkSource[]; note: string }>(WIZARD_SOURCE_KEY)
  );
  const [repos, setRepos] = useState<GitHubRepo[]>(saved?.selectedRepos ?? []);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  // [2026-09] GitHub OAuth 토큰은 Supabase 세션에 저장되지 않고 로그인
  // 직후 메모리에만 있다가 새로고침하면 사라집니다(AuthProvider.tsx
  // captureProviderToken 주석 참고). 토큰 없이 /user/repos 를 부르면
  // 401이 나는데, 이건 "다시 로그인"이 아니라 "GitHub 연결을 새로
  // 한 번 더"로 풀립니다 — 이미 로그인은 돼 있으니까요. 그래서 일반
  // reposError 와 구분해서 재연결 버튼을 따로 보여줍니다.
  const [reposAuthError, setReposAuthError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((saved?.selectedRepos ?? []).map((r) => r.id))
  );
  /**
   * [2026-09-23] 자료함에서 "이번 생성에 뺄 것".
   *
   * 자료함 행의 체크 표시가 <span> 이라 눌러도 아무 일이 없었습니다.
   * 체크박스처럼 생겼는데 동작하지 않는 것이고, 화면 아래 안내는
   * "선택 해제한 자료는 AI 초안 생성에 포함되지 않으며"라고 그 없는
   * 기능을 설명하고 있었습니다.
   *
   * 자료함에서 빼는 것(X)과는 다릅니다. X 는 목록에서 사라지고, 체크
   * 해제는 목록에 남은 채 이번 생성에만 빠집니다 — 안내 문구가 말하는
   * "언제든지 다시 추가할 수 있습니다"가 이 동작입니다.
   */
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(saved?.excluded ?? []));

  const isIncluded = (key: string) => !excluded.has(key);
  const toggleIncluded = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const [repoUrl, setRepoUrl] = useState("");
  const [repoAdding, setRepoAdding] = useState(false);
  const [repoAddError, setRepoAddError] = useState<string | null>(null);

  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const [linkUrl, setLinkUrl] = useState("");
  const [links, setLinks] = useState<LinkSource[]>(saved?.links ?? []);
  const [note, setNote] = useState(saved?.note ?? "");

  useEffect(() => {
    writeSession(WIZARD_SOURCE_KEY, {
      selectedRepos: repos.filter((r) => selected.has(r.id)),
      excluded: [...excluded],
      links,
      note,
    });
  }, [repos, selected, excluded, links, note]);

  const [openPanel, setOpenPanel] = useState<QuickAddPanel>(null);
  const togglePanel = (panel: QuickAddPanel) =>
    setOpenPanel((prev) => (prev === panel ? null : panel));

  const loadRepos = useCallback(async () => {
    if (!githubLogin) return;
    setReposLoading(true);
    setReposError(null);
    setReposAuthError(false);
    try {
      const list = await fetchUserRepos(githubLogin);
      const kept = saved?.selectedRepos ?? [];
      if (kept.length > 0) {
        // 돌아온 경우: 전에 고른 것을 그대로(주소로 따로 담은 저장소도 잃지 않게 합칩니다)
        setRepos([...kept.filter((k) => !list.some((r) => r.id === k.id)), ...list]);
        setSelected(new Set(kept.map((r) => r.id)));
      } else {
        setRepos(list);
        // 처음 열 때는 최근 수정한 다섯 개만 켜둡니다. 저장소가 수십 개인
        // 사람이 전부 선택된 화면을 보면 하나씩 끄는 일부터 하게 됩니다.
        setSelected(new Set(list.slice(0, 5).map((r) => r.id)));
      }
    } catch (e) {
      if (e instanceof GitHubError && e.status === 401) {
        setReposAuthError(true);
        setReposError("GitHub 연결이 끊어졌어요. 새로고침하면 토큰이 사라지는 구조라 다시 연결해야 합니다.");
      } else {
        setReposError(
          e instanceof GitHubError ? e.message : "저장소 목록을 불러오지 못했습니다."
        );
      }
    } finally {
      setReposLoading(false);
    }
  }, [githubLogin]);

  /** "GitHub 다시 연결" 버튼. 이미 로그인은 돼 있는 상태에서 provider
   *  토큰만 새로 받아오는 거라 signIn 을 한 번 더 호출하는 것만으로
   *  충분합니다 — GitHub 쪽에서 이미 이 앱을 승인해둔 계정이면 동의
   *  화면 없이 바로 돌아옵니다. 돌아오면 AuthProvider 가 새 토큰을
   *  잡아서 loadRepos 가 자동으로 다시 돕니다(githubLogin 의존성). */
  const reconnectGitHub = async () => {
    setReconnecting(true);
    try {
      await signIn("github");
    } catch {
      setReposError("GitHub 재연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setReconnecting(false);
    }
  };

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addRepo = async () => {
    const parsed = parseRepoInput(repoUrl);
    if (!parsed) {
      setRepoAddError("주소 형식을 확인해 주세요. 예: https://github.com/사용자/저장소");
      return;
    }

    setRepoAdding(true);
    setRepoAddError(null);
    try {
      const repo = await fetchRepo(parsed.owner, parsed.name);
      setRepos((prev) => (prev.some((r) => r.id === repo.id) ? prev : [repo, ...prev]));
      setSelected((prev) => new Set(prev).add(repo.id));
      setRepoUrl("");
    } catch (e) {
      setRepoAddError(e instanceof GitHubError ? e.message : "저장소를 불러오지 못했습니다.");
    } finally {
      setRepoAdding(false);
    }
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    setLinks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "웹 링크", meta: linkUrl.trim() },
    ]);
    setLinkUrl("");
  };

  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));

  const clearAll = () => {
    setSelected(new Set());
    setLinks([]);
    setNote("");
    // 체크 해제 기록도 같이 지웁니다. 안 그러면 나중에 같은 저장소를
    // 다시 담았을 때 예전 해제 상태를 물려받아, 담았는데 생성에는 안
    // 들어가는 상태가 됩니다.
    setExcluded(new Set());
  };

  const selectedRepos = repos.filter((r) => selected.has(r.id));
  const trayCount = selectedRepos.length + links.length + (note.trim() ? 1 : 0);

  // 생성에 실제로 들어가는 것만 셉니다. 전부 체크 해제해놓고 "다음"이
  // 눌리면, 자료 없이 초안을 만들라고 보내는 꼴입니다.
  const includedRepos = selectedRepos.filter((r) => isIncluded(`repo:${r.id}`));
  const includedLinks = links.filter((l) => isIncluded(`link:${l.id}`));
  const includedNote = note.trim() && isIncluded("note") ? note : "";
  const includedCount = includedRepos.length + includedLinks.length + (includedNote ? 1 : 0);
  const hasSelection = includedCount > 0;

  /**
   * 다음 단계로 넘어가기 전에 선택한 저장소의 README 와 언어 구성을 모읍니다.
   *
   * 여기서 모으는 이유는, 저장소 목록만으로는 AI 에 넘길 내용이 없기 때문입니다.
   * 이름과 언어 한 줄로는 포트폴리오 문장이 나오지 않습니다.
   *
   * 일부가 실패해도 진행합니다. 다섯 개 중 하나가 막혔다고 전체를 되돌리면
   * 사용자는 뭘 고쳐야 할지 알 수 없습니다. 어느 저장소가 빠졌는지만 알립니다.
   */
  const startDraft = async () => {
    const chosen = includedRepos;

    if (chosen.length === 0) {
      navigate("/wizard/draft", {
        state: { materials: [], note: includedNote, links: includedLinks },
      });
      return;
    }

    setCollecting(true);
    setCollectError(null);

    try {
      const { materials, failed } = await fetchMaterials(chosen);

      if (materials.length === 0) {
        setCollectError(
          "선택한 저장소의 내용을 읽지 못했습니다. 잠시 후 다시 시도하거나 메모 칸을 이용해 주세요."
        );
        return;
      }

      navigate("/wizard/draft", { state: { materials, note: includedNote, links: includedLinks, failed } });
    } catch (e) {
      setCollectError(
        e instanceof GitHubError ? e.message : "자료를 모으는 중 문제가 생겼습니다."
      );
    } finally {
      setCollecting(false);
    }
  };

  return (
    // [2026-09] 폭을 절충했습니다. 칸(카드·목록)은 남는 가로를 쓰고,
    // 읽는 글만 60~62ch 로 묶습니다. 전부 넓히면 설명 한 줄이 100자에
    // 가까워져 눈이 줄 앞으로 되돌아오는 거리가 길어지고, 전부 좁히면
    // 저장소 목록이 한 줄짜리 항목으로 길게 내려갑니다.
    <div className="space-y-6">
      <div>
        <Link to="/library" className="text-xs text-brand hover:underline">
          ← 홈
        </Link>
        <h1 className="text-xl font-heading mt-2">원본 자료 입력</h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-[62ch]">
          포트폴리오 생성에 사용할 원본 자료를 자료함에 모으세요. 여러 형식의 자료를
          함께 추가할 수 있습니다.
        </p>
      </div>

      <div className="entry">
        <div className="entry-title flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Inbox size={18} strokeWidth={1.75} />
            자료함
          </span>
          {trayCount > 0 && (
            <span className="badge bg-brand/10 text-brand">
              {includedCount}개 반영 중
              {includedCount < trayCount && (
                <span className="text-brand/60"> · {trayCount - includedCount}개 뺌</span>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => togglePanel("github")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-all ${
              openPanel === "github"
                ? "border-brand text-brand"
                : "border-dashed border-neutral-700 text-neutral-300 hover:border-brand hover:text-brand"
            }`}
          >
            <GitHubIcon size={15} />
            GitHub 리포
          </button>
          <button
            type="button"
            onClick={() => togglePanel("link")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-all ${
              openPanel === "link"
                ? "border-brand text-brand"
                : "border-dashed border-neutral-700 text-neutral-300 hover:border-brand hover:text-brand"
            }`}
          >
            <Link2 size={15} strokeWidth={1.75} />
            웹 링크
          </button>
          <button
            type="button"
            onClick={() => togglePanel("memo")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-all ${
              openPanel === "memo"
                ? "border-brand text-brand"
                : "border-dashed border-neutral-700 text-neutral-300 hover:border-brand hover:text-brand"
            }`}
          >
            <StickyNote size={15} strokeWidth={1.75} />
            메모
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3.5 py-2 text-sm text-neutral-600 cursor-not-allowed"
          >
            <FileText size={15} strokeWidth={1.75} />
            PDF · 준비 중
          </button>
        </div>

        {openPanel === "github" && (
          <div className="mb-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
            <p className="text-xs text-neutral-500 flex items-start gap-1.5">
              <Info size={13} strokeWidth={1.5} className="text-brand shrink-0 mt-0.5" />
              <span>
                공개 저장소만 불러옵니다. 비공개 저장소를 읽으려면 코드 전체에 대한
                권한이 필요해서 요청하지 않습니다. 비공개 프로젝트는 메모에 직접
                설명을 적어주시면 함께 반영됩니다.
              </span>
            </p>

            <div className="flex gap-2 items-end">
              <input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addRepo();
                }}
                placeholder="GitHub 리포지토리 URL (예: https://github.com/username/repo)"
                className="field flex-1"
              />
              <button
                className="btn-secondary"
                onClick={() => void addRepo()}
                disabled={repoAdding}
              >
                {repoAdding ? "확인 중" : "연결"}
              </button>
            </div>
            {repoAddError && (
              <p role="alert" className="text-xs text-brand">
                {repoAddError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-neutral-500">내 공개 저장소</p>
              {githubLogin && (
                <button
                  type="button"
                  onClick={() => void loadRepos()}
                  disabled={reposLoading}
                  className="text-xs text-brand hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw size={12} strokeWidth={1.5} />
                  새로 고침
                </button>
              )}
            </div>

            {reposLoading && <p className="text-sm text-neutral-500">저장소를 불러오는 중입니다.</p>}
            {reposError && (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-brand">
                  {reposError}
                </p>
                {reposAuthError && (
                  <button
                    type="button"
                    onClick={() => void reconnectGitHub()}
                    disabled={reconnecting}
                    className="btn-secondary disabled:opacity-40"
                  >
                    {reconnecting ? "연결하는 중" : "GitHub 다시 연결"}
                  </button>
                )}
              </div>
            )}
            {!reposLoading && !reposError && !githubLogin && (
              <p className="text-sm text-neutral-500">
                GitHub 계정으로 로그인하면 공개 저장소를 자동으로 불러옵니다. 위에
                주소를 직접 넣으셔도 됩니다.
              </p>
            )}
            {!reposLoading && !reposError && githubLogin && repos.length === 0 && (
              <p className="text-sm text-neutral-500">
                공개 저장소가 없습니다. 위에 주소를 직접 넣거나 메모를 이용해 주세요.
              </p>
            )}
            {/* 폭이 넓어진 만큼 목록을 2열로 흘립니다 — 저장소 이름은 짧아서
                한 줄을 통째로 쓸 이유가 없고, 열이 둘이면 같은 높이에 두 배가
                보입니다. */}
            {repos.length > 0 && (
              <ul className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-1.5 text-sm max-h-56 overflow-y-auto">
                {repos.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="accent-brand"
                      id={`repo-${r.id}`}
                    />
                    <label htmlFor={`repo-${r.id}`} className="text-neutral-200 cursor-pointer">
                      {r.name}
                    </label>
                    {r.language && <span className="text-xs text-neutral-500">{r.language}</span>}
                    {r.stars > 0 && (
                      <span className="text-xs text-neutral-500 inline-flex items-center gap-0.5">
                        <Star size={11} strokeWidth={1.5} />
                        {r.stars}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {openPanel === "link" && (
          <div className="mb-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
            <div className="flex gap-2 items-end">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLink();
                }}
                placeholder="참고할 웹 페이지 URL을 입력하세요"
                className="field flex-1"
              />
              <button className="btn-secondary" onClick={addLink}>
                추가
              </button>
            </div>
          </div>
        )}

        {openPanel === "memo" && (
          <div className="mb-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="경력 사항, 프로젝트 설명, 성과 등을 자유롭게 작성하세요"
              rows={4}
              className="field-area max-w-[80ch]"
            />
            <p className="text-xs text-neutral-600">
              작성한 내용은 AI 초안 생성의 기초 자료로 활용됩니다. 비공개 저장소의
              프로젝트도 여기에 적어주시면 됩니다.
            </p>
          </div>
        )}

        <div className="flex flex-col">
          {selectedRepos.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-t border-neutral-800 py-3 first:border-t-0 first:pt-0">
              <button
                type="button"
                onClick={() => toggleIncluded(`repo:${r.id}`)}
                aria-pressed={isIncluded(`repo:${r.id}`)}
                aria-label={`${r.name} 이번 생성에서 ${isIncluded(`repo:${r.id}`) ? "빼기" : "넣기"}`}
                title={isIncluded(`repo:${r.id}`) ? "이번 생성에 포함됩니다 — 누르면 뺍니다" : "이번 생성에서 빠져 있습니다 — 누르면 넣습니다"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isIncluded(`repo:${r.id}`)
                    ? "bg-brand-solid border-brand-solid text-white"
                    : "border-neutral-700 text-transparent hover:border-neutral-500"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-100">
                <GitHubIcon size={16} />
              </span>
              <div className={`min-w-0 flex-1 transition-opacity ${isIncluded(`repo:${r.id}`) ? "" : "opacity-40"}`}>
                <p className="truncate text-xs text-neutral-100">{r.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span className="badge bg-neutral-800 text-neutral-400">README</span>
                  {r.language && <span>{r.language}</span>}
                  {r.stars > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star size={11} strokeWidth={1.5} />
                      {r.stars}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300"
                aria-label={`${r.name} 자료함에서 빼기`}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-t border-neutral-800 py-3 first:border-t-0 first:pt-0">
              <button
                type="button"
                onClick={() => toggleIncluded(`link:${l.id}`)}
                aria-pressed={isIncluded(`link:${l.id}`)}
                aria-label={`${l.meta} 이번 생성에서 ${isIncluded(`link:${l.id}`) ? "빼기" : "넣기"}`}
                title={isIncluded(`link:${l.id}`) ? "이번 생성에 포함됩니다 — 누르면 뺍니다" : "이번 생성에서 빠져 있습니다 — 누르면 넣습니다"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isIncluded(`link:${l.id}`)
                    ? "bg-brand-solid border-brand-solid text-white"
                    : "border-neutral-700 text-transparent hover:border-neutral-500"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Link2 size={16} strokeWidth={1.75} />
              </span>
              <div className={`min-w-0 flex-1 transition-opacity ${isIncluded(`link:${l.id}`) ? "" : "opacity-40"}`}>
                <p className="truncate text-xs text-neutral-100">{l.meta}</p>
                <div className="mt-1">
                  <span className="badge bg-brand/10 text-brand">웹</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLink(l.id)}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300"
                aria-label="링크 자료함에서 빼기"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {note.trim() ? (
            <div className="flex items-center gap-3 border-t border-neutral-800 py-3 first:border-t-0 first:pt-0">
              <button
                type="button"
                onClick={() => toggleIncluded("note")}
                aria-pressed={isIncluded("note")}
                aria-label={`${"메모"} 이번 생성에서 ${isIncluded("note") ? "빼기" : "넣기"}`}
                title={isIncluded("note") ? "이번 생성에 포함됩니다 — 누르면 뺍니다" : "이번 생성에서 빠져 있습니다 — 누르면 넣습니다"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isIncluded("note")
                    ? "bg-brand-solid border-brand-solid text-white"
                    : "border-neutral-700 text-transparent hover:border-neutral-500"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400">
                <StickyNote size={16} strokeWidth={1.75} />
              </span>
              <div className={`min-w-0 flex-1 transition-opacity ${isIncluded("note") ? "" : "opacity-40"}`}>
                <p className="truncate text-xs text-neutral-100">
                  {note.trim().slice(0, 40)}
                  {note.trim().length > 40 ? "…" : ""}
                </p>
                <div className="mt-1">
                  <span className="badge bg-neutral-800 text-neutral-400">메모</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNote("")}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-800 hover:text-neutral-300"
                aria-label="메모 자료함에서 빼기"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-t border-neutral-800 py-3 first:border-t-0 first:pt-0">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-600">
                <StickyNote size={16} strokeWidth={1.75} />
              </span>
              <p className="text-xs text-neutral-600">
                메모 없음 — "메모" 버튼으로 추가하면 여기 표시됩니다
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {trayCount > 0 && (
            <button className="btn-secondary" onClick={clearAll}>
              자료함 비우기
            </button>
          )}
          <button
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            disabled={!hasSelection || collecting}
            onClick={() => void startDraft()}
          >
            {collecting ? (
              "자료를 읽는 중"
            ) : (
              <>
                다음: 생성 설정
                <ArrowRight size={15} strokeWidth={1.75} />
              </>
            )}
          </button>
        </div>
        {collecting && (
          <p className="text-xs text-neutral-500 mt-2 text-right">
            선택한 저장소의 README와 언어 구성을 가져오고 있습니다.
          </p>
        )}
        {collectError && (
          <p role="alert" className="text-xs text-brand mt-2 text-right">
            {collectError}
          </p>
        )}
      </div>

      <p className="text-xs text-neutral-600 flex items-start gap-1.5">
        <Ban size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" />
        체크를 끈 자료는 이번 초안 생성에 들어가지 않습니다. 자료함에는 그대로
        남아 있어서 다시 켜면 됩니다. X 를 누르면 자료함에서 아예 빠집니다.
      </p>
    </div>
  );
}
