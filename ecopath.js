const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

// ЦВЕТНИ И НАСИТЕНИ СЛОЕВЕ
const colorfulTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
}).addTo(map);

const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
});

const typeConfig = {
    'restaurant': { label: 'Хапване', icon: '🍎', color: '#ff4d4d' },
    'cafe': { label: 'Кафе', icon: '☕', color: '#ff9f43' },
    'hotel': { label: 'Спирка', icon: '⛺', color: '#54a0ff' },
    'museum': { label: 'Култура', icon: '🎭', color: '#5f27cd' },
    'nature_reserve': { label: 'Природа', icon: '🌲', color: '#10ac84' }
};

// ТЕМА
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        if (isDark) {
            map.removeLayer(colorfulTiles);
            darkTiles.addTo(map);
        } else {
            map.removeLayer(darkTiles);
            colorfulTiles.addTo(map);
        }

        if (routeLayer) {
            routeLayer.setStyle({ color: isDark ? '#00ff88' : '#2ecc71' });
        }
    };
}

// ГЕОКОДИРАНЕ & МАРШРУТ
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

        const isDark = document.body.classList.contains('dark-mode');
        
        // Линията сега е по-ярка и има сянка
        routeLayer = L.geoJSON(data, { 
            style: { 
                color: isDark ? '#00ff88' : '#27ae60', 
                weight: 7,
                opacity: 0.9,
                lineCap: 'round'
            } 
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Статистики
        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.08 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        let score = transport === 'bike' ? 100 : Math.max(10, Math.min(100, 100 - (co2 * 2.5)));
        const bar = document.getElementById('scoreBar');
        bar.style.width = score + "%";
        document.getElementById('scoreText').innerText = Math.round(score) + "%";
        
        fetchPOIs(data.features[0].geometry);
    } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
}

// ТЪРСЕНЕ НА ОБЕКТИ
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    if (!selected.length) { 
        list.innerHTML = '<p class="text-muted small m-0 text-center">Изберете категория...</p>'; 
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
                filters: { category_group_ids: selected }, 
                limit: 60 
            })
        });
        
        const data = await res.json();
        list.innerHTML = ''; 
        markersGroup.clearLayers();
        
        data.features?.forEach(poi => {
            const tags = poi.properties.osm_tags || {};
            const name = tags.name || tags['name:bg'] || "Обект";
            const type = tags.amenity || tags.tourism || 'object';
            const config = typeConfig[type] || { label: 'Точка', icon: '📍', color: '#10ac84' };
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];

            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.style.borderLeft = `4px solid ${config.color}`;
            div.innerHTML = `<span>${config.icon}</span> <strong>${name}</strong>`;
            div.onclick = () => { map.flyTo(coords, 16); L.popup().setLatLng(coords).setContent(name).openOn(map); };
            list.appendChild(div);
            
            L.circleMarker(coords, { 
                radius: 7, fillColor: config.color, color: "#fff", weight: 2, fillOpacity: 1 
            }).addTo(markersGroup);
        });
    } catch (e) { console.error(e); }
}

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.onchange = () => routeLayer && fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
});
