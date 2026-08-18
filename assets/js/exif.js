// Minimaler EXIF-Leser: holt GPS-Position und Aufnahmezeitpunkt aus einem JPEG.
//
// Bewusst selbst geschrieben statt einer Bibliothek – gebraucht werden genau
// drei Werte, und so hängt der Upload nicht an einem fremden CDN.
//
// Aufbau: JPEG besteht aus Segmenten (0xFFxx). Das APP1-Segment (0xFFE1) mit
// der Kennung "Exif\0\0" enthält einen kompletten TIFF-Block: Header mit
// Byte-Reihenfolge, dann IFD0 (Bild-Tags). IFD0 enthält Zeiger auf die
// Exif-SubIFD (Aufnahmedatum) und die GPS-IFD (Koordinaten).
//
// PNG und WebP werden nicht unterstützt – sie tragen in der Praxis keine
// Kamera-GPS-Daten. Bei allem Unerwarteten wird null geliefert, nie geworfen.

const TAG_EXIF_IFD  = 0x8769;
const TAG_GPS_IFD   = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT     = 0x0002;
const TAG_GPS_LON_REF = 0x0003;
const TAG_GPS_LON     = 0x0004;

// Bytes pro Wert je EXIF-Datentyp (Index = Typnummer).
const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

// Sucht das APP1/Exif-Segment und gibt dessen TIFF-Startoffset zurück.
function findTiffStart(view) {
  if (view.getUint16(0) !== 0xffd8) return -1;      // kein JPEG
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return -1;  // Segmentstruktur kaputt
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      // "Exif\0\0" prüfen, dann beginnt direkt danach der TIFF-Block.
      if (view.getUint32(offset + 4) === 0x45786966) return offset + 10;
      return -1;
    }
    if (marker === 0xda) return -1;                 // ab hier Bilddaten
    offset += 2 + size;
  }
  return -1;
}

// Liest eine IFD und liefert { tag: wert }. `want` begrenzt auf die Tags,
// die uns interessieren – alles andere wird übersprungen.
function readIfd(view, tiff, ifdOffset, little, want) {
  const out = {};
  const count = view.getUint16(tiff + ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entry = tiff + ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (!want.includes(tag)) continue;

    const type = view.getUint16(entry + 2, little);
    const num = view.getUint32(entry + 4, little);
    const size = (TYPE_SIZES[type] ?? 0) * num;
    if (!size) continue;
    // Bis 4 Byte stehen die Daten direkt im Eintrag, sonst folgt ein Zeiger.
    const dataOffset = size <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, little);
    if (dataOffset + size > view.byteLength) continue;

    if (type === 2) {
      // ASCII, abschließendes Nullbyte abschneiden
      let str = "";
      for (let k = 0; k < num - 1; k++) str += String.fromCharCode(view.getUint8(dataOffset + k));
      out[tag] = str;
    } else if (type === 5) {
      // RATIONAL: Zähler/Nenner-Paare (GPS liefert Grad, Minuten, Sekunden)
      const vals = [];
      for (let k = 0; k < num; k++) {
        const n = view.getUint32(dataOffset + k * 8, little);
        const d = view.getUint32(dataOffset + k * 8 + 4, little);
        vals.push(d === 0 ? 0 : n / d);
      }
      out[tag] = vals;
    } else if (type === 3) {
      out[tag] = view.getUint16(dataOffset, little);
    } else if (type === 4) {
      out[tag] = view.getUint32(dataOffset, little);
    }
  }
  return out;
}

// Grad/Minuten/Sekunden -> Dezimalgrad. "S" und "W" sind negativ.
function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const dec = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (!Number.isFinite(dec)) return null;
  return (ref === "S" || ref === "W") ? -dec : dec;
}

// "2026:07:03 08:24:57" -> Date (lokale Zeit, so wie die Kamera sie notiert hat)
function parseExifDate(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(str ?? "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Liest GPS und Aufnahmezeit aus einer Bilddatei.
 * @returns {Promise<{latitude:number|null, longitude:number|null, takenAt:Date|null}>}
 */
export async function readImageExif(file) {
  const empty = { latitude: null, longitude: null, takenAt: null };
  if (!file || !/jpe?g/i.test(file.type)) return empty;
  try {
    // Die EXIF-Daten stehen am Dateianfang – 256 KB reichen weit aus, damit
    // muss kein 5-MB-Foto komplett in den Speicher gelesen werden.
    const head = file.slice(0, 256 * 1024);
    const view = new DataView(await head.arrayBuffer());

    const tiff = findTiffStart(view);
    if (tiff < 0) return empty;

    const byteOrder = view.getUint16(tiff);
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return empty;
    const little = byteOrder === 0x4949;             // 0x4949 = "II" = little endian

    const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little,
                         [TAG_EXIF_IFD, TAG_GPS_IFD]);

    let takenAt = null;
    if (ifd0[TAG_EXIF_IFD]) {
      const exif = readIfd(view, tiff, ifd0[TAG_EXIF_IFD], little, [TAG_DATETIME_ORIGINAL]);
      takenAt = parseExifDate(exif[TAG_DATETIME_ORIGINAL]);
    }

    let latitude = null, longitude = null;
    if (ifd0[TAG_GPS_IFD]) {
      const gps = readIfd(view, tiff, ifd0[TAG_GPS_IFD], little,
                          [TAG_GPS_LAT_REF, TAG_GPS_LAT, TAG_GPS_LON_REF, TAG_GPS_LON]);
      latitude  = dmsToDecimal(gps[TAG_GPS_LAT], gps[TAG_GPS_LAT_REF]);
      longitude = dmsToDecimal(gps[TAG_GPS_LON], gps[TAG_GPS_LON_REF]);
      // 0/0 liefern manche Kameras, wenn kein Fix vorlag – das ist kein Ort.
      if (latitude === 0 && longitude === 0) { latitude = null; longitude = null; }
    }

    return { latitude, longitude, takenAt };
  } catch {
    return empty;                                    // defekte Datei: still aufgeben
  }
}
