import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { listMyPortfolios } from "../../lib/portfolios";
import type { LibraryPortfolio } from "../../lib/portfolios";
import {
  deleteMyAccount,
  deletePortfolios,
  downloadAsJson,
  exportMyData,
} from "../../lib/account";

/**
 * [2026-09] 버튼 세 개가 실제로 동작합니다.
 *
 * 전에는 목록이 mockData 였고, 버튼 셋 다 모달만 닫았습니다. 특히
 * "계정 영구 삭제" 는 navigate("/") 만 해서, 사용자는 계정을 지웠다고
 * 믿는데 그대로 남아 있었습니다. 데이터 관리 화면에서 이건 단순한
 * 미구현이 아니라 잘못된 정보입니다.
 *
 * 내려받기 안내도 고쳤습니다 — "최대 24시간 이내 이메일 발송" 이라고
 * 적혀 있었지만 그런 파이프라인은 없고, 만들 이유도 없습니다. 데이터가
 * 포트폴리오 몇 건이라 그 자리에서 JSON 을 만들어 내려줍니다.
 *
 * PDF 는 안내에서 뺐습니다. 포트폴리오 PDF 는 내보내기 화면에 이미
 * 따로 있고, 여기서 또 만들면 같은 기능이 두 군데가 됩니다.
 */
