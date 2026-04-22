// Login, Signup (via Edge Function redeem-invite), Logout.
import { supabase } from "./supabase-client.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function signupWithInvite({ email, password, display_name, code, legacy_match }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password, display_name, code, legacy_match: legacy_match || null }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Registrierung fehlgeschlagen.");
  await login(email, password);
  return { claimed_stickers: body?.claimed_stickers ?? 0 };
}

export async function deleteOwnAccount() {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("Nicht eingeloggt.");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Account-Löschung fehlgeschlagen.");
  await supabase.auth.signOut();
}

// Legacy-Namen vorschlagen: alle distinct legacy_finder_name die noch keinem
// registrierten Nutzer gehören.
export async function listUnclaimedLegacyNames() {
  const { data, error } = await supabase
    .from("stickers")
    .select("legacy_finder_name")
    .eq("is_legacy", true)
    .not("legacy_finder_name", "is", null);
  if (error) return [];
  const seen = new Set();
  for (const row of data) {
    if (row.legacy_finder_name) seen.add(row.legacy_finder_name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "de"));
}
