(function() {
  'use strict';
  // Constants
  const AACHEN_CENTER = [50.7763, 6.0836];
  // For restoring focus after modal
  let lastFocusedElement = null;

  // Initialize map
const map = L.map("map").setView([51.1657, 10.4515], 6);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

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
const toggleViewBtn = document.getElementById("toggleViewBtn");
const modal = document.getElementById("fullscreenModal");
const closeModal = document.getElementById("closeModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");

let mapHidden = false; // Track map visibility

if (locations.length != 0) {
  gallery.innerHTML = "";
}
// Create markers + gallery
locations.forEach((loc, index) => {
  // --- Leaflet Marker ---
  const marker = L.marker(loc.position).addTo(map);
  // Store marker on location for distance leaderboard navigation
  loc.marker = marker;

  // --- Popup content ---
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
  <div style="text-align:center;">
    <img src="${loc.image}" alt="${loc.title}"
         style="width: 200px; height: 200px; object-fit: cover;border-radius: 8px; cursor: pointer;"
         id="popupImg${index}">
    <p style="text-align: left; font-size: 1.2em;"><strong>${loc.title
    }</strong></p>
    <p style="text-align: left">${loc.description}</p>
    <p style="text-align: left; font-size: 0.9em; color: #555;">
      Gefunden von <strong>${loc.finder
    }</strong> am <em>${loc.time.toLocaleDateString("de-DE")}</em>
    </p>
  </div>
`;
// Fügt Entfernung im Popup hinzu (in popupDiv)
const dist = calculateDistance(loc.position, AACHEN_CENTER);
const distText = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`;

popupDiv.innerHTML += `
  <p style="text-align: left; font-size: 0.9em; color: #555;">
    Entfernung zur Aachener Mitte: <strong>${distText}</strong>
  </p>
`;

  // Fullscreen Button for Popup
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

  // Zoom Button
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

  // Marker Popup
  marker.bindPopup(popupDiv, {
    autoPan: true,
    maxWidth: 350,
  });

  // Make popup image clickable to open fullscreen
  marker.on("popupopen", () => {
    const popupImg = document.getElementById(`popupImg${index}`);
    if (popupImg) {
      popupImg.onclick = () => openFullscreen(loc);
    }
  });

  // --- Gallery Card ---
  const imageCard = document.createElement("div");
  imageCard.className = "image-card";
  // Tag card with index for robust filtering
  imageCard.dataset.index = index;
  imageCard.innerHTML = `
  <img src="${loc.image}" alt="${loc.title}">
  <p class="image-title">${loc.title}</p>
  <p class="finder-info">Gefunden von <strong>${loc.finder
    }</strong> am ${loc.time.toLocaleDateString("de-DE")}</p>
`;

  // Clicking a gallery card
  imageCard.onclick = () => {
    if (mapHidden) {
      openFullscreen(loc);
    } else {
      map.setView(loc.position, 17);
      marker.openPopup();
    }
  };

  gallery.appendChild(imageCard);
});

// Fügt Entfernung im Modal hinzu (openFullscreen)
function openFullscreen(loc) {
  // Save focus and show modal
  lastFocusedElement = document.activeElement;
  modal.style.display = "block";
  modalImage.src = loc.image;
  modalImage.alt = loc.title;
  modalTitle.textContent = loc.title;
  modalDescription.textContent = loc.description;

  const modalMeta = document.getElementById("modalMeta");
  const dist = calculateDistance(loc.position, AACHEN_CENTER);
  const distText = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`;

  modalMeta.innerHTML = `Gefunden von <strong>${loc.finder}</strong> am ${new Date(loc.time).toLocaleDateString("de-DE")}<br>
  Entfernung zur Aachener Mitte: <strong>${distText}</strong>`;
  // Focus close button for accessibility
  closeModal.focus();
}

// Schließen per Button
closeModal.onclick = closeFullscreen;

function closeFullscreen() {
  modal.style.display = "none";
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
// Close modal with ESC key
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.style.display === 'block') {
    closeFullscreen();
  }
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

  const cards = gallery.querySelectorAll(".image-card");
  let anyVisible = false;

  cards.forEach((card) => {
    const idx = card.dataset.index;
    const loc = locations[idx];
    const matchesTitle = fuzzyMatch(filterText, loc.title);
    const matchesAuthor = !selectedAuthor || loc.finder === selectedAuthor;
    const show = matchesTitle && matchesAuthor;
    card.style.display = show ? "flex" : "none";
    if (show) anyVisible = true;
  });

  // Handle no-results message
  const existing = gallery.querySelector(".no-results");
  if (!anyVisible) {
    if (!existing) {
      const msg = document.createElement("p");
      msg.className = "no-results";
      msg.textContent = "Keine Treffer gefunden.";
      gallery.appendChild(msg);
    }
  } else if (existing) {
    existing.remove();
  }
}

// Suchfunktion
searchInput.addEventListener("input", filterGallery);
authorSelect.addEventListener("change", filterGallery);

// Ansicht umschalten: Galerie anzeigen / Karte anzeigen
toggleViewBtn.addEventListener("click", () => {
  mapHidden = !mapHidden;
  if (mapHidden) {
    document.body.classList.add("hide-map");
    toggleViewBtn.textContent = "🗺️ Karte anzeigen";
  } else {
    document.body.classList.remove("hide-map");
    toggleViewBtn.textContent = "📷 Nur Galerie anzeigen";
    // Ensure map tiles render correctly after showing map
    map.invalidateSize();
  }
});

// 2) Build the leaderboard from the 'locations' array
const leaderboardData = {};

locations.forEach((loc) => {
  const author = loc.finder || "Unknown";
  leaderboardData[author] = leaderboardData[author]
    ? leaderboardData[author] + 1
    : 1;
});

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(coord1, coord2) {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const R = 6371.071;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const lat1Rad = lat1 * rad;
  const lat2Rad = lat2 * rad;

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
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

// 4) Build the distance leaderboard for top 3 furthest stickers
function updateDistanceLeaderboard() {
  const list = document.getElementById("distanceLeaderboardList");
  if (!list) return;
  list.innerHTML = "";

  // Compute distances for each location relative to Aachen center
  const distArray = locations.map((loc) => ({ loc, dist: calculateDistance(loc.position, AACHEN_CENTER) }));
  // Sort descending by distance
  distArray.sort((a, b) => b.dist - a.dist);
  // Take top 3
  const top3 = distArray.slice(0, 3);

  top3.forEach((item, index) => {
    const { loc, dist } = item;
    const li = document.createElement("li");
    // Medal icon for rank
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
    // Format distance text
    const distText = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`;
    // Build list item: medal, sticker title and author, distance
    li.innerHTML = `
      <span class="medal">${medal}</span>
      <span class="leaderboard-author">${loc.title} (von ${loc.finder || "Unknown"})</span>
      <span class="count">${distText}</span>
    `;
    // Navigate map to sticker on click
    li.addEventListener("click", () => {
      map.setView(loc.position, 17);
      if (loc.marker) loc.marker.openPopup();
    });
    list.appendChild(li);
  });
}

// Initialize distance leaderboard
updateDistanceLeaderboard();

// End of module wrapper
})();
