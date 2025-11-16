/*
 * F1 Qualifying System - ESP32 WiFi Code
 * Sends IR sensor data to Node.js server via WiFi/Internet
 * 
 * Hardware Setup:
 * - ESP32 board (requires WiFi capability)
 * - 3 IR Sensors (for Start/Finish line and 2 sector lines)
 * 
 * IR Sensor Connections:
 * - Sensor 1 (Start/Finish): GPIO 25
 * - Sensor 2 (Sector 1):      GPIO 26
 * - Sensor 3 (Sector 2):      GPIO 27
 * - VCC: 3.3V or 5V (depending on sensor)
 * - GND: GND
 * 
 * NOTE: Avoid GPIO 12, 0, 2, 15 - they affect boot mode!
 * 
 * Communication:
 * - Connects to WiFi network
 * - Sends sensor data to server via WebSocket
 * - Sends "S1", "S2", "S3" when sensors are triggered
 */

#include <WiFi.h>
#include <WebSocketsClient.h>

// ===== WiFi Configuration =====
const char* WIFI_SSID = "ASUS 7704";        // Replace with your WiFi name
const char* WIFI_PASSWORD = "janindup"; // Replace with your WiFi password

// ===== Server Configuration =====
const char* SERVER_HOST = "192.168.137.212";  // Replace with your server IP address
const int SERVER_PORT = 3000;                // Server port (default: 3000)
const char* WEBSOCKET_PATH = "/socket.io/?EIO=4&transport=websocket";

// Pin definitions
const int SENSOR_START_FINISH = 25;  // Start/Finish line sensor (was 13)
const int SENSOR_SECTOR_1 = 26;      // Sector 1 completion sensor (was 12)
const int SENSOR_SECTOR_2 = 27;      // Sector 2 completion sensor (was 14)

// LED indicator
const int LED_PIN = 2;  // ESP32 built-in LED

// Debounce settings
unsigned long lastTriggerTime[3] = {0, 0, 0};
const unsigned long DEBOUNCE_DELAY = 500;  // 500ms debounce (reduced from 1000ms)

// Sensor states
bool lastSensorState[3] = {HIGH, HIGH, HIGH};

// WiFi reconnection
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 5000;  // Check WiFi every 5 seconds

// WebSocket client
WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastPingTime = 0;
const unsigned long PING_INTERVAL = 25000;  // 25 seconds (from server config)

void setup() {
  // Initialize serial for debugging
  Serial.begin(115200);
  Serial.println("\n\nF1 Qualifying System - ESP32 WiFi");
  Serial.println("==================================");
  
  // Initialize sensor pins
  pinMode(SENSOR_START_FINISH, INPUT_PULLUP);
  pinMode(SENSOR_SECTOR_1, INPUT_PULLUP);
  pinMode(SENSOR_SECTOR_2, INPUT_PULLUP);
  
  // Initialize LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Startup LED indication
  blinkLED(3);
  
  // Connect to WiFi
  connectWiFi();
  
  // Setup WebSocket
  setupWebSocket();
  
  Serial.println("System ready - monitoring sensors...");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check all sensors FIRST - highest priority for minimum latency
  checkSensor(0, SENSOR_START_FINISH, "S1", currentTime);
  checkSensor(1, SENSOR_SECTOR_1, "S2", currentTime);
  checkSensor(2, SENSOR_SECTOR_2, "S3", currentTime);
  
  // Maintain WebSocket connection (non-blocking)
  webSocket.loop();
  
  // Check WiFi only every 5 seconds (not every loop)
  if (currentTime - lastWiFiCheck > WIFI_CHECK_INTERVAL) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected! Reconnecting...");
      connectWiFi();
    }
    lastWiFiCheck = currentTime;
  }
  
  // No delay - maximum responsiveness!
}

// WiFi connection function
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));  // Blink during connection
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, LOW);
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    blinkLED(2);  // Success indication
  } else {
    Serial.println("\nWiFi Connection Failed!");
    Serial.println("Check SSID and password, then restart ESP32");
  }
}

// WebSocket setup
void setupWebSocket() {
  Serial.println("Setting up WebSocket connection...");
  
  // Configure WebSocket
  webSocket.begin(SERVER_HOST, SERVER_PORT, WEBSOCKET_PATH);
  
  // Event handler
  webSocket.onEvent(webSocketEvent);
  
  // Reconnect settings
  webSocket.setReconnectInterval(5000);  // Try reconnecting every 5 seconds
  
  Serial.print("Connecting to server: ");
  Serial.print(SERVER_HOST);
  Serial.print(":");
  Serial.println(SERVER_PORT);
}

