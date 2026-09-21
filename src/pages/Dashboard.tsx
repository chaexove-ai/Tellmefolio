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
/**
 * [2026-09 수정] 색이 탁하다는 지적을 받고 다시 잡았습니다.
 *
 * 원인은 알파였습니다. 어두운 저채도 색(세이지 채도 20%, 블루 38%)을
 * 7% 로 희석하면 색이 아니라 회색 얼룩이 됩니다 — 크림 바탕이 나머지
 * 93% 를 차지하니 남는 건 미세한 명도 차뿐입니다.
 *
 * 그래서 면에는 희석한 색이 아니라 "밝은 색조"를 직접 씁니다. 명도가
 * 높으면서 채도는 살아 있는 값이라 옅어도 색으로 읽힙니다. 진한 값은
 * 숫자와 아이콘에만 쓰고, 채도도 한 단계씩 올렸습니다.
 *
 * ink 는 해당 fill 위에서 4.5:1 이상입니다(숫자는 30px 이라 3:1 이면
 * 되지만, 같은 색을 아이콘에도 쓰므로 작은 요소 기준을 맞췄습니다).
 */
/** 브랜드 칸의 면. 다른 셋과 같은 이유로 알파가 아니라 밝은 색조입니다. */
const BRAND_FILL = "#fbeadd";

interface Accent {
  /** 숫자·아이콘 */
  ink: string;
  /** 칸 배경 */
  fill: string;
}

const ACCENTS: Record<string, Accent> = {
  sage: { ink: "#44702f", fill: "#eaf2e3" },
  blue: { ink: "#295f82", fill: "#e3eef6" },
  gold: { ink: "#8c5a0c", fill: "#fbf0da" },
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
    accent: ACCENTS.sage.ink as string | null,
  },
  {
    icon: Users,
    title: "커뮤니티 둘러보기",
    desc: "다른 사용자의 포트폴리오 구성 방식을 참고합니다.",
    to: "/community",
    cta: "커뮤니티 보기",
    accent: ACCENTS.blue.ink as string | null,
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

  const stats: Array<{ label: string; sub: string; icon: typeof FolderOpen; accent: Accent | null }> = [
    { label: "전체 포트폴리오", sub: "저장된 작업물", icon: FolderOpen, accent: null },
    { label: "공개 포트폴리오", sub: "현재 공개 중", icon: Globe, accent: ACCENTS.sage },
    { label: "비공개 포트폴리오", sub: "나만 볼 수 있음", icon: Lock, accent: ACCENTS.gold },
    { label: "직무 전환 생성", sub: "이번 달 재구성", icon: Repeat, accent: ACCENTS.blue },
  ];
  /** 셋 중 "포트폴리오 만들기" 하나만 큰 면으로 세웁니다 — 이 앱에
   *  들어온 사람이 하러 온 일이 그것입니다. */
  const [primary, ...others] = nextSteps;

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
        <h1 className="text-2xl font-heading">홈</h1>
        <Link to="/library/portfolios" className="text-sm text-brand hover:underline">
          포트폴리오 목록 보기
        </Link>
      </div>

      {/* [2026-09] 통계를 띠 하나로 합쳤습니다.
          카드 넷이 같은 간격으로 떠 있으면, 색을 넣어도 "같은 모양의
          반복"이라는 인상이 남습니다. 간격을 없애고 한 덩어리로 붙이면
          네 개의 상자가 아니라 하나의 현황 띠로 읽힙니다 — 성격에도
          맞습니다. 색은 그대로 두되 칸마다 면을 채워 넣어서, 합쳐졌는데도
          오히려 색이 더 잘 보입니다.

          랜딩에서 이미 쓴 원칙입니다(CONTEXT.md: "3열 카드 그리드가 연속
          으로 세 번 나오던 것이 단조롭다의 원인"). 앱 안쪽에는 아직 그
          원칙이 적용되지 않았습니다. */}
      <div className="entry p-0 overflow-hidden grid grid-cols-4 divide-x divide-neutral-800/70">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="px-4 py-3.5"
            style={{ backgroundColor: s.accent ? s.accent.fill : BRAND_FILL }}
          >
            {/* [2026-09] 띠 높이를 줄였습니다. 이 칸은 "지금 상태"를 스치듯
                확인하는 자리인데, 숫자를 크게 잡고 위아래 여백을 넉넉히
                두니 화면 맨 위에서 주인공처럼 자리를 차지했습니다.
                숫자와 라벨을 한 줄에 묶어 세로 길이를 줄입니다. */}
            <div className="flex items-center gap-2">
              <s.icon
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className={s.accent ? undefined : "text-brand"}
                style={s.accent ? { color: s.accent.ink } : undefined}
              />
              <p className="text-xs tracking-wide text-neutral-500">{s.label}</p>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <p
                className="text-[22px] leading-none font-heading text-neutral-100"
                style={s.accent ? { color: s.accent.ink } : undefined}
              >
                {statValues[i]}
              </p>
              <p className="text-xs text-neutral-600 truncate">{s.sub}</p>
            </div>
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
          {/* [2026-09] 제목과 책장을 한 덩어리로 묶습니다.
              둘을 형제로 두니 바깥의 space-y-14(56px)가 그 사이에 통째로
              들어갔고, 거기에 제목의 mb-4 와 책장 자체의 위 여백까지
              더해져 제목과 책 사이가 100px 넘게 벌어져 있었습니다.
              섹션 사이 간격과 섹션 안 간격은 다른 값이어야 합니다. */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-lg font-heading text-neutral-200">내 서재</h2>
              <span className="text-xs text-neutral-600">{portfolios.length}권</span>
            </div>
            <Reveal>
              <Bookshelf
                portfolios={portfolios}
                onUpdated={(u) =>
                  setPortfolios((list) => list.map((p) => (p.id === u.id ? u : p)))
                }
              />
            </Reveal>
          </div>

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
        {/* [2026-09] 3열 카드 그리드를 걷어냈습니다. 위에 이미 4칸 띠가
            있고 아래에 또 카드 3개가 오면 같은 리듬이 반복됩니다. 게다가
            셋의 무게가 같아서 "그래서 지금 뭘 하면 되는가"가 안 보였습니다.

            실제로는 하나가 압도적으로 중요합니다 — 이 앱에 들어온 사람은
            포트폴리오를 만들러 옵니다. 그것만 큰 면으로 세우고 나머지 둘은
            그 아래 링크로 내립니다. */}
        <Reveal>
          <Link
            to={primary.to}
            className="entry group flex items-center gap-5 p-7 transition-colors hover:border-brand/50"
            style={{ backgroundColor: "rgb(var(--brand) / 0.07)", borderColor: "rgb(var(--brand) / 0.3)" }}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
              <primary.icon size={22} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-neutral-100">{primary.title}</span>
              <span className="block text-sm text-neutral-500 mt-1">{primary.desc}</span>
            </span>
            <span className="ml-auto shrink-0 text-sm text-brand group-hover:underline">
              {primary.cta} →
            </span>
          </Link>
        </Reveal>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          {others.map((s) => (
            <Link
              key={s.title}
              to={s.to}
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-brand"
            >
              <s.icon size={15} strokeWidth={1.75} aria-hidden="true" />
              {s.title}
            </Link>
          ))}
        </div>
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
