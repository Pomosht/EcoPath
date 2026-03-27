const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

// LIGHT MODE - Standard OpenStreetMap
const standardTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

// DARK MODE - Voyager (lighter, more visible dark theme)
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

// Alternative: Positron (very light gray, great visibility)
const positronTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

// Alternative: Dark Matter Lite (more visible than pure dark)
const darkMatterLite = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    className: 'map-tiles-bright'
});

// Default to standard geographic view
standardTiles.addTo(map);

// Theme Toggle functionality
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        
        // Switch map tiles based on theme
        if (isDark) {
            map.removeLayer(standardTiles);
            // Use filtered light tiles for better visibility instead of pure dark
            positronTiles.addTo(map);
            // Add CSS filter to make it slightly darker but still visible
            document.getElementById('map').classList.add('dark-map-filter');
        } else {
            map.removeLayer(positronTiles);
            map.removeLayer(darkTiles);
            standardTiles.addTo(map);
            document.getElementById('map').classList.remove('dark-map-filter');
        }
    };
}

async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
}

// Calculate Route
async function calculateRoute() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    
    const start = await getCoords(document.getElementById('startInput').value);
    const end = await getCoords(document.getElementById('endInput').value);

    if (!start || !end) { alert("Градът не е намерен!"); loader.style.display = 'none'; return; }

    const transport = document.getElementById('transportMode').value;
    const profile = transport === 'bike' ? 'cycling-regular' : 'driving-car';

    try {
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coordinates: [[parseFloat(start.lon), parseFloat(start.lat)], [parseFloat(end.lon), parseFloat(end.lat)]]
            })
        });
        const data = await response.json();
        
        if (routeLayer) map.removeLayer(routeLayer);
        markersGroup.clearLayers();

        // Route styling - bright green for visibility in both modes
        const isDark = document.body.classList.contains('dark-mode');
        routeLayer = L.geoJSON(data, { 
            style: { 
                color: isDark ? '#00ff88' : '#22c55e', // Bright neon green for dark mode
                weight: 5,
                opacity: 1,
                dashArray: '8, 6',
                lineCap: 'round',
                lineJoin: 'round'
            } 
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        const summary = data.features[0].properties.summary;
        const distKm = summary.distance / 1000;
        document.getElementById('distVal').innerText = Math.round(distKm);
        document.getElementById('timeVal').innerText = `${Math.floor(summary.duration/3600)}ч ${Math.floor((summary.duration%3600)/60)}м`;

        // CO2 Calculation
        let factor = transport === 'electric' ? 0.05 : transport === 'bus' ? 0.03 : transport === 'bike' ? 0 : 0.14;
        const co2 = distKm * factor;
        document.getElementById('co2Val').innerText = co2.toFixed(1);

        // Eco Score
        let score = 100;
        if (transport !== 'bike') {
            score = 100 - (co2 * 2.5); 
            if (transport === 'bus' || transport === 'electric') score += 20;
        }
        
        score = Math.max(10, Math.min(100, score));
        
        const bar = document.getElementById('scoreBar');
        const scoreText = document.getElementById('scoreText');
        bar.style.width = score + "%";
        scoreText.innerText = Math.round(score) + "%";
        
        // Update badge color
        scoreText.className = score > 75 ? 'badge bg-success' : score > 40 ? 'badge bg-warning text-dark' : 'badge bg-danger';
        bar.className = score > 75 ? 'progress-bar bg-success' : score > 40 ? 'progress-bar bg-warning' : 'progress-bar bg-danger';

        fetchPOIs(data.features[0].geometry);
    } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
}

// Fetch POIs
async function fetchPOIs(routeGeo) {
    const selected = Array.from(document.querySelectorAll('.poi-check:checked')).map(cb => parseInt(cb.value));
    const list = document.getElementById('poiList');
    if (!selected.length) { 
        list.innerHTML = '<p class="text-muted small m-0 text-center">Изберете категория...</p>'; 
        markersGroup.clearLayers(); 
        return; 
    }

    const totalPoints = routeGeo.coordinates.length;
    const step = Math.max(1, Math.ceil(totalPoints / 40)); 
    const simpleCoords = routeGeo.coordinates.filter((_, i) => i % step === 0);

    try {
        const res = await fetch(`https://api.openrouteservice.org/pois`, {
            method: 'POST',
            headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                request: "pois", 
                geometry: { 
                    geojson: { type: "LineString", coordinates: simpleCoords }, 
                    buffer: 1000 
                },
                filters: { category_group_ids: selected }, 
                limit: 40 
            })
        });
        
        const data = await res.json();
        
        if (data.error || res.status === 400) {
            list.innerHTML = '<p class="text-center text-danger small">Грешка в заявката (твърде дълъг път).</p>';
            return;
        }

        list.innerHTML = ''; 
        markersGroup.clearLayers();
        
        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-muted small m-0 text-center">Няма обекти в този радиус.</p>';
            return;
        }

        data.features.forEach(poi => {
            const name = poi.properties.osm_tags?.name || poi.properties.osm_tags?.amenity || "Обект";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            const div = document.createElement('div');
            div.className = 'poi-item'; 
            div.innerHTML = `<strong>${name}</strong>`;
            
            div.onclick = () => { 
                map.flyTo(coords, 16); 
                L.popup().setLatLng(coords).setContent(name).openOn(map); 
            };
            list.appendChild(div);
            
            // Bright colored markers for visibility
            const isDark = document.body.classList.contains('dark-mode');
            L.circleMarker(coords, { 
                radius: 7, 
                fillColor: isDark ? "#ff6b6b" : "#3b82f6", 
                color: "#ffffff", 
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