import { randomUUID } from "node:crypto";
import { z } from "zod";
import { admin } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { body, json, route, sameOrigin } from "@/lib/http";
import { BUCKET, MAX_BYTES, safeFilename } from "@/lib/shared";
const schema = z.object({
  filename: z.string().min(1).max(255),
  kind: z.enum(["file", "text"]),
  size: z
    .number()
    .int()
    .min(1, "内容不能为空。")
    .max(MAX_BYTES, "内容不能超过 5MB。"),
  expiresIn: z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]),
});
export const POST = route(async (request) => {
  sameOrigin(request);
  await requireOwner();
  const input = await body(request, schema);
  const id = randomUUID();
  const path = `${id}/${randomUUID()}`;
  const client = admin();
  const { error } = await client.from("shares").insert({
    id,
    storage_path: path,
    filename: safeFilename(input.filename),
    kind: input.kind,
    size_bytes: input.size,
    status: "pending",
    expires_at: input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 86400000).toISOString()
      : null,
  });
  if (error) throw error;
  const { data, error: uploadError } = await client.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (uploadError || !data) {
    await client.from("shares").delete().eq("id", id);
    throw uploadError ?? new Error("Upload URL unavailable");
  }
  return json({ id, uploadUrl: data.signedUrl });
});
