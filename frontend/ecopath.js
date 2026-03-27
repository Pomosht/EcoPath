let map, routeLayer, markersGroup;
let currentRouteGeometry = null; 
let poiAbortController = null;

// Инициализация на картата
map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
markersGroup = L.layerGroup().addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function getRouteColor() {
    return document.body.classList.contains('dark-mode') ? '#52b788' : '#E37556'; 
}

export function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('map').classList.toggle('dark-map-filter', isDark);
    if (routeLayer) routeLayer.setStyle({ color: getRouteColor() });
}

async function getCoords(city) {
    try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
        const data = await res.json();
        return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    } catch (e) { return null; }
}

// ФУНКЦИЯ ЗА ОБЕКТИ (САМО ЕДНА КАТЕГОРИЯ)
async function fetchPOIs() {
    if (!currentRouteGeometry) return;
    
    if (poiAbortController) poiAbortController.abort();
    poiAbortController = new AbortController();

    const bubble = document.getElementById('status-bubble');
    const listContainer = document.getElementById('poiList');
    
    if (bubble) bubble.style.display = 'block';

    const selectedRadio = document.querySelector('.poi-radio:checked');
    if (!selectedRadio) {
        markersGroup.clearLayers();
        listContainer.innerHTML = '<p class="text-muted small m-0 text-center">Няма избрани обекти</p>';
        if (bubble) bubble.style.display = 'none';
        return;
    }

    const category = selectedRadio.value;

    try {
        const response = await fetch('/api/pois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geometry: currentRouteGeometry, categories: [category] }),
            signal: poiAbortController.signal
        });
        
        const data = await response.json();
        renderMarkers(data);
        updatePOIList(data);

    } catch (err) {
        if (err.name !== 'AbortError') console.error("POI Error:", err);
    } finally {
        if (bubble) bubble.style.display = 'none';
    }
}

function renderMarkers(pois) {
    markersGroup.clearLayers();
    pois.forEach(poi => {
        const marker = L.marker([poi.lat, poi.lon]);
        marker.bindPopup(`<b>${poi.tags.name}</b><br>${poi.tags.amenity}`);
        markersGroup.addLayer(marker);
    });
}

function updatePOIList(pois) {
    const listContainer = document.getElementById('poiList');
    if (pois.length === 0) {
        listContainer.innerHTML = '<p class="text-muted small m-0 text-center">Не бяха намерени обекти в тази зона.</p>';
        return;
    }
    
    listContainer.innerHTML = pois.map(poi => `
        <div class="poi-item mb-1 p-1 border-bottom" style="font-size: 0.75rem;">
            <strong>${poi.tags.name}</strong><br>
            <span class="text-muted">${poi.tags.amenity}</span>
        </div>
    `).join('');
}

window.clearPOIs = function() {
    document.querySelectorAll('.poi-radio').forEach(r => r.checked = false);
    markersGroup.clearLayers();
    document.getElementById('poiList').innerHTML = '<p class="text-muted small m-0 text-center">Няма избрани обекти</p>';
}

export async function calculateRoute() {
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

        if (routeLayer) map.removeLayer(routeLayer);
        currentRouteGeometry = routeData.geometry;
        
        routeLayer = L.geoJSON(currentRouteGeometry, { 
            style: { color: getRouteColor(), weight: 6, opacity: 0.9 } 
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // МЕТРИКИ
        const distKm = routeData.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);

        let durationSec = routeData.duration;
        if (transport === 'bike') durationSec = (distKm / 15) * 3600;
        const h = Math.floor(durationSec / 3600), m = Math.floor((durationSec % 3600) / 60);
        document.getElementById('timeVal').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;

        // CO2 & SCORE
        let co2PerKm = transport === 'bike' ? 0 : transport === 'bus' ? 0.06 : transport === 'electric' ? 0.04 : 0.19;
        let baseScore = transport === 'bike' ? 100 : transport === 'electric' ? 90 : transport === 'bus' ? 75 : 45;
        
        document.getElementById('co2Val').innerText = (distKm * co2PerKm).toFixed(1);
        let finalScore = Math.max(5, baseScore - (transport !== 'bike' ? Math.floor(distKm / 50) * 5 : 0));
        
        const bar = document.getElementById('scoreBar');
        bar.style.width = finalScore + '%';
        bar.className = `progress-bar ${finalScore > 75 ? 'bg-success' : finalScore > 45 ? 'bg-warning' : 'bg-danger'}`;
        document.getElementById('scoreText').innerText = finalScore + '%';

        fetchPOIs();
    } catch (e) { if (loader) loader.style.display = 'none'; }
}

// Закачаме слушателите за Radio бутоните
document.querySelectorAll('.poi-radio').forEach(radio => {
    radio.addEventListener('change', () => {
        if (!currentRouteGeometry) {
            radio.checked = false;
            alert("Първо изчислете маршрут!");
            return;
        }
        fetchPOIs();
    });
});

window.calculateRoute = calculateRoute;
window.toggleTheme = toggleTheme;
