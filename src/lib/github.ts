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

/** 한도 초과처럼 사용자에게 그대로 보여줄 만한 오류를 구분하려고 씁니다. */
export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubError";
  }
}

async function request<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (providerToken) headers.Authorization = `Bearer ${providerToken}`;

  const res = await fetch(`${API}${path}`, { headers });

  if (res.ok) return (await res.json()) as T;

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
