const API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVlY2M5ZDQzYzg1OTQwYzBhMzUyNmMyMGQ2ZWY2MDNmIiwiaCI6Im11cm11cjY0In0=';

var map = L.map('map', { zoomControl: false }).setView([42.6977, 23.3219], 7);
var routeLayer = null;
var markersGroup = L.layerGroup().addTo(map);

// GEOGRAPHIC MAP TILES
const standardTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
});

const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
});

const topoTiles = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; OpenStreetMap'
});

// Default layer
standardTiles.addTo(map);

// --- ЗАМЕНЕНА ЧАСТ: DARK MODE LOGIC ---
function toggleDarkMode() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    
    body.classList.toggle('dark-mode');
    
    const isDark = body.classList.contains('dark-mode');
    
    if (isDark) {
        if (icon) icon.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
        localStorage.setItem('theme', 'dark');
        
        // Превключване на картата към Dark
        map.removeLayer(standardTiles);
        darkTiles.addTo(map);
    } else {
        if (icon) icon.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
        localStorage.setItem('theme', 'light');
        
        // Превключване на картата към Light
        map.removeLayer(darkTiles);
        standardTiles.addTo(map);
    }

    // Актуализиране на стила на маршрута ако съществува
    if (routeLayer) {
        routeLayer.setStyle({
            color: isDark ? '#4ade80' : '#22c55e'
        });
    }
}

// Проверка за запазена тема при зареждане
window.onload = () => {
    if (localStorage.getItem('theme') === 'dark') {
        toggleDarkMode();
    }
};
// --- КРАЙ НА ЗАМЕНЕНАТА ЧАСТ ---

async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
}

async function