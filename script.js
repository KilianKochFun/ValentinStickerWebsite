const locations = [
    {
        position: [52.5200, 13.4050],
        image: 'https://picsum.photos/450/300?random=1',
        title: 'Berlin',
        description: 'Die pulsierende Hauptstadt Deutschlands.'
    },
    {
        position: [48.1351, 11.5820],
        image: 'https://picsum.photos/450/300?random=2',
        title: 'München',
        description: 'Heimat des Oktoberfests.'
    },
    {
        position: [50.9375, 6.9603],
        image: 'https://picsum.photos/450/300?random=3',
        title: 'Köln',
        description: 'Berühmt für den Kölner Dom.'
    },
    {
        position: [53.5511, 9.9937],
        image: 'https://picsum.photos/450/300?random=4',
        title: 'Hamburg',
        description: 'Das Tor zur Welt.'
    }
];

const map = L.map('map').setView([51.1657, 10.4515], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);


const gallery = document.getElementById('gallery');

locations.forEach(loc => {
    const marker = L.marker(loc.position).addTo(map);

    // Popup-Inhalt (ohne Button im HTML-String)
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
        <div>
            <img src="${loc.image}" alt="${loc.title}" style="width: 100%; border-radius: 8px;">
            <p><strong>${loc.title}</strong></p>
            <p>${loc.description}</p>
        </div>
    `;

    const zoomButton = document.createElement('button');
    zoomButton.innerHTML = '🔍 Zoom in';
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

        // Öffne das Popup nochmal nach dem Zoom
        marker.openPopup();
    };

    popupContent.appendChild(zoomButton);

    marker.bindPopup(popupContent, {
        autoPan: true,
        autoPanPaddingTopLeft: [20, 100],
        maxWidth: 350
    });

    const imageCard = document.createElement('div');
    imageCard.className = 'image-card';
    imageCard.innerHTML = `<img src="${loc.image}" alt="${loc.title}">`;

    imageCard.onclick = () => {
        map.setView(loc.position, 17);
        marker.openPopup();
    };

    gallery.appendChild(imageCard);
});

