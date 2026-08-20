/**
 * GitHub 공개 API 클라이언트.
 *
 * [권한을 추가로 요청하지 않는 이유]
 * 공개 저장소는 권한 없이도 읽을 수 있습니다. 비공개까지 읽으려면 `repo`
 * 권한이 필요한데, 그건 비공개 코드에 대한 읽기·쓰기 전권이라 동의 화면이
 * 험악해집니다. 포트폴리오 도구가 요구할 만한 수준이 아니라고 판단해
 * 공개 저장소만 다룹니다.
 *
 * [토큰을 쓰는 이유]
 * 권한과 별개로, 요청에 토큰을 붙이면 시간당 한도가 60회에서 5,000회로
 * 올라갑니다. 60회는 IP 기준이라 같은 사무실에서 몇 명만 써도 금방
 * 바닥납니다. 로그인 직후 Supabase 가 돌려주는 공급자 토큰을 그대로 씁니다.
 *
 * [토큰을 메모리에만 두는 이유]
 * 이 토큰은 사용자의 GitHub 접근 토큰입니다. localStorage 에 넣으면 XSS
 * 한 방에 새어 나갑니다. 새로고침하면 사라지는 대신, 없으면 권한 없는
 * 호출로 자동으로 넘어갑니다. 기능이 멈추지는 않고 한도만 낮아집니다.
 */

const API = "https://api.github.com";

let providerToken: string | null = null;

/** 로그인 직후 AuthProvider 가 호출합니다. */
export function setGitHubToken(token: string | null) {
  providerToken = token;
}

export function hasGitHubToken() {
  return Boolean(providerToken);
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  updatedAt: string;
  isFork: boolean;
}

/** 저장소 하나에서 실제로 AI 에 넘길 재료. */
export interface RepoMaterial {
  repo: GitHubRepo;
  /** README 본문. 없으면 null. 아래 상한만큼 잘려 있을 수 있습니다. */
  readme: string | null;
  readmeTruncated: boolean;
  /** 바이트 비율이 큰 순서의 언어 이름. 상위 6개까지. */
  languages: string[];
}

/**
 * README 길이 상한.
 *
 * 잘 쓴 프로젝트일수록 README 가 깁니다. 수만 자짜리를 그대로 AI 에 넘기면
 * 저장소 다섯 개만 골라도 입력 토큰이 폭발합니다. 앞부분에 개요와 목적이
 * 몰려 있고 뒤로 갈수록 설치법·라이선스라, 앞을 남기고 자릅니다.
 */
const README_LIMIT = 4000;

/** 한도 초과처럼 사용자에게 그대로 보여줄 만한 오류를 구분하려고 씁니다. */
export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubError";
  }
}

async function request<T>(path: string, accept = "application/vnd.github+json"): Promise<T> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (providerToken) headers.Authorization = `Bearer ${providerToken}`;

  const res = await fetch(`${API}${path}`, { headers });

  if (res.ok) {
    const body = accept.includes("raw") ? await res.text() : await res.json();
    return body as T;
  }

  // 한도 초과는 403 또는 429 로 오는데, 남은 횟수가 0 인지로 구분합니다.
  const remaining = res.headers.get("x-ratelimit-remaining");
  if ((res.status === 403 || res.status === 429) && remaining === "0") {
    const reset = res.headers.get("x-ratelimit-reset");
    const when = reset
      ? new Date(Number(reset) * 1000).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
    throw new GitHubError(
      when
        ? `GitHub 요청 한도를 넘었습니다. ${when} 이후에 다시 시도해 주세요.`
        : "GitHub 요청 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.",
      res.status
    );
  }

  if (res.status === 404) {
    // 비공개 저장소도 404 로 옵니다. GitHub 이 존재 자체를 숨기기 때문에
    // 없는 저장소와 구분할 방법이 없습니다. 문구에서 둘 다 언급합니다.
    throw new GitHubError(
      "저장소를 찾을 수 없습니다. 주소가 맞는지, 공개 저장소가 맞는지 확인해 주세요.",
      404
    );
  }

  throw new GitHubError(`GitHub 요청에 실패했습니다. (${res.status})`, res.status);
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
}

