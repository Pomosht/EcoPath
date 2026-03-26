// 1. Инициализираме картата с временни координати
var map = L.map('map').setView([0, 0], 2); 

// 2. Добавяме слой с карта (OpenStreetMap)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// 3. Използваме метода на Leaflet за геолокация
map.locate({setView: true, maxZoom: 16});

// 4. Функция, която се изпълнява при успешно локализиране
function onLocationFound(e) {
    var radius = e.accuracy / 2;

    // Добавяме маркер на точното място
    L.marker(e.latlng).addTo(map)
        .bindPopup("Вие сте в радиус от " + radius + " метра от тази точка").openPopup();

    // Добавяме кръг, показващ точността на локацията
    L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);

// 5. Функция за грешка (ако потребителят откаже достъп)
function onLocationError(e) {
    alert("Неуспешно определяне на местоположението: " + e.message);
    // При грешка можем да центрираме картата на София по подразбиране
    map.setView([42.6977, 23.3219], 13);
}

function onLocationError(e) {
    if (e.code === 1) { // Error code 1 е "Permission Denied"
        alert("Моля, разрешете достъп до местоположението от настройките на браузъра си, за да видите екопътеките около вас.");
    } else {
        alert("Грешка при локализиране: " + e.message);
    }
    // Центрираме по подразбиране в София, за да не остане празен екран
    map.setView([42.6977, 23.3219], 13);
}

map.on('locationerror', onLocationError);
