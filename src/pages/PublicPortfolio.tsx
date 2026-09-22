import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCoverImageUrl, getPublicPortfolio, listProjectImages } from "../lib/portfolios";
import type { PortfolioProjectRow, PortfolioRow } from "../lib/portfolios";
import { DEFAULT_FONT, FONT_STACKS } from "../lib/portfolioTheme";
import PortfolioRenderer from "../components/portfolio-templates/PortfolioRenderer";
import type { ProjectImageMap } from "../components/portfolio-templates/types";
import { listBlocks, type BlockMap } from "../lib/blocks";
/** 프로젝트 이미지를 템플릿이 쓰는 모양으로 읽습니다.
 *  PDF·공개 링크 둘 다 이 경로를 씁니다 — 편집기와 다른 방법으로 읽으면
 *  "편집기엔 보이는데 PDF엔 없는" 상태가 생깁니다. */
async function loadImageMap(projectIds: string[]): Promise<ProjectImageMap> {
  const rows = await listProjectImages(projectIds);
  const out: ProjectImageMap = {};
  for (const r of rows) {
    const url = await getCoverImageUrl(r.storage_path);
    (out[r.project_id] ??= []).push({ id: r.id, url, caption: r.caption });
  }
  return out;
}


/**
 * 공개된 포트폴리오를 **로그인 없이** 보는 화면. `/p/:id`.
 *
 * [왜 필요했나]
 * visibility 컬럼과 RLS 는 처음부터 있었는데 이 화면이 없어서, 공개로
 * 바꿔도 남에게 보여줄 주소가 없었습니다. 포트폴리오 서비스에서 "만들고 →
 * 공개하고 → 링크를 보낸다"가 끝까지 되는 건 이 화면이 생긴 지금부터입니다.
 *
 * [왜 AppLayout 밖인가]
 * 사이드바·내 서재·계정 메뉴는 방문자에게 의미가 없습니다. 남의
 * 포트폴리오를 보러 온 사람에게 이 서비스의 내부 구조를 보여줄 이유가
 * 없어서, 레이아웃 없이 본문만 그립니다. 대신 맨 아래에 작은 출처 표시를
 * 둡니다 — 이 링크를 받은 사람이 "이게 뭐로 만든 거지"를 알 수 있어야
 * 하고, 사실상 이 서비스의 유일한 유기적 유입 경로이기도 합니다.
 *
 * [데스크탑 게이트를 적용하지 않습니다]
 * 앱 본체는 1200px 미만을 막지만 이 화면은 예외입니다. 공유 링크는
 * 대부분 휴대폰에서 열립니다 — 채용 담당자가 메신저로 받은 링크를 폰에서
 * 눌렀을 때 "데스크탑에서 봐주세요"가 뜨면 그걸로 끝입니다.
 */
export default function PublicPortfolio() {
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectRow[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ProjectImageMap>({});
  const [blocks, setBlocks] = useState<BlockMap>({});

  useEffect(() => {
    if (!id) {
      setState("missing");
      return;
    }
    let alive = true;

    getPublicPortfolio(id)
      .then(async (result) => {
        if (!alive) return;
        if (!result) {
          setState("missing");
          return;
        }
        setPortfolio(result.portfolio);
        setProjects(result.projects);
        setState("ok");

        // 이미지는 본문이 뜬 뒤에 붙습니다. 이미지를 기다리느라 글까지
        // 늦게 보이면, 링크를 연 사람에게 빈 화면이 더 길어집니다.
        loadImageMap(result.projects.map((p) => p.id))
          .then((m) => alive && setImages(m))
          .catch(() => {});

        listBlocks(result.portfolio.id)
          .then((m) => alive && setBlocks(m))
          .catch(() => {});

        if (result.portfolio.cover_image_path) {
          try {
            const url = await getCoverImageUrl(result.portfolio.cover_image_path);
            if (alive) setCoverUrl(url);
          } catch {
            // 표지를 못 불러와도 본문은 보여줍니다 — 템플릿이 null 을 처리합니다.
          }
        }
      })
      .catch(() => alive && setState("missing"));

    return () => {
      alive = false;
    };
  }, [id]);

  // 공유 링크는 미리보기 카드로 먼저 읽힙니다. 이 앱은 CSR 이라 크롤러가
  // 보는 건 여전히 index.html 이지만, 최소한 브라우저 탭과 방문 기록에는
  // 제목이 남습니다.
  useEffect(() => {
    if (!portfolio) return;
    const previous = document.title;
    document.title = `${portfolio.title} — Tellmefolio`;
    return () => {
      document.title = previous;
    };
  }, [portfolio]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      </div>
    );
  }

  if (state === "missing" || !portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-heading text-neutral-200">
            공개되지 않은 포트폴리오입니다
          </h1>
          <p className="text-sm text-neutral-500 mt-3">
            링크가 잘못되었거나, 작성자가 공개를 해제했을 수 있습니다.
          </p>
          <Link to="/" className="btn-secondary inline-flex mt-6">
            Tellmefolio 둘러보기
          </Link>
        </div>
      </div>
    );
  }

  const bodyFontStack = FONT_STACKS[portfolio.font] ?? FONT_STACKS[DEFAULT_FONT];

  return (
    <div className="min-h-screen">
      <PortfolioRenderer
        portfolio={portfolio}
        projects={projects}
        coverUrl={coverUrl}
        images={images}
        blocks={blocks}
        bodyFontStack={bodyFontStack}
      />

      <footer className="py-10 text-center">
        <Link
          to="/"
          className="text-xs text-neutral-500 hover:text-brand transition-colors"
        >
          Tellmefolio로 만든 포트폴리오입니다
        </Link>
      </footer>
    </div>
  );
}
