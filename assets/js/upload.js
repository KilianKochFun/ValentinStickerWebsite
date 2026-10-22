// Sticker-Upload: Bild in Storage, Row in Tabelle stickers.
import { supabase } from "./supabase-client.js";
import { STORAGE_BUCKET } from "./config.js";
import { CONTINENT_BY_COUNTRY } from "./countries.js";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO = 15 * 1024 * 1024;  // 15 MB (Bucket-Limit)
const MAX_VIDEO_SECONDS = 30;

export function isVideoFile(file) {
  return !!file && ALLOWED_VIDEO.includes(file.type);
}

// Liest die Länge eines Videos aus den Metadaten (ohne komplett zu laden).
export function videoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Video konnte nicht gelesen werden.")); };
    v.src = url;
  });
}

function sanitizeFilename(name) {
  const base = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return base.length > 80 ? base.slice(-80) : base;
}

// Ermittelt den ISO-Ländercode zu den Koordinaten (OpenStreetMap/Nominatim).
// Passiert genau einmal pro Sticker beim Upload; das Ergebnis landet in der DB,
// die Website selbst fragt später keinen Geocoder mehr.
//
// Schlägt die Abfrage fehl, bleibt country_code leer — der Sticker wird trotzdem
// gespeichert und kann per scripts/backfill-countries.js nachgetragen werden.
export async function lookupCountryCode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({
    format: "jsonv2", lat, lon: lng, zoom: 3, addressdetails: 1,
  });
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "de" } });
    if (!res.ok) return null;
    const cc = (await res.json())?.address?.country_code;
    return cc ? cc.toUpperCase() : null;
  } catch {
    return null;
  }
}

// Ist gerade ein offener Upload-Zeitraum aktiv? Gibt das Enddatum zurück oder null.
export async function openUploadUntil() {
  const { data } = await supabase.from("upload_settings").select("open_until").eq("id", 1).maybeSingle();
  const until = data?.open_until ? new Date(data.open_until) : null;
  return until && until > new Date() ? until : null;
}

// Lädt ein Bild in den eigenen Storage-Ordner und gibt den neuen Pfad zurück.
// Validiert MIME und Größe. Nutzt die Konvention "{user.id}/{timestamp}-{filename}",
// ohne Login (offener Upload) "anon/{timestamp}-{filename}".
export async function uploadImage(file) {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user && !(await openUploadUntil())) throw new Error("Nicht eingeloggt.");

  const isImage = ALLOWED_IMAGE.includes(file.type);
  const isVideo = ALLOWED_VIDEO.includes(file.type);
  if (!isImage && !isVideo) {
    throw new Error("Nur Bilder (JPEG, PNG, WebP) oder Videos (MP4, WebM, MOV).");
  }
  if (isImage && file.size > MAX_IMAGE) throw new Error("Bild ist größer als 5 MB.");
  if (isVideo) {
    if (file.size > MAX_VIDEO) throw new Error("Video ist größer als 15 MB.");
    const dur = await videoDuration(file);
    if (dur > MAX_VIDEO_SECONDS + 0.5) {
      throw new Error(`Video ist zu lang (${Math.round(dur)} s). Maximal ${MAX_VIDEO_SECONDS} s erlaubt.`);
    }
  }

  const path = `${user ? user.id : "anon"}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);
  return path;
}

export async function uploadSticker({ file, title, description, latitude, longitude, found_at, continent, country_code, finder_name, email }) {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  const name = (finder_name || "").trim();
  if (!user && (!name || !(email || "").trim())) throw new Error("Bitte Name und E-Mail angeben.");

  const path = await uploadImage(file);

  // Land bestimmen, falls der Aufrufer keins mitgibt. Ein Fehlschlag darf den
  // Upload nicht blockieren – dann bleibt das Feld eben leer.
  const cc = country_code || (await lookupCountryCode(latitude, longitude));

  // Ohne Login (offener Upload): Sticker + E-Mail legt die RPC serverseitig an.
  // Die Datei bleibt bei einem Fehler liegen – anonyme Nutzer dürfen nicht löschen.
  if (!user) {
    const { data: id, error } = await supabase.rpc("submit_open_upload", {
      p_image_path: path,
      p_title: title || null,
      p_description: description || null,
      p_latitude: Number.isFinite(latitude) ? latitude : null,
      p_longitude: Number.isFinite(longitude) ? longitude : null,
      p_country_code: cc || null,
      p_continent: continent || (cc ? CONTINENT_BY_COUNTRY[cc] ?? null : null),
      p_found_at: found_at || null,
      p_finder_name: name,
      p_email: email.trim(),
    });
    if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
    return { id };
  }

  const row = {
    uploader_id: user.id,
    is_legacy: false,
    legacy_finder_name: null,
    image_path: path,
    title: title || null,
    description: description || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    country_code: cc || null,
    continent: continent || (cc ? CONTINENT_BY_COUNTRY[cc] ?? null : null),
    found_at: found_at || new Date().toISOString(),
  };

  const { data, error } = await supabase.from("stickers").insert(row).select().single();
  if (error) {
    // Cleanup: Bild wegräumen, wenn Row-Insert scheitert
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
  }
  return data;
}
