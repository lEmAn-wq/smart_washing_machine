#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- CẤU HÌNH CHÂN ---
#define PIN_RELAY_MOTOR 26  
#define PIN_RELAY_VALVE 32  
#define PIN_POT_WATER   34  
#define PIN_POT_DIRT    35  
#define PIN_DOOR_SWITCH 13  
#define PIN_BUZZER      15  

#define PIN_BTN_START   12  // Nút Xanh (Start / Power)
#define PIN_BTN_PAUSE   14  // Nút Vàng (Pause / Resume)

LiquidCrystal_I2C lcd(0x27, 20, 4);

// --- CÁC TRẠNG THÁI ---
enum State { 
  POWER_OFF,        
  READY,            
  CHECK_SYSTEM,     
  FILLING,          
  MIXING,           
  SENSING,          
  WASHING,          
  DRAINING,         
  SPINNING,         
  PAUSED,           
  ERROR_DOOR,       
  ERROR_WATER,      
  DONE              
};

State currentState = POWER_OFF; // Mặc định tắt
State previousState = READY;

unsigned long phaseStartTime = 0;
unsigned long savedElapsedTime = 0;
unsigned long washDuration = 10000; 
unsigned long spinDuration = 5000;
unsigned long lastBeepTime = 0; 
String modeName = "NORMAL";

// --- HÀM TIỆN ÍCH ---
void beep(int freq, int dur) { 
  tone(PIN_BUZZER, freq, dur); 
}

void drawProgressBar(int row, int percent, String label) {
  lcd.setCursor(0, row); lcd.print(label);
  lcd.setCursor(10, row); lcd.print("[");
  int bars = map(percent, 0, 100, 0, 8);
  for (int i = 0; i < 8; i++) {
    lcd.print(i < bars ? "#" : " ");
  }
  lcd.print("]");
}

// Hàm tắt máy
void powerOff() {
  digitalWrite(PIN_RELAY_MOTOR, LOW);
  digitalWrite(PIN_RELAY_VALVE, LOW);
  lcd.clear();
  lcd.setCursor(5, 1); lcd.print("POWER OFF");
  delay(1000);
  lcd.noBacklight();
  lcd.clear();
  currentState = POWER_OFF;
}

// Hàm bật máy
void powerOn() {
  lcd.backlight();
  lcd.display();
  lcd.clear();
  lcd.setCursor(2, 0); lcd.print("AI SMART WASHER");
  lcd.setCursor(6, 1); lcd.print("HELLO!");
  beep(1000, 100); delay(100); beep(2000, 200);
  delay(1000);
  lcd.clear();
  currentState = READY;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY_MOTOR, OUTPUT); pinMode(PIN_RELAY_VALVE, OUTPUT); pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BTN_START, INPUT_PULLUP); pinMode(PIN_BTN_PAUSE, INPUT_PULLUP);
  pinMode(PIN_DOOR_SWITCH, INPUT_PULLUP);
  
  digitalWrite(PIN_RELAY_MOTOR, LOW); digitalWrite(PIN_RELAY_VALVE, LOW); noTone(PIN_BUZZER);

  Wire.begin(21, 22); lcd.init(); 
  powerOff(); // Khởi động vào chế độ ngủ
}

