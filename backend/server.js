import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 1. ГЕОКОДИРАНЕ
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

// 3. ОБЕКТИ (Overpass API - Max 20)
app.post('/api/pois', async (req, res) => {
    try {
        const { geometry, categories } = req.body;
        if (!categories || categories.length === 0) return res.json([]);

        const coords = geometry.coordinates;
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        coords.forEach(([lon, lat]) => {
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        });

        const bbox = `${minLat - 0.01},${minLon - 0.01},${maxLat + 0.01},${maxLon + 0.01}`;
        const tagMap = {
            restaurants: 'node["amenity"~"restaurant|cafe"]',
            culture: 'node["amenity"~"museum|theater|arts_centre"]',
            churches: 'node["amenity"="place_of_worship"]',
            hotels: 'node["tourism"~"hotel|hostel"]',
            nature: 'node["leisure"~"park|nature_reserve"]',
            sights: 'node["tourism"~"attraction|viewpoint"]'
        };

        let query = `[out:json][timeout:25];(`;
        categories.forEach(cat => { if (tagMap[cat]) query += `${tagMap[cat]}(${bbox});`; });
        query += `);out body 20;`;

        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await response.json();
        res.json(data.elements || []);
    } catch (e) { res.json([]); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/ecopath.html')));
app.listen(PORT, () => console.log(`🚀 Сървър: http://localhost:${PORT}`));
