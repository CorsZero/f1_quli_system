/*
 * F1 Qualifying System - ESP32/Arduino Code
 * 
 * Hardware Setup:
 * - 3 IR Sensors (for Start/Finish line and 2 sector lines)
 * - ESP32 or Arduino board
 * 
 * IR Sensor Connections:
 * - Sensor 1 (Start/Finish): GPIO 13 (or Pin 13 on Arduino)
 * - Sensor 2 (Sector 1):      GPIO 12 (or Pin 12 on Arduino)
 * - Sensor 3 (Sector 2):      GPIO 14 (or Pin 14 on Arduino)
 * - VCC: 5V
 * - GND: GND
 * 
 * When an object passes by the IR sensor, it sends a signal.
 * This code sends "S1", "S2", "S3" through serial when sensors are triggered.
 */

// Pin definitions
const int SENSOR_START_FINISH = 13;  // Start/Finish line sensor
const int SENSOR_SECTOR_1 = 12;      // Sector 1 completion sensor
const int SENSOR_SECTOR_2 = 14;      // Sector 2 completion sensor

// LED indicator (optional, built-in LED)
const int LED_PIN = 2;  // ESP32 built-in LED (Pin 13 on Arduino)

// Debounce settings
unsigned long lastTriggerTime[3] = {0, 0, 0};
const unsigned long DEBOUNCE_DELAY = 500;  // 500ms debounce

// Sensor states
bool lastSensorState[3] = {HIGH, HIGH, HIGH};  // Assuming sensors are HIGH when not triggered

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  
  // Initialize sensor pins as INPUT
  pinMode(SENSOR_START_FINISH, INPUT_PULLUP);
  pinMode(SENSOR_SECTOR_1, INPUT_PULLUP);
  pinMode(SENSOR_SECTOR_2, INPUT_PULLUP);
  
  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Startup indication
  blinkLED(3);
  
  Serial.println("F1 Qualifying System - Ready");
  Serial.println("Waiting for sensor triggers...");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check Start/Finish line sensor
  checkSensor(0, SENSOR_START_FINISH, "S1", currentTime);
  
  // Check Sector 1 sensor
  checkSensor(1, SENSOR_SECTOR_1, "S2", currentTime);
  
  // Check Sector 2 sensor
  checkSensor(2, SENSOR_SECTOR_2, "S3", currentTime);
  
  delay(10);  // Small delay to prevent overwhelming the CPU
}

void checkSensor(int sensorIndex, int sensorPin, const char* message, unsigned long currentTime) {
  // Read sensor state (LOW when triggered for most IR sensors)
  bool currentState = digitalRead(sensorPin);
  
  // Check if sensor state changed from HIGH to LOW (triggered)
  if (currentState == LOW && lastSensorState[sensorIndex] == HIGH) {
    // Check debounce
    if (currentTime - lastTriggerTime[sensorIndex] > DEBOUNCE_DELAY) {
      // Send sensor trigger message
      Serial.println(message);
      
      // Blink LED for visual feedback
      digitalWrite(LED_PIN, HIGH);
      delay(50);
      digitalWrite(LED_PIN, LOW);
      
      // Update last trigger time
      lastTriggerTime[sensorIndex] = currentTime;
    }
  }
  
  // Update last sensor state
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
 * ALTERNATIVE VERSION FOR ANALOG IR SENSORS:
 * If your IR sensors output analog values instead of digital,
 * uncomment and use this version:
 */

/*
const int ANALOG_THRESHOLD = 500;  // Adjust based on your sensor

void checkAnalogSensor(int sensorIndex, int sensorPin, const char* message, unsigned long currentTime) {
  int sensorValue = analogRead(sensorPin);
  
  if (sensorValue > ANALOG_THRESHOLD && lastSensorState[sensorIndex] == 0) {
    if (currentTime - lastTriggerTime[sensorIndex] > DEBOUNCE_DELAY) {
      Serial.println(message);
      
      digitalWrite(LED_PIN, HIGH);
      delay(50);
      digitalWrite(LED_PIN, LOW);
      
      lastTriggerTime[sensorIndex] = currentTime;
      lastSensorState[sensorIndex] = 1;
    }
  } else if (sensorValue <= ANALOG_THRESHOLD) {
    lastSensorState[sensorIndex] = 0;
  }
}
*/
