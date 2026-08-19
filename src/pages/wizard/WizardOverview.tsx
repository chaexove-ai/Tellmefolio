import { Link } from "react-router-dom";

/**
 * [와이어프레임 리뷰 반영]
 * 기존 와이어프레임은 "1단계 스타일 선택 → 2단계 내용 구성 → 3단계 내보내기"라고
 * 안내했지만, 실제 화면 진행 순서는 자료 입력·AI 초안 생성이 먼저이고
 * 템플릿/스타일 설정은 편집 이후 단계였습니다. 안내 문구를 실제 진행 순서에
 * 맞춰 수정했습니다.
 */
const steps = [
  {
    n: 1,
    title: "자료 입력 및 AI 초안 생성",
    desc: "GitHub, PDF, 링크, 메모 등 원본 자료를 선택해 AI 초안 생성을 요청합니다.",
  },
  {
    n: 2,
    title: "편집 및 스타일 설정",
    desc: "AI 문장 다듬기·근거 확인으로 내용을 다듬고, 템플릿과 디자인 스타일을 적용합니다.",
  },
  {
    n: 3,
    title: "내보내기",
    desc: "완성된 포트폴리오를 한국어·영어 버전으로 PDF 또는 웹 형식으로 내보냅니다.",
  },
];

export default function WizardOverview() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading">포트폴리오 생성</h1>
          <p className="text-xs text-neutral-500 mt-1">임시 저장됨</p>
        </div>
        <Link to="/library" className="text-xs text-brand hover:underline">
          내 서재로
        </Link>
      </div>

      <div>
        {steps.map((s, i) => (
          <div key={s.n} className="flex gap-5">
            <div className="flex flex-col items-center">
              <span className="step-mark">{s.n}</span>
              {i < steps.length - 1 && <span className="w-px flex-1 bg-neutral-800 mt-2" />}
            </div>
            <div className="pb-8">
              <p className="font-medium text-neutral-100">{s.title}</p>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-600">각 단계의 입력 내용은 자동으로 임시 저장됩니다.</p>

      <Link to="/wizard/source" className="btn-primary inline-block">
        원본 자료 입력으로 계속
      </Link>
    </div>
  );
}
