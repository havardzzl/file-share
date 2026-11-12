import "server-only";
import { admin } from "@/lib/supabase";
import { BUCKET, isExpired, type Share } from "@/lib/shared";
import { HttpError, uuid } from "@/lib/http";
export async function getShare(id: string, ready = true): Promise<Share> {
  uuid(id);
  const { data, error } = await admin()
    .from("shares")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (
    !data ||
    data.status === "deleted" ||
    (ready && data.status !== "ready") ||
    isExpired(data.expires_at)
  ) {
    throw new HttpError(404, "分享不存在或已过期。");
  }
  return data as Share;
}
export async function readText(share: Share) {
  const { data, error } = await admin()
    .storage.from(BUCKET)
    .download(share.storage_path);
  if (error || !data) throw error ?? new Error("Content missing");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    await data.arrayBuffer(),
  );
}
export async function removeShares(
  shares: Pick<Share, "id" | "storage_path">[],
) {
  if (!shares.length) return;
  const client = admin();
  // Keep a tombstone while a signed upload URL can still be used. A late or
  // retried upload will be reclaimed by cleanup instead of becoming orphaned.
  const { error: markError } = await client
    .from("shares")
    .update({ status: "deleted" })
    .in(
      "id",
      shares.map((s) => s.id),
    );
  if (markError) throw markError;
  const { error } = await client.storage
    .from(BUCKET)
    .remove(shares.map((s) => s.storage_path));
  if (error) throw error;
  const { error: dbError } = await client
    .from("shares")
    .delete()
    .in(
      "id",
      shares.map((s) => s.id),
    )
    .lte("created_at", new Date(Date.now() - 86400000).toISOString());
  if (dbError) throw dbError;
}
