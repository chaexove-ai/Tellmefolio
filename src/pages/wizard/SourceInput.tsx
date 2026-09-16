import { useCallback, useEffect, useState } from "react";
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
  const { githubLogin } = useAuth();

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [repoUrl, setRepoUrl] = useState("");
  const [repoAdding, setRepoAdding] = useState(false);
  const [repoAddError, setRepoAddError] = useState<string | null>(null);

  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const [linkUrl, setLinkUrl] = useState("");
  const [links, setLinks] = useState<LinkSource[]>([]);
  const [note, setNote] = useState("");

  const [openPanel, setOpenPanel] = useState<QuickAddPanel>(null);
  const togglePanel = (panel: QuickAddPanel) =>
    setOpenPanel((prev) => (prev === panel ? null : panel));

  const loadRepos = useCallback(async () => {
    if (!githubLogin) return;
    setReposLoading(true);
    setReposError(null);
    try {
      const list = await fetchUserRepos(githubLogin);
      setRepos(list);
      // 처음 열 때는 최근 수정한 다섯 개만 켜둡니다. 저장소가 수십 개인
      // 사람이 전부 선택된 화면을 보면 하나씩 끄는 일부터 하게 됩니다.
      setSelected(new Set(list.slice(0, 5).map((r) => r.id)));
    } catch (e) {
      setReposError(
        e instanceof GitHubError ? e.message : "저장소 목록을 불러오지 못했습니다."
      );
    } finally {
      setReposLoading(false);
    }
  }, [githubLogin]);

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
  };

  const selectedRepos = repos.filter((r) => selected.has(r.id));
  const trayCount = selectedRepos.length + links.length + (note.trim() ? 1 : 0);
  const hasSelection = trayCount > 0;

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
    const chosen = selectedRepos;

    if (chosen.length === 0) {
      navigate("/wizard/draft", { state: { materials: [], note, links } });
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

      navigate("/wizard/draft", { state: { materials, note, links, failed } });
    } catch (e) {
      setCollectError(
        e instanceof GitHubError ? e.message : "자료를 모으는 중 문제가 생겼습니다."
      );
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/wizard" className="text-xs text-brand hover:underline">
          이전 단계로
        </Link>
        <h1 className="text-xl font-heading mt-2">원본 자료 입력</h1>
        <p className="text-sm text-neutral-400 mt-1">
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
            <span className="badge bg-brand/10 text-brand">{trayCount}개 반영 중</span>
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
              <p role="alert" className="text-sm text-brand">
                {reposError}
              </p>
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
            {repos.length > 0 && (
              <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
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
              className="field-area"
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-solid text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-100">
                <GitHubIcon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-neutral-100">{r.name}</p>
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-solid text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Link2 size={16} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-neutral-100">{l.meta}</p>
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-solid text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400">
                <StickyNote size={16} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-neutral-100">
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
              <p className="text-[13.5px] text-neutral-600">
                메모 없음 — "메모" 버튼으로 추가하면 여기 표시됩니다
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {trayCount > 0 && (
            <button className="btn-secondary" onClick={clearAll}>
              전체 해제
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
        선택 해제한 자료는 AI 초안 생성에 포함되지 않으며, 언제든지 다시 추가할 수
        있습니다.
      </p>
    </div>
  );
}
