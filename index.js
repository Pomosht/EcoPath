var map = L.map('map').setView([42.6977, 23.3219], 13); // Координати за София

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
