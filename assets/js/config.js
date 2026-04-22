// ES-Modul-Brücke auf die globale Config aus config-global.js.
// Die Werte leben nur an EINER Stelle (config-global.js als Classic-Script),
// und werden hier für Module-Konsumenten (supabase-client.js, auth.js, …)
// re-exportiert. Jede HTML-Seite, die ein Modul lädt, muss deshalb vorher
// <script src="assets/js/config-global.js"></script> einbinden.

const cfg = window.VS_CONFIG;
if (!cfg) {
  throw new Error(
    "VS_CONFIG fehlt – config-global.js muss vor den Modul-Scripts geladen werden."
  );
}

export const SUPABASE_URL = cfg.SUPABASE_URL;
export const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;
export const STORAGE_BUCKET = cfg.STORAGE_BUCKET;
export const DISTANCE_ANCHOR = cfg.DISTANCE_ANCHOR;
