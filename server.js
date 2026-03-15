// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const TemperatureMonitor = require('./temperatureMonitor');
const PORT = process.env.PORT || 3000;
const app = express();

require('dotenv').config();
app.use(cors());

// Дані в пам'яті
let latestData = { temperature: null, humidity: null, ts: null };
let allTemperatureData = [];
const history = []; // [{ temperature, humidity, ts }]
const HISTORY_MAX = 5000;
const monitor = new TemperatureMonitor({
    minDataPoints: 3,
    suddenChangeThreshold: 5,     // різкий перепад >5°C
    abnormalLowThreshold: 15,      // <15°C – аномалія
    abnormalHighThreshold: 30,     // >30°C – аномалія
    filterAnomalies: true,         // відкидати аномалії
    calibrationPoints: 2           // перші 2 записи завжди додаються
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/api', (req, res) => {
    try {
        const data = req.body;
        const t = parseFloat(req.body.temperature);
        const h = parseFloat(req.body.humidity);
        
        if (Array.isArray(data)) {
            // console.log(`Отримано масив з ${data.length} елементів`);
            allTemperatureData.push(...data);
            data.forEach(item => {
                if (t !== undefined) {
                    monitor.addData(t, h, item.ts);
                } else {
                    // console.log('Елемент без temperature:', item);
                }
            });
            console.log(`✅ Отримано та проаналізовано ${data.length} записів`);
        } else if (data.temperature !== undefined) {
            // console.log('Отримано одиничний об’єкт');
            allTemperatureData.push(data);
            monitor.addData(data.temperature, data.humidity, data.ts);
            // console.log('✅ Отримано та проаналізовано 1 запис');
        } else {
            console.log('❌ Невірний формат даних:', data);
        }
        
        res.status(200).json({ message: 'Дані успішно отримано', /*totalRecords: monitor*/ });
    } catch (error) {
        console.error('❌ Помилка обробки даних:', error);
        res.status(500).json({ error: 'Внутрішня помилка сервера' });
    }
});

// API: останні дані
app.get('/api/latest', (req, res) => {
  res.json(monitor.temperatureData.at(0));
});

// API: історія
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '300', 10), HISTORY_MAX);
  const slice = monitor.temperatureData.slice(-limit);
  
  res.json(slice);
});

// Статика для фронтенду
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`🔌 Сервер запущено на http://localhost:${PORT}`);
  console.log(`   Відкрий фронтенд: http://<IP_комп'ютера>:${PORT}/`);
});
