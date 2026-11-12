import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { getShare } from "@/lib/shares";
import { BUCKET } from "@/lib/shared";
import { handleError } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const share = await getShare((await context.params).id);
    // Signed links never outlive the share and force an attachment download.
    const ttl = share.expires_at
      ? Math.max(
          1,
          Math.min(
            60,
            Math.floor((Date.parse(share.expires_at) - Date.now()) / 1000),
          ),
        )
      : 60;
    const { data, error } = await admin()
      .storage.from(BUCKET)
      .createSignedUrl(share.storage_path, ttl, { download: share.filename });
    if (error || !data) throw error ?? new Error("Download unavailable");
    const response = NextResponse.redirect(data.signedUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleError(error);
  }
}
