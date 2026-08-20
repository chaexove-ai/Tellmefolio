import { getSupabase } from "./supabase";
import type { RepoMaterial } from "./github";

/**
 * Edge Function 을 호출해 포트폴리오 초안을 받아옵니다.
 *
 * supabase.functions.invoke 를 쓰면 로그인 토큰이 자동으로 실려 갑니다.
 * 함수 쪽은 그 토큰을 검증하므로, 로그인하지 않은 요청은 아예 닿지 않습니다.
 */

export interface DraftProject {
  name: string;
  oneLiner: string;
  body: string;
  highlights: string[];
  stack: string[];
}

export interface Draft {
  title: string;
  summary: string;
  projects: DraftProject[];
  /** 자료가 부족해 모델이 쓰지 못한 부분. 사용자에게 그대로 보여줍니다. */
  gaps: string[];
}

export interface DraftUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export class DraftError extends Error {}

export async function generateDraft(input: {
  materials: RepoMaterial[];
  note: string;
  job: string;
  structure: string;
  extra: string;
}): Promise<{ draft: Draft; usage: DraftUsage | null }> {
  const sb = await getSupabase();
  if (!sb) {
    throw new DraftError("Supabase 설정이 없어 초안을 생성할 수 없습니다.");
  }

  // 서버에 넘길 형태로 줄입니다. GitHub 응답 전체를 보낼 이유가 없고,
  // 그대로 보내면 요청 본문만 커집니다.
  const materials = input.materials.map((m) => ({
    name: m.repo.name,
    description: m.repo.description,
    languages: m.languages,
    readme: m.readme,
    readmeTruncated: m.readmeTruncated,
  }));

  const { data, error } = await sb.functions.invoke("generate-draft", {
    body: {
      materials,
      note: input.note,
      job: input.job,
      structure: input.structure,
      extra: input.extra,
    },
  });

  if (error) {
    throw new DraftError(
      "초안 생성 요청이 실패했습니다. 잠시 후 다시 시도해 주세요."
    );
  }

  if (data?.error) throw new DraftError(String(data.error));
  if (!data?.draft) throw new DraftError("초안 응답이 비어 있습니다.");

  return { draft: data.draft as Draft, usage: data.usage ?? null };
}
