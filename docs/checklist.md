# 전체 점검 체크리스트

작성 기준: `574b9e6` (2026-09-21). 위에서부터 순서대로 처리하는 것을 권장합니다.
각 항목은 **왜 이 순서인지**를 함께 적었습니다.

---

## 0단계 — 지금 바로 (배포 부채)

배포된 사이트가 코드와 다른 상태입니다. 아래 두 개는 `git push` 로 따라가지 않습니다.

- [x] **Edge Function 2개 배포** — `generate-draft`, `translate-portfolio`
  현재 로컬 코드에만 있습니다. 배포 안 하면 AI 초안 생성이 배포판에서 동작하지 않습니다.
  ```bash
  npx supabase link --project-ref tswxxqqnzqexwxkgpajg
  npx supabase functions deploy generate-draft
  npx supabase functions deploy translate-portfolio
  ```
- [x] **`density` 마이그레이션 실행** — `supabase/migrations/20260921_portfolio_density.sql`
  `portfolioTheme.byDensity()` 에 `?? normal` 폴백을 넣어놔서 지금은 조용히 넘어가지만,
  여백 설정을 바꿔도 저장이 안 됩니다. (이미 실행했다면 체크)
  ```bash
  npx supabase db push
  ```
- [ ] 배포 후 실제 URL에서 초안 생성 1회, 여백 변경 1회 확인 ← 남음

---

## 1단계 — 사용자를 속이는 것들 (법적/신뢰 문제)

기능이 없는 것보다, **있다고 말해놓고 없는 것**이 더 위험합니다.

> **2026-09-21 결정 — 약관/방침은 맨 마지막으로.** 사업자 등록이 아직이고
> 베타라 실사용자가 없어서, 푸터 링크가 홈으로 튕기는 현재 상태를 그대로
> 두기로 했습니다. 외부에 공개하고 사람을 받는 시점 **전까지**는 반드시
> 있어야 합니다 — 개인정보처리방침 의무는 사업자 등록 여부와 무관하게
> "개인정보처리자"에게 붙습니다.

- [ ] **`/terms`, `/privacy` 페이지 만들기** — 🕓 **맨 마지막 (사업자 등록 후)**
  - 푸터(`Landing.tsx:365-366`)가 두 링크를 걸어놨는데 라우트가 없어서 `*` → `/` 로 튕깁니다
  - 로그인 화면(`Login.tsx:111`)은 이미 "계속 진행하면 이용약관과 개인정보처리방침에 동의합니다"라고 말하고 있습니다
  - 개인정보처리방침은 개인정보보호법상 **의무**입니다 (온라인 서비스 운영자)
  - 필요한 정보 4가지: ① 운영 주체(사업자명/대표자) ② 문의 이메일 ③ 데이터 보관 기간 ④ 입력한 내용을 AI 학습에 쓰는지 여부
- [x] **FAQ의 `TODO` 2개 채우기** — `src/landingContent.ts`
  - 데이터 처리 방침 답변 (`"TODO — 실제 데이터 처리 방침을 여기에 적어주세요"`)
  - 가격 정책 답변 (`"TODO: 가격 정책 확정 후 교체"`)
  - 확정 전이라면 "현재 무료 베타" 같은 솔직한 문장으로 교체
- [x] **`DataManage.tsx` 의 동작하지 않는 버튼 3개** — 구현 완료. `delete-account` 함수 배포 필요
  - 전체 데이터 다운로드 → 모달만 닫힘 (실제 export 없음)
  - 포트폴리오 전체 삭제 → 모달만 닫힘
  - 계정 삭제 → `navigate("/")` 만 하고 계정은 남아 있음
  - **선택지**: (a) 실제로 구현 (b) "준비 중" 으로 비활성화. (b)가 최소 비용이고, 지금 상태보다 정직합니다
