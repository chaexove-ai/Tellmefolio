import { Link } from "react-router-dom";
import {
  FolderOpen,
  Globe,
  FileEdit,
  Repeat,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { portfolios, aiUsage } from "../mockData";
import Reveal from "../components/Reveal";
import Bookshelf from "../components/Bookshelf";

const stats = [
  { label: "전체 포트폴리오", sub: "저장된 작업물", icon: FolderOpen },
  { label: "공개 포트폴리오", sub: "현재 공개 중", icon: Globe },
  { label: "초안", sub: "편집 중인 작업물", icon: FileEdit },
  { label: "직무 전환 생성", sub: "이번 달 재구성", icon: Repeat },
];

const nextSteps = [
  {
    icon: Sparkles,
    title: "새 포트폴리오 만들기",
    desc: "원본 자료를 바탕으로 AI가 포트폴리오 초안을 구성합니다.",
    to: "/wizard",
    cta: "포트폴리오 생성 시작",
  },
  {
    icon: Repeat,
    title: "직무 전환 재구성",
    desc: "기존 포트폴리오를 목표 직무 관점으로 재해석합니다.",
    to: "/job-switch",
    cta: "직무 전환 시작",
  },
  {
    icon: Users,
    title: "커뮤니티 둘러보기",
    desc: "다른 사용자의 포트폴리오 구성 방식을 참고합니다.",
    to: "/community",
    cta: "커뮤니티 보기",
  },
];

export default function Dashboard() {
  const recent = [...portfolios].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );
  const statValues = [
    portfolios.length,
    portfolios.filter((p) => p.visibility === "공개").length,
    portfolios.filter((p) => p.visibility === "초안").length,
    2,
  ];

  return (
    <div className="max-w-3xl space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading">홈</h1>
        <Link to="/library/portfolios" className="text-xs text-brand hover:underline">
          포트폴리오 목록 보기
        </Link>
      </div>

      <Reveal>
        <Bookshelf portfolios={portfolios} />
      </Reveal>

      <div>
        <h2 className="text-sm text-neutral-500 mb-3">최근 작업</h2>
        <Reveal>
          <div className="entry divide-y divide-neutral-800 p-0">
            {recent.map((p) => (
              <Link
                key={p.id}
                to={`/library/portfolios/${p.id}/versions`}
                className="flex items-center justify-between px-5 py-4 hover:bg-neutral-900 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div>
                  <p className="font-medium text-neutral-100">{p.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    직무: {p.job} · {p.year}년
                  </p>
                </div>
                <div className="text-right">
                  <span className="badge bg-neutral-800 text-neutral-300">{p.visibility}</span>
                  <p className="text-xs text-neutral-500 mt-1">{p.updatedAt} 편집</p>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>

      <div>
        <h2 className="text-sm text-neutral-500 mb-3">다음으로 할 일</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {nextSteps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="entry h-full">
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-3">
                  <s.icon size={16} strokeWidth={2.25} />
                </div>
                <p className="font-medium text-neutral-100 mb-1">{s.title}</p>
                <p className="text-xs text-neutral-500 mb-3">{s.desc}</p>
                <Link to={s.to} className="text-xs text-brand hover:underline">
                  {s.cta} →
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* 통계는 아래로 내렸습니다. 포트폴리오가 두세 개인 사용자에게
          "전체 2, 공개 1"은 첫 화면에서 볼 이유가 없는 숫자입니다.
          위쪽은 만들기와 최근 작업이 차지하는 게 맞습니다. */}
      <div>
        <h2 className="text-sm text-neutral-500 mb-3">현황</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <div className="entry p-5">
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-3">
                  <s.icon size={16} strokeWidth={2.25} />
                </div>
                <p className="text-2xl font-heading text-neutral-100">{statValues[i]}</p>
                <p className="text-xs text-neutral-400 mt-1">{s.label}</p>
                <p className="text-xs text-neutral-600">{s.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="entry">
        <div className="flex items-center justify-between mb-3">
          <h2 className="entry-title mb-0">AI 사용량 요약</h2>
          <Link to="/settings" className="text-xs text-brand hover:underline">
            계정 설정
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-neutral-500 text-xs">오늘 남은 AI 요청</p>
            <p className="font-semibold text-neutral-100">
              {aiUsage.dailyLimit - aiUsage.dailyUsed} / {aiUsage.dailyLimit}회
            </p>
            <p className="text-xs text-neutral-500">일일 한도 기준 · {aiUsage.plan} 플랜</p>
          </div>
          <div>
            <p className="text-neutral-500 text-xs">이번 달 사용</p>
            <p className="font-semibold text-neutral-100">
              {aiUsage.monthlyUsed} / {aiUsage.monthlyLimit}회
            </p>
            <p className="text-xs text-neutral-500">마지막 요청: 포트폴리오 초안 생성</p>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-3">
          한도 초과 시 기존 포트폴리오 열람·편집·내보내기는 계속 이용 가능합니다.
        </p>
      </div>

      <div className="entry">
        <h2 className="entry-title">최근 AI 요청 상태</h2>
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
