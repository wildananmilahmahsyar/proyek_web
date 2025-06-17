const express = require('express');
const app = express();
const PORT = 3000;
const thingsboardClient = require('./thingsboard-client');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const ExcelJS = require('exceljs');
const axios = require('axios');

app.use(express.static('public'));
app.set('view engine', 'ejs');

// Data state (default values)
let data = {
    temperature1: 0,
    temperature2: 0,
    humidity1: 0,
    humidity2: 0,
    soil1: 0,
    soil2: 0,
    soil_condition: "",
    relay_status: 0,
    temperature: 0,   // alias ke temperature1
    humidity: 0,      // alias ke humidity1
    soilMoisture: 0   // alias ke soil1
};


// Koneksi ke ThingsBoard
thingsboardClient.connect();


// Update data ketika menerima MQTT dari ThingsBoard
thingsboardClient.on('data', (payload) => {
    console.log('\n📥 Data MQTT Masuk:', payload);

    if (payload.esp1_temperature !== undefined) {
        data.temperature1 = parseFloat(payload.esp1_temperature);
        data.temperature = data.temperature1;
    }
    if (payload.esp2_temperature !== undefined) {
        data.temperature2 = parseFloat(payload.esp2_temperature);
    }
    if (payload.esp1_humidity !== undefined) {
        data.humidity1 = parseFloat(payload.esp1_humidity);
        data.humidity = data.humidity1;
    }
    if (payload.esp2_humidity !== undefined) {
        data.humidity2 = parseFloat(payload.esp2_humidity);
    }
    if (payload.esp1_soil !== undefined) {
        data.soil1 = parseFloat(payload.esp1_soil);
        data.soilMoisture = data.soil1;
    }
    if (payload.esp2_soil !== undefined) {
        data.soil2 = parseFloat(payload.esp2_soil);
    }
    if (payload.esp1_soil_condition !== undefined) {
        data.soil_condition = payload.esp1_soil_condition;
    }


    console.log('✅ Data Sekarang:', data);
    io.emit('realtimeData', data);
});

// Fungsi untuk update data dari ThingsBoard
async function updateDataFromThingsBoard() {
  try {
    const latest = await thingsboardClient.getLatestTelemetry();
    if (latest) {
      // Update suhu
      if (latest.esp1_temperature) {
        data.temperature1 = parseFloat(latest.esp1_temperature[0].value);
        data.temperature = data.temperature1;
      }
      if (latest.esp2_temperature) {
        data.temperature2 = parseFloat(latest.esp2_temperature[0].value);
      }

      // Update kelembapan udara
      if (latest.esp1_humidity) {
        data.humidity1 = parseFloat(latest.esp1_humidity[0].value);
        data.humidity = data.humidity1;
      }
      if (latest.esp2_humidity) {
        data.humidity2 = parseFloat(latest.esp2_humidity[0].value);
      }

      // Update kelembapan tanah
      if (latest.esp1_soil) {
        data.soil1 = parseFloat(latest.esp1_soil[0].value);
        data.soilMoisture = data.soil1;
      }
      if (latest.esp2_soil) {
        data.soil2 = parseFloat(latest.esp2_soil[0].value);
      }

      console.log('🔄 Data berhasil diperbarui:', data);
    }
  } catch (error) {
    console.error('❌ Gagal memperbarui data:', error);
  }
}

// Update data setiap 5 detik
setInterval(updateDataFromThingsBoard, 5000);

// Update data pertama kali saat server start
updateDataFromThingsBoard();


// Ambil data awal dari REST API (jika tidak ada data MQTT)
thingsboardClient.getLatestTelemetry().then((latest) => {
  if (latest) {
    // Suhu
    if (latest.esp1_temperature) {
      data.temperature1 = parseFloat(latest.esp1_temperature[0].value);
      data.temperature = data.temperature1;
    }
    if (latest.esp2_temperature) {
      data.temperature2 = parseFloat(latest.esp2_temperature[0].value);
    }

    // Kelembapan udara
    if (latest.esp1_humidity) {
      data.humidity1 = parseFloat(latest.esp1_humidity[0].value);
      data.humidity = data.humidity1;
    }
    if (latest.esp2_humidity) {
      data.humidity2 = parseFloat(latest.esp2_humidity[0].value);
    }

    // Kelembapan tanah
    if (latest.esp1_soil) {
      data.soil1 = parseFloat(latest.esp1_soil[0].value);
      data.soilMoisture = data.soil1;
    }
    if (latest.esp2_soil) {
      data.soil2 = parseFloat(latest.esp2_soil[0].value);
    }

    console.log('🔁 Data awal dari ThingsBoard berhasil dimuat:', data);
  }
});



// Routes
app.get('/', (req, res) => res.render('index', { data }));
app.get('/temperature', (req, res) => res.render('temperature', { data }));
app.get('/humidity', (req, res) => res.render('humidity', { data }));
app.get('/switch', (req, res) => res.render('switch', { data }));
app.get('/soil', (req, res) => res.render('soil', { data }));
app.get('/history', (req, res) => res.render('history', { data }));

