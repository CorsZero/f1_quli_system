# F1 Qualifying System - IoT Project

A real-time F1 qualifying race timing system using IR sensors, Node.js, and WebSockets.

## 🏎️ Features

- **Real-time Timing**: Live sector and lap time tracking
- **3-Sector System**: Track divide into 3 sectors with individual timing
- **Color-Coded Performance**:
  - 🟣 Purple: Overall best time (fastest across all drivers)
  - 🟢 Green: Personal best time
  - 🟡 Yellow: Slower than personal best
- **Leaderboard**: Auto-updating rankings with best lap times
- **F1 2024 Teams & Drivers**: All current teams and driver lineup
- **Race Control**: Select team/driver and manage sessions
- **Historical Tracking**: View previous lap times and statistics

## 📋 Requirements

### Hardware
- ESP32 or Arduino board
- 3x IR sensors (infrared obstacle detection sensors)
- USB cable for connecting to computer
- Breadboard and jumper wires (optional)

### Software
- Node.js (v14 or higher)
- npm

## 🔧 Installation

1. **Install Dependencies**:
```bash
npm install
```

2. **Upload Arduino Code**:
   - Open `esp_code/f1_qualifying_sensors.ino` in Arduino IDE
   - Connect your ESP32/Arduino board
   - Upload the code to your board

## 🔌 Hardware Setup

### IR Sensor Connections:

```
Sensor 1 (Start/Finish Line):
- VCC → 5V
- GND → GND
- OUT → GPIO 13 (ESP32) or Pin 13 (Arduino)

Sensor 2 (Sector 1 Completion):
- VCC → 5V
- GND → GND
- OUT → GPIO 12 (ESP32) or Pin 12 (Arduino)

Sensor 3 (Sector 2 Completion):
- VCC → 5V
- GND → GND
- OUT → GPIO 14 (ESP32) or Pin 14 (Arduino)
```

### Track Layout:
```
START/FINISH LINE (Sensor 1)
    ↓
SECTOR 1
    ↓
SECTOR 1 END (Sensor 2)
    ↓
SECTOR 2
    ↓
SECTOR 2 END (Sensor 3)
    ↓
SECTOR 3
    ↓
BACK TO START/FINISH LINE (Sensor 1)
```

## 🚀 Running the Application

1. **Connect Your Hardware**:
   - Ensure your ESP32/Arduino is connected via USB
   - Note the COM port (e.g., COM3, COM4)

2. **Configure Serial Port** (in `server.js`):
   ```javascript
   // Line 340 - uncomment and set your COM port
   initSerialPort('COM3');  // Change to your port
   ```

3. **Start the Server**:
```bash
npm start
```

4. **Open Browser**:
   Navigate to `http://localhost:3000`

## 🎮 How to Use

### Demo Mode (Without Hardware):
1. Open the web interface
2. Select a team and driver in Race Control
3. Click "START SESSION"
4. Use the demo buttons to simulate sensor triggers:
   - **Trigger Start/Finish**: Starts a new lap or completes current lap
   - **Trigger Sector 1**: Completes Sector 1
   - **Trigger Sector 2**: Completes Sector 2

### With Hardware:
1. Select team and driver
2. Click "START SESSION"
3. Send your car/object through the track
4. Times are automatically recorded when sensors are triggered

## 📊 Understanding the Display

### Current Lap View:
- Shows live sector times as they're recorded
- Color bars indicate performance:
  - Purple: Best time overall
  - Green: Personal best
  - Yellow: Slower than personal best

### Leaderboard:
- Position rankings (Gold/Silver/Bronze for top 3)
- Driver info with team colors
- Best sector times
- Total lap time
- Number of laps completed

## 🏁 F1 Teams Included

- Red Bull Racing
- Ferrari
- Mercedes
- McLaren
- Aston Martin
- Alpine
- Williams
- RB (AlphaTauri)
- Kick Sauber
- Haas

## 🛠️ Troubleshooting

### Serial Port Issues:
- Check if correct COM port is set in `server.js`
- Ensure no other program is using the serial port
- Verify driver installation for ESP32/Arduino

### Sensors Not Triggering:
- Check sensor connections
- Adjust sensor sensitivity (potentiometer on sensor)
- Verify power supply (5V)
- Test LED indicator on board for visual feedback

### Web Interface Not Loading:
- Ensure server is running (`npm start`)
- Check console for errors
- Clear browser cache

## 📁 Project Structure

```
f1_quli_system/
├── server.js              # Node.js backend with WebSocket
├── package.json           # Dependencies
├── public/
│   ├── index.html        # Main web interface
│   ├── styles.css        # F1-styled CSS
│   └── script.js         # Frontend JavaScript
└── esp_code/
    └── f1_qualifying_sensors.ino  # Arduino/ESP32 code
```

## 🔄 Data Flow

1. IR sensor detects object
2. ESP32/Arduino sends signal (S1/S2/S3) via serial
3. Node.js server receives and processes timing
4. WebSocket broadcasts update to all connected clients
5. Frontend updates display in real-time
6. Leaderboard automatically recalculates

## 📝 Notes for University Project

- Demonstrates IoT integration with web technologies
- Real-time data processing
- WebSocket communication
- Hardware-software integration
- Professional UI/UX design
- Scalable architecture

## 🎓 Learning Outcomes

- IoT sensor integration
- Serial communication
- Real-time web applications
- WebSocket technology
- Node.js backend development
- Frontend JavaScript
- Race timing algorithms

## 📄 License

ISC

## 👨‍💻 Support

For issues or questions about the project, check:
1. Hardware connections
2. Serial port configuration
3. Browser console for errors
4. Server logs in terminal
