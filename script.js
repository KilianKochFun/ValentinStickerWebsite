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
  const top3 = distArray;

  top3.forEach((item, index) => {
    const { loc, dist } = item;
    const li = document.createElement("li");
    // Medal icon for rank
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎗";
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

// End of module wrapper
})();