// Endpoint untuk update (jika ingin kirim data balik)
app.post('/api/update', express.json(), (req, res) => {
    const updates = req.body;
    console.log('\n📤 Permintaan Update dari Client:', updates);

    // Pastikan nilai saklar adalah number
    if (updates.saklar !== undefined) {
        updates.saklar = parseInt(updates.saklar);
    }

    data = { ...data, ...updates };
    thingsboardClient.publishTelemetry(updates);

    console.log('✅ Data setelah update:', data);
    res.json({ success: true, data: data });
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.get('/api/data', (req, res) => {
  res.json(data);
});

app.get('/history-data', async (req, res) => {
  const axios = require('axios');
  const jwt = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ5YXlhdGExNDFAZ21haWwuY29tIiwidXNlcklkIjoiN2UzMTU5YjAtNDliZi0xMWYwLWFkZDItMDkzZjg0MWNjNWRjIiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiJhZjA3NDg4Yi1hNzllLTQwN2QtYWUwMC0wNDc5NTA5Yzg4ZmYiLCJleHAiOjE3NTAxNTE2MzYsImlzcyI6InRoaW5nc2JvYXJkLmNsb3VkIiwiaWF0IjoxNzUwMTIyODM2LCJmaXJzdE5hbWUiOiJBaG1hZCIsImxhc3ROYW1lIjoiWWF5YXQiLCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsImlzQmlsbGluZ1NlcnZpY2UiOmZhbHNlLCJwcml2YWN5UG9saWN5QWNjZXB0ZWQiOnRydWUsInRlcm1zT2ZVc2VBY2NlcHRlZCI6dHJ1ZSwidGVuYW50SWQiOiI3ZGZhZTA2MC00OWJmLTExZjAtYWRkMi0wOTNmODQxY2M1ZGMiLCJjdXN0b21lcklkIjoiMTM4MTQwMDAtMWRkMi0xMWIyLTgwODAtODA4MDgwODA4MDgwIn0.yAw8l8KmUezWY3f5VLoL-gmz4ThQ-aGXBTAFaHtrYm0XakfBxKK-s7Z6MnvjpW1JbM6s1xeOJQZVUJGncfLH5g'; // JWT dari ThingsBoard
  const deviceId = '9ba728d0-49bf-11f0-9e49-05adc209a747';

  const endTs = Date.now();
  const startTs = endTs - 24 * 60 * 60 * 1000; // 24 jam terakhir

  try {
    const response = await axios.get(`https://thingsboard.cloud/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
      headers: { 'X-Authorization': jwt },
      params: {
        keys: 'esp1_temperature,esp2_temperature,esp1_humidity,esp2_humidity,esp1_soil,esp2_soil',
        startTs,
        endTs
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('❌ Error ambil history:', err.message);
    res.status(500).send('Gagal ambil data history');
  }
});


app.get('/download-history', async (req, res) => {
  const jwt = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ5YXlhdGExNDFAZ21haWwuY29tIiwidXNlcklkIjoiN2UzMTU5YjAtNDliZi0xMWYwLWFkZDItMDkzZjg0MWNjNWRjIiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiJhZjA3NDg4Yi1hNzllLTQwN2QtYWUwMC0wNDc5NTA5Yzg4ZmYiLCJleHAiOjE3NTAxNTE2MzYsImlzcyI6InRoaW5nc2JvYXJkLmNsb3VkIiwiaWF0IjoxNzUwMTIyODM2LCJmaXJzdE5hbWUiOiJBaG1hZCIsImxhc3ROYW1lIjoiWWF5YXQiLCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsImlzQmlsbGluZ1NlcnZpY2UiOmZhbHNlLCJwcml2YWN5UG9saWN5QWNjZXB0ZWQiOnRydWUsInRlcm1zT2ZVc2VBY2NlcHRlZCI6dHJ1ZSwidGVuYW50SWQiOiI3ZGZhZTA2MC00OWJmLTExZjAtYWRkMi0wOTNmODQxY2M1ZGMiLCJjdXN0b21lcklkIjoiMTM4MTQwMDAtMWRkMi0xMWIyLTgwODAtODA4MDgwODA4MDgwIn0.yAw8l8KmUezWY3f5VLoL-gmz4ThQ-aGXBTAFaHtrYm0XakfBxKK-s7Z6MnvjpW1JbM6s1xeOJQZVUJGncfLH5g'; // ganti dengan JWT kamu
  const deviceId = '9ba728d0-49bf-11f0-9e49-05adc209a747';
  const endTs = Date.now();
  const startTs = endTs - 24 * 60 * 60 * 1000;

  try {
    const response = await axios.get(`https://thingsboard.cloud/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
      headers: { 'X-Authorization': jwt },
      params: {
        keys: 'esp1_temperature,esp2_temperature,esp1_humidity,esp2_humidity,esp1_soil,esp2_soil',
        startTs,
        endTs
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sensor History');

    // Header
    sheet.columns = [
      { header: 'Waktu', key: 'timestamp', width: 25 },
      { header: 'Key', key: 'key', width: 25 },
      { header: 'Value', key: 'value', width: 15 },
    ];

    // Append data
    for (const key in response.data) {
      response.data[key].forEach(entry => {
        sheet.addRow({
          timestamp: new Date(entry.ts).toLocaleString(),
          key,
          value: entry.value
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=history.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌ Gagal generate Excel:', error);
    res.status(500).send('Gagal generate file Excel');
  }
});