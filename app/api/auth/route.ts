import { cookies } from "next/headers";
import { z } from "zod";
import { authClient } from "@/lib/supabase";
import { SESSION_COOKIE, requireOwner } from "@/lib/auth";
import { body, HttpError, json, route, sameOrigin } from "@/lib/http";

export const POST = route(async (request) => {
  sameOrigin(request);
  const { password } = await body(
    request,
    z.object({ password: z.string().min(1).max(1024) }),
  );
  const { data, error } = await authClient().auth.signInWithPassword({
    email: process.env.OWNER_EMAIL!.trim(),
    password,
  });
  if (
    error ||
    !data.session ||
    !data.user.email_confirmed_at ||
    data.user.email?.toLowerCase() !==
      process.env.OWNER_EMAIL!.trim().toLowerCase()
  ) {
    throw new HttpError(
      error?.status === 429 ? 429 : 401,
      error?.status === 429
        ? "尝试次数过多，请稍后再试。"
        : "密码不正确，或账号尚未确认。",
    );
  }
  (await cookies()).set(SESSION_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: data.session.expires_in,
  });
  return json({ ok: true });
});
export const GET = route(async () => {
  await requireOwner();
  return json({ ok: true });
});
export const DELETE = route(async (request) => {
  sameOrigin(request);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (token) await authClient().auth.admin.signOut(token, "local");
  return json({ ok: true });
});
