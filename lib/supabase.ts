import "server-only";
import { createClient } from "@supabase/supabase-js";

export function isConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.OWNER_EMAIL,
  );
}
export function admin() {
  if (!isConfigured()) throw new Error("请先配置 Supabase 环境变量。");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
export function authClient() {
  if (!isConfigured()) throw new Error("请先配置 Supabase 环境变量。");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
