// Edge Function: redeem-invite
// Verifiziert Invite-Code, legt Auth-User und profiles-Row in einer Transaktion an,
// markiert Code als verbraucht. Rollback wenn profiles-Insert fehlschlägt.
//
// Deploy:  supabase functions deploy redeem-invite
// Secrets: SUPABASE_SERVICE_ROLE_KEY muss via `supabase secrets set` gesetzt sein.
//          SUPABASE_URL wird von Supabase automatisch gesetzt.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimit(ip: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const e = attempts.get(ip);
  if (!e || e.reset < now) {
    attempts.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function validEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function validDisplayName(s: string) { return typeof s === "string" && s.trim().length >= 2 && s.length <= 40; }
function validPassword(s: string) { return typeof s === "string" && s.length >= 10; }
// Mindestens 8 Zeichen: bei [A-Z0-9-] (37 Zeichen) sind 8 Stellen ~3,5 Billionen
// Kombis – Brute-Force über das 5/Minute-Rate-Limit nicht mehr praktikabel.
function validCode(s: string) { return typeof s === "string" && /^[A-Z0-9-]{8,32}$/.test(s); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(ip)) return json({ error: "Zu viele Versuche, bitte warte kurz." }, 429);

  let payload: { email?: string; password?: string; display_name?: string; code?: string; legacy_match?: string };
  try { payload = await req.json(); } catch { return json({ error: "Ungültiger Request-Body." }, 400); }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const display_name = payload.display_name?.trim() ?? "";
  const code = payload.code?.trim().toUpperCase() ?? "";
  const legacy_match = payload.legacy_match?.trim() ?? "";

  if (!validEmail(email)) return json({ error: "Ungültige Email-Adresse." }, 400);
  if (!validPassword(password)) return json({ error: "Passwort muss mindestens 10 Zeichen haben." }, 400);
  if (!validDisplayName(display_name)) return json({ error: "Anzeigename muss 2–40 Zeichen lang sein." }, 400);
  if (!validCode(code)) return json({ error: "Ungültiger Invite-Code." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invite, error: inviteErr } = await admin
    .from("invite_codes")
    .select("code, expires_at, used_by")
    .eq("code", code)
    .maybeSingle();

  if (inviteErr) return json({ error: "Datenbankfehler beim Code-Check." }, 500);
  if (!invite) return json({ error: "Invite-Code unbekannt." }, 400);
  if (invite.used_by) return json({ error: "Invite-Code wurde bereits verwendet." }, 400);
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return json({ error: "Invite-Code ist abgelaufen." }, 400);
  }

  const { data: nameClash } = await admin
    .from("profiles")
    .select("id")
    .eq("display_name", display_name)
    .maybeSingle();
  if (nameClash) return json({ error: "Anzeigename ist bereits vergeben." }, 400);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created.user) {
    return json({ error: createErr?.message ?? "User konnte nicht angelegt werden." }, 400);
  }
  const userId = created.user.id;

  const { error: profileErr } = await admin
    .from("profiles")
    .insert({ id: userId, display_name });
  if (profileErr) {
    // Kompensation: User wieder löschen, damit Code nicht verloren ist.
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "Profil konnte nicht angelegt werden." }, 500);
  }

  const { error: redeemErr } = await admin
    .from("invite_codes")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_by", null);
  if (redeemErr) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "Code-Redemption fehlgeschlagen." }, 500);
  }

  // Legacy-Claim: übernimmt alle Sticker des gewählten Legacy-Namens auf den
  // neuen User. is_legacy bleibt true, damit image_path weiter auf das Repo zeigt.
  let claimed_stickers = 0;
  if (legacy_match) {
    const { count, error: claimErr } = await admin
      .from("stickers")
      .update({ uploader_id: userId, legacy_finder_name: null }, { count: "exact" })
      .eq("is_legacy", true)
      .eq("legacy_finder_name", legacy_match);
    if (!claimErr) claimed_stickers = count ?? 0;
  }

  return json({ ok: true, user_id: userId, claimed_stickers });
});
