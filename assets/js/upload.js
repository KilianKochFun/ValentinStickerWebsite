// Sticker-Upload: Bild in Storage, Row in Tabelle stickers.
import { supabase } from "./supabase-client.js";
import { STORAGE_BUCKET } from "./config.js";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB (entspricht Bucket-Limit)

function sanitizeFilename(name) {
  const base = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return base.length > 80 ? base.slice(-80) : base;
}

export function guessContinent(lat, lng) {
  if (lat == null || lng == null) return null;
  if (lat >= -60 && lat <= 13 && lng >= -82 && lng <= -34) return "SA";
  if (lat >= 13 && lat <= 84 && lng >= -170 && lng <= -52) return "NA";
  if (lat >= 34 && lat <= 72 && lng >= -25 && lng <= 45) return "EU";
  if (lat >= -35 && lat <= 38 && lng >= -18 && lng <= 52) return "AF";
  if (lat >= -10 && lat <= 82 && lng >= 25 && lng <= 180) return "AS";
  if (lat >= -50 && lat <= 0 && lng >= 110 && lng <= 180) return "OC";
  if (lat < -60) return "AN";
  return null;
}

// Lädt ein Bild in den eigenen Storage-Ordner und gibt den neuen Pfad zurück.
// Validiert MIME und Größe. Nutzt die Konvention "{user.id}/{timestamp}-{filename}".
export async function uploadImage(file) {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) throw new Error("Nicht eingeloggt.");
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Nur JPEG, PNG oder WebP.");
  if (file.size > MAX_SIZE) throw new Error("Datei ist größer als 5 MB.");

  const path = `${user.id}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);
  return path;
}

export async function uploadSticker({ file, title, description, latitude, longitude, found_at, continent, country_code }) {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) throw new Error("Nicht eingeloggt.");

  const path = await uploadImage(file);

  const row = {
    uploader_id: user.id,
    is_legacy: false,
    legacy_finder_name: null,
    image_path: path,
    title: title || null,
    description: description || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    country_code: country_code || null,
    continent: continent || guessContinent(latitude, longitude),
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
