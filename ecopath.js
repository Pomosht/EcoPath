const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

// Обединяваме метаданните за икони и преводи на едно място
const typeConfig = {
    // Храна (Category 130)
    'restaurant': { label: 'Ресторант', icon: '🍴', color: '#e63946' },
    'cafe': { label: 'Кафене', icon: '☕', color: '#a67c52' },
    'fast_food': { label: 'Бързо хранене', icon: '🍔', color: '#f4a261' },
    'pub': { label: 'Пъб/Бар', icon: '🍺', color: '#e63946' },
    // Хотели (Category 330)
    'hotel': { label: 'Хотел', icon: '🏨', color: '#457b9d' },
    'hostel': { label: 'Хостел', icon: '🛌', color: '#457b9d' },
    'guest_house': { label: 'Къща за гости', icon: '🏠', color: '#457b9d' },
    'motel': { label: 'Мотел', icon: '🚗', color: '#457b9d' },
    'apartment': { label: 'Апартамент', icon: '🏢', color: '#457b9d' },
    // Култура (Category 300)
    'museum': { label: 'Музей', icon: '🏛️', color: '#2a9d8f' },
    'gallery': { label: 'Галерия', icon: '🎨', color: '#2a9d8f' },
    'castle': { label: 'Замък/Крепост', icon: '🏰', color: '#2a9d8f' },
    // Религия (Category 210)
    'place_of_worship': { label: 'Храм', icon: '⛪', color: '#e9c46a' },
    'church': { label: 'Църква', icon: '⛪', color: '#e9c46a' }
};

// 1. Theme Toggle
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

        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.03 : transport === 'bike' ? 0 : 0.14;
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

// 3. Fetch POIs - КОРИГИРАНА ВЕРСИЯ
async function fetchPOIs(routeGeo) {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.poi-check:checked'));
    const selectedIds = selectedCheckboxes.map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    
    if (!selectedIds.length) { 
        list.innerHTML = '<p class="text-center small text-muted">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    // Разреждаме точките, за да не гръмне API-то
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
                limit: 150 
            })
        });
        
        const data = await res.json();
        list.innerHTML = ''; 
        markersGroup.clearLayers();
        
        if (!data.features || data.features.length === 0) { 
            list.innerHTML = '<p class="text-center small text-muted">Няма открити обекти.</p>'; 
            return; 
        }

        let counter = 0;

        data.features.forEach(poi => {
            const tags = poi.properties.osm_tags || {};
            
            // 1. Търсим име - ако няма никакво име, пропускаме
            const name = tags.name || tags.brand || tags['name:bg'] || tags.operator;
            if (!name || name.length < 2) return;

            // 2. Определяме типа (проверяваме amenity и tourism тагове)
            const actualType = tags.amenity || tags.tourism || tags.religion || tags.historic || 'object';
            const config = typeConfig[actualType] || { label: actualType.replace('_', ' '), icon: '📍', color: '#f39c12' };

            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            counter++;

            // 3. Добавяме в страничния списък
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<span>${config.icon}</span> <strong>${name}</strong><br><small class="text-muted ms-4">${config.label}</small>`;
            
            div.onclick = () => { 
                map.flyTo(coords, 16); 
                L.popup().setLatLng(coords).setContent(`${config.icon} <b>${name}</b>`).openOn(map); 
            };
            list.appendChild(div);
            
            // 4. Слагаме маркер на картата
            L.circleMarker(coords, { 
                radius: 9, 
                fillColor: config.color, 
                color: "#fff", 
                weight: 2, 
                fillOpacity: 0.9 
            }).addTo(markersGroup).bindPopup(`${config.icon} <b>${name}</b><br>${config.label}`);
        });

        if (counter === 0) {
            list.innerHTML = '<p class="text-center small text-muted">Няма именувани обекти в този обхват.</p>';
        }

    } catch (e) { 
        console.error("POI Fetch Error:", e);
        list.innerHTML = '<p class="text-center text-danger small">Грешка при зареждане на обекти.</p>';
    }
}

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.onchange = () => {
        if (routeLayer) {
            const geo = routeLayer.toGeoJSON().features[0].geometry;
            fetchPOIs(geo);
        }
    };
});
