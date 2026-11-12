import { admin } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { handleError, HttpError, json, sameOrigin } from "@/lib/http";
import { getShare, readText, removeShares } from "@/lib/shares";
import { BUCKET, MAX_BYTES } from "@/lib/shared";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireOwner();
    const share = await getShare((await context.params).id, false);
    if (share.status === "ready") return json({ id: share.id });
    const client = admin();
    const { data, error } = await client.storage
      .from(BUCKET)
      .info(share.storage_path);
    if (error || !data) throw new HttpError(409, "文件尚未上传完成，请重试。");
    if (
      !Number.isSafeInteger(data.size) ||
      data.size !== share.size_bytes ||
      data.size < 1 ||
      data.size > MAX_BYTES
    ) {
      await removeShares([share]);
      throw new HttpError(400, "实际内容大小不符合限制，请重新上传。");
    }
    if (share.kind === "text") {
      try {
        await readText(share);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        await removeShares([share]);
        throw new HttpError(400, "文本必须使用 UTF-8 编码。");
      }
    }
    const { data: updated, error: updateError } = await client
      .from("shares")
      .update({ status: "ready" })
      .eq("id", share.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new HttpError(409, "分享状态已改变，请刷新后重试。");
    return json({ id: share.id });
  } catch (error) {
    return handleError(error);
  }
}
