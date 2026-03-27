const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

// Конфигурация без църкви и с фокус върху Еко обекти
const typeConfig = {
    'restaurant': { label: 'Еко Ресторант', icon: '🍏', color: '#2d6a4f' },
    'cafe': { label: 'Био Кафене', icon: '☕', color: '#40916c' },
    'hotel': { label: 'Еко Хотел', icon: '🌿', color: '#1b4332' },
    'guest_house': { label: 'Къща за гости', icon: '🏠', color: '#1b4332' },
    'museum': { label: 'Музей', icon: '🏛️', color: '#a67c52' },
    'gallery': { label: 'Галерия', icon: '🎨', color: '#a67c52' },
    'castle': { label: 'Замък/Крепост', icon: '🏰', color: '#a67c52' },
    'park': { label: 'Парк/Природа', icon: '🌳', color: '#74c69d' },
    'nature_reserve': { label: 'Еко пътека', icon: '🥾', color: '#74c69d' },
    'viewpoint': { label: 'Гледка', icon: '🔭', color: '#74c69d' }
};

const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        isDark ? (map.removeLayer(lightTiles), darkTiles.addTo(map)) : (map.removeLayer(darkTiles), lightTiles.addTo(map));
    };
}

async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
}

async function calculateRoute() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    
    const start = await getCoords(document.getElementById('startInput').value);
    const end = await getCoords(document.getElementById('endInput').value);

    if (!start || !end) { alert("Градът не е намерен!"); loader.style.display = 'none'; return; }

    const transport = document.getElementById('transportMode').value;
    const profile = transport === 'bike' ? 'cycling-regular' : 'driving-car';

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: [[parseFloat(start.lon), parseFloat(start.lat)], [parseFloat(end.lon), parseFloat(end.lat)]] })
        });
        const data = await response.json();
        
        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        routeLayer = L.geoJSON(data, { style: { color: '#2d6a4f', weight: 5 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.08 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        let score = transport === 'bike' ? 100 : Math.max(10, Math.min(100, 100 - (co2 * 2.2)));
        const bar = document.getElementById('scoreBar');
        bar.style.width = score + "%";
        document.getElementById('scoreText').innerText = Math.round(score) + "%";
        bar.style.backgroundColor = score > 75 ? "#2d6a4f" : score > 40 ? "#f39c12" : "#d9534f";

        fetchPOIs(data.features[0].geometry);
    } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
}

async function fetchPOIs(routeGeo) {
    const selectedIds = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    
    if (!selectedIds.length) { 
        list.innerHTML = '<p class="text-center small text-muted">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    const step = Math.max(1, Math.ceil(routeGeo.coordinates.length / 40)); 
    const simpleCoords = routeGeo.coordinates.filter((_, i) => i % step === 0);

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                request: "pois", 
                geometry: { geojson: { type: "LineString", coordinates: simpleCoords }, buffer: 1500 },
                filters: { category_group_ids: selectedIds }, 
                limit: 100 
            })
        });
        
        const data = await res.json();
        list.innerHTML = ''; markersGroup.clearLayers();
        
        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-center small text-muted">Няма открити обекти.</p>';
            return;
        }

        data.features.forEach(poi => {
            const tags = poi.properties.osm_tags || {};
            const name = tags.name || tags['name:bg'] || "Еко обект";
            const actualType = tags.tourism || tags.historic || tags.leisure || tags.amenity || 'object';
            const config = typeConfig[actualType] || { label: 'Интересно място', icon: '📍', color: '#2d6a4f' };

            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<span>${config.icon}</span> <strong>${name}</strong><br><small class="text-muted ms-4">${config.label}</small>`;
            div.onclick = () => { map.flyTo(coords, 16); L.popup().setLatLng(coords).setContent(name).openOn(map); };
            list.appendChild(div);
            
            L.circleMarker(coords, { radius: 8, fillColor: config.color, color: "#fff", weight: 2, fillOpacity: 0.8 }).addTo(markersGroup);
        });
    } catch (e) { list.innerHTML = '<p class="text-center text-danger small">Грешка при зареждане.</p>'; }
}

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.onchange = () => routeLayer && fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
});
