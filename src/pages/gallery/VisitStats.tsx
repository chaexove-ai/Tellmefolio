import { Link } from "react-router-dom";
import { Eye, CalendarDays, CalendarRange } from "lucide-react";
import Reveal from "../../components/Reveal";

const visits = [
  { time: "2025-06-24 15:12", type: "로그인 사용자" },
  { time: "2025-06-24 11:05", type: "익명" },
  { time: "2025-06-23 19:48", type: "로그인 사용자" },
  { time: "2025-06-23 14:30", type: "익명" },
  { time: "2025-06-22 09:17", type: "익명" },
];

export default function VisitStats() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/community/share" className="text-xs text-brand hover:underline">
        공유 페이지 설정으로
      </Link>
      <h1 className="text-xl font-heading">방문 통계</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Eye, label: "총 조회수", value: "1,284", sub: "전체 기간 누적" },
          { icon: CalendarDays, label: "이번 주 조회수", value: "37", sub: "최근 7일 기준" },
          { icon: CalendarRange, label: "이번 달 조회수", value: "142", sub: "이번 달 기준" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className="entry p-5">
              <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-3">
                <s.icon size={16} strokeWidth={2.25} />
              </div>
              <p className="text-2xl font-heading text-neutral-100">{s.value}</p>
              <p className="text-xs text-neutral-400 mt-1">{s.label}</p>
              <p className="text-xs text-neutral-600">{s.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="entry">
        <h2 className="entry-title">기간별 조회수 추이</h2>
        <div className="flex gap-2 text-xs mb-3">
          <button className="btn-secondary py-1 px-2">7일</button>
          <button className="btn-secondary py-1 px-2">30일</button>
          <button className="btn-secondary py-1 px-2">90일</button>
        </div>
        <div className="h-40 border border-neutral-800 flex items-center justify-center text-xs text-neutral-600">
          기간별 조회수 차트
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">최근 방문 내역</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[280px]">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-2 font-normal">방문 시점</th>
                <th className="pb-2 font-normal">방문자 유형</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => (
                <tr key={i} className="border-t border-neutral-800 text-neutral-300">
                  <td className="py-2">{v.time}</td>
                  <td className="py-2">{v.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          익명 방문자는 집계 수치로만 제공됩니다.
        </p>
      </div>
    </div>
  );
}
