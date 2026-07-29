import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await db.user.findUnique({ where: { supabaseUserId: user.id } });
  return dbUser?.id ?? null;
}
