class TemperatureMonitor {
    constructor(options = {}) {
        this.temperatureData = []; // масив тільки "нормальних" даних
        this.options = {
            minDataPoints: 5,           // мінімальна кількість точок для аналізу
            suddenChangeThreshold: 5,    // поріг різкої зміни (°C)
            abnormalLowThreshold: 10,    // поріг аномально низької температури
            abnormalHighThreshold: 35,   // поріг аномально високої температури
            movingAverageWindow: 3,       // вікно для ковзного середнього
            filterAnomalies: true,        // чи відкидати аномалії
            calibrationPoints: 3,          // перші N записів завжди додаються
            ...options
        };
    }

    // Перевірка, чи є значення аномальним
    isAnomaly(currentTemp, previousTemp, dataLength) {
        // Якщо ще не набрали калібрувальних даних, не вважати аномалією
        if (dataLength < this.options.calibrationPoints) {
            return false;
        }

        // Перевірка на різкий перепад (якщо є попереднє значення)
        if (previousTemp !== undefined) {
            const tempChange = Math.abs(currentTemp - previousTemp);
            if (tempChange >= this.options.suddenChangeThreshold) {
                return true;
            }
        }

        // Перевірка на абсолютні викиди
        if (currentTemp <= this.options.abnormalLowThreshold ||
            currentTemp >= this.options.abnormalHighThreshold) {
            return true;
        }

        return false;
    }

    // Додавання нового запису
    addData(temperature, humidity, timestamp = Date.now()) {
        const newData = { temperature, humidity, ts: timestamp };

        // Отримуємо попереднє значення температури (якщо є)
        const previousTemp = this.temperatureData.length > 0
            ? this.temperatureData[this.temperatureData.length - 1].temperature
            : undefined;

        // Перевіряємо, чи є нове значення аномальним
        const anomaly = this.isAnomaly(temperature, previousTemp, this.temperatureData.length);

        // Якщо аномалія і фільтрація ввімкнена – не додаємо, але виводимо сповіщення
        if (anomaly && this.options.filterAnomalies) {
            console.log(`🚨 Виявлено аномалію: ${temperature}°C (попереднє: ${previousTemp !== undefined ? previousTemp + '°C' : 'немає'}) – значення проігноровано`);
            this.sendTelegramMessage(`🚨 Виявлено аномалію: ${temperature}°C (попереднє: ${previousTemp !== undefined ? previousTemp + '°C' : 'немає'}) – значення проігноровано`);
            return null; // не додаємо в масив
        }

        // Додаємо нормальне (або калібрувальне) значення
        this.temperatureData.push(newData);
        
        // Запускаємо аналіз тільки якщо додали дані
        this.analyzeTemperature(newData);
        
        return newData;
    }

    // Метод для аналізу температури (залишається майже без змін)
    analyzeTemperature(currentData) {
        if (this.temperatureData.length < this.options.minDataPoints) {
            return;
        }

        const currentTemp = currentData.temperature;
        const lastData = this.temperatureData[this.temperatureData.length - 2]; // попередній запис

        // 1. Аналіз різких змін (тепер тільки для нормальних даних)
        if (lastData) {
            const tempChange = Math.abs(currentTemp - lastData.temperature);
            if (tempChange >= this.options.suddenChangeThreshold) {
                this.sendTelegramMessage(`🚨 РІЗКА ЗМІНА ТЕМПЕРАТУРИ: ${lastData.temperature}°C → ${currentTemp}°C (зміна на ${tempChange.toFixed(1)}°C)`);
            }
        }

        // 2. Аналіз аномальних температур (тепер це будуть тільки ті, що пройшли фільтр,
        //    але абсолютні викиди можуть бути відсутні, якщо вони відфільтрувались)
        if (currentTemp <= this.options.abnormalLowThreshold) {
            this.sendTelegramMessage(`❄️ АНОМАЛЬНО НИЗЬКА ТЕМПЕРАТУРА: ${currentTemp}°C`);
        } else if (currentTemp >= this.options.abnormalHighThreshold) {
            this.sendTelegramMessage(`🔥 АНОМАЛЬНО ВИСОКА ТЕМПЕРАТУРА: ${currentTemp}°C`);
        }

        // 3. Аналіз ковзного середнього
        this.analyzeMovingAverage();

        // 4. Статистичний аналіз
        this.detectOutliers(currentData);
    }
    analyzeMovingAverage() {
        if (this.temperatureData.length < this.options.movingAverageWindow) return;

        const window = this.options.movingAverageWindow;
        const recentTemps = this.temperatureData.slice(-window).map(d => d.temperature);
        const movingAvg = recentTemps.reduce((a, b) => a + b, 0) / window;

        if (this.temperatureData.length > window) {
            const prevTemps = this.temperatureData.slice(-window - 1, -1).map(d => d.temperature);
            const prevAvg = prevTemps.reduce((a, b) => a + b, 0) / window;
            
            const avgChange = movingAvg - prevAvg;
            
            if (Math.abs(avgChange) >= 3) {
                this.sendTelegramMessage(`📊 ЗМІНА ТРЕНДУ: Середня температура змінилась на ${avgChange.toFixed(1)}°C (поточне середнє: ${movingAvg.toFixed(1)}°C)`);
            }
        }
    }

    detectOutliers(currentData) {
        if (this.temperatureData.length < 10) return;

        const temps = this.temperatureData.map(d => d.temperature);
        const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
        
        const squareDiffs = temps.map(temp => Math.pow(temp - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
        const stdDev = Math.sqrt(avgSquareDiff);

        const currentTemp = currentData.temperature;
        const deviations = Math.abs(currentTemp - mean) / stdDev;

        if (deviations > 2) {
            this.sendTelegramMessage(`📈 СТАТИСТИЧНИЙ ВИКИД: ${currentTemp}°C відхиляється на ${deviations.toFixed(1)}σ від середнього (${mean.toFixed(1)}°C)`);
        }
    }

    getStatistics() {
        if (this.temperatureData.length === 0) {
            return {
                message: "Масив даних порожній",
                count: 0
            };
        }

        const temps = this.temperatureData.map(d => d.temperature);
        const min = Math.min(...temps);
        const max = Math.max(...temps);
        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        
        const sorted = [...temps].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0 
            ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
            : sorted[Math.floor(sorted.length/2)];

        return {
            count: this.temperatureData.length,
            min: min.toFixed(1),
            max: max.toFixed(1),
            avg: avg.toFixed(1),
            median: median.toFixed(1),
            lastUpdate: new Date(this.temperatureData[this.temperatureData.length - 1].ts).toLocaleString()
        };
    }

    clearOldData(hoursToKeep = 24) {
        const now = Date.now();
        const msInHour = 3600000;
        const cutoff = now - (hoursToKeep * msInHour);
        
        this.temperatureData = this.temperatureData.filter(data => data.ts >= cutoff);
        console.log(`🧹 Очищено дані старші за ${hoursToKeep} годин. Залишилось записів: ${this.temperatureData.length}`);
    }
   async sendTelegramMessage(message) {
        try {
            const token = process.env.TB;
            const chatId = process.env.TCID;

            if (!token || !chatId) {
                console.error('❌ Telegram token або chatId не задано в .env');
                return;
            }

            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            
            // Якщо fetch недоступний, використайте node-fetch
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                }),
            });

            const data = await response.json();
            if (!data.ok) {
                console.error('❌ Telegram API помилка:', data);
            } else {
                console.log('✅ Telegram повідомлення надіслано');
            }
        } catch (err) {
            console.error('❌ Помилка відправки в Telegram:', err.message);
        }
    }
}

module.exports = TemperatureMonitor;
