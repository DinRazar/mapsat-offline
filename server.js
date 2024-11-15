const express = require('express');
const xlsx = require('xlsx');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors()); // Разрешаем CORS для взаимодействия с клиентом

// Чтение данных из Excel и конвертация в JSON

app.get('/data', (req, res) => {
    const workbook = xlsx.readFile('sput.xlsx');
    const sheetName = workbook.SheetNames[0]; // Используем первый лист
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet); // Конвертируем в JSON
    res.json(jsonData); // Отправляем JSON на клиент

});

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));


