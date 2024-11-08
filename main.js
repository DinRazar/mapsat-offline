 // Создание карты
 var map = L.map('map').setView([55.755811, 37.617617], 11);

 map.attributionControl.setPrefix(false)

 // Добавление слоя тайлов
 L.tileLayer('data/Tiles/{z}/{x}/{y}.png', {

     maxZoom: 13,
     minZoom: 3,
     tileSize: 256,
     zoomOffset: 0,
     attribution: 'Тестовая карта'
 }).addTo(map);

 map.attributionControl.setPrefix(false);


 
 let lastMarker;     // переменная для маркера, создающегося по клику
 let markerFromDB;   // переменная для маркера из базы данных
 let geodesic;       // переменная для геодезической линии между lastMarker и markerFromDB
 let thirdMarker;    // переменная для маркера дрона
 let thirdGeodesic;  // переменная для геодезической линии меджду lastmarker и thirdMarker

 var info = L.control();
 info.onAdd = function(map) {
     this._div = L.DomUtil.create('div', 'info');
     return this._div;
 };
 info.addTo(map);

 info.update = function(stats) {
     this._div.innerHTML = '<h4>Данные</h4>' +
         '<b>Истинный азимут:</b> ' + (stats.trueAzimuth || 'N/A') + '°<br/>' +
         '<b>Магнитный азимут:</b> ' + (stats.magneticAzimuth || 'N/A') + '°';
 };

 map.on('click', function(e) {
     const lat = e.latlng.lat;
     const lng = e.latlng.lng;

     if (lastMarker) {
         map.removeLayer(lastMarker);
     }

     lastMarker = L.marker([lat, lng], {
         draggable: true
     }).addTo(map);
     lastMarker.on('drag', updateGeodesic);
     updateGeodesic();

     // Включаем кнопку добавления точки
     document.getElementById('addPointButton').disabled = false;
 });

 fetch('http://localhost:3000/data')
     .then(response => response.json())
     .then(data => {
         const dropdown = document.getElementById('dataDropdown');
         data.forEach(item => {
             const option = document.createElement('option');
             option.value = item.id;
             option.textContent = item.name;
             option.dataset.latitude = item.latitude;
             option.dataset.longitude = item.longitude;
             dropdown.appendChild(option);
         });

         dropdown.addEventListener('change', (event) => {
             const selectedOption = event.target.selectedOptions[0];
             const latitude = selectedOption.dataset.latitude;
             const longitude = selectedOption.dataset.longitude;

             if (markerFromDB) {
                 map.removeLayer(markerFromDB);
             }

             markerFromDB = L.marker([latitude, longitude]).addTo(map).bindPopup(selectedOption.textContent);
             updateGeodesic();
         });
     })
     .catch(error => console.error('Ошибка загрузки данных:', error));

 function updateGeodesic() {
     if (geodesic) {
         map.removeLayer(geodesic);
     }

     if (lastMarker && markerFromDB) {
         geodesic = L.geodesic([lastMarker.getLatLng(), markerFromDB.getLatLng()], {
             weight: 3,
             opacity: 1,
             color: 'blue',
             steps: 50
         }).addTo(map);

         const lat1 = lastMarker.getLatLng().lat;
         const lon1 = lastMarker.getLatLng().lng;
         const lat2 = markerFromDB.getLatLng().lat;
         const lon2 = markerFromDB.getLatLng().lng;

         const trueAzimuth = calculateTrueAzimuth(lat1, lon1, lat2, lon2);
         const magneticDeclination = 12;
         const magneticAzimuth = calculateMagneticAzimuth(trueAzimuth, magneticDeclination);

         info.update({
             totalDistance: geodesic.statistics.totalDistance,
             trueAzimuth: trueAzimuth.toFixed(2),
             magneticAzimuth: magneticAzimuth.toFixed(2)
         });
     }

     // Обновляем геодезическую линию между lastMarker и thirdMarker, если он существует
     if (thirdMarker) {
         if (thirdGeodesic) {
             map.removeLayer(thirdGeodesic);
         }
         thirdGeodesic = L.geodesic([lastMarker.getLatLng(), thirdMarker.getLatLng()], {
             weight: 3,
             opacity: 1,
             color: 'red',
             steps: 50
         }).addTo(map);
     }
 }

 function calculateTrueAzimuth(lat1, lon1, lat2, lon2) {
     const toRadians = (degrees) => degrees * (Math.PI / 180);
     const toDegrees = (radians) => radians * (180 / Math.PI);

     const deltaLon = toRadians(lon2 - lon1);
     lat1 = toRadians(lat1);
     lat2 = toRadians(lat2);

     const y = Math.sin(deltaLon) * Math.cos(lat2);
     const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
     const azimuth = Math.atan2(y, x);

     return (toDegrees(azimuth) + 360) % 360; // Возвращаем значение в диапазоне [0, 360)
 }

 function calculateMagneticAzimuth(trueAzimuth, magneticDeclination) {
     return (trueAzimuth + magneticDeclination + 360) % 360; // Возвращаем значение в диапазоне [0, 360)
 }

 // Создание новой иконки для третьего маркера
 const thirdMarkerIcon = L.icon({
     iconUrl: 'data/dron.png',
     iconSize: [25, 25],
     iconAnchor: [12.5, 12.5],
 });

 // Обработчик нажатия на кнопку добавления точки
 document.getElementById('addPointButton').addEventListener('click', function() {
     if (geodesic) {
         const newPointLatLng = lastMarker.getLatLng();

         // Проверяем, существует ли третий маркер
         if (thirdMarker) {
             // Если третий маркер существует, удаляем его
             map.removeLayer(thirdMarker);
             thirdMarker = null; // Устанавливаем thirdMarker в null
             if (thirdGeodesic) {
                 map.removeLayer(thirdGeodesic);
                 thirdGeodesic = null; // Устанавливаем thirdGeodesic в null
             }
             // Скрываем поле ввода и очищаем его
             const heightInput = document.getElementById('heightInput');
             heightInput.style.display = 'none';
             heightInput.disabled = true;
             heightInput.value = '';

             // Скрываем кнопку подтверждения
             const confirmHeightButton = document.getElementById('confirmHeightButton');
             confirmHeightButton.style.display = 'none';
             confirmHeightButton.disabled = true;
         } else {
             // Если третьего маркера нет, добавляем его
             thirdMarker = L.marker(newPointLatLng, {
                 icon: thirdMarkerIcon, // Применяем новую иконку
                 draggable: true
             }).addTo(map);
             thirdMarker.on('drag', updateGeodesic); // Обновляем геодезическую линию при перемещении третьего маркера

             // Показываем поле ввода высоты и активируем его
             const heightInput = document.getElementById('heightInput');
             heightInput.style.display = 'block';
             heightInput.disabled = false;

             // Показываем кнопку подтверждения и активируем ее
             const confirmHeightButton = document.getElementById('confirmHeightButton');
             confirmHeightButton.style.display = 'block';
             confirmHeightButton.disabled = false;
         }

         // Обновляем геодезическую линию после добавления или удаления третьего маркера
         updateGeodesic();
     } else {
         alert('Невозможно добавить точку, так как геодезическая линия не существует.');
     }
 });

 // Обработчик нажатия на кнопку подтверждения высоты
 document.getElementById('confirmHeightButton').addEventListener('click', function() {
     const height = document.getElementById('heightInput').value;
     console.log(`Высота дрона: ${height} м`);
 });