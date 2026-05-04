// ════════════════════════════════════════════
// THERMAL MONITOR — Arduino
// MAX31855 + LM35 + control manual/automático del ventilador
// ════════════════════════════════════════════

#include <SPI.h>
#include "Adafruit_MAX31855.h"

// ── PINES ────────────────────────────────────
#define MAXDO   3
#define MAXCS   4
#define MAXCLK   5
#define PIN_RELAY 7
#define PIN_LM35  A0

// ── CALIBRACIÓN LM35 ─────────────────────────
const float VREF       = 1.1;   
const int   ADC_RES    = 1024;
const int   N_MUESTRAS = 100;
float       OFFSET     = 0.0;    
float       FACTOR     = 1.0;    

// ── PARÁMETROS ───────────────────────────────
int setpoint = 35;                 // setpoint por defecto
bool modoManual = false;           // false = automático por setpoint, true = manual
bool relayEstado = false;          // false = apagado, true = encendido (para manual)

Adafruit_MAX31855 thermocouple(MAXCLK, MAXCS, MAXDO);

float leerLM35() {
  analogRead(PIN_LM35);
  delay(5);
  long suma = 0;
  for (int i = 0; i < N_MUESTRAS; i++) {
    suma += analogRead(PIN_LM35);
    delay(2);
  }
  float adc = (float)suma / N_MUESTRAS;
  float voltaje = (adc * VREF) / ADC_RES;
  float tRaw = voltaje * 100.0;
  return (tRaw * FACTOR) + OFFSET;
}

void aplicarRelay() {
  if (modoManual) {
    digitalWrite(PIN_RELAY, relayEstado ? LOW : HIGH);   // LOW = encendido, HIGH = apagado
  } else {
    // modo automático: se decide por error (setpoint - temp)
    // El control se hace en loop, pero aquí no es necesario.
  }
}

void setup() {
  Serial.begin(115200);
  analogReference(INTERNAL);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, HIGH); // apagado
  delay(500);
  Serial.println("THERMAL MONITOR LISTO");
  Serial.print("Setpoint inicial: ");
  Serial.println(setpoint);
}

void loop() {
  // ── Leer comandos del puerto serie ──
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("SET:")) {
      int nuevoSet = cmd.substring(4).toInt();
      if (nuevoSet > 0 && nuevoSet < 200) {
        setpoint = nuevoSet;
        Serial.print("Setpoint actualizado: ");
        Serial.println(setpoint);
      }
    }
    else if (cmd.startsWith("RELAY:")) {
      String estado = cmd.substring(6);
      estado.trim();
      if (estado == "1") {
        modoManual = true;
        relayEstado = true;
        digitalWrite(PIN_RELAY, LOW);   // encender
        Serial.println("Ventilador encendido MANUALMENTE");
      }
      else if (estado == "0") {
        modoManual = true;
        relayEstado = false;
        digitalWrite(PIN_RELAY, HIGH);  // apagar
        Serial.println("Ventilador apagado MANUALMENTE");
      }
    }
    else if (cmd.startsWith("AUTO")) {
      modoManual = false;
      Serial.println("Modo automático (setpoint) activado");
    }
  }

  // ── Lecturas ──
  float time_seconds = millis() / 1000.0;
  double tTermo = thermocouple.readCelsius();
  float tAmb = leerLM35();

  if (isnan(tTermo)) {
    Serial.println("Error en termopar!");
    delay(1000);
    return;
  }

  float error = setpoint - tTermo;

  // ── Control automático si no está en modo manual ──
  if (!modoManual) {
    if (error < 0) {
      digitalWrite(PIN_RELAY, LOW);   // encender
    } else {
      digitalWrite(PIN_RELAY, HIGH);  // apagar
    }
  }

  // ── Enviar datos al PC (mismo formato) ──
  Serial.print("Tiempo_s: ");
  Serial.print(time_seconds, 2);
  Serial.print(" | Temp: ");
  Serial.print(tTermo, 2);
  Serial.print(" | TAmb: ");
  Serial.print(tAmb, 2);
  Serial.print(" | Error: ");
  Serial.print(error, 2);
  Serial.print(" | Modo: ");
  Serial.println(modoManual ? "MANUAL" : "AUTO");

  delay(1000);
}