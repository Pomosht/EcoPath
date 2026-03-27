const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

// 1. Инициализация на картата и основните слоеве
var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

lightTiles.addTo(map);

// 2. Логика за смяна на темата (Безопасна проверка)
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        this.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        if (isDark) {
            map.removeLayer(lightTiles);
            darkTiles.addTo(map);
        } else {
            map.removeLayer(darkTiles);
            lightTiles.addTo(map);
        }
    });
}

// 3. Геокодиране
async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data.length > 0 ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) {
        console.error("Грешка при Геокодиране:", e);
        return null;
    }
}

// 4. Основна функция за маршрут
async function calculateRoute() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';

    const startInput = document.getElementById('startInput').value;
    const endInput = document.getElementById('endInput').value;

    const start = await getCoords(startInput);
    const end = await getCoords(endInput);

    if (!start || !end) {
        alert("Градът не е намерен! Моля, проверете името.");
        loader.style.display = 'none';
        return;
    }

    const transport = document.getElementById('transportMode').value;
    const profile = transport === 'bike' ? 'cycling-regular' : 'driving-car';

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
            method: 'POST',
            headers: { 
                'Authorization': API_KEY, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ coordinates: [[parseFloat(start.lon), parseFloat(start.lat)], [parseFloat(end.lon), parseFloat(end.lat)]] })
        });

        const data = await response.json();
        
        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        routeLayer = L.geoJSON(data, { 
            style: { color: '#2d6a4f', weight: 5, opacity: 0.8 } 
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Статистика
        const summary = data.features[0].properties.summary;
        document.getElementById('distVal').innerText = Math.round(summary.distance / 1000);
        
        const hours = Math.floor(summary.duration / 3600);
        const mins = Math.floor((summary.duration % 3600) / 60);
        document.getElementById('timeVal').innerText = `${hours}ч ${mins}м`;

        // Еко рейтинг
        let co2Factor = 0.14; 
        if (transport === 'electric') co2Factor = 0.05;
        else if (transport === 'bus') co2Factor = 0.03;
        else if (transport === 'bike') co2Factor = 0;
        
        document.getElementById('co2Val').innerText = ((summary.distance / 1000) * co2Factor).toFixed(1);

        fetchPOIs(data.features[0].geometry);

    } catch (e) {
        console.error("Грешка при маршрута:", e);
        alert("Грешка при изчисляване. Проверете конзолата.");
    } finally {
        loader.style.display = 'none';
    }
}

// 5. Обекти (POI)
async function fetchPOIs(routeGeo) {
    const checkboxes = document.querySelectorAll('.poi-check:checked');
    const selectedCats = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');

    if (selectedCats.length === 0) {
        list.innerHTML = '<p class="text-muted small text-center">Изберете категория...</p>';
        markersGroup.clearLayers();
        return;
    }

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 
                'Authorization': API_KEY, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                request: "pois", 
                geometry: { 
                    geojson: routeGeo, 
                    buffer: 500 
                },
                filters: { category_group_ids: selectedCats }, 
                limit: 30 
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
            const tags = poi.properties.osm_tags || {};
            const name = tags.name || tags.amenity || "Интересно място";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<strong>${name}</strong>`;
            div.onclick = () => {
                map.flyTo(coords, 16);
                L.popup().setLatLng(coords).setContent(`<b>${name}</b>`).openOn(map);
            };
            list.appendChild(div);

            L.circleMarker(coords, { 
                radius: 8, fillColor: "#f39c12", color: "#fff", weight: 2, fillOpacity: 0.9 
            }).addTo(markersGroup).bindPopup(`<b>${name}</b>`);
        });

    } catch (e) {
        console.error("POI Error:", e);
    }
}

// 6. Обновяване при промяна на филтрите
document.querySelectorAll('.poi-check').forEach(cb => {
    cb.addEventListener('change', () => {
        if (routeLayer) {
            fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
        }
    });
});
