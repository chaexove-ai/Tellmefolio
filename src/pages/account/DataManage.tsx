import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { portfolios } from "../../mockData";

export default function DataManage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/settings" className="text-xs text-brand hover:underline">
        계정 설정으로
      </Link>
      <h1 className="text-xl font-heading">데이터 관리</h1>

      <div className="entry">
        <h2 className="entry-title">개인 데이터 내려받기</h2>
        <p className="text-xs text-neutral-400 mb-3">
          Tellmefolio에 저장된 개인정보, 포트폴리오 내용, 원본 자료, AI 생성 이력을
          포함한 데이터를 파일로 받을 수 있습니다.
        </p>
        <p className="text-xs text-neutral-600 mb-3">
          제공 형식: JSON 및 PDF · 처리 시간: 최대 24시간 이내 이메일 발송
        </p>
        <button className="btn-secondary" onClick={() => setConfirmDownload(true)}>
          데이터 내려받기 요청
        </button>
      </div>

      <div className="entry">
        <h2 className="entry-title">포트폴리오 데이터 삭제</h2>
        <p className="text-xs text-neutral-400 mb-3">삭제할 포트폴리오를 선택하세요.</p>
        <p className="text-xs text-neutral-600 mb-3">
          삭제된 포트폴리오는 복구할 수 없으며, 해당 포트폴리오의 공개 공유 URL도
          함께 비활성화됩니다.
        </p>
        <ul className="space-y-2 text-sm mb-3">
          {portfolios.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-red-500"
              />
              <span className="text-neutral-200">{p.title}</span>
              <span className="text-xs text-neutral-500">{p.visibility}</span>
            </li>
          ))}
        </ul>
        <button
          className="rounded-sm border border-red-600 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40"
          disabled={selected.length === 0}
          onClick={() => setConfirmDelete(true)}
        >
          선택한 포트폴리오 삭제
        </button>
      </div>

      <div className="entry border-t-red-900/60">
        <h2 className="entry-title text-red-400">계정 전체 삭제</h2>
        <p className="text-xs text-neutral-400 mb-3">
          계정을 삭제하면 모든 데이터가 영구적으로 제거됩니다.
        </p>
        <ul className="text-xs text-neutral-500 space-y-1 mb-3">
          <li>· 저장된 모든 포트폴리오와 원본 자료가 삭제됩니다.</li>
          <li>· 공개된 공유 페이지가 즉시 비활성화됩니다.</li>
          <li>· 소셜 계정 연결이 해제되고 로그인이 불가능해집니다.</li>
          <li>· 삭제 후 데이터는 복구할 수 없습니다.</li>
        </ul>
        <button
          className="rounded-sm border border-red-600 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/10"
          onClick={() => setConfirmAccountDelete(true)}
        >
          계정 삭제
        </button>
      </div>

      {confirmDownload && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">데이터 내려받기 요청</h2>
            <p className="text-xs text-neutral-400">
              개인정보, 포트폴리오, 원본 자료, AI 생성 이력을 포함한 전체 데이터를
              JSON 및 PDF 형식으로 준비합니다.
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              처리가 완료되면 가입 이메일로 다운로드 링크가 발송됩니다. 처리에는 최대
              24시간이 소요될 수 있습니다.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirmDownload(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={() => setConfirmDownload(false)}>
                요청 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">포트폴리오 삭제 확인</h2>
            <p className="text-xs text-neutral-400">
              선택한 포트폴리오를 영구 삭제합니다. 삭제된 포트폴리오는 복구할 수
              없습니다.
            </p>
            <ul className="text-xs text-neutral-500 mt-2 space-y-1">
              <li>· 포트폴리오 내용과 편집 이력이 삭제됩니다.</li>
              <li>· 공개 공유 URL이 즉시 비활성화됩니다.</li>
              <li>· 커뮤니티에서도 제거됩니다.</li>
            </ul>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                onClick={() => {
                  setConfirmDelete(false);
                  setSelected([]);
                }}
              >
                선택 항목 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAccountDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">계정 삭제 최종 확인</h2>
            <p className="text-xs text-neutral-400">
              계정을 삭제하면 모든 포트폴리오, 원본 자료, AI 생성 이력이 영구적으로
              삭제되며 복구할 수 없습니다.
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              계속하려면 아래에 이메일 주소를 입력해 확인해주세요.
            </p>
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="가입한 이메일 주소 입력"
              className="field mt-2"
            />
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setConfirmAccountDelete(false)}>
                취소
              </button>
              <button
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                disabled={!emailInput.trim()}
                onClick={() => navigate("/")}
              >
                계정 영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