export default function DataManage() {
  const navigate = useNavigate();
  const { session, configured } = useAuth();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? null;

  const [items, setItems] = useState<LibraryPortfolio[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [busy, setBusy] = useState<null | "export" | "delete" | "account">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !userId) {
      setItems([]);
      return;
    }
    let alive = true;
    listMyPortfolios(userId)
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setLoadError("목록을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [configured, userId]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleExport = async () => {
    if (!userId) return;
    setBusy("export");
    setError(null);
    setNotice(null);
    try {
      const data = await exportMyData(userId);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadAsJson(data, `tellmefolio-${stamp}.json`);
      setNotice(`포트폴리오 ${data.portfolios.length}건을 내려받았습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "내려받지 못했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteSelected = async () => {
    setBusy("delete");
    setError(null);
    setNotice(null);
    try {
      await deletePortfolios(selected);
      setItems((prev) => (prev ?? []).filter((p) => !selected.includes(p.id)));
      setNotice(`${selected.length}건을 삭제했습니다.`);
      setSelected([]);
      setConfirmDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAccount = async () => {
    setBusy("account");
    setError(null);
    try {
      await deleteMyAccount();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "계정을 삭제하지 못했습니다.");
      setConfirmAccountDelete(false);
      setBusy(null);
    }
  };

  // 이메일을 정확히 입력해야만 계정 삭제 버튼이 열립니다. 전에는 아무
  // 글자나 넣어도 됐는데, 마지막 방어선이 아무 역할도 못 하고 있었습니다.
  const emailMatches =
    email !== null && emailInput.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/settings" className="text-xs text-brand hover:underline">
        계정 설정으로
      </Link>
      <h1 className="text-xl font-heading">데이터 관리</h1>

      {notice && (
        <p className="entry py-3 text-sm text-neutral-200 border-l-2 border-l-brand">
          {notice}
        </p>
      )}
      {error && (
        <p className="entry py-3 text-sm text-red-400 border-l-2 border-l-red-600">
          {error}
        </p>
      )}

      <div className="entry">
        <h2 className="entry-title">개인 데이터 내려받기</h2>
        <p className="text-xs text-neutral-400 mb-3">
          계정 정보, 포트폴리오 전체 내용, 프로젝트, AI 생성 이력을 JSON 파일
          하나로 내려받습니다.
        </p>
        <p className="text-xs text-neutral-600 mb-3">
          브라우저에서 바로 만들어 내려받습니다 — 기다리거나 이메일을 확인할
          필요가 없습니다.
        </p>
        <button
          className="btn-secondary"
          disabled={!userId || busy !== null}
          onClick={handleExport}
        >
          {busy === "export" ? "준비 중…" : "JSON으로 내려받기"}
        </button>
      </div>

      <div className="entry">
        <h2 className="entry-title">포트폴리오 데이터 삭제</h2>
        <p className="text-xs text-neutral-400 mb-3">삭제할 포트폴리오를 선택하세요.</p>
        <p className="text-xs text-neutral-600 mb-3">
          삭제된 포트폴리오는 복구할 수 없으며, 표지 이미지와 공개 공유 URL도 함께
          제거됩니다.
        </p>

        {loadError && <p className="text-sm text-red-400 mb-3">{loadError}</p>}
        {items === null && !loadError && (
          <p className="text-sm text-neutral-500 mb-3">불러오는 중…</p>
        )}
        {items !== null && items.length === 0 && (
          <p className="text-sm text-neutral-500 mb-3">
            아직 만든 포트폴리오가 없습니다.
          </p>
        )}

        {items !== null && items.length > 0 && (
          <ul className="space-y-2 text-sm mb-3">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <input
                  id={`del-${p.id}`}
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-red-500"
                />
                <label htmlFor={`del-${p.id}`} className="text-neutral-200 cursor-pointer">
                  {p.title}
                </label>
                <span className="text-xs text-neutral-500">{p.visibility}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          className="rounded-sm border border-red-600 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40"
          disabled={selected.length === 0 || busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          선택한 포트폴리오 삭제
          {selected.length > 0 && ` (${selected.length})`}
        </button>
      </div>

      <div className="entry border-t-red-900/60">
        <h2 className="entry-title text-red-400">계정 전체 삭제</h2>
        <p className="text-xs text-neutral-400 mb-3">
          계정을 삭제하면 모든 데이터가 영구적으로 제거됩니다.
        </p>
        <ul className="text-xs text-neutral-500 space-y-1 mb-3">
          <li>· 저장된 모든 포트폴리오와 표지 이미지가 삭제됩니다.</li>
          <li>· 공개된 공유 페이지가 즉시 비활성화됩니다.</li>
          <li>· 소셜 계정 연결이 해제되고 로그인이 불가능해집니다.</li>
          <li>· 삭제 후 데이터는 복구할 수 없습니다.</li>
        </ul>
        <button
          className="rounded-sm border border-red-600 text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40"
          disabled={!userId || busy !== null}
          onClick={() => setConfirmAccountDelete(true)}
        >
          계정 삭제
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
          <div className="surface w-full max-w-sm">
            <h2 className="entry-title mb-2">포트폴리오 삭제 확인</h2>
            <p className="text-xs text-neutral-400">
              선택한 {selected.length}건을 영구 삭제합니다. 복구할 수 없습니다.
            </p>
            <ul className="text-xs text-neutral-500 mt-2 space-y-1">
              <li>· 포트폴리오 내용과 프로젝트가 삭제됩니다.</li>
              <li>· 표지 이미지가 함께 삭제됩니다.</li>
              <li>· 공개 공유 URL이 즉시 비활성화됩니다.</li>
            </ul>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn-secondary"
                disabled={busy !== null}
                onClick={() => setConfirmDelete(false)}
              >
                취소
              </button>
              <button
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                disabled={busy !== null}
                onClick={handleDeleteSelected}
              >
                {busy === "delete" ? "삭제 중…" : "선택 항목 삭제"}
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
              계정을 삭제하면 모든 포트폴리오, 표지 이미지, AI 생성 이력이
              영구적으로 삭제되며 복구할 수 없습니다.
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              계속하려면 가입한 이메일 주소
              {email && <span className="text-neutral-300"> ({email})</span>}를
              정확히 입력해주세요.
            </p>
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="가입한 이메일 주소 입력"
              className="field mt-2"
              autoComplete="off"
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn-secondary"
                disabled={busy !== null}
                onClick={() => setConfirmAccountDelete(false)}
              >
                취소
              </button>
              <button
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                disabled={!emailMatches || busy !== null}
                onClick={handleDeleteAccount}
              >
                {busy === "account" ? "삭제 중…" : "계정 영구 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
