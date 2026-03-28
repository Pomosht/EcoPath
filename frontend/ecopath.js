let map, routeLayer, markersGroup;
let currentRouteGeometry = null; 
let poiAbortController = null;
let debounceTimer = null;

// 
map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
markersGroup = L.layerGroup().addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function getRouteColor() {
    return document.body.classList.contains('dark-mode') ? '#52b788' : '#E37556'; 
}

// LIght or Dark theme
export function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const mapContainer = document.getElementById('map');
    if (mapContainer) mapContainer.classList.toggle('dark-map-filter', isDark);
    if (routeLayer) routeLayer.setStyle({ color: getRouteColor() });
    
    // Смяна на иконата на бутона
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
    }
}

// 3. Геокодиране
async function getCoords(city) {
    try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
        const data = await res.json();
        return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    } catch (e) { return null; }
}

// 4. Търсене на обекти (POI)
async function fetchPOIs() {
    if (!currentRouteGeometry) return;

    // Чистим веднага
    markersGroup.clearLayers();
    const listContainer = document.getElementById('poiList');
    if (listContainer) {
        listContainer.innerHTML = '<p class="text-muted small m-0 text-center"><span class="spinner-border spinner-border-sm"></span> Търся...</p>';
    }

    if (poiAbortController) poiAbortController.abort();
    poiAbortController = new AbortController();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const selectedRadio = document.querySelector('.poi-radio:checked');
        const bubble = document.getElementById('status-bubble');

        if (!selectedRadio) {
            if (listContainer) listContainer.innerHTML = '<p class="text-muted small m-0 text-center">Изберете категория</p>';
            return;
        }

        if (bubble) bubble.style.display = 'block';

        try {
            const response = await fetch('/api/pois', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    geometry: currentRouteGeometry, 
                    categories: [selectedRadio.value] 
                }),
                signal: poiAbortController.signal
            });

            const data = await response.json();
            markersGroup.clearLayers();
            
            if (data && data.length > 0) {
                renderMarkers(data);
                updatePOIList(data);
            } else {
                if (listContainer) listContainer.innerHTML = '<p class="text-muted small m-0 text-center">Нищо не е намерено.</p>';
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Грешка:", err);
            }
        } finally {
            if (bubble) bubble.style.display = 'none';
        }
    }, 250);
}

function renderMarkers(pois) {
    pois.forEach(poi => {
        const name = poi.tags.name || "Обект без име";
        const type = poi.tags.amenity || poi.tags.tourism || poi.tags.historic || "Интересно място";
        const marker = L.marker([poi.lat, poi.lon]);
        marker.bindPopup(`<b>${name}</b><br>${type}`);
        markersGroup.addLayer(marker);
    });
}

function updatePOIList(pois) {
    const listContainer = document.getElementById('poiList');
    listContainer.innerHTML = pois.map(poi => {
        const name = poi.tags.name || "Обект без име";
        return `
            <div class="poi-item mb-1 p-1 border-bottom" style="font-size: 0.75rem;">
                <strong>${name}</strong><br>
                <span class="text-muted">${poi.tags.amenity || 'Обект'}</span>
            </div>
        `;
    }).join('');
}

// 5. Маршрут
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

        // Статистики
        const distKm = routeData.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);

        let durationSec = routeData.duration;
        const h = Math.floor(durationSec / 3600), m = Math.floor((durationSec % 3600) / 60);
        document.getElementById('timeVal').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;

        // CO2 & Score
        let co2PerKm = transport === 'bike' ? 0 : transport === 'bus' ? 0.06 : transport === 'electric' ? 0.04 : 0.19;
        let baseScore = transport === 'bike' ? 100 : transport === 'electric' ? 90 : transport === 'bus' ? 75 : 45;
        
        document.getElementById('co2Val').innerText = (distKm * co2PerKm).toFixed(1);
        let finalScore = Math.max(5, baseScore - (transport !== 'bike' ? Math.floor(distKm / 50) * 5 : 0));
        
        const bar = document.getElementById('scoreBar');
        bar.style.width = finalScore + '%';
        bar.className = `progress-bar ${finalScore > 75 ? 'bg-success' : finalScore > 45 ? 'bg-warning' : 'bg-danger'}`;
        document.getElementById('scoreText').innerText = finalScore + '%';

        // Автоматично затваряне на сайдбара на телефон
        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.remove('active');
        }

        fetchPOIs();
    } catch (e) { 
        if (loader) loader.style.display = 'none'; 
        console.error(e);
    }
}

// 6. Глобални функции и Слушатели
window.calculateRoute = calculateRoute;
window.toggleTheme = toggleTheme;
window.clearPOIs = function() {
    document.querySelectorAll('.poi-radio').forEach(r => r.checked = false);
    markersGroup.clearLayers();
    document.getElementById('poiList').innerHTML = '<p class="text-muted small m-0 text-center">Няма избрани обекти</p>';
};

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
