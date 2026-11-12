import { timingSafeEqual } from "node:crypto";
import { admin } from "@/lib/supabase";
import { HttpError, json, route } from "@/lib/http";
import { removeShares } from "@/lib/shares";
export const maxDuration = 60;
export const GET = route(async (request) => {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  ) {
    throw new HttpError(401, "未授权。");
  }
  const now = new Date().toISOString();
  // Signed upload URLs live for 2h; wait 24h before reclaiming abandoned records.
  const stale = new Date(Date.now() - 86400000).toISOString();
  let removed = 0;
  for (let batch = 0; batch < 5; batch++) {
    const { data, error } = await admin()
      .from("shares")
      .select("id,storage_path")
      .or(
        `and(status.eq.ready,expires_at.lte.${now}),and(status.in.(pending,deleted),created_at.lte.${stale})`,
      )
      .limit(100);
    if (error) throw error;
    if (!data?.length) break;
    await removeShares(data);
    removed += data.length;
  }
  return json({ removed });
});
