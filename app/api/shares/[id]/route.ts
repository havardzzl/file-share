import { requireOwner } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { handleError, json, sameOrigin, uuid } from "@/lib/http";
import { removeShares } from "@/lib/shares";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireOwner();
    const id = uuid((await context.params).id);
    const { data, error } = await admin()
      .from("shares")
      .select("id,storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data) await removeShares([data]);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
