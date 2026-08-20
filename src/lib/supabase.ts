import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트를 **필요할 때** 불러옵니다.
 *
 * [왜 정적 import 가 아닌가]
 * @supabase/supabase-js 를 그냥 import 하면 메인 청크에 통째로 들어갑니다.
 * 실측으로 gzip 기준 57KB 가 늘었습니다. 랜딩은 로그인이 필요 없는
 * 화면인데, 처음 들어온 사람이 인증 라이브러리를 통째로 내려받게 됩니다.
 * 동적 import 로 돌리면 별도 청크로 빠지고 첫 화면이 그만큼 가벼워집니다.
 *
 * [키에 대해]
 * publishable(과거 anon) 키는 브라우저에 노출돼도 되는 키입니다. 단,
 * 테이블에 RLS 정책이 걸려 있을 때의 이야기입니다. 테이블을 만들 때
 * RLS 를 반드시 켜세요. service_role 키는 RLS 를 통째로 무시하므로
 * 프론트에 절대 넣지 않습니다.
 *
 * [환경변수가 없을 때]
 * null 을 돌려줍니다. Vercel 에 환경변수를 넣기 전에 push 해도 화면이
 * 죽지 않게 하려는 것이고, 그 상태에서는 로그인이 목업으로 돕니다.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url as string, key as string, {
        auth: {
          // OAuth 가 돌려보낸 주소에서 코드를 꺼내 세션으로 바꿉니다.
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    );
  }

  return clientPromise;
}
