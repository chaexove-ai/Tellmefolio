/**
 * 자유 블록. 설계는 docs/editor-freedom.md 3절.
 *
 * [무엇인가]
 * 프로젝트의 5필드 뒤에 사용자가 원하는 대로 쌓는 덩어리입니다. 1단계는
 * 텍스트와 구분선 둘뿐입니다 — 이미지는 이미 프로젝트 이미지가 있어서,
 * 넣는 방법을 두 개로 만들면 "내 사진이 어디 있지"가 생깁니다.
 *
 * [왜 파서가 한 곳에 있는가]
 * data 가 jsonb 라 DB 가 내용을 지켜주지 않습니다. 화면 여기저기서
 * `data.text ?? ""` 같은 걸 하기 시작하면 손쓸 수 없어집니다. 읽는 입구를
 * 여기 하나로 두고, 나머지 코드는 이미 정리된 모양만 봅니다.
 */

import { getSupabase } from "./supabase";
import { PortfolioError } from "./portfolios";

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new PortfolioError("서버 연결이 설정되지 않았습니다.");
  return sb;
}

/* ------------------------------------------------------------------ */
/* 모양                                                                */
/* ------------------------------------------------------------------ */

export type BlockKind = "text" | "divider";
export type BlockSpan = "full" | "half";

/** 텍스트 블록의 크기. 템플릿이 자기 팔레트로 그립니다. */
export type TextStyle = "heading" | "body" | "small";

export interface TextBlock {
  kind: "text";
  /** 없으면 안 그립니다 — 제목 없는 문단도 흔합니다. */
  label: string;
  text: string;
  style: TextStyle;
}

export interface DividerBlock {
  kind: "divider";
}

export type BlockContent = TextBlock | DividerBlock;

export interface BlockRow {
  id: string;
  portfolio_id: string;
  project_id: string | null;
  position: number;
  span: BlockSpan;
  content: BlockContent;
}

/** 프로젝트 id → 그 프로젝트의 블록들. 템플릿이 받는 모양. */
export type BlockMap = Record<string, BlockRow[]>;

/**
 * [2026-09-23] 미리보기에서 바로 고치기 위한 창구.
 *
 * 전에는 왼쪽 폼에서 블록을 추가하고 오른쪽 미리보기에서 결과를
 * 확인해야 했습니다 — 한 가지를 고치는데 두 곳을 봐야 하는 구조라
 * 불편했습니다. 이제 전체화면 미리보기가 편집면입니다.
 *
 * 오른쪽 패널의 작은 미리보기는 편집면으로 쓰지 않습니다: zoom 으로
 * 눌려 있어 한글 입력이 어긋나고, 250ms 디바운스로 그려지는 복사본이라
 * 입력과 화면이 서로 싸웁니다.
 *
 * 템플릿은 이 객체가 있을 때만 편집 도구를 그립니다. 없으면(내보내기,
 * 공개 링크, 작은 미리보기) 평소처럼 읽기 전용입니다.
 */
export interface BlockEditorApi {
  /** atIndex 자리에 끼워 넣습니다. 끝에 붙이려면 목록 길이를 넘깁니다. */
  add: (projectId: string, kind: BlockKind, atIndex: number) => void;
  update: (projectId: string, blockId: string, content: BlockContent) => void;
  move: (projectId: string, index: number, dir: -1 | 1) => void;
  remove: (projectId: string, blockId: string) => void;
}

/* ------------------------------------------------------------------ */
/* 파서 — 바깥에서 들어온 것을 믿지 않습니다                            */
/* ------------------------------------------------------------------ */

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function parseContent(kind: unknown, data: unknown): BlockContent | null {
  const d = (data ?? {}) as Record<string, unknown>;

  if (kind === "text") {
    const style = d.style;
    return {
      kind: "text",
      label: str(d.label),
      text: str(d.text),
      style: style === "heading" || style === "small" ? style : "body",
    };
  }
  if (kind === "divider") return { kind: "divider" };

  // 모르는 종류는 null 입니다. 새 블록 종류를 쓰는 프런트가 먼저 배포된
  // 기기에서 만든 행을, 아직 모르는 기기가 읽을 수 있습니다. 그때
  // 화면이 죽는 것보다 그 블록만 안 보이는 편이 낫습니다.
  return null;
}

function toBlockRow(raw: Record<string, unknown>): BlockRow | null {
  const content = parseContent(raw.kind, raw.data);
  if (!content) return null;
  return {
    id: String(raw.id),
    portfolio_id: String(raw.portfolio_id),
    project_id: raw.project_id ? String(raw.project_id) : null,
    position: typeof raw.position === "number" ? raw.position : 0,
    span: raw.span === "half" ? "half" : "full",
    content,
  };
}

/** 블록이 실제로 보여줄 내용이 있는지. 빈 텍스트 블록은 안 그립니다. */
export function blockHasContent(b: BlockRow): boolean {
  if (b.content.kind === "divider") return true;
  return Boolean(b.content.text.trim() || b.content.label.trim());
}

/* ------------------------------------------------------------------ */
/* 읽기·쓰기                                                           */
/* ------------------------------------------------------------------ */

export async function listBlocks(portfolioId: string): Promise<BlockMap> {
  const sb = await getSupabase();
  if (!sb) return {};

  const { data } = await sb
    .from("portfolio_blocks")
    .select()
    .eq("portfolio_id", portfolioId)
    .order("position", { ascending: true });

  const map: BlockMap = {};
  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const row = toBlockRow(raw);
    if (!row || !row.project_id) continue;
    (map[row.project_id] ??= []).push(row);
  }
  return map;
}

export async function createBlock(input: {
  portfolioId: string;
  projectId: string;
  kind: BlockKind;
  position: number;
}): Promise<BlockRow> {
  const sb = await requireClient();

  const data: Record<string, unknown> =
    input.kind === "text" ? { label: "", text: "", style: "body" } : {};

  const { data: row, error } = await sb
    .from("portfolio_blocks")
    .insert({
      portfolio_id: input.portfolioId,
      project_id: input.projectId,
      kind: input.kind,
      position: input.position,
      data,
    })
    .select()
    .single();

  if (error || !row) {
    throw new PortfolioError("블록을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const parsed = toBlockRow(row as Record<string, unknown>);
  if (!parsed) {
    throw new PortfolioError("블록을 추가하지 못했습니다.");
  }
  return parsed;
}

export async function updateBlock(
  id: string,
  patch: { content?: BlockContent; span?: BlockSpan }
): Promise<void> {
  const sb = await requireClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.span) update.span = patch.span;
  if (patch.content) {
    const c = patch.content;
    update.kind = c.kind;
    update.data = c.kind === "text" ? { label: c.label, text: c.text, style: c.style } : {};
  }

  const { error } = await sb.from("portfolio_blocks").update(update).eq("id", id);
  if (error) {
    throw new PortfolioError("블록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export async function deleteBlock(id: string): Promise<void> {
  const sb = await requireClient();
  const { error } = await sb.from("portfolio_blocks").delete().eq("id", id);
  if (error) {
    throw new PortfolioError("블록을 삭제하지 못했습니다.");
  }
}

/** 끌어서 순서를 바꾼 뒤 한 번에 반영합니다. */
export async function reorderBlocks(ordered: BlockRow[]): Promise<void> {
  const sb = await requireClient();
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i].position === i) continue;
    const { error } = await sb
      .from("portfolio_blocks")
      .update({ position: i })
      .eq("id", ordered[i].id);
    if (error) {
      throw new PortfolioError("블록 순서를 저장하지 못했습니다.");
    }
  }
}
