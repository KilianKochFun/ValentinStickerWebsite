// Länder-Helfer: Flagge, deutscher Name, Kontinent — alles ohne externe Daten.
//
// Die Anzeige kostet null zusätzliche Bytes: Flaggen sind Emoji (aus dem
// ISO-Code gerechnet), Ländernamen liefert `Intl.DisplayNames` aus dem Browser.
// Gespeichert wird pro Sticker nur der ISO-3166-1-Alpha-2-Code (`country_code`).
//
// Wird sowohl als ES-Modul importiert (upload.js, profile.html) als auch über
// `window.VS_COUNTRIES` vom klassischen script.js genutzt.

// ISO-Code -> Kontinent, abgeleitet aus der UN-M49-Gliederung (249 Länder).
// Karibik und Mittelamerika zählen hier zu Nordamerika.
//
// ACHTUNG: Ländercodes und Kontinentcodes überschneiden sich — "NA" ist als
// Ländercode Namibia (Kontinent AF), als Kontinentcode Nordamerika. Beide
// Tabellen deshalb nie vermischen.
const CONTINENT_CODES = {
  EU:
        "AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR " +
        "HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO " +
        "RS RU SE SI SJ SK SM UA VA",
  AS:
        "AE AF AM AZ BD BH BN BT CN CY GE HK ID IL IN IQ IR JO JP KG KH " +
        "KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY " +
        "TH TJ TL TM TR TW UZ VN YE",
  AF:
        "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN " +
        "GQ GW IO KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC " +
        "SD SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW",
  NA:
        "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT " +
        "JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
  SA:
        "AR BO BR BV CL CO EC FK GF GS GY PE PY SR UY VE",
  OC:
        "AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW " +
        "SB TK TO TV UM VU WF WS",
  AN:
        "AQ",
};

// Flach gezogen: { DE: "EU", JP: "AS", … }
export const CONTINENT_BY_COUNTRY = Object.fromEntries(
  Object.entries(CONTINENT_CODES).flatMap(([continent, codes]) =>
    codes.split(" ").map((cc) => [cc, continent])
  )
);

export const CONTINENT_NAMES = {
  EU: "Europa", AS: "Asien", AF: "Afrika", NA: "Nordamerika",
  SA: "Südamerika", OC: "Ozeanien", AN: "Antarktis",
};

// "de" -> 🇩🇪. Regional Indicator Symbols liegen 127397 über A–Z.
export function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return "🏳️";
  return cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

// Deutscher Ländername aus dem Browser. Fällt auf den Code zurück, falls die
// Intl-Daten fehlen (alte Browser) oder der Code unbekannt ist.
let regionNames = null;
export function countryName(cc) {
  if (!cc) return "Unbekannt";
  const up = cc.toUpperCase();
  try {
    if (!regionNames) regionNames = new Intl.DisplayNames(["de"], { type: "region" });
    return regionNames.of(up) || up;
  } catch {
    return up;
  }
}

export function continentOf(cc) {
  return cc ? CONTINENT_BY_COUNTRY[cc.toUpperCase()] ?? null : null;
}

// "🇩🇪 Deutschland"
export function countryLabel(cc) {
  return `${flagEmoji(cc)} ${countryName(cc)}`;
}

// Für script.js, das als klassisches Script läuft und nicht importieren kann.
if (typeof window !== "undefined") {
  window.VS_COUNTRIES = {
    CONTINENT_BY_COUNTRY, CONTINENT_NAMES,
    flagEmoji, countryName, continentOf, countryLabel,
  };
}
