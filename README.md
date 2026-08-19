# Tellmefolio 프론트엔드 스캐폴드

와이어프레임(21개 화면) + 기능 명세서를 기준으로 만든 React 스캐폴드입니다.
AI 생성, 백엔드, 인증은 아직 목 데이터(`src/mockData.ts`)로 대체되어 있습니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 이번 스캐폴드에서 반영한 리뷰 사항

- **위저드 단계 순서**: 와이어프레임의 "1단계 스타일 선택" 안내 문구가 실제 화면
  진행 순서(자료 입력 → AI 초안 → 편집 → 스타일 → 내보내기)와 어긋나 있던 부분을
  `src/pages/wizard/WizardOverview.tsx`에서 실제 순서에 맞게 수정했습니다.
- **직무 전환 재구성 중복 화면 통합**: 퀵 액션형과 상세 폼형으로 중복 설계됐던
  화면을 `src/pages/jobswitch/JobSwitchRequest.tsx` 하나로 합쳤고, 구성 방식
  선택을 AI 요청 이전 단계로 배치했습니다.
- **공통 AI 요청 상태 처리**: `src/components/AIRequestStatus.tsx`를 만들어
  포트폴리오 초안 생성, 직무 전환 재구성 등 모든 AI 요청에서 동일한 처리 중/실패/
  완료 UI와 재시도·취소 로직을 재사용하도록 했습니다(명세서 1.2.2).

## 폴더 구조

```
src/
  components/       공통 레이아웃, AI 사용량 배지, AI 요청 상태 컴포넌트
  pages/            인증, 대시보드, 버전 관리
  pages/wizard/      포트폴리오 생성 위저드 5단계
  pages/jobswitch/   직무 전환 재구성
  pages/gallery/     커뮤니티 갤러리, 공유 페이지, 방문 통계
  pages/account/     계정 설정, 소셜 계정 관리, 데이터 관리
  mockData.ts       화면에서 쓰는 목 데이터 (백엔드 연동 시 API 응답으로 대체)
```

## 다음 단계 (백엔드/AI 연동 전 확인할 것)

1. 인증: `Login.tsx`의 목업 로그인을 실제 OAuth(Google/GitHub/Figma)로 교체
2. AI 연동: `AIDraftGeneration.tsx`, `JobSwitchRequest.tsx`의 `setTimeout` 처리를
   실제 API 폴링/웹소켓으로 교체
3. 데이터 영속화: 현재 `mockData.ts`는 새로고침 시 초기화됩니다. 상태 관리
   라이브러리(예: TanStack Query + 서버 API) 도입 필요
4. 이 환경은 npm 레지스트리 접근이 막혀 있어 `npm install`/빌드 검증을 하지
   못했습니다. 로컬에서 설치 후 `npm run build`로 타입 에러를 확인해 주세요.
