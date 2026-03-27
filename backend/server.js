import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const app = express();
const PORT = 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// 1. ГЕОКОДИРАНЕ (OSM Nominatim)
app.get('/api/geocode', async (req, res) => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(req.query.q)}&limit=1`;
        const response = await fetch(url, { headers: { 'User-Agent': 'EcoPath-App-Kosi' } });
        const data = await response.json();
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

// 2. МАРШРУТ (OSRM)
app.post('/api/directions', async (req, res) => {
    try {
        const { coordinates, transport } = req.body;
        const profile = (transport === 'bike') ? 'bicycle' : 'driving';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${coordinates[0][0]},${coordinates[0][1]};${coordinates[1][0]},${coordinates[1][1]}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.code !== 'Ok') return res.status(400).json({ error: 'Route not found' });
        res.json(data.routes[0]);
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// 3. ОБЕКТИ (Overpass API - Брониран вариант)
app.post('/api/pois', async (req, res) => {
    try {
        const { geometry, categories } = req.body;
        if (!geometry || !categories || categories.length === 0) return res.json([]);

        const lats = geometry.coordinates.map(c => c[1]);
        const lons = geometry.coordinates.map(c => c[0]);
        const bbox = `${Math.min(...lats) - 0.002},${Math.min(...lons) - 0.002},${Math.max(...lats) + 0.002},${Math.max(...lons) + 0.002}`;

        const filters = {
            'restaurants': 'nwr["amenity"~"restaurant|cafe"]',
            'hotels': 'nwr["tourism"~"hotel|guest_house"]',
            'culture': 'nwr["tourism"~"museum|gallery"]',
            'churches': 'nwr["amenity"="place_of_worship"]',
            'nature': 'nwr["natural"~"peak|spring"];nwr["tourism"="viewpoint"]',
            'sights': 'nwr["tourism"="attraction"];nwr["historic"~"monument"]'
        };

        let queryBody = "";
        categories.forEach(cat => {
            if (filters[cat]) {
                filters[cat].split(';').forEach(f => { queryBody += `${f}(${bbox});`; });
            }
        });

        const finalQuery = `[out:json][timeout:25];(${queryBody});out center 40;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(finalQuery)}`;

        const response = await fetch(url);
        const text = await response.text();

        if (!text.trim().startsWith('{')) return res.json([]);

        const data = JSON.parse(text);
        const formatted = data.elements ? data.elements.filter(el => el.tags?.name).map(el => ({
            lat: el.lat || el.center?.lat,
            lon: el.lon || el.center?.lon,
            tags: { name: el.tags.name, amenity: el.tags.amenity || el.tags.tourism || "забележителност" }
        })).filter(i => i.lat && i.lon) : [];

        res.json(formatted);
    } catch (e) { res.json([]); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '../frontend/ecopath.html')); });
app.listen(PORT, () => console.log(`🚀 Сървърът е активен: http://localhost:${PORT}`));
