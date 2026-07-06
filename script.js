(function() {
  'use strict';
  // Constants
  const AACHEN_CENTER = [50.7763, 6.0836];
  // For restoring focus after modal
  let lastFocusedElement = null;

  // Initialize map
const map = L.map("map").setView([51.1657, 10.4515], 6);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// Bezugspunkt „Aachener Mitte" – auffälliger, dicker Marker (kein Standard-Pin),
// weil alle Entfernungen zu diesem Punkt berechnet werden.
const centerIcon = L.divIcon({
  className: "center-marker",
  html: '<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21 12.5 41 12.5 41S25 21 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="#e53935" stroke="#fff" stroke-width="1.5"/>'
    + '<circle cx="12.5" cy="12.5" r="4.5" fill="#fff"/></svg>',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -36],
});
const centerMarker = L.marker(AACHEN_CENTER, { icon: centerIcon, zIndexOffset: 1000, title: "Aachener Mitte" }).addTo(map);
const centerPopup = document.createElement("div");
centerPopup.innerHTML = "<strong>📍 Aachener Mitte</strong><br>Bezugspunkt für alle Entfernungen";
const centerZoomBtn = document.createElement("button");
centerZoomBtn.innerHTML = "🔍 Hineinzoomen";
centerZoomBtn.style.cssText = `
  background-color: #4CAF50;
  color: #fff;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 8px;
  width: 100%;
`;
centerZoomBtn.onclick = () => {
  map.setView(AACHEN_CENTER, 16);
  centerMarker.openPopup();
};
centerPopup.appendChild(centerZoomBtn);
centerMarker.bindPopup(centerPopup);

// Get unique authors from 'locations'
const uniqueAuthors = new Set(locations.map((loc) => loc.finder || "Unknown"));
// Insert as <option>
const authorSelect = document.getElementById("authorSelect");
uniqueAuthors.forEach((author) => {
  const option = document.createElement("option");
  option.value = author;
  option.textContent = author;
  authorSelect.appendChild(option);
});

// DOM Elements
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("searchInput");
const modal = document.getElementById("fullscreenModal");
const closeModal = document.getElementById("closeModal");
const modalImage = document.getElementById("modalImage");
const modalVideo = document.getElementById("modalVideo");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const shareStickerBtn = document.getElementById("shareStickerBtn");
const zoomStickerBtn = document.getElementById("zoomStickerBtn");
const commentsJumpBtn = document.getElementById("commentsJumpBtn");
const zoomOverlay = document.getElementById("zoomOverlay");
const zoomImage = document.getElementById("zoomImage");

let mapHidden = false; // Track map visibility
let currentModalLoc = null; // aktuell im Vollbild geöffneter Sticker

if (locations.length != 0) {
  gallery.innerHTML = "";
}

// Galerie-Pagination: Marker rendern wir für ALLE Sticker sofort (damit die
// Karte vollständig ist). Die Galerie rendert pro Seite nur PAGE_SIZE Karten,
// sonst werden bei >100 Stickern zu viele Bild-Requests auf einmal gefeuert.
const GALLERY_PAGE_SIZE = 12;
let galleryFilteredIndices = [];   // Indices aus `locations` nach aktuellem Filter
let galleryPage = 0;

// Create all markers (map zeigt immer ALLE Sticker) – Galerie-Karten werden
// erst in renderGalleryPage() on-demand für die aktuelle Seite erstellt.
locations.forEach((loc, index) => {
  const marker = L.marker(loc.position).addTo(map);
  loc.marker = marker;

  const popupMedia = loc.isVideo
    ? `<video src="${loc.image}" controls muted playsinline preload="metadata"
         style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px;"
         id="popupImg${index}"></video>`
    : `<img src="${loc.image}" alt="${loc.title}"
         style="width: 200px; height: 200px; object-fit: cover;border-radius: 8px; cursor: pointer;"
         id="popupImg${index}">`;
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
  <div style="text-align:center;">
    ${popupMedia}
    <p style="text-align: left; font-size: 1.2em;"><strong>${loc.title
    }</strong></p>
    <p style="text-align: left">${loc.description}</p>
    <p style="text-align: left; font-size: 0.9em; color: #555;">
      Gefunden von <strong>${loc.finder
    }</strong> am <em>${loc.time.toLocaleDateString("de-DE")}</em>
    </p>
  </div>
`;
  const dist = calculateDistance(loc.position, AACHEN_CENTER);
  const distText = `${dist.toFixed(2)} km`;
  popupDiv.innerHTML += `
  <p style="text-align: left; font-size: 0.9em; color: #555;">
    Entfernung zur Aachener Mitte: <strong>${distText}</strong>
  </p>
`;

  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.innerHTML = "🖥️ Vollbild anzeigen";
  fullscreenBtn.style.cssText = `
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 5px;
      width: 100%;
    `;
  fullscreenBtn.onclick = () => openFullscreen(loc);
  popupDiv.appendChild(fullscreenBtn);

  const zoomButton = document.createElement("button");
  zoomButton.innerHTML = "🔍 Hineinzoomen";
  zoomButton.style.cssText = `
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 5px;
      width: 100%;
    `;
  zoomButton.onclick = () => {
    map.setView(loc.position, 17);
    marker.openPopup();
  };
  popupDiv.appendChild(zoomButton);

  const commentsButton = document.createElement("button");
  commentsButton.innerHTML = loc.commentCount > 0
    ? `💬 ${loc.commentCount} Kommentar${loc.commentCount === 1 ? "" : "e"} ansehen`
    : "💬 Kommentare";
  commentsButton.style.cssText = `
      background-color: #4CAF50;
      color: #fff;
      border: none;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 5px;
      width: 100%;
    `;
  commentsButton.onclick = () => openStickerComments(loc);
  popupDiv.appendChild(commentsButton);

  marker.bindPopup(popupDiv, { autoPan: true, maxWidth: 350 });
  marker.on("popupopen", () => {
    if (loc.isVideo) return; // Video spielt inline über seine Controls
    const popupImg = document.getElementById(`popupImg${index}`);
    if (popupImg) popupImg.onclick = () => openFullscreen(loc);
  });
});

// Fliegt auf der Karte zum Sticker UND scrollt die Karte vollständig ins Bild.
// Wichtig auf Mobil: dort liegt die Karte oben, ein Klick weiter unten würde
// sonst nichts sichtbar bewegen.
function focusStickerOnMap(loc) {
  map.setView(loc.position, 17);
  if (loc.marker) loc.marker.openPopup();
  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Öffnet das Vollbild des Stickers und springt zum Kommentarbereich.
// (Wird u. a. vom "Kommentare"-Button im Karten-Popup genutzt.)
function openStickerComments(loc) {
  openFullscreen(loc);
  // Kommentare laden asynchron – kurz warten, dann hinscrollen.
  setTimeout(() => {
    const c = document.getElementById("modalComments");
    if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 200);
}

function buildGalleryCard(index) {
  const loc = locations[index];
  const imageCard = document.createElement("div");
  imageCard.className = "image-card";
  imageCard.dataset.index = index;
  const cardMedia = loc.isVideo
    ? `<video src="${loc.image}#t=0.1" muted playsinline preload="metadata"></video>`
    : `<img src="${loc.image}" alt="${loc.title}" loading="lazy">`;
  imageCard.innerHTML = `
  ${cardMedia}
  <p class="image-title">${loc.title}</p>
  <p class="finder-info">Gefunden von <strong>${loc.finder}</strong> am ${loc.time.toLocaleDateString("de-DE")}</p>
  ${loc.commentCount > 0 ? `<span class="comment-count-badge">💬 ${loc.commentCount}</span>` : ""}
  ${loc.isVideo ? `<span class="video-badge">▶</span>` : ""}
`;
  imageCard.onclick = () => {
    if (mapHidden) {
      openFullscreen(loc);
    } else {
      focusStickerOnMap(loc);
    }
  };
  return imageCard;
}

function renderGalleryPage() {
  gallery.innerHTML = "";
  const pag = document.getElementById("galleryPagination");
  if (pag) pag.innerHTML = "";

  if (galleryFilteredIndices.length === 0) {
    const msg = document.createElement("p");
    msg.className = "no-results";
    msg.textContent = "Keine Treffer gefunden.";
    gallery.appendChild(msg);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(galleryFilteredIndices.length / GALLERY_PAGE_SIZE));
  if (galleryPage >= totalPages) galleryPage = totalPages - 1;
  if (galleryPage < 0) galleryPage = 0;

  const start = galleryPage * GALLERY_PAGE_SIZE;
  const end = Math.min(start + GALLERY_PAGE_SIZE, galleryFilteredIndices.length);
  for (let i = start; i < end; i++) {
    gallery.appendChild(buildGalleryCard(galleryFilteredIndices[i]));
  }

  // Blätter-Leiste ÜBER der Galerie (außerhalb der scrollenden Box), damit man
  // zum Umblättern nicht erst in der Box scrollen muss.
  if (pag && totalPages > 1) {
    const nav = document.createElement("div");
    nav.className = "gallery-pagination";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "← Zurück";
    prev.disabled = galleryPage === 0;
    prev.onclick = () => { galleryPage--; renderGalleryPage(); gallery.scrollTop = 0; };
    const info = document.createElement("span");
    info.className = "gallery-page-info";
    info.textContent = `Seite ${galleryPage + 1} von ${totalPages} (${galleryFilteredIndices.length} Sticker)`;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Weiter →";
    next.disabled = galleryPage >= totalPages - 1;
    next.onclick = () => { galleryPage++; renderGalleryPage(); gallery.scrollTop = 0; };
    nav.appendChild(prev);
    nav.appendChild(info);
    nav.appendChild(next);
    pag.appendChild(nav);
  }
}

// Initial: alle Sticker in die Galerie-Liste, erste Seite rendern.
galleryFilteredIndices = locations.map((_, i) => i);
renderGalleryPage();

// Deep-Link: ?sticker=<id> öffnet direkt den passenden Sticker im Vollbild.
// NICHT auf `window.load` warten: script.js wird von bootstrap.js erst nach dem
// Supabase-Fetch nachgeladen – da ist `load` oft schon gefeuert, der Handler
// liefe dann nie. Die `locations` sind hier bereits vorhanden.
function openDeepLinkSticker() {
  const deepId = new URLSearchParams(location.search).get("sticker");
  if (!deepId) return;
  const loc = locations.find((l) => l.id === deepId);
  if (!loc) return;
  if (!mapHidden) map.setView(loc.position, 15);
  openFullscreen(loc);
}
// setTimeout(0) gibt den deferred Modulen (comments.js/likes.js) noch die Chance,
// ihre sticker:open-Listener zu setzen, bevor das Modal das Event feuert.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(openDeepLinkSticker, 0));
} else {
  setTimeout(openDeepLinkSticker, 0);
}

// Kommentar-Zähler live aktualisieren, wenn im Modal kommentiert/gelöscht wird.
document.addEventListener("comment:changed", (e) => {
  const { id, count } = e.detail || {};
  const loc = locations.find((l) => l.id === id);
  if (!loc) return;
  loc.commentCount = count;
  const idx = locations.indexOf(loc);
  const card = gallery.querySelector(`.image-card[data-index="${idx}"]`);
  if (!card) return;
  let badge = card.querySelector(".comment-count-badge");
  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "comment-count-badge";
      card.appendChild(badge);
    }
    badge.textContent = `💬 ${count}`;
  } else if (badge) {
    badge.remove();
  }
});

// Fügt Entfernung im Modal hinzu (openFullscreen)
function openFullscreen(loc) {
  // Save focus and show modal
  lastFocusedElement = document.activeElement;
  currentModalLoc = loc;
  // Deep-Link setzen, damit die Adresszeile den offenen Sticker zeigt (teilbar).
  if (loc.id) history.replaceState(null, "", location.pathname + "?sticker=" + loc.id);
  modal.style.display = "block";
  if (loc.isVideo) {
    modalImage.hidden = true;
    modalImage.removeAttribute("src");
    if (modalVideo) { modalVideo.hidden = false; modalVideo.src = loc.image; }
  } else {
    if (modalVideo) { modalVideo.pause(); modalVideo.hidden = true; modalVideo.removeAttribute("src"); }
    modalImage.hidden = false;
    modalImage.src = loc.image;
    modalImage.alt = loc.title;
  }
  // "Vergrößern" nur für Bilder (Videos haben eigene Controls).
  if (zoomStickerBtn) zoomStickerBtn.hidden = loc.isVideo;
  modalTitle.textContent = loc.title;
  modalDescription.textContent = loc.description;

  const modalMeta = document.getElementById("modalMeta");
  const dist = calculateDistance(loc.position, AACHEN_CENTER);
  const distText = `${dist.toFixed(2)} km`;

  modalMeta.innerHTML = `Gefunden von <strong>${loc.finder}</strong> am ${new Date(loc.time).toLocaleDateString("de-DE")}<br>
  Entfernung zur Aachener Mitte: <strong>${distText}</strong>`;

  // Kommentare für diesen Sticker laden (assets/js/comments.js hört auf dieses Event).
  document.dispatchEvent(new CustomEvent("sticker:open", { detail: { id: loc.id, title: loc.title } }));

  // Focus close button for accessibility
  closeModal.focus();
}

// Schließen per Button
closeModal.onclick = closeFullscreen;

// Bild-Zoom: Klick aufs Modal-Bild ODER auf den "Vergrößern"-Button öffnet die
// Großansicht, Klick auf die Großansicht schließt sie.
function openZoom() {
  if (!modalImage.getAttribute("src")) return;
  zoomImage.src = modalImage.src;
  zoomOverlay.hidden = false;
}
if (modalImage && zoomOverlay && zoomImage) {
  modalImage.addEventListener("click", openZoom);
  if (zoomStickerBtn) zoomStickerBtn.addEventListener("click", openZoom);
  zoomOverlay.addEventListener("click", () => {
    zoomOverlay.hidden = true;
    zoomImage.removeAttribute("src");
  });
}

// "Kommentare"-Button springt zum Kommentarbereich (macht ihn auffindbar,
// v. a. auf Mobil, wo er unter dem Bild liegt).
if (commentsJumpBtn) {
  commentsJumpBtn.addEventListener("click", () => {
    const c = document.getElementById("modalComments");
    if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Teilen: Link zum aktuell geöffneten Sticker in die Zwischenablage kopieren.
if (shareStickerBtn) {
  shareStickerBtn.addEventListener("click", async () => {
    if (!currentModalLoc?.id) return;
    const url = location.origin + location.pathname + "?sticker=" + currentModalLoc.id;
    try {
      await navigator.clipboard.writeText(url);
      const prev = shareStickerBtn.textContent;
      shareStickerBtn.textContent = "✅ Link kopiert!";
      setTimeout(() => { shareStickerBtn.textContent = prev; }, 1600);
    } catch {
      prompt("Link zum Teilen:", url);
    }
  });
}

function closeFullscreen() {
  modal.style.display = "none";
  if (modalVideo) modalVideo.pause();
  if (zoomOverlay) { zoomOverlay.hidden = true; zoomImage.removeAttribute("src"); }
  currentModalLoc = null;
  document.dispatchEvent(new CustomEvent("sticker:close"));
  // Deep-Link-Parameter wieder aus der Adresszeile entfernen.
  if (location.search) history.replaceState(null, "", location.pathname);
  // Restore focus
  if (lastFocusedElement) lastFocusedElement.focus();
}

// Schließen durch Klick außerhalb
// Close by clicking outside modal
window.onclick = (event) => {
  if (event.target === modal) {
    closeFullscreen();
  }
};
// Close modal with ESC key (Zoom zuerst schließen, falls offen)
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (zoomOverlay && !zoomOverlay.hidden) {
    zoomOverlay.hidden = true;
    zoomImage.removeAttribute("src");
    return;
  }
  if (modal.style.display === 'block') closeFullscreen();
});

// Funktion zur Normalisierung von Text (ä -> ae, ö -> oe, ß -> ss etc.)
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

// Levenshtein-Abstand (Fuzzy-Search) zur Toleranz von kleinen Tippfehlern
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Einfügen
        matrix[i][j - 1] + 1, // Entfernen
        matrix[i - 1][j - 1] + cost // Ersetzen
      );
    }
  }

  return matrix[a.length][b.length];
}

// Funktion zur Erkennung von unscharfen Matches
function fuzzyMatch(input, target) {
  const normalizedInput = normalizeText(input);
  const normalizedTarget = normalizeText(target);

  // Exakte Übereinstimmung
  if (normalizedTarget.includes(normalizedInput)) {
    return true;
  }

  // Fuzzy-Logik (Fehlertoleranz bis zu 2 Zeichen Abweichung)
  return levenshtein(normalizedInput, normalizedTarget) <= 2;
}

function filterGallery() {
  const filterText = searchInput.value.trim();
  const selectedAuthor = authorSelect.value; // "" means all

  galleryFilteredIndices = locations
    .map((loc, i) => {
      const matchesTitle = fuzzyMatch(filterText, loc.title);
      const matchesAuthor = !selectedAuthor || loc.finder === selectedAuthor;
      return matchesTitle && matchesAuthor ? i : -1;
    })
    .filter((i) => i >= 0);

  galleryPage = 0;
  renderGalleryPage();
}

// Suchfunktion
searchInput.addEventListener("input", filterGallery);
authorSelect.addEventListener("change", filterGallery);

// 2) Build the leaderboard from the 'locations' array
const leaderboardData = {};

locations.forEach((loc) => {
  const author = loc.finder || "Unknown";
  leaderboardData[author] = leaderboardData[author]
    ? leaderboardData[author] + 1
    : 1;
});

// Calculate distance between two coordinates (Haversine).
// WICHTIG: bit-identisch zu haversineKm() in sticker-view.js (gleicher Erdradius
// 6371 und gleiche atan2-Formel), damit die auf der Seite angezeigte Entfernung
// exakt dem Wert entspricht, den das km-Quiz prüft.
function calculateDistance(coord1, coord2) {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const R = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 3) Render the leaderboard
function updateLeaderboard() {
  const leaderboardList = document.getElementById("leaderboardList");
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";

  const sorted = Object.entries(leaderboardData)
    .sort((a, b) => b[1] - a[1]);

    let displayRank = 1;
    let previousCount = null;
    
    sorted.forEach(([author, count], index) => {
      if (count !== previousCount && index !== 0) {
        displayRank++;
      }
    
      const li = document.createElement("li");
      const medal =
        displayRank === 1 ? "🥇" :
        displayRank === 2 ? "🥈" :
        displayRank === 3 ? "🥉" : "";
    
      li.innerHTML = `
        <span class="medal">${medal}</span>
        <span class="leaderboard-author">${author}</span>
        <span class="count">${count} Sticker</span>
      `;
    
      li.addEventListener("click", () => {
        authorSelect.value = author;
        filterGallery();
      });
    
      leaderboardList.appendChild(li);
    
      previousCount = count;
    });
    
}


updateLeaderboard();

// 4) Entfernungs-Rangliste (alle Sticker nach Distanz zur Aachener Mitte).
// Wird seitenweise angezeigt, damit die Liste bei vielen Stickern nicht
// endlos lang wird – die Finder-Rangliste bleibt dagegen komplett.
const DISTANCE_PAGE_SIZE = 10;
let distanceSorted = [];
let distancePage = 0;

function updateDistanceLeaderboard() {
  const list = document.getElementById("distanceLeaderboardList");
  if (!list) return;
  // Distanzen einmalig berechnen und absteigend sortieren.
  distanceSorted = locations
    .map((loc) => ({ loc, dist: calculateDistance(loc.position, AACHEN_CENTER) }))
    .sort((a, b) => b.dist - a.dist);
  distancePage = 0;
  renderDistanceLeaderboardPage();
}

function renderDistanceLeaderboardPage() {
  const list = document.getElementById("distanceLeaderboardList");
  if (!list) return;
  list.innerHTML = "";

  // Vorhandene Blätter-Leiste entfernen (wird ggf. neu aufgebaut).
  const oldNav = document.getElementById("distanceLeaderboardNav");
  if (oldNav) oldNav.remove();

  if (distanceSorted.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Noch keine Sticker gefunden.";
    li.style.cursor = "default";
    list.appendChild(li);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(distanceSorted.length / DISTANCE_PAGE_SIZE));
  if (distancePage >= totalPages) distancePage = totalPages - 1;
  if (distancePage < 0) distancePage = 0;

  const start = distancePage * DISTANCE_PAGE_SIZE;
  const end = Math.min(start + DISTANCE_PAGE_SIZE, distanceSorted.length);

  for (let i = start; i < end; i++) {
    const { loc, dist } = distanceSorted[i];
    const rank = i + 1; // globaler Platz über alle Seiten hinweg
    const li = document.createElement("li");
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
    const distText = `${dist.toFixed(2)} km`;
    li.innerHTML = `
      <span class="medal">${medal}</span>
      <span class="leaderboard-author">${loc.title} (von ${loc.finder || "Unknown"})</span>
      <span class="count">${distText}</span>
    `;
    li.addEventListener("click", () => focusStickerOnMap(loc));
    list.appendChild(li);
  }

  // Blätter-Leiste nur zeigen, wenn es mehr als eine Seite gibt.
  if (totalPages > 1) {
    const nav = document.createElement("div");
    nav.id = "distanceLeaderboardNav";
    nav.className = "leaderboard-pagination";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "← Zurück";
    prev.disabled = distancePage === 0;
    prev.onclick = () => { distancePage--; renderDistanceLeaderboardPage(); };
    const info = document.createElement("span");
    info.className = "gallery-page-info";
    info.textContent = `Seite ${distancePage + 1} von ${totalPages} (${distanceSorted.length} Sticker)`;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Weiter →";
    next.disabled = distancePage >= totalPages - 1;
    next.onclick = () => { distancePage++; renderDistanceLeaderboardPage(); };
    nav.appendChild(prev);
    nav.appendChild(info);
    nav.appendChild(next);
    list.parentElement.appendChild(nav);
  }
}

// Initialize distance leaderboard
updateDistanceLeaderboard();

// FALLING STICKERS ANIMATION
let animationActive = localStorage.getItem('animationActive') !== 'false';
let stickerSpawnInterval = null;

// Animation settings
let stickerSpeed = 5; // 1-10, affects fall duration
let stickerFrequency = 5; // 1-10, affects spawn interval
let stickerSize = 50; // 20-80 pixels
let cursorEffectActive = false;

const fallingStickerContainer = document.getElementById('falling-stickers');
const toggleAnimationBtn = document.getElementById('toggleAnimationBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const toggleCursorBtn = document.getElementById('toggleCursorBtn');

// Mobile menu elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const toggleAnimationBtnMobile = document.getElementById('toggleAnimationBtnMobile');
const settingsBtnMobile = document.getElementById('settingsBtnMobile');
const toggleCursorBtnMobile = document.getElementById('toggleCursorBtnMobile');

// Settings sliders
const speedSlider = document.getElementById('speedSlider');
const frequencySlider = document.getElementById('frequencySlider');
const sizeSlider = document.getElementById('sizeSlider');
const speedValue = document.getElementById('speedValue');
const frequencyValue = document.getElementById('frequencyValue');
const sizeValue = document.getElementById('sizeValue');

// Settings Panel Functions
function openSettingsPanel() {
  settingsPanel.classList.remove('hidden');
}

function closeSettingsPanel() {
  settingsPanel.classList.add('hidden');
}

// Settings panel event listeners
settingsBtn.addEventListener('click', openSettingsPanel);
document.querySelector('.settings-close').addEventListener('click', closeSettingsPanel);
settingsPanel.addEventListener('click', (e) => {
  if (e.target === settingsPanel) closeSettingsPanel();
});

// Slider event listeners
speedSlider.addEventListener('input', (e) => {
  stickerSpeed = parseInt(e.target.value);
  speedValue.textContent = stickerSpeed;
  localStorage.setItem('stickerSpeed', stickerSpeed);
});

frequencySlider.addEventListener('input', (e) => {
  stickerFrequency = parseInt(e.target.value);
  frequencyValue.textContent = stickerFrequency;
  localStorage.setItem('stickerFrequency', stickerFrequency);
  // Restart spawn interval if animation is active
  if (animationActive && stickerSpawnInterval !== null) {
    stopStickerAnimation();
    startStickerAnimation();
  }
});

sizeSlider.addEventListener('input', (e) => {
  stickerSize = parseInt(e.target.value);
  sizeValue.textContent = stickerSize + 'px';
  localStorage.setItem('stickerSize', stickerSize);
});

// Load saved settings
function loadSettings() {
  stickerSpeed = parseInt(localStorage.getItem('stickerSpeed')) || 5;
  stickerFrequency = parseInt(localStorage.getItem('stickerFrequency')) || 20;
  stickerSize = parseInt(localStorage.getItem('stickerSize')) || 50;

  speedSlider.value = stickerSpeed;
  frequencySlider.value = stickerFrequency;
  sizeSlider.value = stickerSize;
  speedValue.textContent = stickerSpeed;
  frequencyValue.textContent = stickerFrequency;
  sizeValue.textContent = stickerSize + 'px';
}

// Update button state based on animationActive
function updateToggleButtonState() {
  if (animationActive) {
    toggleAnimationBtn.textContent = '🎉 Animation an';
    toggleAnimationBtn.classList.remove('inactive');
  } else {
    toggleAnimationBtn.textContent = '🎉 Animation aus';
    toggleAnimationBtn.classList.add('inactive');
  }
}

updateToggleButtonState();

// Spawn a falling sticker
function spawnFallingSticker() {
  const sticker = document.createElement('div');
  sticker.className = 'falling-sticker';

  // Random horizontal position (0% to 100%)
  const randomX = Math.random() * 100;
  sticker.style.left = randomX + '%';
  sticker.style.top = '-100px';

  // Use configured size with slight random variation
  const sizeVariation = stickerSize * 0.8 + Math.random() * (stickerSize * 0.4);
  sticker.style.width = sizeVariation + 'px';
  sticker.style.height = sizeVariation + 'px';

  // Set background image
  sticker.style.backgroundImage = "url('img/valentinSticker.webp')";

  // Calculate fall duration based on speed setting (1=fast, 10=slow)
  const baseSpeed = 3 + (10 - stickerSpeed) * 0.7;
  const fallDuration = baseSpeed + Math.random() * 2;

  // Apply animation
  sticker.style.animation = `fall ${fallDuration}s linear forwards`;

  fallingStickerContainer.appendChild(sticker);

  // Remove element after animation completes
  setTimeout(() => {
    sticker.remove();
  }, fallDuration * 1000);
}

// Start spawning stickers
function startStickerAnimation() {
  if (stickerSpawnInterval === null) {
    stickerSpawnInterval = setInterval(() => {
      if (animationActive) {
        spawnFallingSticker();
      }
    }, (99 - stickerFrequency) * 10); // Base interval adjusted by frequency
  }
}

// Stop spawning stickers
function stopStickerAnimation() {
  if (stickerSpawnInterval !== null) {
    clearInterval(stickerSpawnInterval);
    stickerSpawnInterval = null;
  }
  // Clear existing stickers
  fallingStickerContainer.innerHTML = '';
}


// CURSOR EFFECT - Valentinsticker Cursor Trail
let cursorListener = null;

function createStickerCursor() {
  if (!cursorEffectActive) return;

  if (cursorListener) return; // Prevent duplicate listeners

  cursorListener = (e) => {
    const sticker = document.createElement('img');
    sticker.src = 'img/valentinSticker.webp';
    sticker.style.position = 'fixed';
    sticker.style.left = (e.clientX - 20) + 'px';
    sticker.style.top = (e.clientY - 20) + 'px';
    sticker.style.pointerEvents = 'none';
    sticker.style.zIndex = '9999';
    sticker.style.width = '40px';
    sticker.style.height = '40px';
    sticker.style.animation = 'stickerTrailFade 0.6s ease-out forwards';
    sticker.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(sticker);

    setTimeout(() => sticker.remove(), 600);
  };

  document.addEventListener('mousemove', cursorListener);
}

function removeStickerCursor() {
  if (cursorListener) {
    document.removeEventListener('mousemove', cursorListener);
    cursorListener = null;
  }
}

// Toggle cursor effect
toggleCursorBtn.addEventListener('click', () => {
  cursorEffectActive = !cursorEffectActive;
  localStorage.setItem('cursorEffectActive', cursorEffectActive);

  if (cursorEffectActive) {
    toggleCursorBtn.style.opacity = '1';
    createStickerCursor();
  } else {
    toggleCursorBtn.style.opacity = '0.7';
    removeStickerCursor();
  }
});

// Add CSS for sticker trail fade animation
const style = document.createElement('style');
style.textContent = `
  @keyframes stickerTrailFade {
    0% {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    100% {
      opacity: 0;
      transform: rotate(360deg) scale(0.5);
    }
  }
`;
document.head.appendChild(style);

// Load cursor effect state
const savedCursorEffect = localStorage.getItem('cursorEffectActive') === 'true';
if (savedCursorEffect) {
  cursorEffectActive = true;
  toggleCursorBtn.style.opacity = '1';
  createStickerCursor();
} else {
  toggleCursorBtn.style.opacity = '0.7';
}

// KONTINENTE LEADERBOARD
function updateContinentsLeaderboard() {
  const continentMap = {
    'Europa': { minLat: 35, maxLat: 71, minLon: -10, maxLon: 40 },
    'Asien': { minLat: -10, maxLat: 80, minLon: 40, maxLon: 150 },
    'Afrika': { minLat: -35, maxLat: 37, minLon: -20, maxLon: 55 },
    'Nordamerika': { minLat: 15, maxLat: 80, minLon: -170, maxLon: -50 },
    'Südamerika': { minLat: -56, maxLat: 13, minLon: -85, maxLon: -30 },
    'Australien': { minLat: -47, maxLat: -10, minLon: 113, maxLon: 154 }
  };

  const continentFindings = {};

  locations.forEach((loc) => {
    const [lat, lon] = loc.position;
    for (const [continent, bounds] of Object.entries(continentMap)) {
      if (lat >= bounds.minLat && lat <= bounds.maxLat &&
          lon >= bounds.minLon && lon <= bounds.maxLon) {
        if (!continentFindings[continent]) {
          continentFindings[continent] = [];
        }
        continentFindings[continent].push(loc);
        break;
      }
    }
  });

  const continentList = document.getElementById('continentsLeaderboardList');
  if (!continentList) return;
  continentList.innerHTML = '';

  // Get sorted continents
  const sortedContinents = Object.entries(continentFindings)
    .sort((a, b) => b[1].length - a[1].length);

  if (sortedContinents.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Noch keine Sticker gefunden';
    continentList.appendChild(li);
    return;
  }

  sortedContinents.forEach((item, index) => {
    const [continent, findings] = item;
    const firstFinder = findings[0].finder;
    const count = findings.length;
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🌍';

    const li = document.createElement('li');
    li.innerHTML = `
      <span class="medal">${medal}</span>
      <span class="leaderboard-author">${continent} (${count} Sticker)</span>
      <span class="count">Zuerst: ${firstFinder}</span>
    `;
    continentList.appendChild(li);
  });
}

updateContinentsLeaderboard();

// Toggle animation
toggleAnimationBtn.addEventListener('click', () => {
  animationActive = !animationActive;
  localStorage.setItem('animationActive', animationActive);
  updateToggleButtonState();

  if (animationActive) {
    startStickerAnimation();
  } else {
    stopStickerAnimation();
  }
});

// Initialize animations if enabled
loadSettings();
if (animationActive) {
  startStickerAnimation();
}

// HAMBURGER MENU FUNCTIONALITY
if (hamburgerBtn && mobileMenu) {

  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = mobileMenu.classList.contains('hidden');

    if (isHidden) {
      mobileMenu.classList.remove('hidden');
      mobileMenu.classList.add('visible');
    } else {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('visible');
    }

  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.banner') && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('visible');
    }
  });
} else {
  console.warn('Hamburger menu elements not found');
}

// Mobile button event listeners - sync with desktop buttons
if (toggleAnimationBtnMobile && toggleAnimationBtn) {
  toggleAnimationBtnMobile.addEventListener('click', () => {
    toggleAnimationBtn.click();
    closeMobileMenu();
  });
}

if (settingsBtnMobile && settingsBtn) {
  settingsBtnMobile.addEventListener('click', () => {
    settingsBtn.click();
    closeMobileMenu();
  });
}

if (toggleCursorBtnMobile && toggleCursorBtn) {
  toggleCursorBtnMobile.addEventListener('click', () => {
    toggleCursorBtn.click();
    closeMobileMenu();
  });
}

// Update mobile button text when desktop buttons change
function updateMobileButtonText() {
  toggleAnimationBtnMobile.textContent = toggleAnimationBtn.textContent;
}

// Helper function to close mobile menu
function closeMobileMenu() {
  if (mobileMenu) {
    mobileMenu.classList.add('hidden');
    mobileMenu.classList.remove('visible');
  }
}

// Update mobile buttons initially and when they change
if (toggleAnimationBtn && toggleAnimationBtnMobile) {
  updateMobileButtonText();
  const observer = new MutationObserver(updateMobileButtonText);
  observer.observe(toggleAnimationBtn, { childList: true, characterData: true, subtree: true });
}

// ============ 3D PUNCHING BAG ============
{
  const bagCanvas = null; // moved to sticker-quiz.html
  if (bagCanvas) {
    const ctx = bagCanvas.getContext('2d');
    const punchCountEl = document.getElementById('punchCount');
    const dpr = window.devicePixelRatio || 1;
    let cssW = 0, cssH = 0;

    function setupCanvas() {
      const rect = bagCanvas.getBoundingClientRect();
      cssW = rect.width || 400;
      cssH = rect.height || 400;
      bagCanvas.width = cssW * dpr;
      bagCanvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // Sticker image
    const stickerImg = new Image();
    stickerImg.src = 'img/valentinSticker.webp';

    // ============ MATH HELPERS ============
    const v3 = (x, y, z) => ({ x, y, z });
    const vsub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
    const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const vcross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    const vnorm = v => { const l = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1; return v3(v.x/l, v.y/l, v.z/l); };
    const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x*c + v.z*s, v.y, -v.x*s + v.z*c); };
    const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x*c - v.y*s, v.x*s + v.y*c, v.z); };
    const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return v3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); };

    // Perspective projection
    const FOV   = 4.5;
    const SCALE = 155;
    const VOFF  = -60; // vertical offset in CSS pixels (bag hangs from above center)

    function project(v) {
      const z = v.z + FOV;
      const s = FOV / Math.max(0.01, z);
      return { x: cssW / 2 + v.x * s * SCALE, y: cssH / 2 + VOFF - v.y * s * SCALE, z: v.z, s };
    }

    // ============ BAG GEOMETRY ============
    // Realistic tapered heavy-bag profile (built once, transformed per frame)
    const SEGS   = 24;
    const STACKS = 10;
    const BAG_H  = 2.0;
    const ROPE_L = 0.55;

    function bagRadius(t) {
      // t: 0=top, 1=bottom — widest around t=0.45
      if (t < 0.15) return 0.30 + (t / 0.15) * 0.22;
      if (t < 0.45) return 0.52 + ((t - 0.15) / 0.30) * 0.08;
      if (t < 0.75) return 0.60 - ((t - 0.45) / 0.30) * 0.12;
      return 0.48 - ((t - 0.75) / 0.25) * 0.18;
    }

    const bagVerts = [];
    for (let st = 0; st <= STACKS; st++) {
      const t = st / STACKS;
      const y = -t * BAG_H;
      const r = bagRadius(t);
      for (let sg = 0; sg < SEGS; sg++) {
        const a = (sg / SEGS) * Math.PI * 2;
        bagVerts.push([r * Math.cos(a), y, r * Math.sin(a)]);
      }
    }
    const BOT_CAP_IDX = bagVerts.length;
    bagVerts.push([0, -BAG_H, 0]);
    const TOP_CAP_IDX = bagVerts.length;
    bagVerts.push([0, 0, 0]);

    const bagFaces = [];
    for (let st = 0; st < STACKS; st++) {
      for (let sg = 0; sg < SEGS; sg++) {
        const i0 = st * SEGS + sg;
        const i1 = st * SEGS + (sg + 1) % SEGS;
        const i2 = (st + 1) * SEGS + (sg + 1) % SEGS;
        const i3 = (st + 1) * SEGS + sg;
        bagFaces.push({ vi: [i0, i1, i2, i3], t: (st + 0.5) / STACKS, sg, cap: false });
      }
    }
    for (let sg = 0; sg < SEGS; sg++) {
      bagFaces.push({ vi: [STACKS * SEGS + sg, BOT_CAP_IDX, STACKS * SEGS + (sg + 1) % SEGS], t: 1, sg, cap: true, bot: true });
      bagFaces.push({ vi: [sg, (sg + 1) % SEGS, TOP_CAP_IDX], t: 0, sg, cap: true, bot: false });
    }

    // ============ PHYSICS STATE ============
    const ph = {
      swX: 0, swZ: 0,
      vX: 0,  vZ: 0,
      spinY: 0, vSpinY: 0,
      squish: 0, vSquish: 0,
    };
    const DAMPING  = 0.965;
    const GRAVITY  = 0.022;
    const SPIN_DMP = 0.982;

    let punchCount = 0;
    let particles  = [];
    let hitFlash   = 0;

    const LIGHT = vnorm(v3(-0.6, 1.2, -1.0));

    // How many sticker tiles around the bag
    const TILES = 4;
    const SEGS_PER_TILE = SEGS / TILES; // must be integer (24/4=6 ✓)

    // Affine texture-map a triangle onto the canvas.
    // Maps image coords (u*iw, v*ih) → screen coords (x, y).
    function drawTriTex(img, iw, ih,
        x0, y0, u0, v0,
        x1, y1, u1, v1,
        x2, y2, u2, v2) {
      const sx0 = u0 * iw, sy0 = v0 * ih;
      const sx1 = u1 * iw, sy1 = v1 * ih;
      const sx2 = u2 * iw, sy2 = v2 * ih;
      const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
      if (Math.abs(denom) < 0.5) return;
      const a  = (x0*(sy1-sy2) + x1*(sy2-sy0) + x2*(sy0-sy1)) / denom;
      const b  = (y0*(sy1-sy2) + y1*(sy2-sy0) + y2*(sy0-sy1)) / denom;
      const c  = (sx0*(x1-x2)  + sx1*(x2-x0)  + sx2*(x0-x1))  / denom;
      const dd = (sx0*(y1-y2)  + sx1*(y2-y0)  + sx2*(y0-y1))  / denom;
      const e  = (sx0*(sy1*x2-sy2*x1) + sx1*(sy2*x0-sy0*x2) + sx2*(sy0*x1-sy1*x0)) / denom;
      const f  = (sx0*(sy1*y2-sy2*y1) + sx1*(sy2*y0-sy0*y2) + sx2*(sy0*y1-sy1*y0)) / denom;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, dd, e, f);
      ctx.drawImage(img, 0, 0, iw, ih);
      ctx.restore();
    }

    // ============ TRANSFORM ============
    function transformVert(bv) {
      let [x, y, z] = bv;
      // Impact squish: compress vertically, bulge outward at hit point
      const squishBulge = 1 + ph.squish * 0.18 * Math.sin((-y / BAG_H) * Math.PI);
      x *= squishBulge;
      z *= squishBulge;
      y *= (1 - ph.squish * 0.06);

      let p = v3(x, y, z);
      p = rotY(p, ph.spinY);
      // Pendulum: translate to pivot, rotate, translate back
      p.y += ROPE_L;
      p = rotZ(p, ph.swX);
      p = rotX(p, ph.swZ);
      p.y -= ROPE_L;
      return p;
    }

    // ============ RENDER ============
    function render() {
      ctx.clearRect(0, 0, cssW, cssH);

      // Dark gym background
      const bg = ctx.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, '#1e1e2a');
      bg.addColorStop(1, '#12121a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      // Red floor glow below bag
      const bagBotPx = project(transformVert([0, -BAG_H, 0]));
      const glow = ctx.createRadialGradient(bagBotPx.x, bagBotPx.y + 20, 0, bagBotPx.x, bagBotPx.y + 20, 90);
      glow.addColorStop(0, 'rgba(200,0,0,0.18)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, cssW, cssH);

      // Transform all vertices
      const tw = bagVerts.map(bv => transformVert(bv));
      const pw = tw.map(v => project(v));

      // Build face draw list with depth + lighting
      const drawList = [];
      for (const face of bagFaces) {
        const tvs = face.vi.map(i => tw[i]);
        const pvs = face.vi.map(i => pw[i]);
        const avgZ = tvs.reduce((s, v) => s + v.z, 0) / tvs.length;

        // Face normal
        let normal;
        if (face.cap) {
          normal = v3(0, face.bot ? -1 : 1, 0);
        } else {
          const e1 = vsub(tvs[1], tvs[0]);
          const e2 = vsub(tvs[3], tvs[0]);
          normal = vnorm(vcross(e1, e2));
        }

        // Backface cull
        const toCam = vnorm(v3(-tvs[0].x, -tvs[0].y, FOV - tvs[0].z));
        if (vdot(normal, toCam) < 0) continue;

        // Diffuse + ambient lighting
        const diffuse = Math.max(0, vdot(normal, LIGHT));
        const rimDot  = 1 - Math.abs(vdot(normal, toCam));
        const brightness = Math.min(1, 0.22 + diffuse * 0.78 + rimDot * rimDot * 0.12);

        drawList.push({ face, pvs, avgZ, brightness });
      }

      drawList.sort((a, b) => a.avgZ - b.avgZ);

      const iw = stickerImg.complete && stickerImg.naturalWidth > 0 ? stickerImg.naturalWidth  : 0;
      const ih = stickerImg.complete && stickerImg.naturalWidth > 0 ? stickerImg.naturalHeight : 0;

      for (const { face, pvs, brightness } of drawList) {
        let ok = true;
        for (const p of pvs) { if (!isFinite(p.x) || !isFinite(p.y)) { ok = false; break; } }
        if (!ok) continue;

        if (face.cap) {
          // Metal caps — plain grey
          ctx.beginPath();
          ctx.moveTo(pvs[0].x, pvs[0].y);
          for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
          ctx.closePath();
          const g = Math.floor(80 * brightness);
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          ctx.fill();
        } else {
          // Side face: texture-map the sticker image as skin, tiled TILES times around
          // UV: u tiles every SEGS_PER_TILE segments, v spans full height
          const uL = (face.sg % SEGS_PER_TILE) / SEGS_PER_TILE;
          const uR = ((face.sg % SEGS_PER_TILE) + 1) / SEGS_PER_TILE;
          const vT = (Math.floor(face.t * STACKS) / STACKS);
          const vB = (Math.floor(face.t * STACKS) + 1) / STACKS;

          // Quad corners: [i0=TL, i1=TR, i2=BR, i3=BL]
          const [p0, p1, p2, p3] = pvs;

          if (iw > 0) {
            // Triangle 1: TL, TR, BR
            drawTriTex(stickerImg, iw, ih,
              p0.x, p0.y, uL, vT,
              p1.x, p1.y, uR, vT,
              p2.x, p2.y, uR, vB);
            // Triangle 2: TL, BR, BL
            drawTriTex(stickerImg, iw, ih,
              p0.x, p0.y, uL, vT,
              p2.x, p2.y, uR, vB,
              p3.x, p3.y, uL, vB);
          } else {
            // Fallback: plain red if image not loaded yet
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
            ctx.closePath();
            ctx.fillStyle = `rgb(${Math.floor(185*brightness)},0,0)`;
            ctx.fill();
          }

          // Lighting overlay: dark = shadowed, transparent = lit
          ctx.beginPath();
          ctx.moveTo(pvs[0].x, pvs[0].y);
          for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
          ctx.closePath();
          const shadow = Math.max(0, 1 - brightness) * 0.72;
          ctx.fillStyle = `rgba(0,0,0,${shadow.toFixed(3)})`;
          ctx.fill();

          // Hit flash
          const facingFront = face.sg / SEGS < 0.15 || face.sg / SEGS > 0.85;
          if (facingFront && hitFlash > 0) {
            ctx.beginPath();
            ctx.moveTo(pvs[0].x, pvs[0].y);
            for (let i = 1; i < pvs.length; i++) ctx.lineTo(pvs[i].x, pvs[i].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(255,80,0,${(hitFlash * 0.35).toFixed(3)})`;
            ctx.fill();
          }
        }
      }

      // Rope from ceiling to bag top
      const mountPx  = { x: cssW / 2, y: cssH / 2 + VOFF - SCALE * ROPE_L };
      const bagTopPx = project(transformVert([0, 0, 0]));
      ctx.save();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mountPx.x, mountPx.y);
      ctx.lineTo(bagTopPx.x, bagTopPx.y);
      ctx.stroke();
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(mountPx.x, mountPx.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Particles
      particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life--;
        if (p.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.font = `bold ${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.restore();
        return true;
      });

      hitFlash = Math.max(0, hitFlash - 0.06);
    }

    // ============ PHYSICS UPDATE ============
    function updatePhysics() {
      ph.vX += -Math.sin(ph.swX) * GRAVITY;
      ph.vZ += -Math.sin(ph.swZ) * GRAVITY;
      ph.vX *= DAMPING;
      ph.vZ *= DAMPING;
      ph.vSpinY *= SPIN_DMP;
      ph.swX  = Math.max(-0.85, Math.min(0.85, ph.swX + ph.vX));
      ph.swZ  = Math.max(-0.85, Math.min(0.85, ph.swZ + ph.vZ));
      ph.spinY += ph.vSpinY;
      // Squish spring
      ph.vSquish += -ph.squish * 0.38;
      ph.vSquish *= 0.68;
      ph.squish = Math.max(0, ph.squish + ph.vSquish);
    }

    // ============ PUNCH ============
    function tryPunch(cx, cy) {
      const bagCW = transformVert([0, -BAG_H * 0.5, 0]);
      const bagCP = project(bagCW);
      const dx = cx - bagCP.x, dy = cy - bagCP.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitR = SCALE * bagRadius(0.45) * (FOV / (bagCW.z + FOV)) * 1.4;
      if (dist > hitR) return;

      const force = Math.max(0.25, 1.6 - dist / hitR) * 0.20;
      ph.vX     += (dx / 130) * force;
      ph.vZ     += (dy / 130) * force;
      ph.vSpinY += (dx / 130) * force * 0.28;
      ph.vSquish = 0.7;
      hitFlash   = 1.0;

      punchCount++;
      if (punchCountEl) punchCountEl.textContent = punchCount;

      const emojis = ['💥', '⚡', '✨', '💫', '🔥', '💪', '👊', '🌟'];
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 5;
        particles.push({
          x: cx + (Math.random() - 0.5) * 16,
          y: cy + (Math.random() - 0.5) * 16,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 2,
          life: 55 + Math.random() * 45,
          maxLife: 100,
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          size: 16 + Math.floor(Math.random() * 14),
        });
      }
    }

    bagCanvas.addEventListener('click', e => {
      const r = bagCanvas.getBoundingClientRect();
      tryPunch(e.clientX - r.left, e.clientY - r.top);
    });
    bagCanvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const r = bagCanvas.getBoundingClientRect();
      for (const t of e.changedTouches) tryPunch(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });

    // ============ LOOP ============
    (function loop() {
      updatePhysics();
      render();
      requestAnimationFrame(loop);
    })();
  }
}

// End of module wrapper
})();
