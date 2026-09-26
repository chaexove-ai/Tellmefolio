import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock, GripVertical, ImagePlus, Info, LoaderCircle, MessagesSquare, Minus, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import {
  getPortfolioWithProjects,
  updatePortfolioProject,
  updatePortfolioTitle,
  createPortfolioProject,
  deletePortfolioProject,
  getCoverImageUrl,
  listProjectImages,
  uploadProjectImage,
  deleteProjectImage,
  reorderProjectImages,
  updateProjectImageCaption,
  MAX_PROJECT_IMAGES,
  PortfolioError,
  type PortfolioProjectRow,
  type PortfolioRow,
  type ProjectImageMap,
  type ProjectDepth,
  type ProjectImageRow,
} from "../../lib/portfolios";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import EditorPreview from "../../components/EditorPreview";
import StylePanel from "../../components/StylePanel";
import TemplateFrame from "../../components/TemplateFrame";

import { shrinkImage } from "../../lib/images";
import {
  listBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  type BlockMap,
  type BlockRow,
  type BlockContent,
  type BlockEditorApi,
} from "../../lib/blocks";
import { useAuth } from "../../auth/AuthProvider";

interface EvidenceItem {
  id: string;
  label: string;
  source: string;
  status: "확인 완료" | "검토 필요";
}

const evidenceItems: EvidenceItem[] = [
  { id: "e1", label: "핵심 성과 수치", source: "GitHub 리포지토리 — README.md 3행", status: "확인 완료" },
  { id: "e2", label: "담당 역할 서술", source: "업로드 PDF — 경력기술서 2페이지", status: "검토 필요" },
  { id: "e3", label: "프로젝트 기간", source: "텍스트 메모 — 프로젝트 메모 1항", status: "검토 필요" },
];

const mismatchItems = [
  {
    id: "m1",
    label: "경력 기간 불일치 가능성",
    detail: "이력서: 2021.03 – 2023.08 / 포트폴리오: 2021.06 – 2023.08",
  },
  {
    id: "m2",
    label: "성과 수치 표현 차이",
    detail: "이력서: 전환율 12% 개선 / 포트폴리오: 전환율 15% 향상",
  },
];

/**
 * [2026-09] location.state.draft 대신 실제 DB(portfolios/portfolio_projects)에서
 * 읽고 씁니다. 이전에는 이 화면이 새로고침하면 통째로 비어버렸습니다 —
 * AI 초안이 location.state 에만 있었고 어디에도 저장되지 않았기 때문입니다.
 * 이제는 주소의 :id 로 포트폴리오를 찾아 불러오고, 프로젝트 탭을 바꾸거나
 * "수동 저장"을 누르면 그 시점의 7칸 내용이 portfolio_projects 행에 그대로
 * 저장됩니다.
 *
 * 담당 역할·문제 정의·배운 점은 여전히 AI 응답에 대응하는 필드가 없어
 * 빈 칸으로 시작합니다 — DB 컬럼 자체는 있으니(role/problem/reflection)
 * 한 번 채워서 저장하면 그다음부터는 그대로 남습니다.
 *
 * "AI 근거 및 사실 확인" / "이력서·포트폴리오 불일치 확인" 두 섹션은 이번에도
 * 건드리지 않았습니다 — 문장-출처 연결이나 이력서 대조 기능 자체가 아직
 * 없어서, 여전히 예시 데이터라는 것만 명시합니다.
 */
/**
 * [2026-09] 스타일 패널을 어느 열에 둘지 결정하기 위한 훅입니다.
 *
 * CSS 로 숨기고 보이기만 하면(hidden/xl:block) 패널을 양쪽에 하나씩 두 벌
 * 두어야 하는데, 그러면 각자 자기 상태를 갖게 되어 한쪽에서 고친 값이
 * 다른 쪽에 없습니다. 인스턴스는 하나로 두고 둘 중 한 자리에만 그립니다.
 */
