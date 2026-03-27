const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);


const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

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

// 2. Calculate Route
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

        // КОРЕКЦИЯ НА ЕКО РЕЙТИНГА: По-реалистична скала
        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.08 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        //BIKE
        let score = 100;
        if (transport !== 'bike') {
            score = 100 - (co2 * 2.5); 
            if (transport === 'bus' || transport === 'electric') score += 20; // Бонус за еко транспорт
        }
        
        score = Math.max(10, Math.min(100, score)); // Минимум 10% вместо 5%
        
        const bar = document.getElementById('scoreBar');
        bar.style.width = score + "%";
        document.getElementById('scoreText').innerText = Math.round(score) + "%";
        bar.style.backgroundColor = score > 75 ? "#2d6a4f" : score > 40 ? "#f39c12" : "#d9534f";

        fetchPOIs(data.features[0].geometry);
    } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
}

// 3. Fetch POIs - АГРЕСИВНО ОПТИМИЗИРАНО за избягване на Error 400
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    if (!selected.length) { 
        list.innerHTML = '<p class="text-center small text-muted">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    // КЛЮЧОВАТА ПОПРАВКА: Ограничаваме масива до МАКСИМУМ 40 точки, 
    // независимо колко е дълъг маршрута.
    const totalPoints = routeGeo.coordinates.length;
    const step = Math.max(1, Math.ceil(totalPoints / 40)); 
    const simpleCoords = routeGeo.coordinates.filter((_, i) => i % step === 0);

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                request: "pois", 
                geometry: { 
                    geojson: { type: "LineString", coordinates: simpleCoords }, 
                    buffer: 1000 // Увеличаваме буфера на 1км, тъй като точките са по-редки
                },
                filters: { category_group_ids: selected }, 
                limit: 40 
            })
        });
        
        const data = await res.json();
        
        // Ако все още има грешка от API-то
        if (data.error || res.status === 400) {
            list.innerHTML = '<p class="text-center text-danger small">Грешка в заявката (твърде дълъг път).</p>';
            return;
        }

        list.innerHTML = ''; 
        markersGroup.clearLayers();
        
        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-center small text-muted">Няма обекти в този радиус.</p>';
            return;
        }

        data.features.forEach(poi => {
            const name = poi.properties.osm_tags?.name || poi.properties.osm_tags?.amenity || "Обект";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<strong>${name}</strong>`;
            
            div.onclick = () => { 
                map.flyTo(coords, 16); 
                L.popup().setLatLng(coords).setContent(name).openOn(map); 
            };
            list.appendChild(div);
            
            L.circleMarker(coords, { 
                radius: 7, 
                fillColor: "#f39c12", 
                color: "#fff", 
                weight: 2, 
                fillOpacity: 0.9 
            }).addTo(markersGroup);
        });
    } catch (e) { 
        console.error("POI Error:", e);
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
