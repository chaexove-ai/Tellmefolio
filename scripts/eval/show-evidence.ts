/**
 * 포트폴리오를 운영 코드(buildEvidence)로 쪼갠 근거 id 목록을 보여 줍니다.
 * 라벨을 쓰거나 검수할 때 이 목록을 보고 id 를 고릅니다.
 *
 *   npm run eval:evidence -- pf-dev-01
 */
import { buildEvidence } from "../../supabase/functions/_shared/evidence.ts";
import { loadPortfolio } from "./data.ts";

const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!id) {
  console.error("사용법: npm run eval:evidence -- <포트폴리오 id>");
  process.exit(1);
}
const p = loadPortfolio(id);
p.projects.forEach((proj, i) => console.log(`p${i} = ${proj.name} [${proj.stack.join(", ")}]`));
console.log("");
for (const e of buildEvidence(p.projects)) console.log(`${e.id}\t${e.text}`);
