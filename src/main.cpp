// ============================================
// SMART WASHING MACHINE - ESP32 + MQTT
// Hệ thống máy giặt thông minh với kết nối IoT
// ============================================

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================
// CẤU HÌNH WIFI & MQTT
// ============================================
#define WIFI_SSID         "Wokwi-GUEST"
#define WIFI_PASSWORD     ""

// HiveMQ Public Broker (Free)
#define MQTT_SERVER       "broker.hivemq.com"
#define MQTT_PORT         1883

// Machine ID - ĐỔI CHO MỖI MÁY: MACHINE_01, MACHINE_02, MACHINE_03, MACHINE_04
#define MACHINE_ID        "MACHINE_01"

// MQTT Topics
String TOPIC_STATUS = "laundry/" + String(MACHINE_ID) + "/status";
String TOPIC_COMMAND = "laundry/" + String(MACHINE_ID) + "/command";
String TOPIC_ERROR = "laundry/errors";
String TOPIC_EVENTS = "laundry/events";

// ============================================
// CẤU HÌNH CHÂN GPIO
// ============================================
#define PIN_RELAY_MOTOR   26  
#define PIN_RELAY_VALVE   32  
#define PIN_POT_WATER     34  
#define PIN_POT_DIRT      35  
#define PIN_DOOR_SWITCH   13  
#define PIN_BUZZER        15  
#define PIN_BTN_START     12
#define PIN_BTN_PAUSE     14

// ============================================
// HẰNG SỐ CẤU HÌNH
// ============================================
#define WATER_FULL_THRESHOLD      90
#define WATER_EMPTY_THRESHOLD     5
#define DIRT_HEAVY_THRESHOLD      3000

#define FILL_TIMEOUT_MS           10000
#define MIX_DURATION_MS           5000
#define HEAVY_WASH_DURATION_MS    15000
#define NORMAL_WASH_DURATION_MS   8000
#define SPIN_DURATION_MS          5000
#define DONE_AUTO_OFF_MS          10000
#define SENSING_DELAY_MS          2000

#define DEBOUNCE_DELAY_MS         50
#define BEEP_INTERVAL_MS          500
#define LOOP_DELAY_MS             20
#define MQTT_INTERVAL_MS          2000

#define LCD_ADDRESS               0x27
#define LCD_COLS                  20
#define LCD_ROWS                  4

// ============================================
// CÁC TRẠNG THÁI MÁY GIẶT
// ============================================
enum State { 
  POWER_OFF, READY, CHECK_SYSTEM, FILLING, MIXING,
  SENSING, WASHING, DRAINING, SPINNING, PAUSED,
  ERROR_DOOR, ERROR_WATER, DONE
};

const char* stateNames[] = {
  "POWER_OFF", "READY", "CHECK_SYSTEM", "FILLING", "MIXING",
  "SENSING", "WASHING", "DRAINING", "SPINNING", "PAUSED",
  "ERROR_DOOR", "ERROR_WATER", "DONE"
};

// ============================================
// INSTANCES
// ============================================
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ============================================
// BIẾN TOÀN CỤC
// ============================================
State currentState = POWER_OFF;
State previousState = READY;

unsigned long phaseStartTime = 0;
unsigned long savedElapsedTime = 0;
unsigned long washDuration = NORMAL_WASH_DURATION_MS;
unsigned long lastBeepTime = 0;
unsigned long sensingStartTime = 0;
unsigned long lastMqttPublish = 0;

unsigned long lastStartBtnTime = 0;
unsigned long lastPauseBtnTime = 0;
bool lastStartBtnState = HIGH;
bool lastPauseBtnState = HIGH;

String modeName = "NORMAL";
String currentOrderCode = "";
bool sensingSampled = false;
bool errorNotified = false;

// ============================================
// FORWARD DECLARATIONS
// ============================================
void stopAllRelays();
void beep(int freq, int dur);
int readWaterLevel();
int readDirtLevel();
void powerOff();
void powerOn();
int calculateProgress();

// ============================================
// WIFI SETUP
// ============================================
void setupWifi() {
  Serial.print("Connecting to WiFi");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi...");
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(attempts % 20, 1);
    lcd.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1500);
  } else {
    Serial.println("\nWiFi Failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed!");
    delay(1500);
  }
}