void loop() {
  unsigned long currentMillis = millis();

  // --- 1. XỬ LÝ NÚT START (Xanh) ---
  // Chức năng: Bật nguồn, Bắt đầu giặt, hoặc Tắt nguồn (Reset)
  if (digitalRead(PIN_BTN_START) == LOW) {
    delay(200); // Chống dội
    if (currentState == POWER_OFF) {
      powerOn(); // Bật máy
    } else if (currentState == READY) {
      beep(2000, 100);
      currentState = CHECK_SYSTEM; // Bắt đầu chu trình
      lcd.clear();
    } else {
      // Đang chạy mà nhấn Start -> Tắt nguồn (Reset)
      beep(500, 500);
      powerOff();
    }
    while(digitalRead(PIN_BTN_START) == LOW); 
  }

  if (currentState == POWER_OFF) return;

  // --- 2. XỬ LÝ NÚT PAUSE (Vàng) ---
  // Chức năng: Tạm dừng / Tiếp tục
  if (digitalRead(PIN_BTN_PAUSE) == LOW) {
    delay(200);
    if (currentState == PAUSED) {
      // --- RESUME (Tiếp tục) ---
      beep(2000, 100);
      currentState = previousState;
      // Khôi phục mốc thời gian
      if (currentState == FILLING || currentState == MIXING || currentState == WASHING || currentState == SPINNING) {
         phaseStartTime = millis() - savedElapsedTime; 
      }
    } else if (currentState != READY && currentState != DONE && currentState != ERROR_WATER && currentState != ERROR_DOOR) {
      // --- PAUSE (Tạm dừng) ---
      beep(1000, 100);
      previousState = currentState;
      // Lưu lại thời gian đã trôi qua
      savedElapsedTime = millis() - phaseStartTime;
      currentState = PAUSED;
    }
  }

  // --- 3. KIỂM TRA CỬA ---
  if (digitalRead(PIN_DOOR_SWITCH) == HIGH) { // Cửa Mở
    if (currentState != READY && currentState != PAUSED && currentState != DONE && currentState != ERROR_DOOR && currentState != ERROR_WATER) {
      previousState = currentState; 
      savedElapsedTime = millis() - phaseStartTime; 
      currentState = ERROR_DOOR;
    }
  } else if (currentState == ERROR_DOOR && digitalRead(PIN_DOOR_SWITCH) == LOW) {
    // Đóng cửa -> Về Pause (chờ người dùng bấm Resume)
    currentState = PAUSED; 
    lcd.clear();
  }

  // --- 4. LOGIC MÁY TRẠNG THÁI ---
  int waterLvl = map(analogRead(PIN_POT_WATER), 0, 4095, 0, 100);

  switch (currentState) {
    case READY:
      lcd.setCursor(0, 0); lcd.print("STATUS: STANDBY     ");
      lcd.setCursor(0, 1); lcd.print("Press GREEN: Start  ");
      lcd.setCursor(0, 2); lcd.print("Press GREEN: PowerOff");
      break;

    case CHECK_SYSTEM:
      if (waterLvl > 5) {
        lcd.setCursor(0, 0); lcd.print("! DRUM NOT EMPTY !  ");
        lcd.setCursor(0, 2); lcd.print("Please Drain: 0%    ");
        drawProgressBar(3, waterLvl, "Lvl:");
        digitalWrite(PIN_RELAY_VALVE, HIGH); 
      } else {
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = FILLING;
        phaseStartTime = currentMillis;
        lcd.clear();
      }
      break;

    case FILLING: 
      digitalWrite(PIN_RELAY_VALVE, HIGH);
      lcd.setCursor(0, 0); lcd.print("STEP: FILLING...    ");
      drawProgressBar(2, waterLvl, "Lvl:");
      
      savedElapsedTime = currentMillis - phaseStartTime;
      lcd.setCursor(0, 3); 
      lcd.print("Timeout: "); lcd.print(10 - savedElapsedTime/1000); lcd.print("s ");

      if (waterLvl > 90) { 
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = MIXING;
        phaseStartTime = currentMillis;
        lcd.clear();
      } 
      else if (savedElapsedTime > 10000) { 
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = ERROR_WATER;
        lcd.clear();
      }
      break;

    case ERROR_WATER: 
      lcd.setCursor(0, 0); lcd.print("!!! WATER ERROR !!! ");
      lcd.setCursor(0, 1); lcd.print("Check Water Supply  ");
      
      if (currentMillis - lastBeepTime > 500) {
        beep(2000, 200); 
        lastBeepTime = currentMillis;
      }
      break;

    case MIXING: 
      digitalWrite(PIN_RELAY_MOTOR, HIGH);
      lcd.setCursor(0, 0); lcd.print("STEP: CHECKING...   ");
      lcd.setCursor(0, 1); lcd.print("Mixing Load (5s)    ");
      
      if (currentMillis - phaseStartTime > 5000) {
         digitalWrite(PIN_RELAY_MOTOR, LOW);
         currentState = SENSING;
         lcd.clear();
      }
      break;

    case SENSING:
      lcd.setCursor(0, 0); lcd.print("STEP: AI SENSING... ");
      
      {
        int dirtVal = analogRead(PIN_POT_DIRT);
        lcd.setCursor(0, 3); 
        lcd.print("Val: " + String(dirtVal) + " (>3000=D)"); 
        delay(100); 
        
        // Delay không chặn để hiển thị, nhưng thực tế nên dùng timer.
        // Ở đây dùng delay nhỏ trong loop SENSING cũng ổn.
        if (currentMillis % 2000 < 100) { // Cứ 2s check 1 lần để chốt
             if (dirtVal > 3000) {
                modeName = "HEAVY (Dirty)";
                washDuration = 15000;
                beep(2000, 100); beep(2000, 100);
             } else {
                modeName = "NORMAL (Clean)";
                washDuration = 8000;
             }
             lcd.setCursor(0, 2); lcd.print("Mode: " + modeName);
             delay(2000); 
             
             currentState = WASHING;
             phaseStartTime = millis();
             lcd.clear();
        }
      }
      break;

    case WASHING:
      {
        unsigned long progressTime = currentMillis - phaseStartTime;
        if ((progressTime / 2000) % 2 == 0) digitalWrite(PIN_RELAY_MOTOR, HIGH);
        else digitalWrite(PIN_RELAY_MOTOR, LOW);

        lcd.setCursor(0, 0); lcd.print("WASHING: " + modeName);
        int prog = (progressTime * 100) / washDuration;
        drawProgressBar(2, prog, "Prog:");
        
        long left = (washDuration - progressTime)/1000;
        lcd.setCursor(0, 3); lcd.print("Time: " + String(left) + "s   ");

        if (progressTime >= washDuration) {
          digitalWrite(PIN_RELAY_MOTOR, LOW);
          currentState = DRAINING;
          lcd.clear();
        }
      }
      break;

    case DRAINING:
      digitalWrite(PIN_RELAY_VALVE, HIGH); 
      lcd.setCursor(0, 0); lcd.print("STEP: DRAINING...   ");
      drawProgressBar(2, waterLvl, "Drain:");
      lcd.setCursor(0, 3); lcd.print("(Pot -> 0%)         ");
      
      if (waterLvl < 5) { 
        digitalWrite(PIN_RELAY_VALVE, LOW);
        currentState = SPINNING;
        phaseStartTime = millis();
        lcd.clear();
      }
      break;
      
    case SPINNING:
      digitalWrite(PIN_RELAY_MOTOR, HIGH); 
      lcd.setCursor(0, 0); lcd.print("STEP: SPINNING      ");
      
      if (currentMillis - phaseStartTime >= spinDuration) {
        currentState = DONE;
        beep(1000, 200); delay(100); beep(2000, 500); 
        lcd.clear();
      }
      break;

    case PAUSED: // --- ĐÃ SỬA: BÁO BẤM NÚT VÀNG ---
      digitalWrite(PIN_RELAY_MOTOR, LOW); digitalWrite(PIN_RELAY_VALVE, LOW);
      lcd.setCursor(0, 0); lcd.print("!! PAUSED !!        ");
      lcd.setCursor(0, 2); lcd.print("Press YELLOW: Resume");
      lcd.setCursor(0, 3); lcd.print("Press GREEN: Off    ");
      break;

    case ERROR_DOOR: // --- ĐÃ SỬA: KÊU LIÊN TỤC ---
      digitalWrite(PIN_RELAY_MOTOR, LOW); digitalWrite(PIN_RELAY_VALVE, LOW);
      lcd.setCursor(0, 0); lcd.print("!!! DOOR ERROR !!!  ");
      lcd.setCursor(0, 2); lcd.print("Close Door Now!     ");
      
      if (currentMillis - lastBeepTime > 500) {
        beep(2000, 200); 
        lastBeepTime = currentMillis;
      }
      break;

    case DONE:
      digitalWrite(PIN_RELAY_MOTOR, LOW);
      lcd.setCursor(0, 0); lcd.print("   WASH FINISHED!   ");
      lcd.setCursor(0, 2); lcd.print("Auto Off in 5s...   ");
      delay(5000);
      powerOff();
      break;
  }
  delay(50);
}