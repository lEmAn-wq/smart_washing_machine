#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <Adafruit_FT6206.h>

// --- CẤU HÌNH CHÂN (PINS) ---
// Màn hình TFT (SPI)
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  4
// Các chân khác
#define PIN_RELAY_MOTOR 26
#define PIN_RELAY_VALVE 32
#define PIN_POT_WATER   34
#define PIN_POT_DIRT    35
#define PIN_DOOR_SWITCH 13  // Đã chuyển sang 13 để tránh trùng TFT_CS
#define ILI9341_BROWN 0xA145

// --- KHỞI TẠO ĐỐI TƯỢNG ---
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);
Adafruit_FT6206 ts = Adafruit_FT6206(); // Cảm ứng

// --- MÁY TRẠNG THÁI ---
enum State { READY, FILLING, WASHING, PAUSED, ERROR_DOOR, DONE };
State currentState = READY;
State previousState = READY;

unsigned long startTime = 0;
unsigned long washDuration = 10000;
unsigned long finalDuration = 10000;
unsigned long elapsedTime = 0;
bool isDirtyDetected = false;

// --- GIAO DIỆN (UI) ---
// Định nghĩa vùng nút bấm (Start Button)
int btnX = 60, btnY = 200, btnW = 120, btnH = 40;

void drawButton(const char* label, uint16_t color) {
  tft.fillRoundRect(btnX, btnY, btnW, btnH, 10, color);
  tft.drawRoundRect(btnX, btnY, btnW, btnH, 10, ILI9341_WHITE);
  tft.setCursor(btnX + 25, btnY + 12);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  tft.print(label);
}

void drawStatus(const char* status, uint16_t color) {
  // Xóa vùng chữ cũ
  tft.fillRect(10, 60, 220, 30, ILI9341_BLACK); 
  tft.setCursor(10, 65);
  tft.setTextColor(color);
  tft.setTextSize(2);
  tft.print(status);
}

void drawProgressBar(int x, int y, int w, int h, int percent, uint16_t color, const char* label) {
  tft.drawRect(x, y, w, h, ILI9341_WHITE);
  int fillW = (w * percent) / 100;
  tft.fillRect(x+1, y+1, fillW-2, h-2, color);
  tft.fillRect(x+1+fillW, y+1, w-fillW-2, h-2, ILI9341_BLACK); // Xóa phần dư
  
  tft.setCursor(x, y - 15);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(1);
  tft.print(label);
  tft.print(" ");
  tft.print(percent);
  tft.print("%");
}

void setup() {
  Serial.begin(115200);

  // Cấu hình chân
  pinMode(PIN_RELAY_MOTOR, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_DOOR_SWITCH, INPUT_PULLUP);
  
  digitalWrite(PIN_RELAY_MOTOR, LOW);
  digitalWrite(PIN_RELAY_VALVE, LOW);

  // Khởi động màn hình
  tft.begin();
  tft.setRotation(1); // Xoay ngang
  tft.fillScreen(ILI9341_BLACK);
  
  // Tiêu đề
  tft.setCursor(40, 10);
  tft.setTextColor(ILI9341_CYAN);
  tft.setTextSize(3);
  tft.print("SMART WASH");

  // Khởi động cảm ứng
  if (!ts.begin(40)) { 
    Serial.println("Touchscreen not started!");
  }

  // Vẽ giao diện ban đầu
  drawButton("START", ILI9341_GREEN);
  drawStatus("READY...", ILI9341_WHITE);
}

