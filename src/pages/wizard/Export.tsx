import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Export() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<"한국어" | "영어">("한국어");
  const [format, setFormat] = useState<"pdf" | "web">("pdf");
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);

  const startExport = () => {
    setConfirming(false);
    setExporting(true);
    window.setTimeout(() => {
      setExporting(false);
      navigate("/library/portfolios");
    }, 1200);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/wizard/style" className="text-xs text-brand hover:underline">
        템플릿·스타일 설정으로 돌아가기
      </Link>
      <h1 className="text-xl font-heading">내보내기</h1>

      <div className="entry">
        <h2 className="entry-title">내보내기 언어 선택</h2>
        <p className="text-xs text-neutral-400 mb-3">
          포트폴리오의 어느 언어 버전을 내보낼지 선택하세요. 두 언어 버전을 각각
          내보낼 수 있습니다.
        </p>
        <div className="flex gap-2">
          {(["한국어", "영어"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-sm border px-4 py-2 text-sm ${
                lang === l ? "border-brand bg-brand/10 text-brand" : "border-neutral-800 text-neutral-400"
              }`}
            >
              {l} 버전
            </button>
          ))}
        </div>
      </div>

      <div className="entry">
        <h2 className="entry-title">내보내기 형식 선택</h2>
        <p className="text-xs text-neutral-400 mb-3">
          PDF 파일 또는 웹 형식 자료 중 원하는 형식을 선택하세요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setFormat("pdf")}
            className={`rounded-sm border px-4 py-2 text-sm ${
              format === "pdf" ? "border-brand bg-brand/10 text-brand" : "border-neutral-800 text-neutral-400"
            }`}
          >
            PDF 파일 (.pdf)
          </button>
          <button
            onClick={() => setFormat("web")}
            className={`rounded-sm border px-4 py-2 text-sm ${
              format === "web" ? "border-brand bg-brand/10 text-brand" : "border-neutral-800 text-neutral-400"
            }`}
          >
            웹 형식 (HTML · Notion 호환)
          </button>
        </div>
      </div>

      <div className="entry text-sm">
        <h2 className="entry-title">템플릿 및 스타일 반영 확인</h2>
        <p className="text-neutral-400">적용 템플릿: 라이브에디터</p>
        <p className="text-neutral-400">현재 편집 상태가 내보내기 결과에 반영되는 것을 확인했습니다.</p>
      </div>

      <p className="note border-neutral-700 text-xs text-neutral-500 space-y-1">
        <span className="block font-medium text-neutral-300 mb-1">내보내기 전 주의사항</span>
        <span className="block">· 외부 서비스(Notion, 개인 웹사이트)에 직접 게시되지 않으며, 자료를 복사해 사용할 수 있습니다.</span>
        <span className="block">· 내보낸 파일의 변경 사항은 자동으로 동기화되지 않습니다.</span>
        <span className="block">· AI가 생성한 내용의 사실 여부는 직접 확인 후 제출하시기 바랍니다.</span>
      </p>

      <button className="btn-primary" onClick={() => setConfirming(true)}>
        {format === "pdf" ? "PDF로 내보내기" : "웹 형식으로 내보내기"}
      </button>

      {confirming && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">
              {format === "pdf" ? "PDF 내보내기 확인" : "웹 형식 내보내기 확인"}
            </h2>
            <p className="text-xs text-neutral-400 mb-3">
              선택한 언어와 현재 템플릿을 반영한 {format === "pdf" ? "PDF 파일" : "웹 형식 자료"}를
              생성합니다.
            </p>
            <p className="text-sm text-neutral-200">언어: {lang}</p>
            <p className="text-sm text-neutral-200">형식: {format === "pdf" ? "PDF (.pdf)" : "웹 형식 (HTML · Notion 호환)"}</p>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirming(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={startExport}>
                {format === "pdf" ? "PDF 내보내기 시작" : "웹 형식 내보내기 시작"}
              </button>
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm text-center">
            <p className="font-medium text-neutral-100">내보내기 진행 중</p>
            <p className="text-xs text-neutral-400 mt-1">
              포트폴리오를 생성하고 있습니다. 잠시 기다려 주세요.
            </p>
            <p className="text-xs text-neutral-500 mt-3">처리 중…</p>
          </div>
        </div>
      )}
    </div>
  );
}
