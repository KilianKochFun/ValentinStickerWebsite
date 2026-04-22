// Bootstrap: holt Sticker aus Supabase und lädt dann das Haupt-Script.
//
// Verwendung:
//   <script src="assets/js/config-global.js"></script>
//   <script src="assets/js/bootstrap.js" data-main="script.js"></script>

(() => {
  const scriptEl = document.currentScript;
  const mainSrc  = scriptEl.getAttribute("data-main");
  const cfg      = window.VS_CONFIG;

  function loadMain() {
    const s = document.createElement("script");
    s.src = mainSrc;
    document.body.appendChild(s);
  }

  function showError(msg) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);" +
      "background:#ffebee;color:#b71c1c;border:2px solid #c62828;border-radius:10px;" +
      "padding:12px 18px;z-index:9999;font-family:Arial,sans-serif;max-width:90%;";
    box.textContent = msg;
    document.body.appendChild(box);
  }

  async function fetchFromSupabase() {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    // Nur öffentliche Daten lesen — keine Session nötig. Eigener storageKey,
    // damit es keine Kollision mit dem Auth-Client in supabase-client.js gibt.
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "vs-bootstrap-readonly",
      }
    });

    const { data, error } = await sb
      .from("stickers")
      .select(
        "id, uploader_id, legacy_finder_name, image_path, is_legacy, title, description, latitude, longitude, found_at, profiles:uploader_id(display_name)"
      )
      .eq("is_hidden", false)
      .order("found_at", { ascending: true });

    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Keine Daten");

    const bucket = cfg.STORAGE_BUCKET || "stickers";
    const placeholder = "img/valentinSticker.webp";
    return data.map((row) => ({
      position: [row.latitude, row.longitude],
      image: row.image_path
        ? sb.storage.from(bucket).getPublicUrl(row.image_path).data.publicUrl
        : placeholder,
      time: row.found_at ? new Date(row.found_at) : new Date(),
      finder: row.profiles?.display_name || row.legacy_finder_name || "Anonym",
      title: row.title || "",
      description: row.description || "",
    }));
  }

  (async () => {
    try {
      window.locations = await fetchFromSupabase();
      loadMain();
    } catch (e) {
      console.error("[bootstrap] Supabase-Fetch fehlgeschlagen:", e);
      showError("Sticker konnten nicht geladen werden. Bitte Seite neu laden.");
      window.locations = [];
      loadMain();
    }
  })();
})();
