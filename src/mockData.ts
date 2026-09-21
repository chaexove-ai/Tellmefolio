// 개발 초기 단계용 목 데이터. 실제 연동 시 API 응답으로 대체합니다.

export type AIRequestStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export interface Portfolio {
  id: string;
  title: string;
  job: string;
  year: number;
  visibility: "공개" | "비공개" | "초안";
  updatedAt: string;
  jobColor: string;
}

export const portfolios: Portfolio[] = [
  {
    id: "p1",
    title: "프론트엔드 개발자 포트폴리오 2024",
    job: "프론트엔드",
    year: 2024,
    visibility: "공개",
    updatedAt: "2025-06-12",
    jobColor: "#3b82f6",
  },
  {
    id: "p2",
    title: "UX 디자이너 전환 포트폴리오",
    job: "UX 디자인",
    year: 2024,
    visibility: "초안",
    updatedAt: "2025-06-09",
    jobColor: "#ec4899",
  },
  {
    id: "p3",
    title: "백엔드 엔지니어 포트폴리오",
    job: "백엔드",
    year: 2023,
    visibility: "공개",
    updatedAt: "2025-05-28",
    jobColor: "#10b981",
  },
  {
    id: "p4",
    title: "풀스택 개발자 케이스 스터디",
    job: "풀스택",
    year: 2023,
    visibility: "비공개",
    updatedAt: "2025-05-14",
    jobColor: "#f59e0b",
  },
];

export interface VersionEntry {
  id: string;
  label: string;
  timestamp: string;
  current?: boolean;
}

export const versionHistory: VersionEntry[] = [
  { id: "v8", label: "AI 초안 생성", timestamp: "2025-01-14 15:22", current: true },
  { id: "v7", label: "직접 편집 저장", timestamp: "2025-01-14 11:05" },
  { id: "v6", label: "AI 문장 다듬기 적용", timestamp: "2025-01-13 18:48" },
  { id: "v5", label: "직접 편집 저장", timestamp: "2025-01-13 10:17" },
  { id: "v4", label: "템플릿 전환", timestamp: "2025-01-12 16:33" },
  { id: "v3", label: "AI 초안 생성", timestamp: "2025-01-11 14:10" },
  { id: "v2", label: "직접 편집 저장", timestamp: "2025-01-10 09:44" },
  { id: "v1", label: "초기 저장", timestamp: "2025-01-09 13:00" },
];

export const socialAccounts = [
  { provider: "Google", identifier: "hong@gmail.com", isLoginMethod: true, isSourceAccess: false },
  { provider: "GitHub", identifier: "hong-dev", isLoginMethod: false, isSourceAccess: false },
  { provider: "Figma", identifier: "hong@figma.com", isLoginMethod: false, isSourceAccess: true },
];