// ============================================
// MQTT CALLBACK - Nhận lệnh từ Admin
// ============================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("MQTT Received: ");
  Serial.println(message);
  
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("JSON parse error");
    return;
  }
  
  const char* command = doc["command"];
  
  // Lệnh PAUSE từ Admin
  if (strcmp(command, "PAUSE") == 0) {
    if (currentState != POWER_OFF && currentState != READY && 
        currentState != PAUSED && currentState != DONE &&
        currentState != ERROR_DOOR && currentState != ERROR_WATER) {
      previousState = currentState;
      savedElapsedTime = millis() - phaseStartTime;
      currentState = PAUSED;
      stopAllRelays();
      beep(800, 200);
      Serial.println(">>> Remote PAUSE");
      lcd.clear();
    }
  }
  // Lệnh RESUME từ Admin
  else if (strcmp(command, "RESUME") == 0) {
    if (currentState == PAUSED) {
      currentState = previousState;
      phaseStartTime = millis() - savedElapsedTime;
      beep(1500, 100);
      Serial.println(">>> Remote RESUME");
      lcd.clear();
    }
  }
  // Lệnh START từ Admin (với mã đơn)
  else if (strcmp(command, "START") == 0) {
    if (currentState == READY) {
      const char* orderCode = doc["orderCode"];
      if (orderCode) {
        currentOrderCode = String(orderCode);
      }
      currentState = CHECK_SYSTEM;
      phaseStartTime = millis();
      beep(2000, 100);
      Serial.println(">>> Remote START - Order: " + currentOrderCode);
      lcd.clear();
    }
  }
  // Gán mã đơn cho máy
  else if (strcmp(command, "SET_ORDER") == 0) {
    const char* orderCode = doc["orderCode"];
    if (orderCode) {
      currentOrderCode = String(orderCode);
      Serial.println(">>> Order assigned: " + currentOrderCode);
    }
  }
  // Lệnh RESET từ Admin
  else if (strcmp(command, "RESET") == 0) {
    powerOff();
    delay(500);
    powerOn();
    Serial.println(">>> Remote RESET");
  }
}

// ============================================
// MQTT CONNECT
// ============================================
void connectMqtt() {
  if (mqtt.connected()) return;
  
  Serial.print("Connecting MQTT...");
  String clientId = "ESP32_" + String(MACHINE_ID) + "_" + String(random(1000));
  
  if (mqtt.connect(clientId.c_str())) {
    Serial.println("Connected!");
    mqtt.subscribe(TOPIC_COMMAND.c_str());
    
    // Publish online status
    StaticJsonDocument<128> doc;
    doc["machineId"] = MACHINE_ID;
    doc["event"] = "ONLINE";
    doc["timestamp"] = millis();
    String json;
    serializeJson(doc, json);
    mqtt.publish(TOPIC_EVENTS.c_str(), json.c_str());
  } else {
    Serial.print("Failed, rc=");
    Serial.println(mqtt.state());
  }
}

// ============================================
// PUBLISH STATUS TO MQTT
// ============================================
void publishStatus() {
  if (millis() - lastMqttPublish < MQTT_INTERVAL_MS) return;
  lastMqttPublish = millis();
  
  if (!mqtt.connected()) return;
  
  int waterLevel = readWaterLevel();
  int progress = calculateProgress();
  
  StaticJsonDocument<512> doc;
  doc["machineId"] = MACHINE_ID;
  doc["state"] = stateNames[currentState];
  doc["progress"] = progress;
  doc["waterLevel"] = waterLevel;
  doc["mode"] = modeName;
  doc["orderCode"] = currentOrderCode;
  doc["doorOpen"] = (digitalRead(PIN_DOOR_SWITCH) == HIGH);
  doc["timestamp"] = millis();
  
  if (currentState == ERROR_DOOR) {
    doc["errorCode"] = "DOOR_OPEN";
  } else if (currentState == ERROR_WATER) {
    doc["errorCode"] = "WATER_TIMEOUT";
  }
  
  String json;
  serializeJson(doc, json);
  mqtt.publish(TOPIC_STATUS.c_str(), json.c_str());
}

