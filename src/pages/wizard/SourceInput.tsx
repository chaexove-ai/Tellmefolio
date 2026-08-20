import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info, RefreshCw, Star } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
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
 * PDF 업로드와 링크는 아직 목업입니다.
 */

interface LinkSource {
  id: string;
  label: string;
  meta: string;
}

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

  const hasSelection = selected.size > 0 || links.length > 0 || note.trim().length > 0;

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
    const chosen = repos.filter((r) => selected.has(r.id));

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
          포트폴리오 생성에 사용할 원본 자료를 등록하세요. 여러 형식의 자료를 함께
          추가할 수 있습니다.
        </p>
      </div>

      <div className="entry">
        <div className="flex items-center justify-between">
          <h2 className="entry-title">GitHub 리포지토리</h2>
          {githubLogin && (
            <button
              type="button"
              onClick={() => void loadRepos()}
              disabled={reposLoading}
              className="text-xs text-brand hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              새로 고침
            </button>
          )}
        </div>

        <p className="text-xs text-neutral-500 flex items-start gap-1.5 mb-3">
          <Info size={13} strokeWidth={1.5} className="text-brand shrink-0 mt-0.5" />
          <span>
            공개 저장소만 불러옵니다. 비공개 저장소를 읽으려면 코드 전체에 대한 권한이
            필요해서, 요청하지 않습니다. 비공개 프로젝트는 아래 메모 칸에 직접 설명을
            적어주시면 함께 반영됩니다.
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
          <button className="btn-secondary" onClick={() => void addRepo()} disabled={repoAdding}>
            {repoAdding ? "확인 중" : "리포지토리 연결"}
          </button>
        </div>
        {repoAddError && (
          <p role="alert" className="text-xs text-brand mt-2">
            {repoAddError}
          </p>
        )}
      </div>

      <div className="entry">
        <h2 className="entry-title">PDF 문서 업로드</h2>
        <div className="border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-400">
          PDF 파일을 끌어다 놓거나 클릭해서 선택하세요
          <p className="text-xs text-neutral-600 mt-1">최대 20MB · PDF 형식 지원</p>
          <button className="btn-secondary mt-3">파일 선택</button>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">웹 링크</h2>
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
            링크 추가
          </button>
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">직접 작성 메모</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="경력 사항, 프로젝트 설명, 성과 등을 자유롭게 작성하세요"
          rows={4}
          className="field-area"
        />
        <p className="text-xs text-neutral-600 mt-1">
          작성한 내용은 AI 초안 생성의 기초 자료로 활용됩니다. 비공개 저장소의 프로젝트도
          여기에 적어주시면 됩니다.
        </p>
      </div>

      <div className="entry">
        <h2 className="entry-title">포트폴리오 반영 범위</h2>
        <p className="text-xs text-neutral-500 mb-3">AI 초안 생성에 반영할 자료를 선택하세요</p>

        {reposLoading && <p className="text-sm text-neutral-500">저장소를 불러오는 중입니다.</p>}

        {reposError && (
          <p role="alert" className="text-sm text-brand">
            {reposError}
          </p>
        )}

        {!reposLoading && !reposError && !githubLogin && (
          <p className="text-sm text-neutral-500">
            GitHub 계정으로 로그인하면 공개 저장소를 자동으로 불러옵니다. 위에 주소를
            직접 넣으셔도 됩니다.
          </p>
        )}

        {!reposLoading && !reposError && githubLogin && repos.length === 0 && (
          <p className="text-sm text-neutral-500">
            공개 저장소가 없습니다. 위에 주소를 직접 넣거나 메모 칸을 이용해 주세요.
          </p>
        )}

        {repos.length > 0 && (
          <ul className="space-y-2 text-sm">
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

        {links.length > 0 && (
          <ul className="space-y-2 text-sm mt-2">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <input type="checkbox" checked readOnly className="accent-brand" />
                <span className="text-neutral-200">{l.label}</span>
                <span className="text-xs text-neutral-500">{l.meta}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-neutral-600 mt-3">
          선택 해제한 자료는 AI 초안 생성에 포함되지 않으며, 언제든지 다시 선택할 수
          있습니다.
        </p>
      </div>

      <div>
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!hasSelection || collecting}
          onClick={() => void startDraft()}
        >
          {collecting ? "자료를 읽는 중" : "AI 초안 생성 시작"}
        </button>
        {collecting && (
          <p className="text-xs text-neutral-500 mt-2">
            선택한 저장소의 README와 언어 구성을 가져오고 있습니다.
          </p>
        )}
        {collectError && (
          <p role="alert" className="text-xs text-brand mt-2">
            {collectError}
          </p>
        )}
      </div>
    </div>
  );
}
