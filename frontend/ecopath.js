let map, routeLayer, markersGroup;

// 1. Инициализация на картата
if (!window.mapInitialized) {
    map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
    markersGroup = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    window.mapInitialized = true;
}

// 2. Функция за взимане на координати
async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
        return null;
    } catch (e) {
        console.error("Грешка при геокодиране:", e);
        return null;
    }
}

// 3. ОСНОВНАТА ФУНКЦИЯ (Фикс за 'start is not defined')
async function calculateRoute() {
    // Взимаме стойностите от полетата
    const startInput = document.getElementById('startInput').value;
    const endInput = document.getElementById('endInput').value;
    const transport = document.getElementById('transportMode').value;

    if (!startInput || !endInput) {
        alert("Моля, попълнете и двете полета!");
        return;
    }

    // ТУК ДЕФИНИРАМЕ start И end ПРЕДИ TRY БЛОКА
    const start = await getCoords(startInput);
    const end = await getCoords(endInput);

    if (!start || !end) {
        alert("Градът не е намерен! Проверете името.");
        return;
    }

    try {
        const res = await fetch('/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coordinates: [[start.lon, start.lat], [end.lon, end.lat]], 
                transport 
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Чертане
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(data, { style: { color: '#2d6a4f', weight: 5 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

        // Статистики и Време
        const stats = data.features[0].properties.summary;
        const distKm = stats.distance / 1000;
        let durationSec = stats.duration;

        // Корекция за колело (15 км/ч средно)
        if (transport === 'bike') {
            durationSec = (distKm / 15) * 3600;
        } else {
            durationSec = durationSec * 1.15; // +15% за трафик
        }

        const h = Math.floor(durationSec / 3600);
        const m = Math.floor((durationSec % 3600) / 60);
        
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;

        // CO2
        const factors = { 'car': 0.14, 'electric': 0.05, 'bus': 0.03, 'bike': 0 };
        document.getElementById('co2Val').innerText = (distKm * factors[transport]).toFixed(1);

        // Търсене на 10 обекта покрай пътя
        fetchPOIs(data.features[0].geometry);

    } catch (e) {
        console.error("Грешка при маршрута:", e);
        alert("Сървърът не отговаря. Опитайте пак.");
    }
}

// 4. Търсене на обекти (Стриктен лимит 10)
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => cb.value);
    const list = document.getElementById('poiList');
    if (!selected.length) return markersGroup.clearLayers();

    list.innerHTML = '<p class="text-center small">Търся обекти... 🛰️</p>';

    try {
        const res = await fetch('/api/pois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geometry: routeGeo, categories: selected })
        });
        const data = await res.json();
        
        markersGroup.clearLayers();
        list.innerHTML = '';

        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-center small">Няма открити обекти точно до пътя.</p>';
            return;
        }

        data.features.forEach(poi => {
            const c = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            const div = document.createElement('div');
            div.className = 'poi-item p-2 border-bottom small';
            div.innerHTML = `<strong>${poi.properties.name}</strong><br><small>${poi.properties.type}</small>`;
            div.onclick = () => map.flyTo(c, 15);
            list.appendChild(div);

            L.circleMarker(c, { radius: 6, fillColor: "#2d6a4f", color: "#fff", fillOpacity: 0.9 }).addTo(markersGroup).bindPopup(poi.properties.name);
        });
    } catch (e) {
        list.innerHTML = 'Грешка в обектите.';
    }
}

// Експониране за HTML бутона
window.calculateRoute = calculateRoute;
