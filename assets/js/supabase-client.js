// Gemeinsamer Supabase-Client für alle Seiten. Wird als ESM aus CDN geladen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function imageUrlFor(sticker) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(sticker.image_path);
  return data.publicUrl;
}

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function currentProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
