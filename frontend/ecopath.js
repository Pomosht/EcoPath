let map, routeLayer, markersGroup;

// Инициализация
map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
markersGroup = L.layerGroup().addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

async function getCoords(city) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
    const data = await res.json();
    return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
}

async function calculateRoute() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const start = await getCoords(document.getElementById('startInput').value);
    const end = await getCoords(document.getElementById('endInput').value);
    const transport = document.getElementById('transportMode').value;

    if (!start || !end) {
        if (loader) loader.style.display = 'none';
        return alert("Градовете не са намерени!");
    }

    try {
        const res = await fetch('/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: [[start.lon, start.lat], [end.lon, end.lat]], transport })
        });
        const routeData = await res.json();
        if (loader) loader.style.display = 'none';

        // Рисуване на маршрута
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(routeData.geometry, { style: { color: '#2d6a4f', weight: 6 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Статистики
        const distKm = routeData.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);

        let durationSec = (transport === 'bike') ? (distKm / 15) * 3600 : routeData.duration;
        const h = Math.floor(durationSec / 3600);
        const m = Math.floor((durationSec % 3600) / 60);
        document.getElementById('timeVal').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;

        // Еко Метър & CO2 (Добавен автобус)
        let co2PerKm = 0.19; // кола по подразбиране
        let ecoScore = 25;

        if (transport === 'bike') { co2PerKm = 0; ecoScore = 100; }
        else if (transport === 'electric') { co2PerKm = 0.04; ecoScore = 85; }
        else if (transport === 'bus') { co2PerKm = 0.07; ecoScore = 65; }

        document.getElementById('co2Val').innerText = (distKm * co2PerKm).toFixed(1);
        
        const bar = document.getElementById('scoreBar');
        if (bar) {
            bar.style.width = ecoScore + '%';
            bar.className = `progress-bar ${ecoScore > 60 ? 'bg-success' : ecoScore > 40 ? 'bg-warning' : 'bg-danger'}`;
        }
        document.getElementById('scoreText').innerText = ecoScore + '%';

        // Викаме POIs
        fetchPOIs(routeData.geometry);
    } catch (e) { console.error(e); }
}

async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => cb.value);
    
    // Ако нищо не е избрано, само чистим и излизаме
    if (selected.length === 0) {
        markersGroup.clearLayers();
        document.getElementById('poiList').innerHTML = '<p class="text-muted small text-center">Изберете категория...</p>';
        return;
    }

    try {
        const res = await fetch('/api/pois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geometry: routeGeo, categories: selected })
        });
        const elements = await res.json();
        
        markersGroup.clearLayers();
        const list = document.getElementById('poiList');
        list.innerHTML = '';

        elements.forEach(el => {
            const coords = [el.lat, el.lon];
            
            // Динамичен цвят: Синьо за хотели, Оранжево за останалите
            const color = el.tags.tourism === 'hotel' || el.tags.tourism === 'hostel' ? "#3498db" : "#e67e22";

            L.circleMarker(coords, { 
                radius: 9, 
                fillColor: color, 
                color: "#fff", 
                weight: 2, 
                fillOpacity: 1 
            }).addTo(markersGroup).bindPopup(`<b>${el.tags.name || "Обект"}</b><br><small>${el.tags.tourism || el.tags.amenity || ""}</small>`);

            const item = document.createElement('div');
            item.className = 'poi-item';
            item.innerHTML = `<strong>${el.tags.name || "Обект"}</strong>`;
            item.onclick = () => map.flyTo(coords, 15);
            list.appendChild(item);
        });

        if (elements.length === 0) {
            list.innerHTML = '<p class="text-muted small text-center">Няма намерени обекти в този обхват.</p>';
        }
    } catch (e) { console.error("POI Fetch Error:", e); }
}

// Поправен слушател за филтрите
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('poi-check')) {
        if (routeLayer) {
            // Взимаме геометрията от слоя
            const geo = routeLayer.toGeoJSON();
            // Подаваме само geometry частта, за да е консистентно със сървъра
            fetchPOIs(geo.features[0].geometry);
        }
    }
});

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('map').classList.toggle('dark-map-filter', isDark);
    
    // Сменяме и иконата на бутона, ако я имаш
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
}

window.calculateRoute = calculateRoute;
window.toggleTheme = toggleTheme;
