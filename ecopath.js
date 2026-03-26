const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0='; 

const map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

let routeLayer = null;
const markersGroup = L.layerGroup().addTo(map);

// Функцията, която ни спасява от Error 429
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function getCoords(city) {
    try {
        await sleep(1100); // Пауза от 1.1 сек (Nominatim иска макс 1 заявка/сек)
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'EcoPath_Student_Project' } });
        const data = await res.json();
        return data.length > 0 ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch (e) { return null; }
}

async function calculateRoute() {
    const loader = document.getElementById('loader');
    const btn = document.getElementById('routeBtn');
    loader.style.display = 'block'; btn.disabled = true;

    const startVal = document.getElementById('startInput').value;
    const endVal = document.getElementById('endInput').value;
    const transport = document.getElementById('transportMode').value;

    const start = await getCoords(startVal);
    const end = await getCoords(endVal); // Тази заявка ще се изчака автоматично заради sleep вътре

    if (!start || !end) {
        alert("Градът не е намерен! Изчакайте 5 сек и опитайте пак.");
        loader.style.display = 'none'; btn.disabled = false;
        return;
    }

    const profile = transport === 'bike' ? 'cycling-regular' : 'driving-car';
    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${ORS_API_KEY}&start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const geom = data.features[0].geometry;
        const prop = data.features[0].properties.summary;

        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        routeLayer = L.geoJSON(geom, { style: { color: transport === 'bike' ? '#2d6a4f' : '#d90429', weight: 5 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds());

        const dist = (prop.distance / 1000).toFixed(1);
        document.getElementById('distVal').innerText = dist;
        document.getElementById('timeVal').innerText = Math.round(prop.duration / 60) + "м";
        
        // CO2 логика
        let factor = 0.14; if(transport === 'electric') factor = 0.05; if(transport === 'bike') factor = 0;
        document.getElementById('co2Val').innerText = (dist * factor).toFixed(1);
        
        fetchPOIs();
    } catch (e) { alert("Грешка при маршрута."); }
    finally { loader.style.display = 'none'; btn.disabled = false; }
}

async function fetchPOIs() {
    if (!routeLayer) return;
    const cats = Array.from(document.querySelectorAll('.poi-check:checked')).map(c => c.value);
    if (cats.length === 0) return;

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request: "pois",
                geometry: { geojson: routeLayer.toGeoJSON().features[0].geometry, buffer: 1000 },
                filters: { category_group_ids: cats.map(Number) },
                limit: 10
            })
        });
        const data = await res.json();
        const list = document.getElementById('poiList');
        list.innerHTML = "";
        data.features.forEach(f => {
            const name = f.properties.osm_tags.name || "Обект";
            const item = document.createElement('div');
            item.className = "poi-item"; item.innerText = name;
            item.onclick = () => map.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 15);
            list.appendChild(item);
        });
    } catch (e) { console.log("POI Error"); }
}
