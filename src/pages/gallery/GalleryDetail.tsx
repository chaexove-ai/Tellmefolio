import { Link, useParams } from "react-router-dom";
import { galleryItems } from "../../mockData";
import GrainCover from "../../components/GrainCover";

export default function GalleryDetail() {
  const { id } = useParams();
  const item = galleryItems.find((g) => g.id === id) ?? galleryItems[0];

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/community" className="text-xs text-brand hover:underline">
        커뮤니티 목록으로
      </Link>

      {/* [2026-08] 대표 이미지 자리 — 목록 카드와 같은 seed 라 같은 그림이 이어집니다 */}
      <GrainCover seed={item.id} className="h-48 rounded-2xl">
        <span className="grain-cover-label">포트폴리오 대표 이미지</span>
      </GrainCover>

      <div>
        <p className="text-xs text-neutral-500">
          작성 {item.author} · {item.job} · {item.year}
        </p>
        <h1 className="text-xl font-heading mt-1">{item.title}</h1>
        <span className="badge bg-neutral-800 text-neutral-300 mt-2">{item.structure}</span>
      </div>

      <div className="entry">
        <h2 className="entry-title">프로젝트 구성</h2>
        <ul className="text-sm text-neutral-400 space-y-1">
          <li>프로젝트 1 — 서비스 개편 · {item.structure}</li>
          <li>프로젝트 2 — 신규 기능 설계 · {item.structure}</li>
          <li>프로젝트 3 — 사용자 조사 기반 개선 · {item.structure}</li>
        </ul>
      </div>

      <div className="entry">
        <h2 className="entry-title">케이스 스터디 미리보기</h2>
        <GrainCover seed={`${item.id}-case`} className="h-40 rounded-xl">
          <span className="grain-cover-label">케이스 스터디 콘텐츠 영역</span>
        </GrainCover>
      </div>

      <p className="text-xs text-neutral-600">
        이 포트폴리오는 열람 전용입니다. 내용을 복제하거나 자신의 포트폴리오로 가져올
        수 없습니다.
      </p>
    </div>
  );
}
