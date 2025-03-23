// Initialize map
const map = L.map("map").setView([51.1657, 10.4515], 6);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

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

if(locations.length != 0)  {
  gallery.innerHTML = "";
}
// Create markers + gallery
locations.forEach((loc, index) => {
  // --- Leaflet Marker ---
  const marker = L.marker(loc.position).addTo(map);

  // --- Popup content ---
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
      <div style="text-align:center;">
        <img src="${loc.image}" alt="${loc.title}"
             style="max-width: 200px; width: 100%; border-radius: 8px; cursor: pointer;"
             id="popupImg${index}">
        <p style="text-align: left; font-size: 1.2em;"><strong>${loc.title}</strong></p>
        <p style="text-align: left">${loc.description}</p>
      </div>
    `;

  // Fullscreen Button for Popup
  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.innerHTML = "🖥️ View Fullscreen";
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
  zoomButton.innerHTML = "🔍 Zoom in";
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
  imageCard.innerHTML = `
      <img src="${loc.image}" alt="${loc.title}">
      <p class="image-title">${loc.title}</p>
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

// Fullscreen modal open/close
function openFullscreen(loc) {
  modal.style.display = "block";
  modalImage.src = loc.image;
  modalTitle.textContent = loc.title;
  modalDescription.textContent = loc.description;
}

// Schließen per Button
closeModal.onclick = closeFullscreen;

function closeFullscreen() {
  modal.style.display = "none";
}

// Schließen durch Klick außerhalb
window.onclick = (event) => {
  if (event.target === modal) {
    closeFullscreen();
  }
};

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

// Suchfunktion
searchInput.addEventListener("input", () => {
  const filter = searchInput.value.trim().toLowerCase();
  const cards = gallery.querySelectorAll(".image-card");

  locations.forEach((loc, i) => {
    const combinedText = normalizeText(loc.title); // Nutzt die Normalisierung
    const card = cards[i];

    if (fuzzyMatch(filter, combinedText)) {
      card.style.display = "flex"; // Zeigen
    } else {
      card.style.display = "none"; // Verstecken
    }
  });
});

// Ansicht umschalten: Galerie anzeigen / Karte anzeigen
toggleViewBtn.addEventListener("click", () => {
  mapHidden = !mapHidden;
  if (mapHidden) {
    document.body.classList.add("hide-map");
    toggleViewBtn.textContent = "🗺️ Karte anzeigen";
  } else {
    document.body.classList.remove("hide-map");
    toggleViewBtn.textContent = "📷 Nur Galerie anzeigen";
  }
});