- [x] **AI 사용량 배지가 가짜** — 배지 제거로 결정(2026-09-21). 한도를 정한 적이 없어서 숫자를 보여줄 근거가 없었습니다. 비용 방어는 Anthropic 콘솔의 월 한도로 합니다. 유료 전환 시 `draft_generations` 를 세어 제대로 붙입니다.

  ~~아래는 제거 전 내용~~ — `aiUsage` (mockData)
  `Dashboard`, `AIUsageBadge`, `AIDraftGeneration`, `JobSwitchRequest` 4곳이 "남은 횟수 N회"를 보여주는데 전부 하드코딩입니다. 사용자가 이 숫자를 보고 행동합니다.
  - **선택지**: (a) `ai_usage` 테이블 만들고 실카운트 (b) 한도 개념이 없다면 배지 자체를 제거
  - 지금은 (b)가 맞을 수 있습니다 — 한도를 정하지도 않았는데 숫자를 보여줄 이유가 없습니다

---

## 2단계 — 반쯤 만들어진 화면 (mock 의존)

`src/mockData.ts` (109줄)를 아직 8개 화면이 import 합니다.

- [ ] `VersionHistory.tsx` — `versionHistory` mock. 버전 저장 자체가 없어서 화면만 있는 상태
      → 되돌리기 기능을 안 만들 거면 `/library/portfolios/:id/versions` 라우트와 링크를 빼는 게 낫습니다
- [ ] `SocialAccountManage.tsx` — `socialAccounts` mock.
      `AccountSettings` 는 이미 실제 `session.user.identities` 를 읽도록 고쳤으니, 같은 방식으로 교체
- [ ] `Gallery.tsx` / `GalleryDetail.tsx` — `galleryItems` mock (커뮤니티)
      → 공개 갤러리는 실제 사용자 데이터가 있어야 의미가 있습니다. **출시 후로 미루고 메뉴에서 감추는 것**을 권장
- [ ] `PortfolioList.tsx` — mock import 잔존 여부 확인 후 제거
- [ ] `AIRequestStatus.tsx` — mock import 제거
- [ ] 위 정리 후 `src/mockData.ts` 삭제 가능한지 확인

---

## 3단계 — 핵심 기능 (제품의 경쟁력)

- [ ] **프로젝트별 이미지 업로드 + 레이아웃 프리셋 3종**
  포트폴리오는 이미지가 핵심인데 현재 표지 1장만 올릴 수 있습니다. 여러 번 미뤄진 항목입니다.
  - 설계: `portfolio_project_images` 테이블 (project_id, url, sort_order)
  - 업로드 위치: 프로젝트 개요 카드 안
  - 프리셋: 프로젝트마다 개별 선택 (텍스트 중심 / 이미지 큼 / 그리드)
- [ ] **직무 전환 재구성 구현** — `docs/job-switch-design.md` 대로
  4단계 파이프라인 + 서버측 기계 검증. "다른 AI 에이전트보다 잘 해야 경쟁력"이라고 하신 그 기능입니다.
  현재 `/job-switch` 는 mock 입니다.
- [ ] **자동 저장** (보류 중 — 다시 검토 시)

---

## 4단계 — 다듬기

- [ ] "이런 분께 맞습니다" 가독성 — 아이콘 키우고 행 간격 넓히기 (일러스트는 넣지 않기로)
- [ ] 네이버/다음 검색 노출 — CSR 이라 크롤러가 빈 페이지를 봅니다.
      랜딩만 prerender 하거나 `index.html` 에 정적 메타/본문을 심는 방법 검토
- [ ] `/wizard/style/:id`, `/gallery/*` 리다이렉트 — 외부 링크가 없다면 정리 가능
- [ ] `docs/` 의 오래된 적용방법 문서들 최종 정리

---

## 참고 — 지금 상태가 괜찮은 것들

점검 중 문제 없다고 확인한 항목입니다. 다시 볼 필요 없습니다.

- 로그인 (Vercel 환경변수 + Supabase Redirect URL 수정 완료, 실제 로그인 성공 확인)
- 글씨 크기 (12/14 + 줄간격 조정 — 브라우저 확대가 원인이었음)
- 라이트 테마 색 (중성색 스케일 재정의 완료)
- 책장 인라인 편집 (이름/색/연도)
- 에디터 실시간 미리보기 + 스타일 바
- 데스크탑 전용 게이트 (1200px)
- 계정 설정의 연결 상태 (실제 세션에서 읽음)
