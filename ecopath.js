const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

// Инициализация на картата
var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

// Използваме само един основен слой (Standard OSM)
const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Theme Toggle с CSS филтър за картата
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        const mapEl = document.getElementById('map');
        if (isDark) {
            mapEl.classList.add('dark-map-filter');
        } else {
            mapEl.classList.remove('dark-map-filter');
        }

        // Ако вече има маршрут, преначертай го с коригиран цвят (заради инверсията)
        if (routeLayer) {
            const currentGeo = routeLayer.toGeoJSON();
            map.removeLayer(routeLayer);
            drawRoute(currentGeo);
        }
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
            body: JSON.stringify({ 
                coordinates: [[parseFloat(start.lon), parseFloat(start.lat)], [parseFloat(end.lon), parseFloat(end.lat)]]
            })
        });
        const data = await response.json();
        
        drawRoute(data);
        
        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.03 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        let score = transport === 'bike' ? 100 : Math.max(10, Math.min(100, 100 - (co2 * 2)));
        const bar = document.getElementById('scoreBar');
        const scoreText = document.getElementById('scoreText');
        bar.style.width = score + "%";
        scoreText.innerText = Math.round(score) + "%";

        fetchPOIs(data.features[0].geometry);
    } catch (e) { 
        console.error(e); 
    } finally { 
        loader.style.display = 'none'; 
    }
}

function drawRoute(geoData) {
    if (routeLayer) map.removeLayer(routeLayer);
    const isDark = document.body.classList.contains('dark-mode');
    
    routeLayer = L.geoJSON(geoData, { 
        style: { 
            // В тъмен режим #ff4500 (оранжево) след инверсия изглежда като наситено синьо/зелено
            color: isDark ? '#ff4500' : '#22c55e',
            weight: 6,
            opacity: 0.9,
            dashArray: '1, 10',
            lineCap: 'round'
        } 
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
}

const categoryNames = {
    108: 'Хотел', 134: 'Музей', 135: 'Храм', 223: 'Археология', 
    331: 'Пещера', 335: 'Връх', 570: 'Ресторант', 564: 'Кафене', 622: 'Атракция'
};

const validCategories = {
    'restaurants': [570, 561, 564, 566],
    'culture': [131, 132, 134],
    'churches': [135],
    'hotels': [108, 107, 101, 103],
    'nature': [331, 332, 335, 338],
    'sights': [622, 627, 223, 224, 237, 243]
};

async function fetchPOIs(routeGeo) {
    const checkboxes = document.querySelectorAll('.poi-check:checked');
    let selectedCategories = [];
    checkboxes.forEach(cb => {
        if (validCategories[cb.value]) selectedCategories = selectedCategories.concat(validCategories[cb.value]);
    });
    
    selectedCategories = [...new Set(selectedCategories)];
    const list = document.getElementById('poiList');
    
    if (!selectedCategories.length) { 
        list.innerHTML = '<p class="text-muted small m-0 text-center">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    // ОПТИМИЗАЦИЯ: Намаляваме точките до макс 20 за API заявката
    const coords = routeGeo.coordinates;
    const step = Math.max(1, Math.ceil(coords.length / 20));
    const simpleCoords = coords.filter((_, i) => i % step === 0);
    if (coords.length > 1) simpleCoords.push(coords[coords.length - 1]);

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request: "pois",
                geometry: {
                    geojson: { type: "LineString", coordinates: simpleCoords },
                    buffer: 1200 
                },
                filters: { category_ids: selectedCategories },
                limit: 50
            })
        });
        
        const data = await res.json();
        list.innerHTML = '';
        markersGroup.clearLayers();

        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-muted small text-center">Няма открити обекти.</p>';
            return;
        }

        data.features.forEach(poi => {
            const props = poi.properties;
            const name = props.osm_tags?.name || categoryNames[props.category_id] || "Обект";
            const c = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<strong>${name}</strong><br><small>${categoryNames[props.category_id] || ''}</small>`;
            div.onclick = () => { 
                map.flyTo(c, 15); 
                L.popup().setLatLng(c).setContent(`<b>${name}</b>`).openOn(map); 
            };
            list.appendChild(div);

            L.circleMarker(c, { 
                radius: 8, 
                fillColor: "#39bee6", 
                color: "#fff", 
                weight: 2, 
                fillOpacity: 1 
            }).addTo(markersGroup);
        });
    } catch (e) { 
        list.innerHTML = '<p class="text-danger small">Грешка при връзка с API.</p>';
    }
}

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.addEventListener('change', () => {
        if (routeLayer) fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
    });
});