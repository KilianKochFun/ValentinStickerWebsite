// Leaflet-basierter Standort-Picker. Leaflet muss als globales `L` vorliegen
// (über <script src=".../leaflet.js"> vor diesem Modul einbinden).

export function createMapPicker(container, { lat = 51.1657, lng = 10.4515, zoom = 5, onChange } = {}) {
  const el = typeof container === "string" ? document.getElementById(container) : container;
  if (!el) throw new Error("map-picker: Container nicht gefunden.");

  const map = L.map(el).setView([lat, lng], zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  let marker = null;

  function emit(latlng) {
    if (typeof onChange === "function") onChange(latlng.lat, latlng.lng);
  }

  function setPoint(la, lo, { fly = false } = {}) {
    const latlng = L.latLng(la, lo);
    if (marker) {
      marker.setLatLng(latlng);
    } else {
      marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on("dragend", (e) => emit(e.target.getLatLng()));
    }
    if (fly) map.flyTo(latlng, Math.max(map.getZoom(), 13), { duration: 0.8 });
    emit(latlng);
  }

  map.on("click", (e) => setPoint(e.latlng.lat, e.latlng.lng));

  return {
    map,
    setPoint,
    clear() { if (marker) { marker.remove(); marker = null; } },
    // Leaflet berechnet die Größe des Containers beim Init. Wird der Container
    // erst später sichtbar (z. B. im <dialog>), muss invalidateSize() getriggert werden.
    refresh() { map.invalidateSize(); },
  };
}