// WebSocket event handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WebSocket] Disconnected from server");
      isConnected = false;
      break;
      
    case WStype_CONNECTED:
      {
        Serial.println("[WebSocket] Connected to server!");
        Serial.printf("[WebSocket] Connected to URL: %s\n", payload);
        isConnected = true;
        lastPingTime = millis();
        blinkLED(3);  // Connection success
      }
      break;
      
    case WStype_TEXT:
      {
        String message = String((char*)payload);
        Serial.printf("[WebSocket] Received: %s\n", payload);
        
        // Handle ping from server (message '2') - MUST respond or connection dies!
        if (message.equals("2")) {
          webSocket.sendTXT("3");  // Respond with pong
          Serial.println("[WebSocket] Ping received, pong sent");
        }
        // Handle Socket.IO handshake (message starting with '0')
        else if (message.startsWith("0")) {
          Serial.println("[WebSocket] Socket.IO handshake received");
          // Send connect message after handshake
          webSocket.sendTXT("40");  // Socket.IO connect on default namespace
          // Send ESP32 identification (removed delay - not needed)
          webSocket.sendTXT("42[\"esp32Connected\",{\"device\":\"ESP32_F1_Sensors\"}]");
        }
        // Handle Socket.IO messages starting with '42'
        else if (message.startsWith("42")) {
          Serial.println("[WebSocket] Received Socket.IO event");
        }
      }
      break;
      
    case WStype_BIN:
      Serial.printf("[WebSocket] Binary data received, length: %u\n", length);
      break;
      
    case WStype_ERROR:
      Serial.printf("[WebSocket] Error: %s\n", payload);
      break;
      
    case WStype_PING:
      Serial.println("[WebSocket] Ping received");
      break;
      
    case WStype_PONG:
      Serial.println("[WebSocket] Pong received");
      break;
  }
}

// Send sensor data via WebSocket
void sendSensorData(const char* sensor) {
  if (isConnected) {
    // Socket.IO message format: 42["sensorTrigger",{"sensor":"S1"}]
    String message = "42[\"sensorTrigger\",{\"sensor\":\"";
    message += sensor;
    message += "\"}]";
    
    webSocket.sendTXT(message);
    
    Serial.print("Sent: ");
    Serial.println(sensor);
  } else {
    Serial.println("WebSocket not connected! Sensor data not sent.");
  }
}

void checkSensor(int sensorIndex, int sensorPin, const char* message, unsigned long currentTime) {
  bool currentState = digitalRead(sensorPin);
  
  // Detect falling edge (HIGH -> LOW)
  if (currentState == LOW && lastSensorState[sensorIndex] == HIGH) {
    if (currentTime - lastTriggerTime[sensorIndex] > DEBOUNCE_DELAY) {
      
      // Send to server IMMEDIATELY - no delays!
      sendSensorData(message);
      
      // Quick LED flash (non-blocking - just turn on, will turn off next loop)
      digitalWrite(LED_PIN, HIGH);
      
      lastTriggerTime[sensorIndex] = currentTime;
    }
  }
  
  // Turn off LED after brief moment (non-blocking)
  if (currentTime - lastTriggerTime[sensorIndex] > 50) {
    digitalWrite(LED_PIN, LOW);
  }
  
  lastSensorState[sensorIndex] = currentState;
}

void blinkLED(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

/*
 * SETUP INSTRUCTIONS:
 * 
 * 1. Install Required Libraries (Arduino IDE):
 *    - Go to: Sketch > Include Library > Manage Libraries
 *    - Search and install: "WebSockets" by Markus Sattler
 *    
 * 2. Configure WiFi:
 *    - Update WIFI_SSID with your WiFi network name
 *    - Update WIFI_PASSWORD with your WiFi password
 *    
 * 3. Configure Server:
 *    - If testing locally: Use your computer's local IP (e.g., 192.168.1.100)
 *      Find it by running "ipconfig" (Windows) or "ifconfig" (Mac/Linux)
 *    - If server is on internet: Use public IP or domain name
 *    - Update SERVER_HOST with the IP address
 *    - Update SERVER_PORT if you changed it (default: 3000)
 *    
 * 4. Upload and Test:
 *    - Upload code to ESP32
 *    - Open Serial Monitor at 115200 baud
 *    - Check WiFi connection and WebSocket connection status
 *    - Wave hand over sensors to test
 *    
 * TROUBLESHOOTING:
 * - WiFi won't connect: Check SSID/password, ensure ESP32 is in range
 * - WebSocket won't connect: Check server is running, firewall settings
 * - Sensor not working: Check wiring, try reversing detection logic
 * - Multiple triggers: Increase DEBOUNCE_DELAY value
 */
