import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, History, LoaderCircle, Plus, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { listMyPortfolios, PortfolioError, type LibraryPortfolio } from "../lib/portfolios";
import { listOpenInterviews, type InterviewSummary } from "../lib/interview";
import { listSubmissions, type Submission } from "../lib/submissions";
import ChatStart from "../components/ChatStart";
import Bookshelf from "../components/Bookshelf";
import Reveal from "../components/Reveal";
import { NewPortfolioButton } from "../components/NewPortfolio";

/**
 * 홈 (09-26 정리 — 예시: docs/mockups/navigation.html ①).
 *
 * 전에는 위에서부터 입력창 · 현황 띠 4칸 · 책장 · "최근 작업"(책장과 같은
 * 목록) · 최근 제출 · "다음으로 할 일"(자료로 만들기 큰 카드 + 링크 둘)이
 * 쌓여 있었습니다. 같은 포트폴리오가 두 번 나오고, 만들기 입구가 위아래로
 * 두 개였습니다. 이제 셋만 남깁니다.
 *   1. 대화 입력창 — 이 앱에 온 사람이 하러 온 일
 *   2. 내 서재(책장) — 이 서비스의 얼굴. 책을 누르면 편집기, 표지에서 이름·색 수정
 *      (09-26 정리 때 카드 4개로 바꿨다가 되돌렸습니다 — 책장 인터랙션은 핵심입니다)
 *   3. 이어서 할 일 — 하다 만 대화, 최근 제출
 * 직무 전환·커뮤니티는 사이드바에 있어서 홈에서 다시 권하지 않습니다.
 */
export default function Dashboard() {
  const { session, configured } = useAuth();
  const [portfolios, setPortfolios] = useState<LibraryPortfolio[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openChats, setOpenChats] = useState<InterviewSummary[]>([]);
  const [recentSub, setRecentSub] = useState<Submission | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!configured || !userId) {
      setPortfolios([]);
      return;
    }
    let alive = true;
    listMyPortfolios(userId)
      .then((list) => alive && setPortfolios(list))
      .catch((e) => {
        if (!alive) return;
        setPortfolios([]);
        setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      });
    listOpenInterviews(2).then((l) => alive && setOpenChats(l)).catch(() => {});
    listSubmissions(null, 1)
      .then((l) => alive && setRecentSub(l[0] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [configured, session?.user?.id]);


  const todos: Array<{ key: string; icon: typeof Send; title: string; sub: string; to: string; cta: string }> = [
    ...openChats.map((c) => ({
      key: c.id,
      icon: History,
      title: "대화 이어가기",
      sub: `${c.title} · ${c.filled}칸 채움`,
      to: `/chat/${c.id}`,
      cta: "열기",
    })),
    ...(recentSub
      ? [
          {
            key: recentSub.id,
            icon: Send,
            title: "최근 제출",
            sub: `${recentSub.company || "회사 미입력"}${recentSub.position ? ` · ${recentSub.position}` : ""} · ${recentSub.submitted_on
              .slice(5, 10)
              .replace("-", "/")}`,
            to: recentSub.portfolio_id
              ? `/library/portfolios/${recentSub.portfolio_id}/versions?sub=${recentSub.id}`
              : `/submissions?sub=${recentSub.id}`,
            cta: "보기",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-14">
      {configured && <ChatStart />}

      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-heading text-xl text-neutral-100">내 서재</h2>
          {portfolios && portfolios.length > 0 && (
            <>
              <span className="text-xs text-neutral-600">{portfolios.length}권</span>
              <Link to="/library/portfolios" className="ml-auto text-sm text-brand hover:underline">
                목록으로 보기 →
              </Link>
            </>
          )}
        </div>

        {!configured ? (
          <p className="text-sm text-neutral-500">Supabase 설정이 없어 포트폴리오를 불러올 수 없습니다.</p>
        ) : portfolios === null ? (
          <p className="inline-flex items-center gap-2 text-sm text-neutral-500">
            <LoaderCircle size={14} className="animate-spin" /> 불러오는 중…
          </p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-brand">
            {loadError}
          </p>
        ) : portfolios.length === 0 ? (
          <div className="entry flex items-center gap-4">
            <p className="flex-1 text-sm text-neutral-400">
              아직 만든 포트폴리오가 없어요. 위에 프로젝트 이야기를 한 줄 적거나, 자료로 시작해 보세요.
            </p>
            <NewPortfolioButton className="btn-secondary inline-flex shrink-0 items-center gap-1.5">
              <Plus size={15} strokeWidth={2} />새 포트폴리오
            </NewPortfolioButton>
          </div>
        ) : (
          <Reveal>
            <Bookshelf
              portfolios={portfolios}
              onUpdated={(u) => setPortfolios((list) => (list ?? []).map((p) => (p.id === u.id ? u : p)))}
            />
          </Reveal>
        )}
      </section>

      {todos.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl text-neutral-100">이어서 할 일</h2>
          <div className="grid grid-cols-2 gap-3">
            {todos.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="entry group flex items-center gap-4 py-4 transition-colors hover:border-brand/50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <t.icon size={16} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-100">{t.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-500">{t.sub}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm text-brand">
                  {t.cta} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