void loop() {
  // 1. XỬ LÝ CẢM ỨNG (TOUCH)
  static unsigned long lastTouchTime = 0;
  if (ts.touched() && millis() - lastTouchTime > 500) { // Chống dội (Debounce) 500ms
    TS_Point p = ts.getPoint();
    // Chuyển đổi tọa độ (Map) vì cảm ứng và màn hình có thể lệch trục
    int y = map(p.x, 0, 240, 240, 0); 
    int x = map(p.y, 0, 320, 320, 0);
    
    // Kiểm tra xem có chạm vào vùng nút bấm không
    if (x > btnX && x < (btnX + btnW) && y > btnY && y < (btnY + btnH)) {
      lastTouchTime = millis();
      
      // Logic xử lý nút bấm
      if (currentState == READY) {
        currentState = FILLING;
        drawButton("PAUSE", ILI9341_ORANGE);
      } else if (currentState == FILLING || currentState == WASHING) {
        previousState = currentState;
        currentState = PAUSED;
        drawButton("RESUME", ILI9341_GREEN);
      } else if (currentState == PAUSED) {
        currentState = previousState;
        if (currentState == WASHING) startTime = millis() - elapsedTime;
        drawButton("PAUSE", ILI9341_ORANGE);
      } else if (currentState == DONE) {
        currentState = READY;
        drawButton("START", ILI9341_GREEN);
      }
    }
  }

  // 2. KIỂM TRA CỬA
  if (digitalRead(PIN_DOOR_SWITCH) == HIGH) { // Cửa mở
    if (currentState != ERROR_DOOR && currentState != READY && currentState != DONE) {
      previousState = currentState;
      currentState = ERROR_DOOR;
      drawStatus("!! DOOR OPEN !!", ILI9341_RED);
      drawButton("STOPPED", ILI9341_RED);
    }
  } else if (currentState == ERROR_DOOR && digitalRead(PIN_DOOR_SWITCH) == LOW) {
    currentState = PAUSED; // Đóng lại thì cho phép Resume
    drawStatus("Paused...", ILI9341_YELLOW);
    drawButton("RESUME", ILI9341_GREEN);
  }

  // 3. LOGIC TRẠNG THÁI
  switch (currentState) {
    case READY:
      drawStatus("READY", ILI9341_WHITE);
      isDirtyDetected = false;
      finalDuration = washDuration;
      break;

    case FILLING:
      digitalWrite(PIN_RELAY_VALVE, HIGH);
      digitalWrite(PIN_RELAY_MOTOR, LOW);
      
      {
        int rawWater = analogRead(PIN_POT_WATER);
        int waterLvl = map(rawWater, 0, 4095, 0, 100);
        drawStatus("Filling Water...", ILI9341_CYAN);
        drawProgressBar(40, 100, 240, 20, waterLvl, ILI9341_BLUE, "Water Level");
        
        if (waterLvl > 80) {
          currentState = WASHING;
          startTime = millis();
          elapsedTime = 0;
          digitalWrite(PIN_RELAY_VALVE, LOW);
          // Xóa thanh nước để vẽ thanh tiến độ giặt
          tft.fillRect(40, 100, 240, 40, ILI9341_BLACK); 
        }
      }
      break;

    case WASHING:
      digitalWrite(PIN_RELAY_MOTOR, HIGH);
      elapsedTime = millis() - startTime;
      
      // Xử lý cảm biến bẩn
      if (!isDirtyDetected) {
        int dirtVal = analogRead(PIN_POT_DIRT);
        int dirtPercent = map(dirtVal, 0, 4095, 0, 100);
        // Vẽ thanh độ bẩn (chỉ để debug)
        drawProgressBar(40, 150, 240, 10, dirtPercent, ILI9341_BROWN, "Dirtiness");
        
        if (dirtVal > 2000) { // Bẩn quá 50%
          isDirtyDetected = true;
          finalDuration += 5000;
          tft.setCursor(40, 130);
          tft.setTextColor(ILI9341_RED);
          tft.print("DIRTY! +5s Added");
        }
      }

      {
        int progress = (elapsedTime * 100) / finalDuration;
        if (progress > 100) progress = 100;
        drawStatus("Washing...", ILI9341_GREEN);
        drawProgressBar(40, 100, 240, 20, progress, ILI9341_GREEN, "Progress");
        
        if (elapsedTime >= finalDuration) {
          currentState = DONE;
        }
      }
      break;

    case PAUSED:
      digitalWrite(PIN_RELAY_MOTOR, LOW);
      digitalWrite(PIN_RELAY_VALVE, LOW);
      drawStatus("PAUSED", ILI9341_YELLOW);
      break;

    case DONE:
      digitalWrite(PIN_RELAY_MOTOR, LOW);
      drawStatus("FINISHED!", ILI9341_MAGENTA);
      drawButton("RESET", ILI9341_BLUE);
      break;
      
    case ERROR_DOOR:
      digitalWrite(PIN_RELAY_MOTOR, LOW);
      digitalWrite(PIN_RELAY_VALVE, LOW);
      break;
  }
  
  delay(100); // Cập nhật màn hình mỗi 100ms
}