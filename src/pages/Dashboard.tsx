import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  Globe,
  Lock,
  Repeat,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { aiUsage } from "../mockData";
import { useAuth } from "../auth/AuthProvider";
import {
  listMyPortfolios,
  PortfolioError,
  type LibraryPortfolio,
} from "../lib/portfolios";
import Reveal from "../components/Reveal";
import Bookshelf from "../components/Bookshelf";

/**
 * [2026-09] mockData.portfolios(고정 4건) 대신 로그인한 사용자의 실제
 * portfolios 테이블을 읽습니다. DB 에는 "초안" 상태가 없어서(visibility 는
 * private/public 뿐) 네 번째 통계를 "초안"에서 "비공개"로 바꿨습니다 —
 * 전체/공개/비공개가 서로 겹치지 않게 나뉘는 편이 실제 값과 맞습니다.
 *
 * [2026-09 추가] "너무 가독성 없고 홈 같지 않다"는 피드백으로 카드마다
 * 같은 brand 색 아이콘 원만 반복되던 걸 깼습니다 — 통계 4개, 다음 할 일
 * 3개에 각각 다른 accent 색을 줘서(job_color 배지와 같은 방식: hex + 알파
 * 접미사로 은은한 배경, 원색으로 아이콘/글자) 한눈에 구획이 구분되게
 * 했습니다. 전체 팔레트를 새로 만들지 않고 기존 크림·테라코타 톤과
 * 어울리는 세이지/더스티블루/머스터드만 더했습니다 — 앱 전체에서 이미
 * 쓰고 있는 "포인트 컬러 + 중성 배경" 규칙은 그대로 지킵니다.
 */
// null 인 항목은 기존 brand 색(Tailwind의 bg-brand/10 text-brand)을 그대로
// 씁니다 — 새 hex를 넣지 않은 이유는, brand 색이 CSS 변수(RGB 트리플)라
// job_color 배지처럼 "hex + 알파 접미사"로 다루기 어렵기 때문입니다.
const ACCENTS = {
  sage: "#5f7a52",
  blue: "#3f6f8f",
  gold: "#b07d2d",
};

const nextSteps = [
  {
    icon: Sparkles,
    title: "새 포트폴리오 만들기",
    desc: "원본 자료를 바탕으로 AI가 포트폴리오 초안을 구성합니다.",
    to: "/wizard",
    cta: "포트폴리오 생성 시작",
    accent: null as string | null,
  },
  {
    icon: Repeat,
    title: "직무 전환 재구성",
    desc: "기존 포트폴리오를 목표 직무 관점으로 재해석합니다.",
    to: "/job-switch",
    cta: "직무 전환 시작",
    accent: ACCENTS.sage as string | null,
  },
  {
    icon: Users,
    title: "커뮤니티 둘러보기",
    desc: "다른 사용자의 포트폴리오 구성 방식을 참고합니다.",
    to: "/community",
    cta: "커뮤니티 보기",
    accent: ACCENTS.blue as string | null,
  },
];

