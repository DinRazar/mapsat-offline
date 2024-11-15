// Оффлайн версия
var map = L.map('map').setView([55.755811, 37.617617], 11);
L.tileLayer('data/Tiles/{z}/{x}/{y}.png', {
    maxZoom: 13,                                                                          
    minZoom: 3,
    tileSize: 256,                                                                            
    zoomOffset: 0,
    attribution: 'Тестовая карта'
}).addTo(map);
        
// отключение флага, что?
map.attributionControl.setPrefix(false)

let lastMarker; // переменная для маркера, создающегося по клику
let markerFromDB; // переменная для маркера из базы данных
let geodesic; // переменная для геодезической линии между lastMarker и markerFromDB
let thirdMarker; // переменная для маркера дрона
let thirdGeodesic; // переменная для геодезической линии между lastMarker и thirdMarker

// обработчик нажатия по карте
map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    // создание маркера 
    if (lastMarker) {
        map.removeLayer(lastMarker);
    }
    lastMarker = L.marker([lat, lng], {
        draggable: true
        }).addTo(map);
        lastMarker.on('drag', updateGeodesicAndCalculations);
        updateGeodesicAndCalculations();
        document.getElementById('addPointButton').disabled = false;
    });

// обработчик запросов на сервер
fetch('http://localhost:3000/data')
    .then(response => response.json())
    .then(data => {
        const dropdown = document.getElementById('dataDropdown');
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.Names;
            option.dataset.latitude = item.latitude;
            option.dataset.longitude = item.longitude;
            dropdown.appendChild(option);
        });

        dropdown.addEventListener('change', (event) => {
            const selectedOption = event.target.selectedOptions[0];
            const latitude = selectedOption.dataset.latitude;
            const longitude = selectedOption.dataset.longitude;

            // создание маркера по координатам с сервера
            if (markerFromDB) {
                map.removeLayer(markerFromDB);
            }
                markerFromDB = L.marker([latitude, longitude]).addTo(map).bindPopup(selectedOption.textContent);
                updateGeodesicAndCalculations();
            });
        })
        .catch(error => console.error('Ошибка загрузки данных:', error));
        
// функция для создания геодезических линий
function updateGeodesicAndCalculations() {
    if (geodesic) {
        map.removeLayer(geodesic);
    }
    if (lastMarker && markerFromDB) {
        geodesic = L.geodesic([lastMarker.getLatLng(), markerFromDB.getLatLng()], {         // между точкой (по клику) и из БД
            weight: 3,
            opacity: 1,
            color: 'blue',
            steps: 50
        }).addTo(map);

    // Выполнение расчетов
    performCalculations();
    }
        if (thirdMarker) {
            if (thirdGeodesic) {
                map.removeLayer(thirdGeodesic);
            }
            thirdGeodesic = L.geodesic([lastMarker.getLatLng(), thirdMarker.getLatLng()], {     // между точкой (по клику) и созданной при помощи кнопки
                weight: 3,
                opacity: 1,
                color: 'red',
                steps: 50
            }).addTo(map);
        }
    }

    // настройка визувльного стиля маркера
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
                thirdMarker.on('drag', updateGeodesicAndCalculations); // Обновляем геодезическую линию при перемещении третьего маркера
                // Показ поля ввода высоты и его активация
                const heightInput = document.getElementById('heightInput');
                heightInput.style.display = 'block';
                heightInput.disabled = false;
                // Показ кнопки подтверждения и её активация
                const confirmHeightButton = document.getElementById('confirmHeightButton');
                confirmHeightButton.style.display = 'block';
                confirmHeightButton.disabled = false;
            }
            // Обновляем геодезическую линию после добавления или удаления третьего маркера
            updateGeodesicAndCalculations();
        } else {
            alert('Невозможно добавить точку, так как геодезическая линия не существует.');
        }
});

document.getElementById('confirmHeightButton').addEventListener('click', function () {
    const height = parseFloat(document.getElementById('heightInput').value);

    // высота антены, в будущем это как-то должно поменяться
    const antennaHeight = 10;    

    const visibilityDistance = calculateVisibilityDistance(antennaHeight, height);
    alert(`Расстояние прямой видимости: ${visibilityDistance.toFixed(2)} км`);
});

// прямая видимость 
function calculateVisibilityDistance(antennaHeight, transmitterHeight) {
    return 3.57 * (Math.sqrt(antennaHeight) + Math.sqrt(transmitterHeight));
};

// подсчёт поляризации, угла места, угла поворота коныектора, истинного и магнитного азимутов

function performCalculations() {
    if (lastMarker && markerFromDB) {
        const lat1 = lastMarker.getLatLng().lat;
        const lon1 = lastMarker.getLatLng().lng;
        const satLat = markerFromDB.getLatLng().lat;
        const satLon = markerFromDB.getLatLng().lng;
        const toDegrees = (radians) => radians * (180 / Math.PI);

        // Поляризация
        const rad = Math.PI / 180;
        const a = Math.sin((lon1 - satLon) / rad);
        const b = Math.tan(lat1 / rad);
        const polarization = Math.atan2(a, b);
        const polarizationText = `Поляризация: ${polarization.toFixed(2)}°`;

        // Угол места
        const angle = Math.atan((Math.cos(lon1 * rad) * Math.cos(lat1 * rad) - 0.151) / Math.sqrt(1 - Math.pow(Math.cos(lon1 * rad), 2) * Math.pow(Math.cos(lat1 * rad), 2))) / rad;
        const elevationAngleText = `Угол места: ${angle.toFixed(2)}°`;

        // Угол поворота конвектора
        const convectorAngle = (Math.atan(Math.sin(lon1 * rad - satLon * rad) / Math.tan(lat1 * rad))) / rad;
        const convectorAngleText = `Угол поворота конвектора: ${convectorAngle.toFixed(2)}°`;

        // Истинный азимут
        const TrueAzimuth = Math.atan2(Math.sin((satLon - lon1) * rad) * Math.cos(satLat * rad), Math.cos(lat1 * rad) * Math.sin(satLat * rad) - Math.sin(lat1 * rad) * Math.cos(satLat * rad) * Math.cos((satLon - lon1) * rad)) ;
        const TrueAzimuthD = (toDegrees(TrueAzimuth) + 360) % 360;
        const TrueAzimuthText = `Истинный азимут: ${TrueAzimuthD.toFixed(2)}°`;

        // Магнитный азимут
        const geomagData = geomag.field(lat1, lon1);
        const magneticDeclination = geomagData.declination;
        const MagneticAzimuth = (TrueAzimuthD - magneticDeclination + 360) % 360;
        const MagneticAzimuthText = `Магнитный азимут: ${MagneticAzimuth.toFixed(2)}°`;

        // Обновление результатов на странице
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = `
            <div class="result-item">${polarizationText}</div>
            <div class="result-item">${elevationAngleText}</div>
            <div class="result-item">${convectorAngleText}</div>
            <div class="result-item">${TrueAzimuthText}</div>
            <div class="result-item">${MagneticAzimuthText}</div>
            `;
    } else {
        alert('Точки для расчета не выбраны.');
    }
};