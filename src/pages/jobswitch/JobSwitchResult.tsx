import { Link, useNavigate } from "react-router-dom";

const covered = [
  "Spring Boot 기반 백엔드 개발 경험",
  "REST API 설계 및 구현",
  "데이터베이스 쿼리 최적화 경험",
  "팀 협업 및 코드 리뷰 참여",
];

const gaps = [
  {
    label: "MSA 아키텍처 경험",
    note: "포트폴리오 자료에서 관련 경험을 확인할 수 없습니다. 해당 경험이 있다면 원본 자료를 추가하거나 직접 편집에서 보완하세요.",
  },
  {
    label: "CI/CD 파이프라인 구성 및 운영",
    note: "일부 언급이 있으나 구체적인 성과나 역할이 명확하지 않습니다. 편집 화면에서 내용을 보강하는 것을 권장합니다.",
  },
];

export default function JobSwitchResult() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/job-switch" className="text-xs text-brand hover:underline">
          재구성 요청으로 돌아가기
        </Link>
        <h1 className="text-xl font-heading mt-2">AI 재구성 결과</h1>
        <p className="text-xs text-neutral-500">백엔드 개발자 · 결과 중심형 구성</p>
      </div>

      <div className="entry">
        <h2 className="entry-title">재구성된 포트폴리오 초안</h2>
        <ul className="text-sm text-neutral-400 space-y-1">
          <li>프로젝트 소개</li>
          <li>역할 및 기여</li>
          <li>주요 성과</li>
          <li>기술 스택 및 문제 해결</li>
        </ul>
      </div>

      <div className="entry">
        <h2 className="entry-title">채용 공고 요구사항 대응 현황</h2>
        <div className="mb-4">
          <p className="text-sm font-medium text-emerald-400 mb-2">
            반영된 요구사항 {covered.length}개
          </p>
          <ul className="space-y-1 text-sm text-neutral-300">
            {covered.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-amber-400 mb-2">
            보완이 필요한 항목 {gaps.length}개
          </p>
          <ul className="text-sm">
            {gaps.map((g) => (
              <li key={g.label} className="row">
                <p className="text-neutral-100">{g.label}</p>
                <p className="text-xs text-neutral-500 mt-1">{g.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="note border-neutral-700 text-xs text-neutral-400">
        이 결과는 입력된 원본 자료와 채용 공고를 기반으로 생성된 초안입니다. 성과
        수치, 역할, 기간 등 사실 여부는 반드시 직접 확인하고 수정하세요. 이 분석은
        합격 가능성이나 채용 결과를 예측하지 않습니다.
      </p>

      <button className="btn-primary" onClick={() => navigate("/wizard/editor")}>
        이 초안으로 편집 시작
      </button>
    </div>
  );
}