function toRepo(r: RawRepo): GitHubRepo {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    htmlUrl: r.html_url,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    updatedAt: r.updated_at,
    isFork: r.fork,
  };
}

/**
 * 사용자의 공개 저장소를 최근 수정순으로 가져옵니다.
 * 포크는 남의 코드라 포트폴리오 재료로 부적절해서 제외합니다.
 */
export async function fetchUserRepos(login: string): Promise<GitHubRepo[]> {
  const raw = await request<RawRepo[]>(
    `/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=100&type=owner`
  );
  return raw.filter((r) => !r.fork).map(toRepo);
}

/** "https://github.com/owner/name" 또는 "owner/name" 을 받습니다. */
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  if (!trimmed) return null;

  const fromUrl = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s?#]+)/i);
  if (fromUrl) return { owner: fromUrl[1], name: fromUrl[2] };

  const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) return { owner: shorthand[1], name: shorthand[2] };

  return null;
}

export async function fetchRepo(owner: string, name: string): Promise<GitHubRepo> {
  const raw = await request<RawRepo>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  );
  return toRepo(raw);
}


/**
 * 한 번 읽은 저장소는 다시 읽지 않습니다.
 *
 * 토큰이 없는 상태(새로고침 뒤)에서는 시간당 60회가 한도입니다. 저장소당
 * 2회를 쓰니 사용자가 선택을 몇 번 바꾸기만 해도 금방 바닥납니다. 화면을
 * 벗어나면 사라지는 메모리 캐시라 최신성 문제는 크지 않습니다.
 */
const materialCache = new Map<number, RepoMaterial>();

/**
 * README 를 원문 그대로 받습니다.
 *
 * 기본 응답은 base64 로 감싸여 오는데, 한글이 섞이면 atob 만으로는 깨집니다.
 * raw 미디어 타입으로 요청하면 GitHub 이 본문을 그대로 돌려주므로 디코딩할
 * 일이 없습니다. README 가 없는 저장소는 404 이며, 이건 오류가 아닙니다.
 */
async function fetchReadme(owner: string, name: string): Promise<string | null> {
  try {
    return await request<string>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`,
      "application/vnd.github.raw+json"
    );
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** 바이트 비율이 큰 순서로 언어 이름을 돌려줍니다. */
async function fetchLanguages(owner: string, name: string): Promise<string[]> {
  try {
    const raw = await request<Record<string, number>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/languages`
    );
    return Object.entries(raw)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([lang]) => lang);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

/**
 * 저장소 하나의 재료를 모읍니다. README 와 언어를 동시에 요청합니다.
 * 저장소 이름에서 owner 를 꺼내야 하므로 fullName 을 씁니다.
 */
export async function fetchRepoMaterial(repo: GitHubRepo): Promise<RepoMaterial> {
  const cached = materialCache.get(repo.id);
  if (cached) return cached;

  const [owner, name] = repo.fullName.split("/");
  const [readmeRaw, languages] = await Promise.all([
    fetchReadme(owner, name),
    fetchLanguages(owner, name),
  ]);

  const truncated = Boolean(readmeRaw && readmeRaw.length > README_LIMIT);
  const material: RepoMaterial = {
    repo,
    readme: readmeRaw ? readmeRaw.slice(0, README_LIMIT) : null,
    readmeTruncated: truncated,
    languages,
  };

  materialCache.set(repo.id, material);
  return material;
}

/**
 * 선택한 저장소들의 재료를 모읍니다.
 *
 * 하나가 실패해도 나머지는 살립니다. 저장소 다섯 개 중 하나가 README 조회에
 * 실패했다고 전체를 되돌리면, 사용자는 뭘 고쳐야 할지 알 수 없습니다.
 */
export async function fetchMaterials(
  repos: GitHubRepo[]
): Promise<{ materials: RepoMaterial[]; failed: string[] }> {
  const settled = await Promise.allSettled(repos.map((r) => fetchRepoMaterial(r)));

  const materials: RepoMaterial[] = [];
  const failed: string[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") materials.push(result.value);
    else failed.push(repos[i].name);
  });

  return { materials, failed };
}
