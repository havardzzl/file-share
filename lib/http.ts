import { NextResponse } from "next/server";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  // Only small metadata is accepted here. Content goes directly to Storage.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容不能为空。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "请求内容过大。");
    }
    chunks.push(value);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "请求格式不正确。");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, parsed.error.issues[0]?.message || "参数不正确。");
  return parsed.data;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new HttpError(403, "请求来源不正确，请刷新页面后重试。");
  }
}
export function handleError(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  // Do not log storage URLs, tokens, passwords or request bodies.
  console.error(
    "Share request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    { error: "服务暂时不可用，请稍后重试并检查 Supabase 配置。" },
    500,
  );
}
export function route(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request);
    } catch (error) {
      return handleError(error);
    }
  };
}
export function uuid(value: string) {
  if (!z.uuid().safeParse(value).success)
    throw new HttpError(404, "分享不存在或已过期。");
  return value;
}
