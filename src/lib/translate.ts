import { getSupabase } from "./supabase";
import type { PortfolioRow, PortfolioProjectRow } from "./portfolios";

/**
 * Export 화면의 "영어 버전"을 실제로 채우는 곳입니다.
 *
 * 지금까지는 영어를 선택해도 화면에 "아직 준비 중"이라는 안내만 있고
 * 실제로는 원문(한국어) 그대로 내보내졌습니다. 이 함수는 translate-portfolio
 * Edge Function을 호출해 title/summary/job과 각 프로젝트의 name·role·stack·
 * 서술형 필드를 영어로 옮기고, 색상·템플릿 설정 등 화면 표시와 무관한
 * 값은 원본 그대로 둔 PortfolioRow/PortfolioProjectRow 를 돌려줍니다 —
 * PortfolioRenderer 는 이 결과를 원본과 똑같은 모양으로 받아 그대로 그릴
 * 수 있습니다.
 *
 * [2026-09 수정] 처음엔 role/stack을 "짧은 고유명사"로 보고 번역 대상에서
 * 뺐는데, 실제로 이 서비스를 쓰는 디자이너 사용자들은 stack에 "React"
 * 같은 툴 이름 대신 "UX 리서치", "와이어프레임" 같은 한국어 서술형
 * 스킬을 적는 경우가 많았습니다 — 영어로 내보내도 role/stack만 한국어로
 * 남아있던 원인입니다. 이제 job/role/stack도 함께 번역합니다.
 */

export class TranslateError extends Error {}

interface TranslatedProject {
  id: string;
  name: string;
  role: string;
  stack: string[];
  context: string;
  problem: string;
  execution: string;
  outcome: string;
  reflection: string;
}

interface TranslationResult {
  title: string;
  summary: string;
  job: string;
  projects: TranslatedProject[];
}

export async function translatePortfolioToEnglish(
  portfolio: PortfolioRow,
  projects: PortfolioProjectRow[]
): Promise<{ portfolio: PortfolioRow; projects: PortfolioProjectRow[] }> {
  const sb = await getSupabase();
  if (!sb) {
    throw new TranslateError("Supabase 설정이 없어 번역할 수 없습니다.");
  }

  const { data, error } = await sb.functions.invoke("translate-portfolio", {
    body: {
      title: portfolio.title,
      summary: portfolio.summary ?? "",
      job: portfolio.job ?? "",
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        stack: p.stack,
        context: p.context,
        problem: p.problem,
        execution: p.execution,
        outcome: p.outcome,
        reflection: p.reflection,
      })),
    },
  });

  if (error) {
    // [디버깅용] Edge Function이 실제로 뭐라고 응답했는지 콘솔에 남깁니다.
    // sb.functions.invoke는 함수가 4xx/5xx를 내면 data를 null로 비워버리고
    // error만 채우기 때문에, 우리 함수가 만든 구체적인 이유("서버에 API
    // 키가 설정되지 않았습니다" 등)가 화면에는 안 보입니다 — 브라우저 콘솔
    // 이나 Supabase 대시보드의 Edge Functions > Logs에서 확인해야 합니다.
    let detail: string | null = null;
    try {
      const ctx = (error as { context?: unknown }).context;
      if (ctx instanceof Response) {
        const body = await ctx.clone().json().catch(() => null);
        detail = body?.error ? String(body.error) : null;
      }
    } catch {
      // 응답 본문을 못 읽어도 아래 콘솔 로그로 원본 error는 남습니다.
    }
    console.error("translate-portfolio 실패:", error, detail);
    throw new TranslateError(
      detail
        ? `번역 요청이 실패했습니다: ${detail}`
        : "번역 요청이 실패했습니다. 잠시 후 다시 시도해 주세요."
    );
  }
  if (data?.error) throw new TranslateError(String(data.error));

  const translation = data?.translation as TranslationResult | undefined;
  if (!translation) throw new TranslateError("번역 응답이 비어 있습니다.");

  // id로 매칭합니다. 모델이 어떤 프로젝트를 빠뜨리거나 id를 바꿔 돌려줄
  // 가능성에 대비해, 매칭되지 않는 프로젝트는 원문 그대로 둡니다(번역
  // 실패보다 원문 노출이 안전한 실패 방식입니다). stack은 배열 길이가
  // 원본과 다르게 오면(모델이 항목을 빠뜨린 경우) 신뢰하지 않고 원문을
  // 그대로 둡니다 — 개수가 달라지면 어떤 항목이 어떤 항목의 번역인지
  // 알 수 없기 때문입니다.
  const byId = new Map(translation.projects.map((tp) => [tp.id, tp]));
  const translatedProjects: PortfolioProjectRow[] = projects.map((p) => {
    const tp = byId.get(p.id);
    if (!tp) return p;
    const stack =
      Array.isArray(tp.stack) && tp.stack.length === p.stack.length ? tp.stack : p.stack;
    return {
      ...p,
      name: tp.name || p.name,
      role: tp.role || p.role,
      stack,
      context: tp.context,
      problem: tp.problem,
      execution: tp.execution,
      outcome: tp.outcome,
      reflection: tp.reflection,
    };
  });

  const translatedPortfolio: PortfolioRow = {
    ...portfolio,
    title: translation.title || portfolio.title,
    summary: translation.summary || portfolio.summary,
    job: translation.job || portfolio.job,
  };

  return { portfolio: translatedPortfolio, projects: translatedProjects };
}
