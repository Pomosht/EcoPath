// Функция за събиране на избраните категории
function getSelectedCategories() {
    const checkboxes = document.querySelectorAll('.poi-filter:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

async function fetchPOIs() {
    // Вземаме геометрията на текущия маршрут
    if (!routeLayer) return;
    const routeGeo = routeLayer.toGeoJSON().features[0].geometry;
    
    const categories = getSelectedCategories();
    const list = document.getElementById('poiList');
    markersGroup.clearLayers(); // Изчистваме старите маркери

    if (categories.length === 0) {
        list.innerHTML = '<p class="text-muted small">Изберете категория горе...</p>';
        return;
    }

    const poiUrl = `https://api.openrouteservice.org/pois`;
    const body = {
        request: "pois",
        geometry: { geojson: routeGeo, buffer: 1000 }, // 1000 метра около маршрута
        filters: { category_group_ids: categories, limit: 20 }
    };

    try {
        const res = await fetch(poiUrl, {
            method: 'POST',
            headers: { 'Authorization': ORS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        list.innerHTML = '';

        if (!data.features || data.features.length === 0) {
            list.innerHTML = '<p class="text-muted small">Няма открити обекти в тази зона.</p>';
            return;
        }

        data.features.forEach(poi => {
            const name = poi.properties.osm_tags.name || "Обект без име";
            const coords = [poi.geometry.coordinates[1], poi.geometry.coordinates[0]];
            
            // Добавяме в списъка вляво
            const div = document.createElement('div');
            div.className = 'poi-item';
            div.innerHTML = `<b>${name}</b><small>${poi.properties.osm_tags.amenity || ''}</small>`;
            div.onclick = () => {
                map.setView(coords, 16);
                L.popup().setLatLng(coords).setContent(name).openOn(map);
            };
            list.appendChild(div);

            // Добавяме маркер на картата
            L.circleMarker(coords, { 
                radius: 8, 
                color: '#e67e22', // Оранжев цвят за обектите, за да се отличават
                fillColor: '#f39c12',
                fillOpacity: 1 
            }).addTo(markersGroup).bindPopup(name);
        });
    } catch (e) { 
        console.error("POI error:", e); 
    }
}

// Добавяме слушатели на чекбоксовете, за да обновяват картата веднага
document.querySelectorAll('.poi-filter').forEach(checkbox => {
    checkbox.addEventListener('change', fetchPOIs);
});