export default function Dashboard() {
  const { session, configured } = useAuth();
  const [portfolios, setPortfolios] = useState<LibraryPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError(null);
    listMyPortfolios(userId)
      .then((list) => {
        if (alive) setPortfolios(list);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof PortfolioError ? e.message : "불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [configured, session?.user?.id]);

  const stats: Array<{ label: string; sub: string; icon: typeof FolderOpen; accent: string | null }> = [
    { label: "전체 포트폴리오", sub: "저장된 작업물", icon: FolderOpen, accent: null },
    { label: "공개 포트폴리오", sub: "현재 공개 중", icon: Globe, accent: ACCENTS.sage },
    { label: "비공개 포트폴리오", sub: "나만 볼 수 있음", icon: Lock, accent: ACCENTS.gold },
    { label: "직무 전환 생성", sub: "이번 달 재구성", icon: Repeat, accent: ACCENTS.blue },
  ];
  const statValues = [
    portfolios.length,
    portfolios.filter((p) => p.visibility === "공개").length,
    portfolios.filter((p) => p.visibility === "비공개").length,
    2,
  ];

  return (
    // [2026-09] 데스크탑 전용이 되면서 max-w-4xl(896px) 로 묶어둘 이유가
    // 없어졌습니다 — 최소 폭이 보장되니 남는 가로를 카드가 쓰는 편이 낫습니다.
    <div className="space-y-14">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading">홈</h1>
        <Link to="/library/portfolios" className="text-sm text-brand hover:underline">
          포트폴리오 목록 보기
        </Link>
      </div>

      {/* [2026-09] 통계를 다시 위로 올렸습니다.
          전에 아래로 내린 이유는 "전체 2, 공개 1" 같은 숫자가 첫 화면을
          차지할 이유가 없다는 것이었는데, 문제는 위치가 아니라 크기였습니다.
          48px 아이콘 원과 p-6 여백을 두른 카드 네 개가 화면 맨 위를 채우면
          그게 이 페이지의 주인공처럼 보입니다. 라벨과 숫자만 남긴 얇은
          띠로 줄이면 "현재 상태"로 읽히고, 아래 책장이 주인공 자리를
          되찾습니다. */}
      {/* [2026-09] 숫자만 색을 달리했더니 카드 넷이 같은 상자로 보였습니다.
          면과 테두리까지 그 색을 옅게 입혀 카드마다 정체성을 줍니다.

          알파를 아주 낮게(면 7%, 테두리 28%) 잡은 이유 — 크림 바탕 위에서
          네 칸을 진하게 칠하면 알록달록한 대시보드가 되고, 이 앱이 잡아온
          원고지·잉크 톤과 싸웁니다. 테두리를 면보다 진하게 두면 색은
          분명히 읽히면서 바탕은 조용합니다.

          아이콘도 되살렸습니다. stats 배열에 icon 이 이미 있었는데 얇은
          띠로 줄이면서 안 쓰고 있었습니다 — 색만으로 구분하면 색을
          구별하기 어려운 사람에게는 넷이 똑같은 칸입니다. */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="entry p-5"
            style={{
              // brand 는 CSS 변수(RGB 트리플)라 hex 알파 접미사를 못 씁니다.
              // 인라인 스타일에서도 변수는 그대로 읽히므로 rgb(var(--brand) / a)
              // 형태로 씁니다 — 넷 중 하나만 흰 칸이면 그 칸만 빠져 보입니다.
              backgroundColor: s.accent ? `${s.accent}12` : "rgb(var(--brand) / 0.07)",
              borderColor: s.accent ? `${s.accent}47` : "rgb(var(--brand) / 0.3)",
            }}
          >
            <div className="flex items-center gap-2">
              <s.icon
                size={15}
                strokeWidth={1.75}
                aria-hidden="true"
                className={s.accent ? undefined : "text-brand"}
                style={s.accent ? { color: s.accent } : undefined}
              />
              <p className="text-xs tracking-wide text-neutral-500">{s.label}</p>
            </div>
            <p
              className="mt-2.5 text-[30px] leading-none font-heading text-neutral-100"
              style={s.accent ? { color: s.accent } : undefined}
            >
              {statValues[i]}
            </p>
            <p className="mt-2 text-xs text-neutral-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {!configured ? (
        <p className="text-sm text-neutral-500">
          Supabase 설정이 없어 서재를 불러올 수 없습니다.
        </p>
      ) : loading ? (
        <p className="text-sm text-neutral-500 inline-flex items-center gap-2">
          <LoaderCircle size={14} className="animate-spin" />
          서재를 불러오는 중입니다.
        </p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-brand">
          {loadError}
        </p>
      ) : portfolios.length === 0 ? (
        <div className="entry">
          <p className="text-sm text-neutral-400">
            아직 만든 포트폴리오가 없습니다.{" "}
            <Link to="/wizard" className="text-brand hover:underline">
              지금 첫 포트폴리오를 만들어보세요
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <Reveal>
            <Bookshelf
              portfolios={portfolios}
              onUpdated={(u) =>
                setPortfolios((list) => list.map((p) => (p.id === u.id ? u : p)))
              }
            />
          </Reveal>

          <div>
            <h2 className="text-lg font-heading text-neutral-200 mb-4">최근 작업</h2>
            <Reveal>
              <div className="entry divide-y divide-neutral-800 p-0">
                {portfolios.map((p) => (
                  <Link
                    key={p.id}
                    to={`/wizard/editor/${p.id}`}
                    className="flex items-center justify-between px-6 py-5 hover:bg-neutral-900 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <div>
                      <p className="font-medium text-neutral-100 text-base">{p.title}</p>
                      <p className="text-sm text-neutral-500 mt-1">
                        직무: {p.job} · {p.year}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="badge bg-neutral-800 text-neutral-300">{p.visibility}</span>
                      <p className="text-xs text-neutral-500 mt-1">{p.updatedAt.slice(0, 10)} 편집</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </>
      )}

      <div>
        <h2 className="text-lg font-heading text-neutral-200 mb-4">다음으로 할 일</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {nextSteps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="entry h-full p-6">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                    s.accent ? "" : "bg-brand/10 text-brand"
                  }`}
                  style={s.accent ? { backgroundColor: `${s.accent}1a`, color: s.accent } : undefined}
                >
                  <s.icon size={20} strokeWidth={2.25} />
                </div>
                <p className="font-medium text-neutral-100 mb-1.5 text-base">{s.title}</p>
                <p className="text-sm text-neutral-500 mb-4">{s.desc}</p>
                <Link to={s.to} className="text-sm text-brand hover:underline">
                  {s.cta} →
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="entry p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading text-neutral-200">AI 사용량 요약</h2>
          <Link to="/settings" className="text-sm text-brand hover:underline">
            계정 설정
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <p className="text-neutral-500 text-xs">오늘 남은 AI 요청</p>
            <p className="text-2xl font-heading text-brand mt-1">
              {aiUsage.dailyLimit - aiUsage.dailyUsed} / {aiUsage.dailyLimit}회
            </p>
            <p className="text-xs text-neutral-500 mt-1">일일 한도 기준 · {aiUsage.plan} 플랜</p>
          </div>
          <div>
            <p className="text-neutral-500 text-xs">이번 달 사용</p>
            <p className="text-2xl font-heading text-neutral-100 mt-1">
              {aiUsage.monthlyUsed} / {aiUsage.monthlyLimit}회
            </p>
            <p className="text-xs text-neutral-500 mt-1">마지막 요청: 포트폴리오 초안 생성</p>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-4">
          한도 초과 시 기존 포트폴리오 열람·편집·내보내기는 계속 이용 가능합니다.
        </p>
      </div>

      <div className="entry p-6">
        <h2 className="text-lg font-heading text-neutral-200 mb-2">최근 AI 요청 상태</h2>
        <ul>
          <li className="row flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-neutral-300">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              프론트엔드 포트폴리오 초안 생성 · 완료
            </span>
            <span className="text-xs text-neutral-500">2025-06-12</span>
          </li>
          <li className="row flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-neutral-300">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              UX 전환 문장 다듬기 · 완료
            </span>
            <span className="text-xs text-neutral-500">2025-06-09</span>
          </li>
          <li className="row flex items-center justify-between text-sm text-red-400">
            <span className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              백엔드 직무 관점 재구성 · 실패 — 요청 시간 초과
            </span>
            <button className="btn-secondary text-neutral-200">재시도</button>
          </li>
        </ul>
      </div>
    </div>
  );
}
