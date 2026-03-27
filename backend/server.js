import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(express.json());

// 1. Премахване на favicon грешката
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 2. API за Маршрут
app.post('/api/directions', async (req, res) => {
    try {
        const { coordinates, transport } = req.body;
        const isBike = (transport === 'bike');
        const profile = isBike ? 'bicycle' : 'driving';
        
        const endpoints = [
            `https://router.project-osrm.org/route/v1/${isBike ? 'bicycle' : 'driving'}`,
            `https://routing.openstreetmap.de/routed-${isBike ? 'bike' : 'car'}/route/v1/${profile}`
        ];

        let data = null;
        for (const baseUrl of endpoints) {
            try {
                const url = `${baseUrl}/${coordinates[0][0]},${coordinates[0][1]};${coordinates[1][0]},${coordinates[1][1]}?overview=full&geometries=geojson`;
                const response = await fetch(url, { timeout: 5000 });
                if (response.ok) {
                    data = await response.json();
                    if (data.code === 'Ok') break;
                }
            } catch (e) { continue; }
        }

        if (!data) return res.status(503).json({ error: "OSRM сървърите са заети." });

        res.json({
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: { summary: data.routes[0] },
                geometry: data.routes[0].geometry
            }]
        });
    } catch (e) {
        res.status(500).json({ error: "Server Error" });
    }
});

// 3. API за Обекти (POIs) - ПОПРАВЕНО!

app.post('/api/pois', async (req, res) => {
    try {
        const { geometry, categories } = req.body;
        if (!geometry || !categories.length) return res.json({ features: [] });

        const coords = geometry.coordinates;
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        coords.forEach(([lon, lat]) => {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
        });

        // Bounding Box с малко буфер
        const bbox = `${minLat - 0.005},${minLon - 0.005},${maxLat + 0.005},${maxLon + 0.005}`;

        const tagMap = {
            restaurants: 'node["amenity"~"restaurant|cafe|fast_food"]',
            hotels: 'node["tourism"~"hotel|motel|guest_house"]',
            nature: 'node["leisure"~"park|nature_reserve"]',
            sights: 'node["tourism"~"attraction|viewpoint"]'
        };

        // СТРОГО ПОПРАВЕНА ЗАЯВКА
        let query = `[out:json][timeout:15];(`;
        categories.forEach(cat => {
            if (tagMap[cat]) {
                query += `${tagMap[cat]}(${bbox});`;
            }
        });
        query += `);out body 10;`;

        const urls = [
            `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
            `https://overpass.openstreetmap.fr/api/interpreter?data=${encodeURIComponent(query)}`
        ];

        let poiData = null;
        for (const url of urls) {
            try {
                const response = await fetch(url, { timeout: 8000 });
                if (response.ok) {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        poiData = await response.json();
                        break;
                    }
                }
            } catch (e) { console.log("⚠️ Сървърът не отговаря, пробвам следващия..."); }
        }

        if (!poiData) return res.json({ features: [] });
        
        const features = (poiData.elements || []).map(el => ({
            type: "Feature",
            properties: { 
                name: el.tags.name || "Еко обект",
                type: el.tags.amenity || el.tags.tourism 
            },
            geometry: { type: "Point", coordinates: [el.lon, el.lat] }
        }));

        res.json({ type: "FeatureCollection", features });

    } catch (e) {
        console.error("❌ POI Error:", e.message);
        res.json({ features: [] });
    }
});


function formatPOI(data) {
    const features = (data.elements || []).map(el => ({
        type: "Feature",
        properties: { 
            name: el.tags.name || "Еко обект",
            type: el.tags.amenity || el.tags.tourism 
        },
        geometry: { type: "Point", coordinates: [el.lon, el.lat] }
    }));
    return { type: "FeatureCollection", features };
}

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/ecopath.html')));

app.listen(PORT, () => {
    console.log(`🚀 EcoPath AI е онлайн на http://localhost:${PORT}`);
});
