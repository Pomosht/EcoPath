const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

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
        
        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        routeLayer = L.geoJSON(data, { style: { color: '#2d6a4f', weight: 5 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

        const summary = data.features[0].properties.summary;
        const distKM = summary.distance / 1000;
        
        document.getElementById('distVal').innerText = Math.round(distKM);
        formatTime(summary.duration);
        
        let co2Factor = 0.14; let score = 40;
        if (transport === 'electric') { co2Factor = 0.05; score = 90; }
        else if (transport === 'bus') { co2Factor = 0.03; score = 85; }
        else if (transport === 'bike') { co2Factor = 0; score = 100; }
        
        document.getElementById('co2Val').innerText = (distKM * co2Factor).toFixed(1);
        document.getElementById('scoreText').innerText = score + "%";
        document.getElementById('scoreBar').style.width = score + "%";

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
                geometry: { geojson: routeGeo, buffer: 1500 },
                filters: { category_group_ids: selectedCats }, 
                limit: 15 
            })
        });
        
        const data = await res.json();
        list.innerHTML = '';
        markersGroup.clearLayers();
        
        data.features.forEach(poi => {
            const name = poi.properties.osm_tags?.name || "Обект";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<strong>${name}</strong>`;
            div.onclick = () => {
                map.flyTo(coords, 15);
                L.popup().setLatLng(coords).setContent(name).openOn(map);
            };
            list.appendChild(div);

            L.circleMarker(coords, { radius: 7, fillColor: "#f39c12", color: "#e67e22", fillOpacity: 0.9 }).addTo(markersGroup);
        });
    } catch (e) { console.error(e); }
}

document.querySelectorAll('.poi-check').forEach(cb => {
    cb.addEventListener('change', () => {
        if (routeLayer) fetchPOIs(routeLayer.toGeoJSON().features[0].geometry);
    });
});