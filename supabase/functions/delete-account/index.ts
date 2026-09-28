/**
 * 계정 삭제 Edge Function.
 *
 * [왜 서버가 필요한가]
 * auth.users 행을 지우려면 service_role 키가 필요합니다. 그 키는 RLS 를
 * 통째로 무시하므로 브라우저에 두면 누구나 남의 데이터를 지울 수 있습니다.
 * 키는 이 함수 안에만 있습니다.
 *
 * [누구를 지우는가]
 * **요청자 본인만.** 클라이언트는 user id 를 보내지 않고, 보내도 무시합니다.
 * 지울 대상은 오직 Authorization 헤더의 JWT 에서 꺼냅니다. id 를 받는
 * 구조로 만들면 그 자체가 "아무 계정이나 지우는 API" 가 됩니다.
 *
 * [지우는 순서]
 * 1) Storage 의 표지 이미지와 프로필 사진 — 테이블 cascade 가 닿지 않는
 *    별도 저장소입니다.
 * 2) auth.users 행 — portfolios/portfolio_projects/draft_generations/
 *    profiles 는 전부 `on delete cascade` 라 이 한 번으로 따라 지워집니다.
 *
 * 순서가 반대면 안 됩니다. 계정을 먼저 지우면 어떤 파일이 그 사람 것이었는지
 * 알 방법이 없어져서 이미지가 영구히 남습니다.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const COVER_BUCKET = "portfolio-covers";
// [2026-09-23] 프로필 사진. 표지와 같은 이유로 여기서 직접 지웁니다 —
// Storage 는 테이블의 cascade 가 닿지 않는 별도 저장소라, profiles 행이
// 따라 지워져도 파일은 그대로 남고 공개 URL 이 계속 살아 있습니다.
const AVATAR_BUCKET = "avatars";
/** [2026-09-25] 제출 기록 결과물(비공개). 경로는 `${userId}/${submissionId}.html` */
const SUBMISSIONS_BUCKET = "submissions";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // 이 두 값은 Supabase 가 모든 Edge Function 에 자동으로 넣어줍니다.
    // 없다면 배포 환경이 잘못된 것이지 사용자 잘못이 아닙니다.
    return json({ error: "서버 설정이 올바르지 않습니다." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "로그인이 필요합니다." }, 401);
  }

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2.45.0"
  );

  // 1) 요청자가 누구인지 확인. 사용자의 토큰으로 조회하므로 남을 사칭할 수 없습니다.
  const asUser = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await asUser.auth.getUser();
  const userId = userData?.user?.id;

  if (userError || !userId) {
    return json({ error: "로그인이 만료되었습니다. 다시 로그인해주세요." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 2) Storage 의 표지 이미지. 경로는 항상 `${userId}/${portfolioId}/cover.<ext>`.
  //    실패해도 계정 삭제 자체는 진행합니다 — 사용자가 "지워달라" 고 한
  //    본체는 계정이고, 여기서 멈추면 계정이 남습니다. 남은 파일은
  //    복구 가능한 실수지만, 지워달라는 계정이 남는 건 그렇지 않습니다.
  //
  // [2026-09-22] 한 단계만 훑던 것을 재귀로 바꿨습니다. 표지는
  // {userId}/{portfolioId}/cover.webp 로 두 단계였지만, 프로젝트 이미지가
  // 생기면서 {userId}/{portfolioId}/projects/{projectId}/{n}.webp 로 네
  // 단계가 됐습니다. 예전 코드는 그 깊이를 못 봐서 이미지가 전부 남았습니다.
  //
  // Storage 의 list 는 재귀가 안 됩니다. 폴더인지 파일인지는 id 로
  // 구분합니다 — 실제 객체는 id 를 갖고, 경로 중간의 가짜 폴더는 null 입니다.
  //
  // [2026-09-23] 버킷을 하나 더 받게 했습니다. 프로필 사진이 avatars 에
  // 따로 들어가는데, 지우는 규칙은 표지와 완전히 같습니다 — 사용자 id
  // 폴더 아래를 통째로 훑어 지웁니다. 같은 코드를 복사하면 한쪽만 고치는
  // 사고가 납니다.
  const purgeBucket = async (bucket: string) => {
    try {
      const paths: string[] = [];

      const walk = async (prefix: string, depth: number): Promise<void> => {
        // 깊이 상한은 무한 루프 방어입니다. 실제로 필요한 건 4단계입니다.
        if (depth > 6) return;
        const { data: entries } = await admin.storage
          .from(bucket)
          .list(prefix, { limit: 1000 });

        for (const entry of entries ?? []) {
          const full = `${prefix}/${entry.name}`;
          if (entry.id) paths.push(full);
          else await walk(full, depth + 1);
        }
      };

      await walk(userId, 0);

      // remove 는 한 번에 받는 개수에 한계가 있어 나눠 보냅니다.
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      }
    } catch (_) {
      // 위 주석대로 계속 진행합니다. 한 버킷이 실패해도 다른 버킷과
      // 계정 삭제는 그대로 갑니다.
    }
  };

  await purgeBucket(COVER_BUCKET);
  await purgeBucket(AVATAR_BUCKET);
  await purgeBucket(SUBMISSIONS_BUCKET);

  // 3) 계정. 나머지 테이블은 on delete cascade 로 따라갑니다.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return json({ error: "계정을 삭제하지 못했습니다." }, 500);
  }

  return json({ ok: true });
});