function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export default function PortfolioEditor() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  // [2026-09-25] ?project=… 이면 그 프로젝트 탭으로 엽니다. "대화로 채우기"를
  // 끝내고 돌아왔을 때 방금 채운 프로젝트가 보여야 합니다.
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project");

  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 포트폴리오 이름 — 내 서재를 카드 격자로 바꾸면서 책장의 제목 고치기가
  // 사라졌습니다(09-25). 이름이 보이는 편집기 머리에서 바로 고칩니다.
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [sentence, setSentence] = useState("");
  const [showRefine, setShowRefine] = useState(false);

  const [projectIndex, setProjectIndex] = useState(0);
  const [titleField, setTitleField] = useState("");
  const [context, setContext] = useState("");
  const [role, setRole] = useState("");
  const [problem, setProblem] = useState("");
  const [execution, setExecution] = useState("");
  const [outcome, setOutcome] = useState("");
  const [reflection, setReflection] = useState("");
  /** 툴·키워드. 지금까지 AI 초안이 넣어준 값을 보여주기만 하고 고칠 방법이
   *  없었습니다 — 직접 추가한 프로젝트는 빈 배열로 시작하니 영영 비어
   *  있었습니다. */
  const [stack, setStack] = useState<string[]>([]);
  const [stackInput, setStackInput] = useState("");
  /** [2026-09-22] 이 프로젝트를 얼마나 깊게 보여줄지. 설계는
   *  docs/editor-redesign.md 3절. 바꿔도 다른 칸의 값은 지우지 않습니다 —
   *  화면에서 접힐 뿐이라 되돌리면 쓰던 글이 그대로 돌아옵니다. */
  const [depth, setDepth] = useState<ProjectDepth>("full");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [addingProject, setAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // coverUrl 은 "지금 미리보기에 그릴 표지"(아직 저장 안 한 새 파일일 수
  // 있음), savedCoverUrl 은 "DB에 들어 있는 표지"입니다. 스타일 패널의
  // 되돌리기가 후자를 복원합니다.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [savedCoverUrl, setSavedCoverUrl] = useState<string | null>(null);

  /** 프로젝트 id → 이미지들. 행(storage_path 포함)과 화면에 쓸 URL 을 함께
   *  들고 있습니다 — 삭제할 때 경로가 필요하고, 그릴 때는 URL 이 필요합니다. */
  const [projectImages, setProjectImages] = useState<Record<string, Array<ProjectImageRow & { url: string }>>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** 미리보기 전체화면. */
  const [expanded, setExpanded] = useState(false);

  /** [2026-09-22] 자유 블록. 5필드 뒤에 사용자가 원하는 대로 쌓습니다.
   *  설계는 docs/editor-freedom.md. */
  const [blocks, setBlocks] = useState<BlockMap>({});
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  /** 미리보기는 xl(1280px) 이상에서만 자리가 납니다. 그 아래에서는 폼과
   *  미리보기가 둘 다 좁아져 양쪽 다 못 쓰게 되므로 감추고, 스타일 패널만
   *  왼쪽 열로 내려보냅니다(안 그러면 좁은 화면에서 스타일을 바꿀 방법이
   *  아예 없어집니다 — 설정 페이지를 없앴으니 여기가 유일한 입구입니다).
   *
   *  [2026-09] "미리보기 숨기기" 토글은 없앴습니다. 숨겨도 입력 폼이
   *  넓어지지 않습니다 — 폼이 max-w-3xl 에 묶여 있어서 숨긴 자리가 그대로
   *  빈 공간이 됩니다. 화면만 허전해지고 얻는 것이 없는 버튼이면서, 주
   *  버튼(내보내기) 옆자리를 차지하고 있었습니다. */
  const isWide = useIsWide();

  const loadProject = (index: number, list: PortfolioProjectRow[]) => {
    const p = list[index];
    setProjectIndex(index);
    setTitleField(p?.name ?? "");
    setContext(p?.context ?? "");
    setRole(p?.role ?? "");
    setProblem(p?.problem ?? "");
    setExecution(p?.execution ?? "");
    setOutcome(p?.outcome ?? "");
    setReflection(p?.reflection ?? "");
    setStack(p?.stack ?? []);
    setStackInput("");
    // depth 컬럼이 없던 시절 행은 undefined 로 옵니다 — 프런트는 자동
    // 배포되고 마이그레이션은 손으로 돌리니, 그 틈에 죽지 않게 full 로 봅니다.
    setDepth(p?.depth ?? "full");
    setImageError(null);
  };

  /** 이미지 행을 읽고 화면에 쓸 URL 까지 붙여 상태에 담습니다. */
  const loadImages = async (projectIds: string[]) => {
    try {
      const rows = await listProjectImages(projectIds);
      const withUrls = await Promise.all(
        rows.map(async (r) => ({ ...r, url: await getCoverImageUrl(r.storage_path) }))
      );
      const grouped: Record<string, Array<ProjectImageRow & { url: string }>> = {};
      for (const r of withUrls) {
        (grouped[r.project_id] ??= []).push(r);
      }
      setProjectImages(grouped);
    } catch {
      // 이미지를 못 읽어도 글은 편집할 수 있어야 합니다.
    }
  };

  /** 쉼표로 여러 개를 한 번에 붙여넣는 경우까지 받습니다. 중복과 빈 값은
   *  버리고, 너무 긴 것은 자릅니다(배지 한 줄을 넘기면 목록이 안 읽힙니다). */
  const addStack = (raw: string) => {
    const added = raw
      .split(",")
      .map((v) => v.trim().slice(0, 24))
      .filter(Boolean);
    if (added.length === 0) return;
    setStack((prev) => {
      const next = [...prev];
      for (const a of added) if (!next.includes(a)) next.push(a);
      return next.slice(0, 12);
    });
    setStackInput("");
  };

  // 전체화면 미리보기는 ESC 로 닫힙니다. 오버레이 클릭으로도 닫히지만,
  // 안쪽을 클릭해도 닫히지 않게 막아둬서 키보드 경로가 필요합니다.
  //
  // [2026-09-23] 글을 고치는 중에는 닫지 않습니다. 편집 칸에서
  // 빠져나오려고 ESC 를 눌렀는데 화면 전체가 닫히면, 방금 쓴 것이
  // 날아간 것처럼 보입니다(실제로는 blur 에서 저장되지만 그렇게 안
  // 보입니다). 그 경우 ESC 는 칸을 빠져나오는 데만 쓰이고, 한 번 더
  // 누르면 닫힙니다.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.isContentEditable) return;
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  /* ---------------- 프로젝트 이미지 ---------------- */

  // currentProject 는 아래(359줄 근처)에서 따로 선언돼 있지만, 이미지
  // 핸들러들이 그보다 위에 있어서 id 만 여기서 한 번 더 꺼냅니다.
  const currentProjectId = projects[projectIndex]?.id ?? null;
  const currentImages = currentProjectId ? (projectImages[currentProjectId] ?? []) : [];

  const addImages = async (files: FileList | null) => {
    const projectId = currentProjectId;
    const userId = session?.user?.id;
    if (!files || files.length === 0 || !projectId || !id) return;
    if (!userId) {
      setImageError("로그인 정보를 확인할 수 없어 이미지를 올릴 수 없습니다.");
      return;
    }

    const room = MAX_PROJECT_IMAGES - currentImages.length;
    if (room <= 0) {
      setImageError(`이미지는 프로젝트당 ${MAX_PROJECT_IMAGES}장까지입니다.`);
      return;
    }

    setUploadingImage(true);
    setImageError(null);
    const picked = Array.from(files).slice(0, room);
    const overflow = files.length - picked.length;

    try {
      for (let i = 0; i < picked.length; i += 1) {
        // 반드시 줄여서 올립니다. 8장 × 4MB 가 그대로 올라가면 공개 링크가
        // 폰에서 안 열립니다(설계문서 4.3).
        const shrunk = await shrinkImage(picked[i]);
        const row = await uploadProjectImage({
          userId,
          portfolioId: id,
          projectId,
          file: shrunk.file,
          position: currentImages.length + i,
        });
        const url = await getCoverImageUrl(row.storage_path);
        setProjectImages((prev) => ({
          ...prev,
          [projectId]: [...(prev[projectId] ?? []), { ...row, url }],
        }));
      }
      if (overflow > 0) {
        setImageError(`${MAX_PROJECT_IMAGES}장까지만 올릴 수 있어 ${overflow}장은 제외했습니다.`);
      }
    } catch (e) {
      setImageError(e instanceof PortfolioError ? e.message : "이미지를 올리지 못했습니다.");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = async (img: ProjectImageRow & { url: string }) => {
    const projectId = currentProjectId;
    if (!projectId) return;
    // 화면에서 먼저 지웁니다 — 서버를 기다리는 동안 남아 있으면 두 번
    // 누르게 됩니다. 실패하면 다시 넣습니다.
    const before = projectImages[projectId] ?? [];
    setProjectImages((prev) => ({
      ...prev,
      [projectId]: before.filter((x) => x.id !== img.id),
    }));
    try {
      await deleteProjectImage(img);
    } catch (e) {
      setProjectImages((prev) => ({ ...prev, [projectId]: before }));
      setImageError(e instanceof PortfolioError ? e.message : "이미지를 삭제하지 못했습니다.");
    }
  };

  const dropImage = async (toIndex: number) => {
    const projectId = currentProjectId;
    if (dragIndex === null || !projectId || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    const list = [...(projectImages[projectId] ?? [])];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(toIndex, 0, moved);
    const renumbered = list.map((x, i) => ({ ...x, position: i }));
    setProjectImages((prev) => ({ ...prev, [projectId]: renumbered }));
    setDragIndex(null);
    try {
      await reorderProjectImages(renumbered);
    } catch (e) {
      setImageError(e instanceof PortfolioError ? e.message : "순서를 저장하지 못했습니다.");
    }
  };

  const saveCaption = async (img: ProjectImageRow & { url: string }, caption: string) => {
    const projectId = currentProjectId;
    if (!projectId || caption === img.caption) return;
    setProjectImages((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((x) => (x.id === img.id ? { ...x, caption } : x)),
    }));
    try {
      await updateProjectImageCaption(img.id, caption);
    } catch {
      // 설명은 부가 정보라 실패해도 되돌리지 않습니다.
    }
  };

  /* ---------------- 자유 블록 ---------------- */

  const currentBlocks = currentProjectId ? (blocks[currentProjectId] ?? []) : [];

  const setProjectBlocks = (projectId: string, next: BlockRow[]) => {
    setBlocks((prev) => ({ ...prev, [projectId]: next }));
  };

  /**
   * [2026-09-23] 핸들러가 projectId 를 받습니다.
   *
   * 전에는 "지금 열린 탭"의 블록만 다뤘습니다. 전체화면 미리보기에서는
   * 모든 프로젝트의 블록이 한 화면에 보이므로, 어느 프로젝트 것인지
   * 호출하는 쪽이 알려줘야 합니다.
   */
  const addBlockAt = async (projectId: string, kind: "text" | "divider", atIndex: number) => {
    if (!id) return;
    const before = blocks[projectId] ?? [];
    setBlockBusy(true);
    setBlockError(null);
    try {
      const row = await createBlock({
        portfolioId: id,
        projectId,
        kind,
        position: atIndex,
      });
      // 중간에 끼워 넣은 경우 뒤 블록들의 번호가 밀립니다. 화면을 먼저
      // 맞추고 서버 번호를 이어서 정리합니다.
      const next = [...before];
      next.splice(Math.min(atIndex, next.length), 0, row);
      const renumbered = next.map((b, i) => ({ ...b, position: i }));
      setProjectBlocks(projectId, renumbered);
      if (atIndex < before.length) {
        await reorderBlocks(renumbered);
      }
    } catch (e) {
      setBlockError(e instanceof PortfolioError ? e.message : "블록을 추가하지 못했습니다.");
    } finally {
      setBlockBusy(false);
    }
  };

  /** 화면을 먼저 바꾸고 서버에 보냅니다. 실패하면 되돌립니다. */
  const saveBlockContent = async (projectId: string, blockId: string, content: BlockContent) => {
    const before = blocks[projectId] ?? [];
    setProjectBlocks(
      projectId,
      before.map((b) => (b.id === blockId ? { ...b, content } : b))
    );
    try {
      await updateBlock(blockId, { content });
    } catch (e) {
      setProjectBlocks(projectId, before);
      setBlockError(e instanceof PortfolioError ? e.message : "블록을 저장하지 못했습니다.");
    }
  };

  const removeBlockFrom = async (projectId: string, blockId: string) => {
    const before = blocks[projectId] ?? [];
    setProjectBlocks(projectId, before.filter((b) => b.id !== blockId));
    try {
      await deleteBlock(blockId);
    } catch (e) {
      setProjectBlocks(projectId, before);
      setBlockError(e instanceof PortfolioError ? e.message : "블록을 삭제하지 못했습니다.");
    }
  };

  const moveBlockIn = async (projectId: string, index: number, dir: -1 | 1) => {
    const before = blocks[projectId] ?? [];
    const to = index + dir;
    if (to < 0 || to >= before.length) return;
    const next = [...before];
    [next[index], next[to]] = [next[to], next[index]];
    const renumbered = next.map((b, i) => ({ ...b, position: i }));
    setProjectBlocks(projectId, renumbered);
    try {
      await reorderBlocks(renumbered);
    } catch (e) {
      setProjectBlocks(projectId, before);
      setBlockError(e instanceof PortfolioError ? e.message : "순서를 저장하지 못했습니다.");
    }
  };

  /** 전체화면 미리보기에 넘기는 편집 창구. */
  const blockEditor: BlockEditorApi = {
    add: (projectId, kind, atIndex) => void addBlockAt(projectId, kind as "text" | "divider", atIndex),
    update: (projectId, blockId, content) => void saveBlockContent(projectId, blockId, content),
    move: (projectId, index, dir) => void moveBlockIn(projectId, index, dir),
    remove: (projectId, blockId) => void removeBlockFrom(projectId, blockId),
  };

  useEffect(() => {
    if (!id) {
      setLoadError("포트폴리오 id가 없습니다.");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getPortfolioWithProjects(id)
      .then(({ portfolio: p, projects: ps }) => {
        if (!alive) return;
        setPortfolio(p);
        setProjects(ps);
        if (ps.length > 0) {
          const at = initialProjectId ? ps.findIndex((x) => x.id === initialProjectId) : -1;
          loadProject(at >= 0 ? at : 0, ps);
        }

        // 이미지는 한 번에 다 읽습니다 — 탭을 옮길 때마다 부르면 그때마다
        // 기다려야 하고, 미리보기는 어차피 전체 프로젝트를 그립니다.
        if (ps.length > 0) {
          void loadImages(ps.map((x) => x.id));
        }
        listBlocks(p.id)
          .then((m) => alive && setBlocks(m))
          .catch(() => {
            // 블록을 못 읽어도 본문은 편집할 수 있어야 합니다.
          });
        setLastSavedAt(new Date(p.updated_at).getTime());
        if (p.cover_image_path) {
          // 표지를 못 불러와도 나머지 미리보기는 그려져야 하므로 조용히
          // 넘어갑니다(템플릿이 coverUrl null 을 알아서 처리합니다).
          getCoverImageUrl(p.cover_image_path)
            .then((url) => {
              if (!alive) return;
              setCoverUrl(url);
              setSavedCoverUrl(url);
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const currentProject = projects[projectIndex];
  /** 대화로 채울 수 있는 빈 칸 수(역할 포함 6칸). 입력 중인 값 기준입니다. */
  const emptyStoryCount = [context, role, problem, execution, outcome, reflection].filter((v) => !v.trim()).length;

  /** 미리보기에 넘길 데이터입니다.
   *
   *  편집 중인 탭의 값은 저장하기 전까지 projects 배열에 반영되지 않습니다
   *  (저장 시점에만 반영). 그래서 그 항목만 지금 입력칸의 값으로 덮어써서
   *  넘깁니다 — 저장을 눌러야 미리보기가 바뀐다면 "실시간"이 아닙니다. */
  const previewProjects = useMemo(
    () =>
      projects.map((p, i) =>
        i === projectIndex
          ? { ...p, name: titleField, context, role, problem, execution, outcome, reflection, stack, depth }
          : p
      ),
    [
      projects,
      projectIndex,
      titleField,
      context,
      role,
      problem,
      execution,
      outcome,
      reflection,
      stack,
      depth,
    ]
  );

  /** 템플릿에 넘길 모양으로. 행에서 화면에 필요한 것만 추립니다. */
  const previewImages: ProjectImageMap = useMemo(() => {
    const out: ProjectImageMap = {};
    for (const [pid, list] of Object.entries(projectImages)) {
      out[pid] = list.map((i) => ({ id: i.id, url: i.url, caption: i.caption }));
    }
    return out;
  }, [projectImages]);

  /** "프로젝트 개요"의 7칸을 순서 있는 케이스 스터디 흐름으로 보여주기 위한
   *  메타데이터입니다. 예전에는 placeholder 텍스트가 곧 라벨이라 필드를 다
   *  채우고 나면 지금 뭘 적고 있는 칸인지 알 수 없었습니다 — 이제 칸마다
   *  실제 <label>과 한 줄 안내, 그리고 순서(맥락→문제→실행→성과→회고)를
   *  숫자로 보여줍니다. ([2026-09-22] 전에는 AI가 안 채워준 칸에 "직접
   *  입력" 배지를 달았는데, 사용자에게는 쓸모없는 구분이었습니다 — 어차피
   *  다 본인이 고쳐야 하는 칸입니다. 배지만 늘어서 화면이 시끄러웠습니다.)
   *  (옛 주석: aiFilled 가 false 인 칸 — 담당 역할·문제 정의·배운
   *  점)은 AI 초안에 대응 필드가 없어 항상 직접 입력해야 하는 칸이라는 걸
   *  라벨 옆 배지로 표시합니다. */
  const storyFields: Array<{
    key: string;
    label: string;
    helper: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    rows: number;
  }> = [
    {
      key: "context",
      label: "맥락 및 배경",
      helper: "이 프로젝트를 하게 된 상황이나 배경을 적어주세요.",
      placeholder: "예: 기존 온보딩 퍼널의 이탈률이 40%를 넘어서면서 개선이 필요했습니다.",
      value: context,
      onChange: setContext,
      rows: 3,
    },
    {
      key: "problem",
      label: "문제 정의",
      helper: "해결하려고 했던 핵심 문제를 한두 문장으로 정리하세요.",
      placeholder: "예: 신규 사용자가 첫 화면에서 다음 단계로 넘어가지 못하고 있었습니다.",
      value: problem,
      onChange: setProblem,
      rows: 2,
    },
    {
      key: "execution",
      label: "실행 내용",
      helper: "문제를 풀기 위해 실제로 한 일을 구체적으로 적으세요.",
      placeholder: "예: 온보딩 단계를 5단계에서 3단계로 줄이고, 각 단계에 진행률 표시를 추가했습니다.",
      value: execution,
      onChange: setExecution,
      rows: 3,
    },
    {
      key: "outcome",
      label: "핵심 성과 및 수치",
      helper: "수치나 결과로 보여줄 수 있는 성과를 적으세요.",
      placeholder: "예: 온보딩 완료율이 52%에서 71%로 개선되었습니다.",
      value: outcome,
      onChange: setOutcome,
      rows: 2,
    },
    {
      key: "reflection",
      label: "배운 점 및 회고",
      helper: "이 프로젝트를 통해 배운 점이나 아쉬웠던 점을 적으세요.",
      placeholder: "예: 초기 가설 검증 없이 구현부터 시작해서 한 차례 방향을 수정해야 했습니다.",
      value: reflection,
      onChange: setReflection,
      rows: 2,
    },
  ];

  /** 지금 탭에 보이는 7칸을 현재 프로젝트 행에 저장합니다. 저장 버튼과
   *  프로젝트 탭 전환 둘 다 여기를 거칩니다 — 탭을 바꿀 때 저장하지 않으면
   *  방금 고친 내용이 조용히 사라지기 때문입니다. */
  const saveCurrentProject = async (): Promise<boolean> => {
    const current = projects[projectIndex];
    if (!current) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const patch = {
        name: titleField,
        context,
        role,
        problem,
        execution,
        outcome,
        reflection,
        stack,
        depth,
      };
      await updatePortfolioProject(current.id, patch);
      setProjects((prev) => prev.map((p, i) => (i === projectIndex ? { ...p, ...patch } : p)));
      setLastSavedAt(Date.now());
      return true;
    } catch (e) {
      setSaveError(e instanceof PortfolioError ? e.message : "저장하지 못했습니다.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * [2026-09-25] "대화로 채우기" — 이 프로젝트의 빈 칸만 묻는 대화로 갑니다
   * (docs/chat-builder-design.md). 떠나기 전에 저장합니다. 저장 없이 가면
   * 방금 쓴 칸이 서버에는 비어 있어서, 대화가 그 칸을 또 묻습니다.
   */
  const goFillByChat = async () => {
    const current = projects[projectIndex];
    if (!current) return;
    const ok = await saveCurrentProject();
    if (ok) navigate(`/chat/new?project=${current.id}`);
  };

  const switchProject = async (index: number) => {
    if (index === projectIndex) return;
    await saveCurrentProject();
    loadProject(index, projects);
  };

  /** 빈 프로젝트 행을 하나 만들고 바로 그 탭으로 전환합니다. AI 초안이
   *  뽑아준 프로젝트 개수가 실제와 다를 때(하나 더 있었다거나, 초안 없이
   *  손으로 새로 쓰고 싶을 때) 쓰라고 만든 버튼입니다.
   *
   *  position 은 projects.length 가 아니라 "지금 있는 것 중 가장 큰
   *  position + 1"로 계산합니다 — 중간 프로젝트를 삭제한 적이 있으면
   *  length 와 실제 최댓값이 어긋나서, length 를 그대로 쓰면 이미 있는
   *  position 과 겹쳐 정렬이 꼬입니다. */
  const handleAddProject = async () => {
    if (!portfolio) return;
    setAddingProject(true);
    setAddProjectError(null);
    try {
      await saveCurrentProject();
      const nextPosition = projects.reduce((max, p) => Math.max(max, p.position), -1) + 1;
      const created = await createPortfolioProject(portfolio.id, nextPosition);
      const next = [...projects, created];
      setProjects(next);
      loadProject(next.length - 1, next);
    } catch (e) {
      setAddProjectError(e instanceof PortfolioError ? e.message : "프로젝트를 추가하지 못했습니다.");
    } finally {
      setAddingProject(false);
    }
  };

  /** 지금 탭의 프로젝트를 삭제합니다. 되돌릴 수 없는 동작이라 버튼을 바로
   *  두지 않고, 누르면 "정말 삭제할까요?" 확인 상태로 한 번 더 거칩니다. */
  const handleDeleteProject = async () => {
    if (!currentProject) return;
    setDeleting(true);
    setDeleteProjectError(null);
    try {
      await deletePortfolioProject(currentProject.id);
      const next = projects.filter((_, i) => i !== projectIndex);
      setProjects(next);
      setDeleteConfirming(false);
      if (next.length > 0) {
        loadProject(Math.min(projectIndex, next.length - 1), next);
      } else {
        setProjectIndex(0);
        setTitleField("");
        setContext("");
        setRole("");
        setProblem("");
        setExecution("");
        setOutcome("");
        setReflection("");
      }
    } catch (e) {
      setDeleteProjectError(e instanceof PortfolioError ? e.message : "프로젝트를 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          포트폴리오를 불러오는 중입니다.
        </p>
      </div>
    );
  }

  if (loadError || !portfolio) {
    return (
      <div className="max-w-3xl space-y-2">
        <p role="alert" className="text-sm text-brand">
          {loadError ?? "포트폴리오를 찾을 수 없습니다."}
        </p>
        <Link to="/wizard/source" className="text-xs text-brand hover:underline">
          원본 자료 입력부터 다시 시작하기
        </Link>
      </div>
    );
  }

  const stylePanel = (
    <StylePanel
      portfolioId={portfolio.id}
      initial={portfolio}
      savedCoverUrl={savedCoverUrl}
      onStyleChange={(s) => setPortfolio((prev) => (prev ? { ...prev, ...s } : prev))}
      onCoverPreviewChange={setCoverUrl}
      onCoverSaved={(url) => {
        setCoverUrl(url);
        setSavedCoverUrl(url);
      }}
    />
  );

  return (
    <div className="flex items-start gap-6">
      <div className="flex-1 min-w-0 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/wizard/draft" className="text-xs text-brand hover:underline">
            AI 초안 생성으로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={() => navigate(`/wizard/export/${portfolio.id}`)}>
              내보내기
            </button>
          </div>
        </div>
        <div>
          {titleDraft === null ? (
            <button
              type="button"
              onClick={() => {
                setTitleError(null);
                setTitleDraft(portfolio.title);
              }}
              className="group -mx-2 flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-neutral-800/50"
              title="이름 바꾸기"
            >
              <h1 className="truncate text-xl font-heading">{portfolio.title}</h1>
              <Pencil size={15} strokeWidth={1.75} className="shrink-0 text-neutral-500 group-hover:text-brand" />
              <span className="sr-only">이름 바꾸기</span>
            </button>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const next = titleDraft.trim();
                if (!next) {
                  setTitleError("이름을 입력해 주세요.");
                  return;
                }
                if (next === portfolio.title) {
                  setTitleDraft(null);
                  return;
                }
                setTitleSaving(true);
                try {
                  await updatePortfolioTitle(portfolio.id, next);
                  setPortfolio((prev) => (prev ? { ...prev, title: next } : prev));
                  setTitleDraft(null);
                } catch (err) {
                  setTitleError(err instanceof Error ? err.message : "이름을 저장하지 못했습니다.");
                } finally {
                  setTitleSaving(false);
                }
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                maxLength={100}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setTitleDraft(null);
                }}
                aria-label="포트폴리오 이름"
                className="field min-w-0 flex-1 font-heading text-xl"
              />
              <button type="submit" className="btn-primary" disabled={titleSaving}>
                {titleSaving ? "저장 중…" : "저장"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setTitleDraft(null)}>
                취소
              </button>
            </form>
          )}
          {titleError && (
            <p role="alert" className="mt-1 text-xs text-brand">
              {titleError}
            </p>
          )}
          {/* [2026-09-22] 요약은 여러 줄짜리 한국어 문단이라 기본 줄
              간격(14/22, 1.57)으로는 답답합니다. 한글은 같은 크기에서 라틴
              문자보다 넓은 행간이 필요합니다 — tailwind.config.js 주석 참고. */}
          {portfolio.summary ? (
            <p className="text-sm text-neutral-400 mt-1.5 leading-[1.8] max-w-[62ch]">
              {portfolio.summary}
            </p>
          ) : (
            <p className="text-xs text-neutral-600 mt-1 flex items-start gap-1.5">
              <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
              <span>요약이 아직 없습니다. 아래 항목을 직접 채워 주세요.</span>
            </p>
          )}
        </div>

        {!isWide && stylePanel}

        <div className="entry space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="entry-title mb-0">프로젝트 개요</h2>
            <div className="flex items-center gap-2">
              {currentProject && !deleteConfirming && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirming(true)}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-brand"
                >
                  <Trash2 size={12} strokeWidth={1.75} />이 프로젝트 삭제
                </button>
              )}
            </div>
          </div>

          {deleteConfirming && (
            <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand/[0.06] px-3.5 py-2.5 text-xs">
              <span className="text-neutral-300">
                "{currentProject?.name || "제목 없음"}"을(를) 정말 삭제할까요? 되돌릴 수 없습니다.
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  className="text-neutral-400 hover:underline"
                  onClick={() => setDeleteConfirming(false)}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="font-medium text-brand hover:underline disabled:opacity-40"
                  onClick={() => void handleDeleteProject()}
                  disabled={deleting}
                >
                  {deleting ? "삭제하는 중" : "삭제"}
                </button>
              </div>
            </div>
          )}
          {deleteProjectError && (
            <p role="alert" className="text-xs text-brand">
              {deleteProjectError}
            </p>
          )}

          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {projects.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void switchProject(i)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                    i === projectIndex
                      ? "border-brand bg-brand/10 text-brand font-medium"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  {p.name || "제목 없음"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void handleAddProject()}
                disabled={addingProject}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
                {addingProject ? "추가하는 중" : "새 프로젝트"}
              </button>
            </div>
          )}

          {projects.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">
                프로젝트가 없습니다.{" "}
                <Link to="/wizard/source" className="text-brand hover:underline">
                  원본 자료 입력
                </Link>
                부터 다시 시작하거나, 아래에서 빈 프로젝트를 직접 추가할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={() => void handleAddProject()}
                disabled={addingProject}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-3.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
                {addingProject ? "추가하는 중" : "새 프로젝트"}
              </button>
            </div>
          )}
          {addProjectError && (
            <p role="alert" className="text-xs text-brand">
              {addProjectError}
            </p>
          )}

          {currentProject && (
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-xs font-medium text-neutral-200">이 프로젝트는</span>
                <div className="inline-flex rounded-md border border-neutral-800 p-0.5">
                  {([
                    { v: "brief", label: "간단히" },
                    { v: "full", label: "케이스 스터디" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setDepth(o.v)}
                      aria-pressed={depth === o.v}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        depth === o.v
                          ? "bg-brand/15 text-brand"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-neutral-600">
                  {depth === "brief"
                    ? "제목 · 한 줄 설명 · 이미지만 보여줍니다"
                    : "다섯 단계를 모두 써서 깊게 보여줍니다"}
                </span>
              </div>
            </div>
          )}

          {/* [2026-09-22] 프로젝트별 이미지. "간단히" 에서는 이 영역이
              사실상 본문이라 툴·키워드보다 위에 둡니다. */}
          {currentProject && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-neutral-200">
                  이미지
                  <span className="text-neutral-600 font-normal">
                    {" "}· {currentImages.length}/{MAX_PROJECT_IMAGES}
                  </span>
                </span>
                <label className="text-xs text-brand hover:underline cursor-pointer inline-flex items-center gap-1">
                  <ImagePlus size={12} aria-hidden="true" />
                  {uploadingImage ? "올리는 중…" : "이미지 추가"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploadingImage || currentImages.length >= MAX_PROJECT_IMAGES}
                    onChange={(e) => {
                      void addImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {currentImages.length === 0 && (
                <p className="text-xs text-neutral-600">
                  화면 캡처나 결과물 사진을 올리면 템플릿 안에 함께 들어갑니다.
                </p>
              )}

              {currentImages.length > 0 && (
                <ul className="grid grid-cols-4 gap-2">
                  {currentImages.map((img, i) => (
                    <li
                      key={img.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void dropImage(i)}
                      className={`group relative rounded-md overflow-hidden border ${
                        dragIndex === i ? "border-brand" : "border-neutral-800"
                      }`}
                    >
                      <img src={img.url} alt="" className="aspect-[4/3] w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                        <GripVertical size={12} aria-hidden="true" />
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeImage(img)}
                        aria-label="이미지 삭제"
                        className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                      <input
                        defaultValue={img.caption}
                        onBlur={(e) => void saveCaption(img, e.target.value.trim())}
                        placeholder="설명 (선택)"
                        className="w-full border-0 bg-neutral-900/80 px-1.5 py-1 text-[11px] text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                      />
                    </li>
                  ))}
                </ul>
              )}

              {imageError && (
                <p role="alert" className="text-xs text-brand">
                  {imageError}
                </p>
              )}
            </div>
          )}

          {currentProject && (
            <div className="space-y-1.5">
              <label htmlFor="proj-stack" className="text-xs font-medium text-neutral-200">
                사용한 툴 · 키워드
              </label>
              {/* 칩과 입력칸을 하나의 상자 안에 넣습니다. 전에는 입력칸이
                  테두리 없이 투명이라 칩이 하나도 없을 때 그냥 안내 글자처럼
                  보였습니다 — 누를 수 있는 곳이라는 신호가 없었습니다.
                  <label>로 감싸서 상자 어디를 눌러도 입력칸에 커서가 갑니다. */}
              <label
                htmlFor="proj-stack"
                className="field flex flex-wrap items-center gap-1.5 cursor-text
                  focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15"
              >
                {stack.map((tag) => (
                  <span
                    key={tag}
                    className="badge bg-neutral-800 text-neutral-300 inline-flex items-center gap-1 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setStack((prev) => prev.filter((t) => t !== tag))}
                      aria-label={`${tag} 제거`}
                      className="grid size-4 place-items-center rounded text-neutral-500 hover:text-brand"
                    >
                      <X size={11} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  id="proj-stack"
                  value={stackInput}
                  onChange={(e) => setStackInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addStack(stackInput);
                    } else if (e.key === "Backspace" && !stackInput) {
                      // 빈 칸에서 지우면 마지막 것부터 떨어집니다 — 태그
                      // 입력칸의 관례라 별도 안내 없이도 통합니다.
                      setStack((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => addStack(stackInput)}
                  placeholder={stack.length === 0 ? "예: Figma, UX 리서치, React" : "추가"}
                  className="min-w-[7rem] flex-1 border-0 bg-transparent p-0 text-sm text-neutral-100
                    placeholder:text-neutral-600 focus:outline-none focus:ring-0"
                />
              </label>
              {stack.length === 0 && (
                <p className="text-xs text-neutral-600">
                  쉼표나 Enter 로 구분해 넣으세요. 템플릿에서 프로젝트 제목 아래
                  줄에 나옵니다.
                </p>
              )}
            </div>
          )}

          {projects.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="proj-title" className="text-xs font-medium text-neutral-300">
                    프로젝트 제목
                  </label>
                  <input
                    id="proj-title"
                    value={titleField}
                    onChange={(e) => setTitleField(e.target.value)}
                    placeholder="예: 사용자 온보딩 퍼널 개선"
                    className="field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="proj-role"
                    className="text-xs font-medium text-neutral-300 inline-flex items-center gap-1.5"
                  >
                    담당 역할
                  </label>
                  <input
                    id="proj-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="예: 프론트엔드 리드"
                    className="field"
                  />
                </div>
              </div>

              {/* [2026-09-25] 빈 칸이 있으면 대화로 채우기. 저장소 README 로 만든
                  초안은 코드 설명은 있어도 문제·성과·배운 점이 비기 쉽습니다.
                  "간단히"는 한 줄 설명만 쓰므로 띄우지 않습니다. */}
              {depth === "full" && emptyStoryCount > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
                  <MessagesSquare size={18} strokeWidth={1.75} className="text-brand shrink-0" />
                  <p className="flex-1 text-sm text-neutral-300 break-keep">
                    빈 칸 <b className="text-neutral-100">{emptyStoryCount}개</b> — 질문에 답하면 대신 정리해 드려요.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary py-2 shrink-0 disabled:opacity-50"
                    onClick={() => void goFillByChat()}
                    disabled={saving}
                  >
                    대화로 채우기
                  </button>
                </div>
              )}

              <div className="border-t border-neutral-800 pt-4">
                {/* [2026-09-22] "간단히" 에서는 한 줄 설명만 남기고 나머지를
                    접습니다. 삭제가 아니라 접힘이라는 것이 보여야 합니다 —
                    안 그러면 사용자가 글이 날아갔다고 생각합니다. */}
                <p className="text-xs text-neutral-500 mb-4">
                  {depth === "brief"
                    ? "간단히 보여줄 프로젝트입니다. 한 줄 설명과 이미지만 들어갑니다."
                    : "아래 5가지는 케이스 스터디 흐름 순서(맥락 → 문제 → 실행 → 성과 → 회고)대로 적으면 자연스럽게 이어집니다."}
                </p>
                <div className="space-y-5">
                  {storyFields
                    .filter((f) => depth === "full" || f.key === "context")
                    .map((f, i) => (
                    <div key={f.key} className="flex gap-3">
                      <div className="flex flex-col items-center pt-0.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-400">
                          {i + 1}
                        </span>
                        {i < storyFields.length - 1 && (
                          <span className="w-px flex-1 bg-neutral-800 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5 pb-0.5">
                        <label
                          htmlFor={`proj-${f.key}`}
                          className="text-xs font-medium text-neutral-200 inline-flex items-center gap-1.5"
                        >
                          {f.label}
                        </label>
                        {/* 안내는 칸이 비어 있을 때만 보여줍니다. 6칸에
                            라벨·안내·예시가 늘 함께 쌓이면 화면이 안내문으로
                            덮입니다 — 처음엔 필요하지만 한 번 채우고 나면
                            소음입니다. */}
                        {!f.value && <p className="text-xs text-neutral-600">{f.helper}</p>}
                        <textarea
                          id={`proj-${f.key}`}
                          value={f.value}
                          onChange={(e) => f.onChange(e.target.value)}
                          placeholder={f.placeholder}
                          rows={f.rows}
                          // 본문 기준(14px)보다 한 단계 위입니다. 이 앱에서
                          // 글을 가장 오래 쓰고 고치는 칸이라, 빽빽한 곳에
                          // 맞춘 기준을 그대로 적용할 이유가 없습니다.
                          className="field-area text-base leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {depth === "brief" && (
                  <p className="text-xs text-neutral-600 mt-4 border-l-2 border-l-neutral-800 pl-3">
                    문제 정의 · 실행 내용 · 핵심 성과 · 배운 점은 접혀 있습니다.
                    지워진 것이 아니라 그대로 남아 있어서, 케이스 스터디로
                    바꾸면 다시 나타납니다.
                  </p>
                )}
              </div>

              {/* [2026-09-23] 블록 편집이 다시 이 자리로 돌아왔습니다.
                  템플릿이 HTML 로 바뀌면서 미리보기가 iframe 이 됐고,
                  iframe 안에서 고치려면 postMessage 로 주고받아야 합니다.
                  그건 다음 단계입니다 — 그때까지 편집할 방법이 아예 없는
                  것보다 여기 두는 편이 낫습니다. */}
              <div className="border-t border-neutral-800 pt-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-medium text-neutral-200">
                    직접 추가한 내용
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void addBlockAt(currentProject.id, "text", currentBlocks.length)}
                      disabled={blockBusy}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                    >
                      <Type size={12} strokeWidth={2} />글 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => void addBlockAt(currentProject.id, "divider", currentBlocks.length)}
                      disabled={blockBusy}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                    >
                      <Minus size={12} strokeWidth={2} />구분선
                    </button>
                  </div>
                </div>

                {currentBlocks.length === 0 && (
                  <p className="text-xs text-neutral-600">
                    다섯 칸에 안 맞는 내용은 여기에 원하는 만큼 쌓으세요.
                  </p>
                )}

                <div className="space-y-3">
                  {currentBlocks.map((b, i) => (
                    <div key={b.id} className="rounded-lg border border-neutral-800 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-600">
                          {b.content.kind === "divider" ? "구분선" : "글"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {b.content.kind === "text" && (
                            <select
                              value={b.content.style}
                              onChange={(e) =>
                                void saveBlockContent(currentProject.id, b.id, {
                                  ...b.content,
                                  style: e.target.value as "heading" | "body" | "small",
                                } as BlockContent)
                              }
                              className="bg-transparent border border-neutral-800 rounded px-1.5 py-0.5 text-xs text-neutral-400"
                              aria-label="글 크기"
                            >
                              <option value="heading" className="bg-neutral-900">제목</option>
                              <option value="body" className="bg-neutral-900">본문</option>
                              <option value="small" className="bg-neutral-900">작게</option>
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => void moveBlockIn(currentProject.id, i, -1)}
                            disabled={i === 0}
                            aria-label="위로"
                            className="text-neutral-600 hover:text-neutral-300 disabled:opacity-25 p-0.5"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveBlockIn(currentProject.id, i, 1)}
                            disabled={i === currentBlocks.length - 1}
                            aria-label="아래로"
                            className="text-neutral-600 hover:text-neutral-300 disabled:opacity-25 p-0.5"
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeBlockFrom(currentProject.id, b.id)}
                            aria-label="블록 삭제"
                            className="text-neutral-600 hover:text-brand p-0.5"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {b.content.kind === "text" && (
                        <>
                          <input
                            defaultValue={b.content.label}
                            onBlur={(e) =>
                              void saveBlockContent(currentProject.id, b.id, {
                                ...b.content,
                                label: e.target.value,
                              } as BlockContent)
                            }
                            placeholder="제목 (선택)"
                            className="field py-1.5 text-sm"
                          />
                          <textarea
                            defaultValue={b.content.text}
                            onBlur={(e) =>
                              void saveBlockContent(currentProject.id, b.id, {
                                ...b.content,
                                text: e.target.value,
                              } as BlockContent)
                            }
                            rows={3}
                            placeholder="내용"
                            className="field-area text-base leading-relaxed"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {blockError && (
                <p role="alert" className="text-xs text-brand">
                  {blockError}
                </p>
              )}
            </>
          )}
        </div>

        {/* [2026-09] 아래 세 섹션은 전부 아직 동작하지 않습니다 — "AI 문장
            다듬기"는 버튼이 상태만 바꾸고, 나머지 둘은 고정된 예시 데이터를
            그립니다. 그런데 이 셋이 편집기 왼쪽 열의 절반을 차지하면서,
            정작 글을 쓰는 칸이 화면 위쪽 일부로 밀려 있었습니다. 지우지
            않고 접어 둡니다 — 만들 화면의 설계가 여기 담겨 있어서 참고용으로
            남길 가치가 있습니다. 실제로 동작하게 되는 순간 이 껍데기를
            벗기면 됩니다. */}
        {/* [09-26] 접힌 줄이 작은 회색 글씨 한 줄이라 거의 보이지 않았습니다.
            "준비 중"임을 분명히 하면서, 무엇이 들어올지는 한눈에 보이게. */}
        <details className="entry group p-0">
          <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-neutral-800/40 [&::-webkit-details-marker]:hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Clock className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                준비 중인 기능 3개
                <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] font-normal text-neutral-400">
                  아직 동작하지 않아요
                </span>
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                {["AI 문장 다듬기", "근거 확인", "이력서 대조"].map((name) => (
                  <span key={name} className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300">
                    {name}
                  </span>
                ))}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-brand">
              <span className="group-open:hidden">미리 보기</span>
              <span className="hidden group-open:inline">접기</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-6 border-t border-neutral-800 p-6">
          <div className="entry space-y-3">
            <h2 className="entry-title mb-0">AI 문장 다듬기</h2>
            <p className="text-xs text-neutral-400">
              다듬을 문장을 선택하거나 아래에 붙여넣어 목표 직무에 맞는 케이스 스터디
              문장으로 개선할 수 있습니다.
            </p>
            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder="다듬을 문장 입력"
              rows={2}
              className="field-area"
            />
            <button
              className="btn-secondary disabled:opacity-40"
              disabled={!sentence.trim()}
              onClick={() => setShowRefine(true)}
            >
              AI 문장 다듬기 요청
            </button>

            {showRefine && (
              <div className="border-t border-neutral-800 pt-3 mt-3">
                <p className="text-xs text-neutral-500 mb-2">
                  아래 개선안을 원문과 비교하고 적용 여부를 직접 결정하세요. AI는 사실이나
                  의도를 임의로 변경하지 않습니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-sm divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
                  <div className="sm:pr-6 pb-4 sm:pb-0">
                    <p className="text-xs text-neutral-500 mb-1">원문</p>
                    {sentence}
                  </div>
                  <div className="sm:pl-6 pt-4 sm:pt-0">
                    <p className="text-xs text-neutral-500 mb-1">AI 개선안</p>
                    {sentence
                      ? `${sentence} (핵심 성과와 역할을 강조한 케이스 스터디 문장으로 개선된 예시입니다.)`
                      : ""}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="btn-secondary" onClick={() => setShowRefine(false)}>
                    취소
                  </button>
                  <button className="btn-primary" onClick={() => setShowRefine(false)}>
                    개선안 적용
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="entry space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="entry-title mb-0">AI 근거 및 사실 확인</h2>
              <span className="badge bg-amber-500/15 text-amber-400">
                {evidenceItems.filter((e) => e.status === "검토 필요").length}건 검토 필요
              </span>
            </div>
            <p className="text-xs text-neutral-400 flex items-start gap-1.5">
              <Info size={13} strokeWidth={1.5} className="text-neutral-500 shrink-0 mt-0.5" />
              <span>
                AI가 제안한 문장별 원본 자료와 근거를 확인하고 사실 여부를 직접
                표시하세요.{" "}
                <span className="text-neutral-600">
                  (아래는 예시 데이터입니다 — 문장-출처 연결 기능은 아직 없습니다.)
                </span>
              </span>
            </p>
            <ul>
              {evidenceItems.map((e) => (
                <li key={e.id} className="row text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-200">{e.label}</span>
                    <span
                      className={`badge ${
                        e.status === "확인 완료"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">연결 원본: {e.source}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <button className="text-brand hover:underline">원본 보기</button>
                    <button className="text-neutral-400 hover:underline">불일치 표시</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="entry space-y-3">
            <h2 className="entry-title mb-0">이력서·포트폴리오 불일치 확인</h2>
            <p className="text-xs text-neutral-400">
              경력 기간, 소속과 역할, 프로젝트명, 성과 수치의 불일치 가능성 항목을
              자동으로 탐지합니다.{" "}
              <span className="text-neutral-600">(예시 데이터 — 이력서 업로드 기능은 아직 없습니다.)</span>
            </p>
            <ul>
              {mismatchItems.map((m) => (
                <li key={m.id} className="row text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-200">{m.label}</span>
                    <button className="text-xs text-brand hover:underline">확인</button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{m.detail}</p>
                </li>
              ))}
            </ul>
            <button className="text-xs text-brand hover:underline">전체 불일치 항목 보기</button>
          </div>

          </div>
        </details>

        <div className="entry flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-neutral-200">
              마지막 저장: {formatRelativeTime(lastSavedAt)}
            </p>
            {saveError && (
              <p role="alert" className="text-xs text-brand mt-1">
                {saveError}
              </p>
            )}
            <p className="text-xs text-neutral-600 mt-1">
              탭을 옮기면 자동으로 먼저 저장됩니다.
            </p>
          </div>
          {/* [2026-09-22] shrink-0 이 없어서 글자가 두 줄로 쪼개졌습니다.
              justify-between 은 남는 폭을 나눠 가지므로, 줄어들면 안 되는
              쪽에는 명시해줘야 합니다. */}
          <button
            className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-40 inline-flex items-center gap-1.5"
            disabled={saving || projects.length === 0}
            onClick={() => void saveCurrentProject()}
          >
            {saving ? (
              "저장하는 중"
            ) : (
              <>
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* 미리보기 패널을 고정 폭(420/560px)으로 두니 넓은 모니터에서
          오른쪽이 계속 비었습니다. 왼쪽 폼과 같이 flex-1 로 두면 폼이
          max-w-3xl 에 걸린 뒤 남는 폭을 이쪽이 전부 가져갑니다. */}
      {isWide && (
        <aside className="sticky top-6 flex-1 min-w-[380px] space-y-3">
          {stylePanel}
          <EditorPreview
            portfolio={portfolio}
            projects={previewProjects}
            coverUrl={coverUrl}
            images={previewImages}
            blocks={blocks}
            onExpand={() => setExpanded(true)}
          />
        </aside>
      )}

      {/* [2026-09-22] 전체화면 미리보기.
          오른쪽 칼럼의 미리보기는 폭에 맞춰 눌려 있어서 "내보내면 이렇게
          나온다"를 확인하기엔 작습니다. 같은 PortfolioRenderer 를 씁니다 —
          별도 뷰를 만들면 내보내기와 어긋나는 순간이 옵니다. */}
      {expanded && portfolio && (
        <div
          className="fixed inset-0 z-20 bg-black/80 overflow-y-auto"
          onClick={() => setExpanded(false)}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3">
            <p className="text-xs text-neutral-400 bg-neutral-900/90 border border-neutral-800 rounded-md px-3 py-1.5">
              내보내면 이 모양 그대로 나옵니다.
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md bg-neutral-900/90 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:text-brand inline-flex items-center gap-1.5"
            >
              <X size={13} aria-hidden="true" />
              닫기
            </button>
          </div>
          <div
            className="mx-auto max-w-[1320px] pb-16 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-xl overflow-hidden bg-white">
              <TemplateFrame
                portfolio={portfolio}
                projects={previewProjects}
                coverUrl={coverUrl}
                images={previewImages}
                blocks={blocks}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
