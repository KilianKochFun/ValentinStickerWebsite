// Edge Function: admin-user-action
// Admin-only Aktionen gegen beliebige User:
//   - action: "reset_password" → setzt ein neues zufälliges Passwort und gibt es zurück.
//   - action: "delete"         → löscht den User wie in delete-account, nur durch einen
//                                Admin ausgelöst (nicht self-service).
//
// Caller muss eingeloggt und profiles.is_admin = true sein.
// Deploy: supabase functions deploy admin-user-action --no-verify-jwt

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

// 16-Zeichen-Passwort mit Buchstaben, Ziffern und wenigen Sonderzeichen.
// Keine Verwechslungen wie 0/O oder 1/l.
function generatePassword(len = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%*";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Nicht eingeloggt." }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Session ungültig." }, 401);
  const callerId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Admin-Check gegen profiles. is_admin wird nie aus dem Request gelesen.
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile?.is_admin) return json({ error: "Nur für Admins." }, 403);

  let payload: { action?: string; target_user_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "Ungültiger Request-Body." }, 400); }

  const action = payload.action;
  const target = payload.target_user_id;
  if (!target || typeof target !== "string") return json({ error: "target_user_id fehlt." }, 400);
  if (target === callerId) return json({ error: "Diese Aktion nicht gegen dich selbst ausführen." }, 400);

  if (action === "reset_password") {
    const newPassword = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(target, { password: newPassword });
    if (error) return json({ error: "Passwort-Reset fehlgeschlagen.", detail: error.message }, 500);
    return json({ ok: true, new_password: newPassword });
  }

  if (action === "delete") {
    // Gleicher Ablauf wie delete-account, nur vom Admin gegen einen Fremduser.
    const { data: files } = await admin.storage.from("stickers").list(target, { limit: 1000 });
    if (files && files.length) {
      const paths = files.map((f) => `${target}/${f.name}`);
      await admin.storage.from("stickers").remove(paths);
    }

    await admin.from("comments").update({ author_id: null }).eq("author_id", target);

    // stickers_has_finder-Constraint: vor NULLen von uploader_id den Display-Namen
    // als legacy_finder_name sichern.
    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", target).maybeSingle();
    const fallback = profile?.display_name ?? "Anonym";
    await admin
      .from("stickers")
      .update({ legacy_finder_name: fallback })
      .eq("uploader_id", target)
      .is("legacy_finder_name", null);

    await admin.from("stickers").update({ uploader_id: null }).eq("uploader_id", target);
    await admin.from("profiles").delete().eq("id", target);

    const { error: delErr } = await admin.auth.admin.deleteUser(target);
    if (delErr) return json({ error: "Löschen fehlgeschlagen.", detail: delErr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "Unbekannte Aktion." }, 400);
});
