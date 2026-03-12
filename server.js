// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
app.use(cors({
  // origin: 'http://127.0.0.1:5500' // або твій фронтенд IP/порт
  origin: 'https://romashka-devise.yzz.me' // або твій фронтенд IP/порт
}));

// Дані в пам'яті
let latestData = { temperature: null, humidity: null, ts: null };
const history = []; // [{ temperature, humidity, ts }]
const HISTORY_MAX = 5000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Прийом даних від ESP8266 (x-www-form-urlencoded або JSON)
app.post('/api', (req, res) => {
  const t = parseFloat(req.body.temperature);
  const h = parseFloat(req.body.humidity);
  const entry = {
    temperature: Number.isFinite(t) ? t : null,
    humidity: Number.isFinite(h) ? h : null,
    ts: Date.now()
  };

  latestData = entry;
  history.push(entry);
  if (history.length > HISTORY_MAX) history.shift();

  console.log('📡 Дані від ESP:', entry);
  res.json({ ok: true });
});

// API: останні дані
app.get('/api/latest', (req, res) => {
  res.json(latestData);
});

// API: історія
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '300', 10), HISTORY_MAX);
  const slice = history.slice(-limit);
  res.json(slice);
});

// Статика для фронтенду
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`🔌 Сервер запущено на http://localhost:${PORT}`);
  console.log(`   Відкрий фронтенд: http://<IP_комп'ютера>:${PORT}/`);
});

