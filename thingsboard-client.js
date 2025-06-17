const mqtt = require('mqtt');
const EventEmitter = require('events');
require('dotenv').config();
const axios = require('axios');

class ThingsboardClient extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.host = process.env.THINGSBOARD_HOST;
        this.accessToken = process.env.THINGSBOARD_ACCESS_TOKEN;
        this.isConnected = false;
    }

    connect() {
        const connectUrl = `mqtt://${this.host}`;
        
        this.client = mqtt.connect(connectUrl, {
            username: this.accessToken,
            port: 1883,
            clean: true,
            reconnectPeriod: 1000 // Reconnect setiap 1 detik jika koneksi terputus
        });

        this.client.on('connect', () => {
            console.log('✅ Connected to ThingsBoard via MQTT');
            this.isConnected = true;
            this.client.subscribe('v1/devices/me/telemetry');
        });

        this.client.on('reconnect', () => {
            console.log('🔄 Mencoba koneksi ulang ke ThingsBoard...');
        });

        this.client.on('offline', () => {
            console.log('❌ Koneksi ThingsBoard terputus');
            this.isConnected = false;
        });

        this.client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                this.emit('data', payload);
                console.log('📥 Received MQTT Data:', payload);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        });

        this.client.on('error', (error) => {
            console.error('❌ MQTT Error:', error);
        });
    }

    publishTelemetry(data) {
        if (this.client && this.client.connected) {
            // Konversi string ke number jika perlu
            if (data.saklar !== undefined) {
                data.saklar = parseInt(data.saklar);
            }
            
            const payload = JSON.stringify(data);
            this.client.publish('v1/devices/me/telemetry', payload);
            console.log('📤 Telemetry published:', data);
        }
    }

    // ✅ Tambahan: Ambil data telemetry terakhir via REST API
    async getLatestTelemetry() {
        // token JWT yang di ambil dari ThingsBoard (cukup copy jwt token di account bagian security)
        const jwt = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJtZmFkZWxoYXN5aW02QGdtYWlsLmNvbSIsInVzZXJJZCI6ImVhYzFjNWIwLTMwMDYtMTFmMC1hYzA3LTdkNDQzMTE3ZjNmNyIsInNjb3BlcyI6WyJURU5BTlRfQURNSU4iXSwic2Vzc2lvbklkIjoiODY3ZTI1YzItMWQwZC00ZWRiLWFjMTAtYjdkNzdmNTkzZDE5IiwiZXhwIjoxNzUwMTUxMzkxLCJpc3MiOiJ0aGluZ3Nib2FyZC5jbG91ZCIsImlhdCI6MTc1MDEyMjU5MSwiZmlyc3ROYW1lIjoiTXVoYW1tYWQiLCJsYXN0TmFtZSI6IkZhZGVsIiwiZW5hYmxlZCI6dHJ1ZSwiaXNQdWJsaWMiOmZhbHNlLCJpc0JpbGxpbmdTZXJ2aWNlIjpmYWxzZSwicHJpdmFjeVBvbGljeUFjY2VwdGVkIjp0cnVlLCJ0ZXJtc09mVXNlQWNjZXB0ZWQiOnRydWUsInRlbmFudElkIjoiZWE3MzU3OTAtMzAwNi0xMWYwLWFjMDctN2Q0NDMxMTdmM2Y3IiwiY3VzdG9tZXJJZCI6IjEzODE0MDAwLTFkZDItMTFiMi04MDgwLTgwODA4MDgwODA4MCJ9.9fRlkHuUDXzK68VkbQSMN6GNziZ0-ge2EUF4fFBNWVIL3E9dUjZwLaxIohBeeKgDvrWKcZ_TEPqMOoGAF0P_6g'; // tempel lengkap
        const deviceId = '2ae6abb0-3007-11f0-80e6-43c583a0c385';

        try {
            const response = await axios.get(
                `https://thingsboard.cloud/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
                {
                    headers: {
                        'X-Authorization': jwt
                    },
                    params: {
                        keys: 'esp1_temperature,esp2_temperature,esp1_humidity,esp2_humidity,esp1_soil,esp2_soil'
                    }
                }
            );

            console.log('\n📥 Data telemetry terakhir dari REST API:');
            console.dir(response.data, { depth: null });

            // Kirimkan hasilnya ke luar (return ke app.js)
            return response.data;
        } catch (error) {
            console.error('\n❌ Gagal ambil data:', error.response?.data || error.message);
            return null;
        }
    }

    async getHistoryData() {
        const jwt = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ5YXlhdGExNDFAZ21haWwuY29tIiwidXNlcklkIjoiN2UzMTU5YjAtNDliZi0xMWYwLWFkZDItMDkzZjg0MWNjNWRjIiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiJhZjA3NDg4Yi1hNzllLTQwN2QtYWUwMC0wNDc5NTA5Yzg4ZmYiLCJleHAiOjE3NTAxNTE2MzYsImlzcyI6InRoaW5nc2JvYXJkLmNsb3VkIiwiaWF0IjoxNzUwMTIyODM2LCJmaXJzdE5hbWUiOiJBaG1hZCIsImxhc3ROYW1lIjoiWWF5YXQiLCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsImlzQmlsbGluZ1NlcnZpY2UiOmZhbHNlLCJwcml2YWN5UG9saWN5QWNjZXB0ZWQiOnRydWUsInRlcm1zT2ZVc2VBY2NlcHRlZCI6dHJ1ZSwidGVuYW50SWQiOiI3ZGZhZTA2MC00OWJmLTExZjAtYWRkMi0wOTNmODQxY2M1ZGMiLCJjdXN0b21lcklkIjoiMTM4MTQwMDAtMWRkMi0xMWIyLTgwODAtODA4MDgwODA4MDgwIn0.yAw8l8KmUezWY3f5VLoL-gmz4ThQ-aGXBTAFaHtrYm0XakfBxKK-s7Z6MnvjpW1JbM6s1xeOJQZVUJGncfLH5g'; // Replace with your JWT token
        const deviceId = '9ba728d0-49bf-11f0-9e49-05adc209a747'; // Replace with your device ID
        const endTs = Date.now();
        const startTs = endTs - (24 * 60 * 60 * 1000); // Last 24 hours

        try {
            const response = await axios.get(
                `https://${this.host}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
                {
                    headers: {
                        'X-Authorization': jwt
                    },
                    params: {
                        keys: 'esp1_temperature,esp2_temperature,esp1_humidity,esp2_humidity,esp1_soil,esp2_soil,esp1_soil_condition,esp1_relay_status',
                        startTs,
                        endTs
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Failed to fetch history:', error);
            throw error;
        }
    }
}

module.exports = new ThingsboardClient();
