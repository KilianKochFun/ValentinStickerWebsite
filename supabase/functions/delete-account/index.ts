// Edge Function: delete-account
// DSGVO-Recht auf Löschung. Anonymisiert Inhalte (stickers.uploader_id = NULL,
// comments.author_id = NULL), löscht Storage-Dateien im eigenen Prefix,
// entfernt profile und Auth-User.
//
// Deploy: supabase functions deploy delete-account
// Client ruft mit Authorization: Bearer <user-jwt>.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Nicht eingeloggt." }, 401);

  // User aus JWT extrahieren (mit Anon-Client + eingehendem Token)
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Session ungültig." }, 401);
  const uid = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Storage-Objekte unter "{uid}/" auflisten und löschen
  const { data: files } = await admin.storage.from("stickers").list(uid, { limit: 1000 });
  if (files && files.length) {
    const paths = files.map((f) => `${uid}/${f.name}`);
    await admin.storage.from("stickers").remove(paths);
  }

  // 2. Kommentare anonymisieren (Body bleibt für Kontext erhalten)
  await admin.from("comments").update({ author_id: null }).eq("author_id", uid);

  // 3. Vor der Anonymisierung legacy_finder_name auf den Display-Namen setzen,
  //    sonst scheitert "uploader_id = NULL" am Check-Constraint stickers_has_finder.
  const { data: profile } = await admin.from("profiles").select("display_name").eq("id", uid).maybeSingle();
  const fallback = profile?.display_name ?? "Anonym";
  await admin
    .from("stickers")
    .update({ legacy_finder_name: fallback })
    .eq("uploader_id", uid)
    .is("legacy_finder_name", null);

  // 4. Sticker anonymisieren (Bild + Metadaten bleiben, Uploader ist weg)
  await admin.from("stickers").update({ uploader_id: null }).eq("uploader_id", uid);

  // 4. Profil löschen
  await admin.from("profiles").delete().eq("id", uid);

  // 5. Auth-User löschen
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return json({ error: "Account-Löschung fehlgeschlagen.", detail: delErr.message }, 500);

  return json({ ok: true });
});
