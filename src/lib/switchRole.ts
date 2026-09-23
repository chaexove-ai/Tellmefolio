/**
 * 직무 전환 — 지금 포트폴리오를 목표 직무의 말로 다시 씁니다.
 *
 * [무엇이 바뀌었나]
 * 전에 이 기능은 "결과 중심형 / 문제-실행-결과형" 중 하나를 고르는
 * 화면이었고, 전부 목업이었습니다(mockData.portfolios + setTimeout).
 * 고르는 값이 서술 순서였는데 순서는 이미 템플릿과 5필드가 정합니다 —
 * 같은 걸 두 군데서 정하고 있었고, 순서를 바꾼다고 마케터의 포트폴리오가
 * PM 것처럼 읽히지도 않습니다.
 *
 * 직무를 바꿀 때 실제로 막히는 건 "내 경험 중 무엇이 새 직무의 무엇에
 * 해당하는가" 입니다. 그 매핑을 제안받고, 프로젝트마다 취할지 말지
 * 고르는 구조로 바꿉니다.
 *
 * [원본을 덮어쓰지 않습니다]
 * 결과는 **새 포트폴리오**로 저장합니다. 되돌릴 수 없는 변환을 기존
 * 포트폴리오에 덮어쓰면, 잘 나오지 않았을 때 원래 것이 사라집니다.
 * 직무 전환은 성공 여부를 써보기 전에는 알 수 없는 작업입니다.
 */

import { getSupabase } from "./supabase";
import { PortfolioError } from "./portfolios";
import type { PortfolioProjectRow, PortfolioRow } from "./portfolios";

/** 프로젝트 한 건에 대한 제안. */
export interface SwitchSuggestion {
  id: string;
  /** 목표 직무와 연결되지 않는다고 판단한 경우. */
  skip: boolean;
  /** 목표 직무의 어떤 역량인지 — 짧은 말. */
  competency: string;
  /** 왜 그 역량에 해당하는지 한 문장. skip 이면 왜 안 되는지. */
  why: string;
  context: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
}

export interface SwitchResult {
  projects: SwitchSuggestion[];
  summary: string;
}

export class SwitchError extends Error {}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function requestSwitch(input: {
  targetJob: string;
  currentJob: string;
  posting: string;
  projects: PortfolioProjectRow[];
}): Promise<SwitchResult> {
  const sb = await getSupabase();
  if (!sb) throw new SwitchError("서버 설정이 없어 직무 전환을 쓸 수 없습니다.");

  // 서버에 보낼 것만 골라 보냅니다. 행 전체를 그대로 보내면 id·시각 같은
  // 필요 없는 값까지 프롬프트 예산을 먹습니다.
  const projects = input.projects.map((p) => ({
    id: p.id,
    name: p.name,
    context: p.context,
    problem: p.problem,
    execution: p.execution,
    outcome: p.outcome,
    reflection: p.reflection,
    stack: p.stack ?? [],
  }));

  const { data, error } = await sb.functions.invoke("switch-role", {
    body: {
      targetJob: input.targetJob,
      currentJob: input.currentJob,
      posting: input.posting,
      projects,
    },
  });

  if (error) {
    throw new SwitchError("직무 전환 제안을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new SwitchError(String((data as { error: unknown }).error));
  }

  const raw = (data ?? {}) as { projects?: unknown[]; summary?: unknown };

  return {
    summary: str(raw.summary),
    projects: (raw.projects ?? []).map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        id: str(o.id),
        skip: Boolean(o.skip),
        competency: str(o.competency),
        why: str(o.why),
        context: str(o.context),
        problem: str(o.problem),
        execution: str(o.execution),
        outcome: str(o.outcome),
        reflection: str(o.reflection),
      };
    }),
  };
}

/**
 * 채택한 제안을 새 포트폴리오로 저장합니다.
 *
 * 원본의 템플릿·색·직무 색을 그대로 가져옵니다 — 직무 전환은 내용을
 * 바꾸는 일이지 디자인을 바꾸는 일이 아닙니다. 사용자가 고른 템플릿을
 * 여기서 되돌리면 두 번 고르게 됩니다.
 *
 * 채택하지 않은 프로젝트는 **원문 그대로** 넣습니다. 빼지 않습니다 —
 * "이 프로젝트는 새 직무와 안 맞는다" 는 제안이지 결정이 아니고,
 * 목록에서 사라지면 사용자가 직접 다시 써넣어야 합니다.
 */
export async function saveSwitchedPortfolio(input: {
  userId: string;
  source: PortfolioRow;
  sourceProjects: PortfolioProjectRow[];
  targetJob: string;
  title: string;
  summary: string;
  /** 채택한 것만. 키는 프로젝트 id. */
  accepted: Map<string, SwitchSuggestion>;
}): Promise<PortfolioRow> {
  const sb = await getSupabase();
  if (!sb) throw new SwitchError("서버 설정이 없어 저장할 수 없습니다.");

  const { data: portfolio, error } = await sb
    .from("portfolios")
    .insert({
      user_id: input.userId,
      title: input.title.trim() || `${input.targetJob} 포트폴리오`,
      job: input.targetJob.trim() || null,
      summary: input.summary.trim() || null,
      template_id: input.source.template_id,
      color_theme: input.source.color_theme,
      font: input.source.font,
      layout: input.source.layout,
      density: input.source.density,
      job_color: input.source.job_color,
      // 새로 만든 것은 항상 비공개로 시작합니다. 직무 전환 결과는
      // 손볼 것이 남아 있는 상태라, 만들자마자 링크가 열려 있으면 안 됩니다.
      visibility: "private",
    })
    .select()
    .single();

  if (error || !portfolio) {
    throw new SwitchError("새 포트폴리오를 만들지 못했습니다.");
  }

  const rows = input.sourceProjects.map((p, i) => {
    const s = input.accepted.get(p.id);
    const use = s && !s.skip;
    return {
      portfolio_id: portfolio.id,
      position: i,
      name: p.name,
      // 채택한 것만 다시 쓴 글로, 나머지는 원문 그대로.
      context: use ? s.context : p.context,
      problem: use ? s.problem : p.problem,
      execution: use ? s.execution : p.execution,
      outcome: use ? s.outcome : p.outcome,
      reflection: use ? s.reflection : p.reflection,
      role: p.role,
      stack: p.stack ?? [],
      depth: p.depth,
    };
  });

  if (rows.length > 0) {
    const { error: projectError } = await sb.from("portfolio_projects").insert(rows);
    if (projectError) {
      throw new SwitchError("포트폴리오는 만들어졌지만 프로젝트 저장에 실패했습니다.");
    }
  }

  return portfolio as PortfolioRow;
}
