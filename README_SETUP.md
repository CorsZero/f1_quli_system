# F1 Qualifying System - Setup Guide

## ESP32 WiFi Setup

### 1. Install Arduino IDE Library
1. Open Arduino IDE
2. Go to: **Sketch → Include Library → Manage Libraries**
3. Search for: **"WebSockets"** by Markus Sattler
4. Click **Install**

### 2. Configure ESP32 Code
Open `esp_code/f1_qualifying_sensors/f1_qualifying_sensors.ino` and update:

```cpp
// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // Your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Your WiFi password

// Server Configuration
const char* SERVER_HOST = "192.168.1.100";  // Your computer's IP address
const int SERVER_PORT = 3000;
```

### 3. Find Your Computer's IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., 192.168.1.100)

**Mac/Linux:**
```bash
ifconfig
```
Look for "inet" address under your active network adapter

### 4. Start the Server
```bash
npm start
```

Server will run on: `http://localhost:3000`

### 5. Upload Code to ESP32
1. Connect ESP32 to computer via USB
2. Select board: **Tools → Board → ESP32 Dev Module**
3. Select port: **Tools → Port → COMx** (your ESP32 port)
4. Click **Upload** button
5. Open **Serial Monitor** at **115200 baud** to see connection status

### 6. Test Connection
1. Serial Monitor should show:
   - WiFi Connected!
   - IP Address: 192.168.x.x
   - WebSocket Connected to server!

2. Wave hand over sensors - should see:
   - LED blinks
   - "Sent: S1/S2/S3" in Serial Monitor
   - Server console shows "Sensor trigger from ESP32"

## Firewall Configuration

If ESP32 can't connect to server:

**Windows Firewall:**
1. Search "Windows Defender Firewall"
2. Click "Allow an app through firewall"
3. Find "Node.js" and check both Private and Public
4. Or temporarily disable firewall for testing

**Router Port Forwarding (for internet access):**
1. Forward port 3000 to your computer's local IP
2. Use public IP address in ESP32 SERVER_HOST
3. Find public IP: https://whatismyipaddress.com/

## Hardware Connections

### IR Sensor Pinout
- **VCC** → 3.3V or 5V (ESP32)
- **GND** → GND
- **OUT** → GPIO pins (13, 12, 14)

### Track Layout
```
[S1: Start/Finish] ──→ [S2: Sector 1 End] ──→ [S3: Sector 2 End] ──→ [Back to S1]
```

## Troubleshooting

### WiFi Won't Connect
- Check SSID and password spelling
- Ensure ESP32 is in WiFi range
- Try 2.4GHz network (ESP32 doesn't support 5GHz)

### WebSocket Won't Connect
- Check server is running (`npm start`)
- Verify SERVER_HOST IP address is correct
- Check firewall settings
- Ensure both ESP32 and computer are on same network

### Sensors Not Triggering
- Check wiring (VCC, GND, OUT pins)
- Test sensor with multimeter or LED
- Adjust DEBOUNCE_DELAY if getting multiple triggers
- Some sensors may be active HIGH (invert logic in code)

### Multiple Sensor Triggers
- Increase `DEBOUNCE_DELAY` from 1000 to 2000ms
- Check for loose wiring causing bouncing

## Demo Mode (Without Hardware)

Use the demo buttons on the web interface:
1. Start server: `npm start`
2. Open browser: `http://localhost:3000`
3. Select team and driver
4. Click "Start Session"
5. Use "Trigger S1/S2/S3" buttons to simulate sensors
