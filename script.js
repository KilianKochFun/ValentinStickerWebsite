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

// Mobile menu elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const toggleAnimationBtnMobile = document.getElementById('toggleAnimationBtnMobile');
const settingsBtnMobile = document.getElementById('settingsBtnMobile');
const toggleCursorBtnMobile = document.getElementById('toggleCursorBtnMobile');
const toggleViewBtnMobile = document.getElementById('toggleViewBtnMobile');

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
  console.log('Hamburger menu initialized');

  hamburgerBtn.addEventListener('click', (e) => {
    console.log('Hamburger clicked');
    e.stopPropagation();
    const isHidden = mobileMenu.classList.contains('hidden');
    console.log('Menu is hidden:', isHidden);
    console.log('Menu classes before:', mobileMenu.className);

    if (isHidden) {
      mobileMenu.classList.remove('hidden');
      mobileMenu.classList.add('visible');
    } else {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('visible');
    }

    console.log('Menu classes after:', mobileMenu.className);
    console.log('Menu display style:', window.getComputedStyle(mobileMenu).display);
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

if (toggleViewBtnMobile && toggleViewBtn) {
  toggleViewBtnMobile.addEventListener('click', () => {
    toggleViewBtn.click();
    closeMobileMenu();
  });
}

// Update mobile button text when desktop buttons change
function updateMobileButtonText() {
  toggleAnimationBtnMobile.textContent = toggleAnimationBtn.textContent;
  toggleViewBtnMobile.textContent = toggleViewBtn.textContent;
}

// Helper function to close mobile menu
function closeMobileMenu() {
  if (mobileMenu) {
    mobileMenu.classList.add('hidden');
    mobileMenu.classList.remove('visible');
  }
}

// Update mobile buttons initially and when they change
if (toggleAnimationBtn && toggleViewBtn && toggleAnimationBtnMobile && toggleViewBtnMobile) {
  updateMobileButtonText();
  const observer = new MutationObserver(updateMobileButtonText);
  observer.observe(toggleAnimationBtn, { childList: true, characterData: true, subtree: true });
  observer.observe(toggleViewBtn, { childList: true, characterData: true, subtree: true });
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
