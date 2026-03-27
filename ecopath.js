const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

// СТИЛОВЕ НА КАРТАТА
const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO'
}).addTo(map);

const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO'
});

// ДАННИ ЗА КАТЕГОРИИ
const typeConfig = {
    'restaurant': { label: 'Ресторант', icon: '🍴', color: '#e63946' },
    'cafe': { label: 'Кафене', icon: '☕', color: '#a67c52' },
    'hotel': { label: 'Хотел', icon: '🏨', color: '#457b9d' },
    'museum': { label: 'Музей', icon: '🏛️', color: '#2a9d8f' },
    'church': { label: 'Храм', icon: '⛪', color: '#e9c46a' }
};

// 1. ТЕМА (DARK MODE)
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        // Switch map tiles based on theme
        if (isDark) {
            map.removeLayer(standardTiles);
            // Use filtered light tiles for better visibility instead of pure dark
            positronTiles.addTo(map);
            // Add CSS filter to make it slightly darker but still visible
            document.getElementById('map').classList.add('dark-map-filter');
        } else {
            map.removeLayer(positronTiles);
            map.removeLayer(darkTiles);
            standardTiles.addTo(map);
            document.getElementById('map').classList.remove('dark-map-filter');
        }

        // Обновяване на цвета на маршрута според темата
        if (routeLayer) {
            routeLayer.setStyle({ color: isDark ? '#4ade80' : '#2d6a4f' });
        }
    };
}

// 2. ГЕОКОДИРАНЕ
async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
}

// 3. ИЗЧИСЛЯВАНЕ НА МАРШРУТ
async function calculateRoute() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    
    const start = await getCoords(document.getElementById('startInput').value);
    const end = await getCoords(document.getElementById('endInput').value);

    if (!start || !end) { 
        alert("Градът не е намерен!"); 
        loader.style.display = 'none'; 
        return; 
    }

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
        routeLayer = L.geoJSON(data, { 
            style: { 
                color: isDark ? '#4ade80' : '#2d6a4f', 
                weight: 5,
                dashArray: '10, 5' // Пунктирана линия за модерен вид
            } 
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Статистики
        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

        // CO2 & Еко рейтинг
        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.08 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        let score = transport === 'bike' ? 100 : Math.max(10, Math.min(100, 100 - (co2 * 2.5)));
        const bar = document.getElementById('scoreBar');
        bar.style.width = score + "%";
        document.getElementById('scoreText').innerText = Math.round(score) + "%";
        
        // Автоматично изтегляне на обекти
        fetchPOIs(data.features[0].geometry);
    } catch (e) { 
        console.error(e); 
    } finally { 
        loader.style.display = 'none'; 
    }
}

// 4. ОБЕКТИ ПО ПЪТЯ (POIs)
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    if (!selected.length) { 
        list.innerHTML = '<p class="text-muted small m-0 text-center">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    // Редукция на точки за API-то
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
                limit: 100 
            })
        });
        
        const data = await res.json();
        list.innerHTML = ''; 
        markersGroup.clearLayers();
        
        if (!data.features?.length) { 
            list.innerHTML = '<p class="text-center small text-muted">Няма открити обекти.</p>'; 
            return; 
        }

        data.features.forEach(poi => {
            const tags = poi.properties.osm_tags || {};
            const name = tags.name || tags.brand || tags['name:bg'] || tags.operator;
            
            // ФИКС: Скриваме обекти без име
            if (!name || name.length < 2) return;

            const type = tags.amenity || tags.tourism || tags.religion || 'object';
            const config = typeConfig[type] || { label: 'Обект', icon: '📍', color: '#f39c12' };
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];

            // Списък
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<span>${config.icon}</span> <strong>${name}</strong><br><small class="text-muted ms-4">${config.label}</small>`;
            
            div.onclick = () => { 
                map.flyTo(coords, 16); 
                L.popup().setLatLng(coords).setContent(`<b>${config.icon} ${name}</b>`).openOn(map); 
            };
            list.appendChild(div);
            
            // Маркер
            L.circleMarker(coords, { 
                radius: 8, 
                fillColor: config.color, 
                color: "#fff", 
                weight: 2, 
                fillOpacity: 0.9 
            }).addTo(markersGroup).bindPopup(`<b>${config.icon} ${name}</b>`);
        });

    } catch (e) { 
        console.error("POI Fetch Error:", e);
    }
}

// Слушател за промяна на филтрите
document.querySelectorAll('.poi-check').forEach(cb => {
    cb.onchange = () => {
        if (routeLayer) {
            const geo = routeLayer.toGeoJSON().features[0].geometry;
            fetchPOIs(geo);
        }
    };
});
