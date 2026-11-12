import { admin } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { json, route } from "@/lib/http";
export const GET = route(async (request) => {
  await requireOwner();
  const offsetValue = Number(
    new URL(request.url).searchParams.get("offset") || "0",
  );
  const offset =
    Number.isSafeInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
  const { data, error, count } = await admin()
    .from("shares")
    .select("id,filename,kind,size_bytes,status,created_at,expires_at", {
      count: "exact",
    })
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .range(offset, offset + 19);
  if (error) throw error;
  return json({ shares: data, total: count });
});
