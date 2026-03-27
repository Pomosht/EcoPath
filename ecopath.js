const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

<<<<<<< HEAD
// 1. Инициализация на картата
=======
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

<<<<<<< HEAD
const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

// --- ДИНАМИЧНИ СТИЛОВЕ ЗА ТЕМАТА (Инжектиране чрез JS) ---
const themeStyles = document.createElement('style');
themeStyles.innerHTML = `
    /* Базови настройки за Dark Mode */
    body.dark-mode { background-color: #121212; color: #ffffff; }
    body.dark-mode .sidebar, body.dark-mode .card { background-color: #1e1e1e !important; border-color: #333 !important; }

    /* ТЕКСТОВЕ: Правим ги бели в Dark Mode и черни в Light Mode */
    /* Таргетираме конкретно заглавията от твоята снимка */
    body.dark-mode h4, 
    body.dark-mode h5, 
    body.dark-mode label, 
    body.dark-mode .poi-item strong,
    body.dark-mode #poiList p { 
        color: #ffffff !important; 
    }

    body:not(.dark-mode) h4, 
    body:not(.dark-mode) h5, 
    body:not(.dark-mode) label,
    body:not(.dark-mode) .poi-item strong { 
        color: #000000 !important; 
    }

    /* Стилизиране на POI елементите в списъка */
    .poi-item { padding: 10px; border-bottom: 1px solid #ddd; cursor: pointer; transition: 0.2s; }
    body.dark-mode .poi-item { border-bottom-color: #444; }
    body.dark-mode .poi-item:hover { background-color: #333; }

    /* Полета за въвеждане */
    body.dark-mode input, body.dark-mode select { 
        background-color: #2c2c2c !important; 
        color: white !important; 
        border: 1px solid #444 !important; 
    }
`;
document.head.appendChild(themeStyles);

// 2. Логика за смяна на темата
=======

const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

// 1. Theme Toggle
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
<<<<<<< HEAD
        
        // Смяна на иконата (Слънце/Луна)
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        // Смяна на слоевете на картата
        if (isDark) {
            map.removeLayer(lightTiles);
            darkTiles.addTo(map);
        } else {
            map.removeLayer(darkTiles);
            lightTiles.addTo(map);
        }
    };
}

// 3. Координати и Маршрут
=======
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        isDark ? (map.removeLayer(lightTiles), darkTiles.addTo(map)) : (map.removeLayer(darkTiles), lightTiles.addTo(map));
    };
}

>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
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
<<<<<<< HEAD
    if(loader) loader.style.display = 'block';
=======
    loader.style.display = 'block';
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
    
    const start = await getCoords(document.getElementById('startInput').value);
    const end = await getCoords(document.getElementById('endInput').value);

<<<<<<< HEAD
    if (!start || !end) { alert("Градът не е намерен!"); if(loader) loader.style.display = 'none'; return; }
=======
    if (!start || !end) { alert("Градът не е намерен!"); loader.style.display = 'none'; return; }
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09

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

        // Обновяване на таблото с данни
        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

<<<<<<< HEAD
        // Еко изчисления
=======
        // КОРЕКЦИЯ НА ЕКО РЕЙТИНГА: По-реалистична скала
<<<<<<< HEAD
        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.08 : transport === 'bike' ? 0 : 0.14;
=======
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.03 : transport === 'bike' ? 0 : 0.14;
>>>>>>> 1c4d852344706ca22bd7f7760f2d12359846ec2b
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

<<<<<<< HEAD
        let score = (transport === 'bike') ? 100 : Math.max(10, 100 - (co2 * 2.5));
=======
        //BIKE
        let score = 100;
        if (transport !== 'bike') {
            score = 100 - (co2 * 2.5); 
            if (transport === 'bus' || transport === 'electric') score += 20; // Бонус за еко транспорт
        }
        
        score = Math.max(10, Math.min(100, score)); // Минимум 10% вместо 5%
        
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
        const bar = document.getElementById('scoreBar');
        bar.style.width = score + "%";
        document.getElementById('scoreText').innerText = Math.round(score) + "%";
        bar.style.backgroundColor = score > 75 ? "#2d6a4f" : score > 40 ? "#f39c12" : "#d9534f";

        fetchPOIs(data.features[0].geometry);
<<<<<<< HEAD
    } catch (e) { console.error(e); } finally { if(loader) loader.style.display = 'none'; }
}

// 4. Търсене на обекти (POIs)
=======
    } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
}

// 3. Fetch POIs - АГРЕСИВНО ОПТИМИЗИРАНО за избягване на Error 400
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    if (!selected.length) { 
<<<<<<< HEAD
        list.innerHTML = '<p class="text-center small opacity-50">Изберете категория...</p>'; 
=======
        list.innerHTML = '<p class="text-center small text-muted">Изберете категория...</p>'; 
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
        markersGroup.clearLayers(); 
        return; 
    }

<<<<<<< HEAD
    // Оптимизация на точките за API заявката
    const step = Math.max(1, Math.ceil(routeGeo.coordinates.length / 40));
=======
    // КЛЮЧОВАТА ПОПРАВКА: Ограничаваме масива до МАКСИМУМ 40 точки, 
    // независимо колко е дълъг маршрута.
    const totalPoints = routeGeo.coordinates.length;
    const step = Math.max(1, Math.ceil(totalPoints / 40)); 
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
    const simpleCoords = routeGeo.coordinates.filter((_, i) => i % step === 0);

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                request: "pois", 
<<<<<<< HEAD
                geometry: { geojson: { type: "LineString", coordinates: simpleCoords }, buffer: 1000 },
=======
                geometry: { 
                    geojson: { type: "LineString", coordinates: simpleCoords }, 
                    buffer: 1000 // Увеличаваме буфера на 1км, тъй като точките са по-редки
                },
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
                filters: { category_group_ids: selected }, 
                limit: 40 
            })
        });
        
        const data = await res.json();
<<<<<<< HEAD
        list.innerHTML = '';
        markersGroup.clearLayers();

        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-center small">Няма обекти наблизо.</p>';
            return;
        }

        data.features.forEach(poi => {
            const name = poi.properties.osm_tags?.name || "Обект";
=======
        
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
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<strong>${name}</strong>`;
<<<<<<< HEAD
=======
            
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
            div.onclick = () => { 
                map.flyTo(coords, 16); 
                L.popup().setLatLng(coords).setContent(name).openOn(map); 
            };
            list.appendChild(div);
            
<<<<<<< HEAD
            L.circleMarker(coords, { radius: 7, fillColor: "#f39c12", color: "#fff", weight: 2, fillOpacity: 0.9 }).addTo(markersGroup);
        });
    } catch (e) { console.error(e); }
}

// Event listeners за чекбоксовете
document.querySelectorAll('.poi-check').forEach(cb => {
    cb.onchange = () => {
        if (routeLayer) fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
    };
});
=======
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
>>>>>>> 96099b5b58f9574b2649ffd500b2242cca63ba09
