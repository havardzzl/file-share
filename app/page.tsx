import { isOwner } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Home() {
  const configured = isConfigured();
  return (
    <Workspace
      configured={configured}
      authenticated={configured && (await isOwner())}
    />
  );
}
