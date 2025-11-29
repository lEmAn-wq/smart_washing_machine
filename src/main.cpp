#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define RELAY_PIN 26
#define LED_GREEN 27
#define LED_RED   14
#define BTN_PIN   25

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BTN_PIN, INPUT_PULLUP);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Miele Brain v1.0");
  lcd.setCursor(0, 1);
  lcd.print("Ready...");
}

void loop() {
  if (digitalRead(BTN_PIN) == LOW) {
    digitalWrite(RELAY_PIN, HIGH);
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
    lcd.setCursor(0, 1);
    lcd.print("Running...      ");
    Serial.println("Máy giặt: BẬT");
  } else {
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, HIGH);
    lcd.setCursor(0, 1);
    lcd.print("Ready...        ");
    Serial.println("Máy giặt: TẮT");
  }
  delay(200);
}