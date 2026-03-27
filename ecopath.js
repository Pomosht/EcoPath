const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

<<<<<<< HEAD
=======
// Инициализация на картата
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data.length > 0 ? { lat: data[0].lat, lon: data[0].lon } : null;
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
            body: JSON.stringify({ coordinates: [[start.lon, start.lat], [end.lon, end.lat]] })
        });

        const data = await response.json();
        
<<<<<<< HEAD
=======
        // Изчистване на стари данни
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        routeLayer = L.geoJSON(data, { style: { color: '#2d6a4f', weight: 5 } }).addTo(map);
<<<<<<< HEAD
        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
=======
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2

        const summary = data.features[0].properties.summary;
        const distKM = summary.distance / 1000;
        
<<<<<<< HEAD
        document.getElementById('distVal').innerText = Math.round(distKM);
        formatTime(summary.duration);
        
=======
        // Статистика
        document.getElementById('distVal').innerText = Math.round(distKM);
        formatTime(summary.duration);
        
        // Еко рейтинг
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
        let co2Factor = 0.14; let score = 40;
        if (transport === 'electric') { co2Factor = 0.05; score = 90; }
        else if (transport === 'bus') { co2Factor = 0.03; score = 85; }
        else if (transport === 'bike') { co2Factor = 0; score = 100; }
        
        document.getElementById('co2Val').innerText = (distKM * co2Factor).toFixed(1);
        document.getElementById('scoreText').innerText = score + "%";
        document.getElementById('scoreBar').style.width = score + "%";

<<<<<<< HEAD
=======
        // Зареждане на POI
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
        fetchPOIs(data.features[0].geometry);

    } catch (e) {
        alert("Грешка при маршрута.");
    } finally {
        loader.style.display = 'none';
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    document.getElementById('timeVal').innerText = `${hours}ч ${minutes}м`;
}

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
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                request: "pois", 
<<<<<<< HEAD
                geometry: { geojson: routeGeo, buffer: 1500 },
=======
                geometry: { geojson: routeGeo, buffer: 1500 }, // 1.5km около пътя
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
                filters: { category_group_ids: selectedCats }, 
                limit: 15 
            })
        });
        
        const data = await res.json();
        list.innerHTML = '';
        markersGroup.clearLayers();
        
        data.features.forEach(poi => {
<<<<<<< HEAD
            const name = poi.properties.osm_tags?.name || "Обект";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<strong>${name}</strong>`;
            div.onclick = () => {
                map.flyTo(coords, 15);
                L.popup().setLatLng(coords).setContent(name).openOn(map);
=======
            const name = poi.properties.osm_tags?.name || "Интересно място";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            // Създаване на елемент в списъка
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<strong>${name}</strong>`;
            
            // При клик на името -> Преместване на камерата към маркера
            div.onclick = () => {
                map.flyTo(coords, 16, { animate: true, duration: 1.5 });
                L.popup().setLatLng(coords).setContent(`<b>${name}</b>`).openOn(map);
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
            };
            
            list.appendChild(div);

<<<<<<< HEAD
            L.circleMarker(coords, { radius: 7, fillColor: "#f39c12", color: "#e67e22", fillOpacity: 0.9 }).addTo(markersGroup);
        });
    } catch (e) { console.error(e); }
}

=======
            // Оранжев маркер на картата
            L.circleMarker(coords, {
                radius: 8,
                fillColor: "#f39c12",
                color: "#e67e22",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(markersGroup).bindPopup(name);
        });

        if (data.features.length === 0) {
            list.innerHTML = '<p class="text-muted small text-center">Няма открити обекти.</p>';
        }

    } catch (e) {
        console.error("POI error", e);
    }
}

// Следене за промени в чекбоксовете в реално време
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
document.querySelectorAll('.poi-check').forEach(cb => {
    cb.addEventListener('change', () => {
        if (routeLayer) fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
    });
<<<<<<< HEAD
});
=======
});
>>>>>>> ac780f3ec133c595fe13b89b93d0a37b6b040ce2
