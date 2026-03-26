// Твоят API ключ за OpenRouteService
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0='; 

// Инициализация на картата
const map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

let routeLayer = null;
const markersGroup = L.layerGroup().addTo(map);

// 1. Функция за координати
async function getCoords(city) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        return data.length > 0 ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch (e) { return null; }
}

// 2. Основна функция за маршрут
async function calculateRoute() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';

    const startVal = document.getElementById('startInput').value;
    const endVal = document.getElementById('endInput').value;
    const ecoValue = document.getElementById('ecoSlider').value;

    // Логика за Еко Метър: ако е под 50, ползваме "recommended" за по-малко CO2
    const preference = ecoValue < 50 ? 'recommended' : 'fastest';

    const start = await getCoords(startVal);
    const end = await getCoords(endVal);

    if (!start || !end) {
        alert("Градът не е намерен!");
        loader.style.display = 'none';
        return;
    }

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}&preference=${preference}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const geometry = data.features[0].geometry;
        const summary = data.features[0].properties.summary;

        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        // Цвят спрямо еко-настройката
        const routeColor = ecoValue < 50 ? '#2d6a4f' : '#d90429';
        routeLayer = L.geoJSON(geometry, { style: { color: routeColor, weight: 6 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // Статистика
        const dist = (summary.distance / 1000).toFixed(1);
        document.getElementById('distVal').innerText = dist;
        document.getElementById('timeVal').innerText = Math.round(summary.duration / 60);
        
        // Калкулация на CO2 (0.08 за еко, 0.14 за бърз път)
        const co2Factor = ecoValue < 50 ? 0.08 : 0.14;
        document.getElementById('co2Val').innerText = (dist * co2Factor).toFixed(1);

        fetchPOIs();
    } catch (e) {
        alert("Грешка при генериране на маршрута.");
    } finally {
        loader.style.display = 'none';
    }
}

// 3. Функция за пингване на обекти (POI)
async function fetchPOIs() {
    // 1. Проверка дали имаме начертан маршрут
    if (!routeLayer) {
        console.warn("Няма начертан маршрут.");
        return;
    }

    // Вземаме геометрията на маршрута
    const routeGeo = routeLayer.toGeoJSON().features[0].geometry;
    
    // 2. Вземаме избраните категории
    const checkboxes = document.querySelectorAll('.poi-check:checked');
    const selectedCats = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    const list = document.getElementById('poiList');
    markersGroup.clearLayers(); // Изчистваме старите икони от картата

    // Ако нищо не е избрано, спираме дотук
    if (selectedCats.length === 0) {
        list.innerHTML = '<p class="text-muted small">Изберете категория...</p>';
        return;
    }

    // ПОПРАВКА: Структурата на заявката трябва да е точно такава
    const requestBody = {
        request: "pois",
        geometry: {
            geojson: routeGeo,
            buffer: 2000 // Търсим в радиус от 2км около линията
        },
        filters: {
            category_group_ids: selectedCats
        },
        limit: 20,
        sortby: "distance"
    };

    try {
        const response = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: {
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        list.innerHTML = '';

        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-muted small">Няма открити обекти в този район.</p>';
            return;
        }

        data.features.forEach(poi => {
            // Вземаме името (ако няма име, ползваме типа на обекта)
            const tags = poi.properties.osm_tags;
            const name = tags.name || tags.amenity || tags.tourism || "Интересен обект";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            // Добавяме в списъка вляво
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<b>${name}</b><small class="text-muted">Разстояние: ~${(poi.properties.distance || 0).toFixed(0)}м</small>`;
            div.onclick = () => {
                map.setView(coords, 16);
                L.popup().setLatLng(coords).setContent(`<b>${name}</b>`).openOn(map);
            };
            list.appendChild(div);

            // Добавяме маркер на картата
            L.circleMarker(coords, { 
                radius: 8, 
                color: 'white', 
                fillColor: '#f39c12', 
                fillOpacity: 1, 
                weight: 2 
            }).addTo(markersGroup).bindPopup(`<b>${name}</b>`);
        });

    } catch (error) {
        console.error("Грешка при POI заявката:", error);
        list.innerHTML = '<p class="text-danger small">Грешка при зареждане на обектите.</p>';
    }
}

// 4. Слушатели на събития
document.getElementById('routeBtn').addEventListener('click', calculateRoute);

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.addEventListener('change', fetchPOIs);
});

document.getElementById('ecoSlider').addEventListener('input', function(e) {
    const val = e.target.value;
    const label = document.getElementById('ecoLabel');
    if (val < 40) {
        label.innerText = "Еко"; label.className = "badge bg-success";
    } else if (val < 75) {
        label.innerText = "Баланс"; label.className = "badge bg-warning text-dark";
    } else {
        label.innerText = "Бърз"; label.className = "badge bg-danger";
    }
});
