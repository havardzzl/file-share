import "server-only";
import { cookies } from "next/headers";
import { authClient, isConfigured } from "@/lib/supabase";
import { HttpError } from "@/lib/http";

export const SESSION_COOKIE = "file-share-session";
export async function isOwner() {
  if (!isConfigured()) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const { data, error } = await authClient().auth.getUser(token);
  return (
    !error &&
    Boolean(data.user?.email_confirmed_at) &&
    data.user?.email?.toLowerCase() ===
      process.env.OWNER_EMAIL?.trim().toLowerCase()
  );
}
export async function requireOwner() {
  if (!(await isOwner())) throw new HttpError(401, "登录已过期，请重新登录。");
}