// ============================================
// PUBLISH ERROR TO ADMIN
// ============================================
void publishError(const char* errorType, const char* errorMessage) {
  if (!mqtt.connected()) return;
  
  StaticJsonDocument<256> doc;
  doc["machineId"] = MACHINE_ID;
  doc["orderCode"] = currentOrderCode;
  doc["errorType"] = errorType;
  doc["errorMessage"] = errorMessage;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  mqtt.publish(TOPIC_ERROR.c_str(), json.c_str());
  
  Serial.println("Error published: " + String(errorType));
}

// ============================================
// PUBLISH DONE EVENT
// ============================================
void publishDone() {
  if (!mqtt.connected()) return;
  
  StaticJsonDocument<256> doc;
  doc["machineId"] = MACHINE_ID;
  doc["orderCode"] = currentOrderCode;
  doc["event"] = "DONE";
  doc["mode"] = modeName;
  doc["timestamp"] = millis();
  
  String json;
  serializeJson(doc, json);
  mqtt.publish(TOPIC_EVENTS.c_str(), json.c_str());
  
  Serial.println("Done event published");
}

// ============================================
// CALCULATE PROGRESS (0-100%)
// ============================================
int calculateProgress() {
  unsigned long elapsed;
  
  switch (currentState) {
    case POWER_OFF:
    case READY:
      return 0;
    case CHECK_SYSTEM:
      return 5;
    case FILLING:
      return map(readWaterLevel(), 0, WATER_FULL_THRESHOLD, 5, 15);
    case MIXING:
      elapsed = millis() - phaseStartTime;
      return map(constrain(elapsed, 0, MIX_DURATION_MS), 0, MIX_DURATION_MS, 15, 20);
    case SENSING:
      return 22;
    case WASHING:
      elapsed = millis() - phaseStartTime;
      return map(constrain(elapsed, 0, washDuration), 0, washDuration, 25, 70);
    case DRAINING:
      return map(readWaterLevel(), WATER_FULL_THRESHOLD, 0, 70, 85);
    case SPINNING:
      elapsed = millis() - phaseStartTime;
      return map(constrain(elapsed, 0, SPIN_DURATION_MS), 0, SPIN_DURATION_MS, 85, 100);
    case DONE:
      return 100;
    default:
      return 0;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
void beep(int freq, int dur) {
  tone(PIN_BUZZER, freq, dur);
}

void stopAllRelays() {
  digitalWrite(PIN_RELAY_MOTOR, LOW);
  digitalWrite(PIN_RELAY_VALVE, LOW);
}

int readWaterLevel() {
  return map(analogRead(PIN_POT_WATER), 0, 4095, 0, 100);
}

int readDirtLevel() {
  return analogRead(PIN_POT_DIRT);
}

bool readButtonDebounced(int pin, bool* lastState, unsigned long* lastTime) {
  bool reading = digitalRead(pin);
  if (*lastState == HIGH && reading == LOW) {
    if (millis() - *lastTime > DEBOUNCE_DELAY_MS) {
      *lastTime = millis();
      *lastState = reading;
      return true;
    }
  }
  if (reading == HIGH) *lastState = HIGH;
  return false;
}

void drawProgressBar(int row, int percent, const char* label) {
  lcd.setCursor(0, row);
  lcd.print(label);
  lcd.setCursor(10, row);
  lcd.print("[");
  int bars = map(constrain(percent, 0, 100), 0, 100, 0, 8);
  for (int i = 0; i < 8; i++) {
    lcd.print(i < bars ? "#" : " ");
  }
  lcd.print("]");
}

// ============================================
// POWER OFF / ON
// ============================================
void powerOff() {
  stopAllRelays();
  noTone(PIN_BUZZER);
  lcd.clear();
  lcd.setCursor(5, 1);
  lcd.print("POWER OFF");
  delay(1000);
  lcd.noBacklight();
  lcd.clear();
  
  currentState = POWER_OFF;
  currentOrderCode = "";
  modeName = "NORMAL";
  washDuration = NORMAL_WASH_DURATION_MS;
  sensingSampled = false;
  errorNotified = false;
}

void powerOn() {
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(2, 0);
  lcd.print("AI SMART WASHER");
  lcd.setCursor(3, 1);
  lcd.print(MACHINE_ID);
  beep(1000, 100);
  delay(150);
  beep(2000, 200);
  delay(1000);
  lcd.clear();
  currentState = READY;
  sensingSampled = false;
  errorNotified = false;
}

// ============================================
// BUTTON HANDLERS
// ============================================
void handleStartButton() {
  if (!readButtonDebounced(PIN_BTN_START, &lastStartBtnState, &lastStartBtnTime)) return;
  
  if (currentState == POWER_OFF) {
    powerOn();
  } else if (currentState == READY) {
    beep(2000, 100);
    currentState = CHECK_SYSTEM;
    phaseStartTime = millis();
    lcd.clear();
  } else {
    beep(500, 500);
    powerOff();
  }
}

void handlePauseButton() {
  if (!readButtonDebounced(PIN_BTN_PAUSE, &lastPauseBtnState, &lastPauseBtnTime)) return;
  
  if (currentState == PAUSED) {
    beep(2000, 100);
    currentState = previousState;
    phaseStartTime = millis() - savedElapsedTime;
    lcd.clear();
  } else if (currentState != POWER_OFF && currentState != READY && 
             currentState != DONE && currentState != ERROR_WATER && currentState != ERROR_DOOR) {
    beep(1000, 100);
    previousState = currentState;
    savedElapsedTime = millis() - phaseStartTime;
    currentState = PAUSED;
    stopAllRelays();
    lcd.clear();
  }
}

void checkDoorStatus() {
  bool doorOpen = (digitalRead(PIN_DOOR_SWITCH) == HIGH);
  
  if (doorOpen && currentState != POWER_OFF && currentState != READY && 
      currentState != PAUSED && currentState != DONE && 
      currentState != ERROR_DOOR && currentState != ERROR_WATER) {
    previousState = currentState;
    savedElapsedTime = millis() - phaseStartTime;
    currentState = ERROR_DOOR;
    stopAllRelays();
    errorNotified = false;
  } else if (!doorOpen && currentState == ERROR_DOOR) {
    currentState = PAUSED;
    lcd.clear();
  }
}

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AI Smart Washer ===");
  Serial.println("Machine ID: " + String(MACHINE_ID));
  
  // GPIO Setup
  pinMode(PIN_RELAY_MOTOR, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BTN_START, INPUT_PULLUP);
  pinMode(PIN_BTN_PAUSE, INPUT_PULLUP);
  pinMode(PIN_DOOR_SWITCH, INPUT_PULLUP);
  
  stopAllRelays();
  noTone(PIN_BUZZER);
  
  // LCD Setup
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  
  // WiFi Setup
  setupWifi();
  
  // MQTT Setup
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  
  // Start in READY state
  powerOn();
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  unsigned long currentMillis = millis();
  
  // Maintain MQTT connection
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) {
      connectMqtt();
    }
    mqtt.loop();
  }
  
  // Handle buttons
  handleStartButton();
  if (currentState == POWER_OFF) {
    delay(LOOP_DELAY_MS);
    return;
  }
  
  handlePauseButton();
  checkDoorStatus();
  
  // Publish status periodically
  publishStatus();
  
  // Read sensors
  int waterLvl = readWaterLevel();
  int dirtVal = readDirtLevel();
  
  // ============================================
  // STATE MACHINE
  // ============================================
  switch (currentState) {
    
    case READY:
      lcd.setCursor(0, 0); lcd.print("=== READY ===       ");
      lcd.setCursor(0, 1); lcd.print("ID: "); lcd.print(MACHINE_ID); lcd.print("      ");
      lcd.setCursor(0, 2); lcd.print("Press START button  ");
      lcd.setCursor(0, 3); lcd.print("Door: ");
      lcd.print(digitalRead(PIN_DOOR_SWITCH) == LOW ? "CLOSED" : "OPEN  ");
      break;

    case CHECK_SYSTEM:
      if (waterLvl > WATER_EMPTY_THRESHOLD) {
        lcd.setCursor(0, 0); lcd.print("! DRAINING OLD !    ");
        drawProgressBar(2, waterLvl, "Water:");
        digitalWrite(PIN_RELAY_VALVE, HIGH);
      } else {
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = FILLING;
        phaseStartTime = currentMillis;
        lcd.clear();
      }
      break;

    case FILLING:
      {
        digitalWrite(PIN_RELAY_VALVE, HIGH);
        lcd.setCursor(0, 0); lcd.print("FILLING WATER...    ");
        if (currentOrderCode.length() > 0) {
          lcd.setCursor(0, 1); lcd.print("Order: "); lcd.print(currentOrderCode);
        }
        drawProgressBar(2, waterLvl, "Level:");
        
        unsigned long elapsed = currentMillis - phaseStartTime;
        lcd.setCursor(0, 3);
        lcd.print("Timeout: ");
        lcd.print((FILL_TIMEOUT_MS - elapsed) / 1000);
        lcd.print("s   ");

        if (waterLvl >= WATER_FULL_THRESHOLD) {
          digitalWrite(PIN_RELAY_VALVE, LOW);
          currentState = MIXING;
          phaseStartTime = currentMillis;
          lcd.clear();
        } else if (elapsed >= FILL_TIMEOUT_MS) {
          digitalWrite(PIN_RELAY_VALVE, LOW);
          currentState = ERROR_WATER;
          errorNotified = false;
          lcd.clear();
        }
      }
      break;

    case ERROR_WATER:
      stopAllRelays();
      lcd.setCursor(0, 0); lcd.print("!!! WATER ERROR !!! ");
      lcd.setCursor(0, 1); lcd.print("Check water supply  ");
      lcd.setCursor(0, 2); lcd.print("Press GREEN to reset");
      
      if (!errorNotified) {
        publishError("WATER_ERROR", "Water fill timeout - check supply");
        errorNotified = true;
      }
      
      if (currentMillis - lastBeepTime >= BEEP_INTERVAL_MS) {
        beep(2000, 200);
        lastBeepTime = currentMillis;
      }
      break;

    case MIXING:
      {
        digitalWrite(PIN_RELAY_MOTOR, HIGH);
        lcd.setCursor(0, 0); lcd.print("MIXING CLOTHES...   ");
        
        unsigned long elapsed = currentMillis - phaseStartTime;
        int progress = (elapsed * 100) / MIX_DURATION_MS;
        drawProgressBar(2, progress, "Prog:");
        
        if (elapsed >= MIX_DURATION_MS) {
          digitalWrite(PIN_RELAY_MOTOR, LOW);
          currentState = SENSING;
          sensingStartTime = currentMillis;
          sensingSampled = false;
          lcd.clear();
        }
      }
      break;

    case SENSING:
      {
        lcd.setCursor(0, 0); lcd.print("AI SENSING...       ");
        lcd.setCursor(0, 1); lcd.print("Analyzing dirt level");
        lcd.setCursor(0, 3);
        lcd.print("Dirt: ");
        lcd.print(dirtVal);
        lcd.print(dirtVal > DIRT_HEAVY_THRESHOLD ? " (HEAVY)" : " (NORMAL)");
        
        if (!sensingSampled && (currentMillis - sensingStartTime >= SENSING_DELAY_MS)) {
          sensingSampled = true;
          if (dirtVal > DIRT_HEAVY_THRESHOLD) {
            modeName = "HEAVY";
            washDuration = HEAVY_WASH_DURATION_MS;
            beep(2000, 100);
          } else {
            modeName = "NORMAL";
            washDuration = NORMAL_WASH_DURATION_MS;
          }
          lcd.setCursor(0, 2);
          lcd.print("Mode: ");
          lcd.print(modeName);
          lcd.print("          ");
        }
        
        if (sensingSampled && (currentMillis - sensingStartTime >= SENSING_DELAY_MS * 2)) {
          currentState = WASHING;
          phaseStartTime = currentMillis;
          lcd.clear();
        }
      }
      break;

    case WASHING:
      {
        unsigned long elapsed = currentMillis - phaseStartTime;
        bool motorOn = ((elapsed / 2000) % 2 == 0);
        digitalWrite(PIN_RELAY_MOTOR, motorOn ? HIGH : LOW);

        lcd.setCursor(0, 0);
        lcd.print("WASHING: ");
        lcd.print(modeName);
        lcd.print("       ");
        
        lcd.setCursor(0, 1);
        lcd.print("Motor: ");
        lcd.print(motorOn ? ">>>" : "<<<");
        
        int progress = (elapsed * 100) / washDuration;
        drawProgressBar(2, progress, "Prog:");
        
        lcd.setCursor(0, 3);
        lcd.print("Time: ");
        lcd.print((washDuration - elapsed) / 1000);
        lcd.print("s   ");

        if (elapsed >= washDuration) {
          digitalWrite(PIN_RELAY_MOTOR, LOW);
          currentState = DRAINING;
          phaseStartTime = currentMillis;
          lcd.clear();
        }
      }
      break;

    case DRAINING:
      digitalWrite(PIN_RELAY_VALVE, HIGH);
      lcd.setCursor(0, 0); lcd.print("DRAINING...         ");
      drawProgressBar(2, waterLvl, "Level:");
      
      if (waterLvl <= WATER_EMPTY_THRESHOLD) {
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = SPINNING;
        phaseStartTime = currentMillis;
        lcd.clear();
      }
      break;

    case SPINNING:
      {
        digitalWrite(PIN_RELAY_MOTOR, HIGH);
        lcd.setCursor(0, 0); lcd.print("SPINNING...         ");
        
        unsigned long elapsed = currentMillis - phaseStartTime;
        int progress = map(elapsed, 0, SPIN_DURATION_MS, 0, 100);
        drawProgressBar(2, progress, "Prog:");
        
        lcd.setCursor(0, 3);
        lcd.print("Time: ");
        lcd.print((SPIN_DURATION_MS - elapsed) / 1000);
        lcd.print("s   ");
        
        if (elapsed >= SPIN_DURATION_MS) {
          digitalWrite(PIN_RELAY_MOTOR, LOW);
          currentState = DONE;
          phaseStartTime = currentMillis;
          publishDone(); // Notify server - sẽ gửi email cho khách
          beep(1000, 200);
          lcd.clear();
        }
      }
      break;

    case PAUSED:
      stopAllRelays();
      lcd.setCursor(0, 0); lcd.print("=== PAUSED ===      ");
      lcd.setCursor(0, 1); lcd.print("Order: "); 
      lcd.print(currentOrderCode.length() > 0 ? currentOrderCode : "N/A");
      lcd.setCursor(0, 2); lcd.print("YELLOW: Resume      ");
      lcd.setCursor(0, 3); lcd.print("GREEN: Power Off    ");
      break;

    case ERROR_DOOR:
      stopAllRelays();
      lcd.setCursor(0, 0); lcd.print("!!! DOOR OPEN !!!   ");
      lcd.setCursor(0, 1); lcd.print("Close door to       ");
      lcd.setCursor(0, 2); lcd.print("continue...         ");
      
      if (!errorNotified) {
        publishError("DOOR_ERROR", "Door opened during operation");
        errorNotified = true;
      }
      
      if (currentMillis - lastBeepTime >= BEEP_INTERVAL_MS) {
        beep(2000, 200);
        lastBeepTime = currentMillis;
      }
      break;

    case DONE:
      {
        stopAllRelays();
        lcd.setCursor(0, 0); lcd.print("=== COMPLETED ===   ");
        lcd.setCursor(0, 1); lcd.print("Order: "); 
        lcd.print(currentOrderCode.length() > 0 ? currentOrderCode : "N/A");
        lcd.setCursor(0, 2); lcd.print("Please collect!     ");
        
        unsigned long elapsed = currentMillis - phaseStartTime;
        lcd.setCursor(0, 3);
        lcd.print("Auto off: ");
        lcd.print((DONE_AUTO_OFF_MS - elapsed) / 1000);
        lcd.print("s   ");
        
        if (currentMillis - lastBeepTime >= 1000) {
          beep(2000, 100);
          lastBeepTime = currentMillis;
        }
        
        if (elapsed >= DONE_AUTO_OFF_MS) {
          currentOrderCode = "";
          powerOff();
          delay(500);
          powerOn();
        }
      }
      break;
  }
  
  delay(LOOP_DELAY_MS);
}
