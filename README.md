# ◈ Thermal Monitor — Ley de Enfriamiento/Calentamiento de Newton

> **Proyecto de Ecuaciones Diferenciales Ordinarias (EDO)**  
> Simulador experimental que modela el comportamiento térmico de un procesador mediante la Ley de Enfriamiento/Calentamiento de Newton, con adquisición de datos en tiempo real vía Arduino.

---

## Índice

1. [Fundamento Teórico — Planteamiento y Resolución de la EDO](#1-fundamento-teórico)
2. [Cálculo Analítico de los Parámetros](#2-cálculo-analítico-de-los-parámetros)
3. [Datos Experimentales Medidos](#3-datos-experimentales-medidos)
4. [Resultados y Validación del Modelo](#4-resultados-y-validación-del-modelo)
5. [Implementación Técnica — Hardware](#5-implementación-técnica--hardware)
6. [Implementación Técnica — Software](#6-implementación-técnica--software)
7. [Estructura del Proyecto](#7-estructura-del-proyecto)
8. [Instalación y Uso](#8-instalación-y-uso)

---

## 1. Fundamento Teórico

### Ley de Enfriamiento/Calentamiento de Newton

La Ley de Newton establece que **la tasa de cambio de temperatura de un objeto es proporcional a la diferencia entre su temperatura actual y la temperatura del entorno**:

```
dT/dt = -k · (T - T∞)
```

Donde:
- `T(t)` — temperatura del objeto en el instante `t` (°C)
- `T∞`   — temperatura del entorno/ambiente (°C), constante
- `k`     — constante de proporcionalidad (s⁻¹), siempre positiva
- `t`     — tiempo (s)

### Resolución Analítica de la EDO — Fase de Enfriamiento

La EDO `dT/dt = -k(T - T∞)` es de variables separables:

```
dT / (T - T∞) = -k · dt
```

Integrando ambos lados:

```
∫ dT/(T - T∞) = ∫ -k dt

ln|T - T∞| = -kt + C
```

Aplicando condición inicial: en `t = 0`, `T = T₀`:

```
ln|T₀ - T∞| = C
```

Sustituyendo:

```
ln|T - T∞| - ln|T₀ - T∞| = -kt

ln[(T - T∞)/(T₀ - T∞)] = -kt
```

**Solución general — Enfriamiento Newton:**

```
T(t) = T∞ + (T₀ - T∞) · e^(-kt)
```

### Resolución Analítica de la EDO — Fase de Calentamiento

Durante el calentamiento, el objeto gana calor hacia una temperatura pico `T_pico`. La EDO es:

```
dT/dt = α · (T_pico - T)
```

Separando variables e integrando con condición inicial `T(0) = T_amb`:

```
∫ dT/(T_pico - T) = ∫ α dt

-ln|T_pico - T| = αt + C

Con T(0) = T_amb:  C = -ln(T_pico - T_amb)
```

**Solución general — Calentamiento:**

```
T(t) = T_amb + (T_pico - T_amb) · (1 - e^(-αt))
```

---

## 2. Cálculo Analítico de los Parámetros

### Cálculo de k — Constante de Enfriamiento

Partiendo de la solución:

```
T(t) = T∞ + (T₀ - T∞) · e^(-kt)

(T(t) - T∞) / (T₀ - T∞) = e^(-kt)

ln[(T(t) - T∞) / (T₀ - T∞)] = -kt
```

Despejando k:

```
k = -ln[(T(t) - T∞) / (T₀ - T∞)] / t
```

**Aplicando con datos reales (t = 90 s):**

```
k = -ln[(46.50 - 32.45) / (77.00 - 32.45)] / 90

k = -ln[14.05 / 44.55] / 90

k = -ln(0.3154) / 90

k = 1.1546 / 90

k ≈ 0.01283 s⁻¹
```

**Verificación con t = 30 s:**

```
k = -ln[(67.25 - 32.45) / (77.00 - 32.45)] / 30
k = -ln[34.80 / 44.55] / 30
k = -ln(0.7812) / 30
k = 0.2469 / 30
k ≈ 0.00823 s⁻¹
```

> El software calcula k automáticamente usando **regresión lineal sobre los datos completos** (mínimos cuadrados sobre `ln(T - T∞)` vs `t`), lo que da un valor más robusto que calcular con un solo punto.

### Cálculo de α — Constante de Calentamiento

De la solución de calentamiento, despejando α:

```
T(t) - T_amb = (T_pico - T_amb) · (1 - e^(-αt))

1 - e^(-αt) = (T(t) - T_amb) / (T_pico - T_amb)

e^(-αt) = 1 - (T(t) - T_amb) / (T_pico - T_amb)

α = -ln[1 - (T(t) - T_amb)/(T_pico - T_amb)] / t
```

**Aplicando con datos reales (t = 90 s):**

```
α = -ln[1 - (46.25 - 30.55)/(52.50 - 30.55)] / 90

α = -ln[1 - 15.70/21.95] / 90

α = -ln[1 - 0.7152] / 90

α = -ln(0.2848) / 90

α = 1.2556 / 90

α ≈ 0.01395 s⁻¹
```

---

## 3. Datos Experimentales Medidos

### Fase 1 — Calentamiento

| Tiempo (s) | T sensor (°C) | T amb LM35 (°C) |
|:----------:|:-------------:|:----------------:|
| 0          | 32.25         | 30.55            |
| 30         | 35.50         | 30.55            |
| 90         | 46.25         | 30.55            |
| 120        | 49.75         | 30.55            |
| 150        | 52.50 (pico)  | 30.55            |

**Parámetros calculados:**
- `T_amb` = 30.55 °C
- `T_pico` = 52.50 °C
- `α` = 0.01395 s⁻¹ (calculado analíticamente)

### Fase 2 — Enfriamiento Newton

| Tiempo (s) | T sensor (°C) | T amb LM35 (°C) |
|:----------:|:-------------:|:----------------:|
| 0          | 77.00         | 32.45            |
| 30         | 67.25         | 32.45            |
| 90         | 46.50         | 32.45            |
| 120        | 43.50         | 32.45            |
| 150        | 41.50         | 34.41            |

**Parámetros calculados:**
- `T∞` = 32.45 °C (promedio LM35)
- `T₀` = 77.00 °C
- `k` = 0.01268 s⁻¹ (calculado analíticamente)

---

## 4. Resultados y Validación del Modelo

### Modelos resultantes

**Enfriamiento Newton:**
```
T(t) = 32.45 + 44.55 · e^(-0.01268·t)
```

**Calentamiento:**
```
T(t) = 30.55 + 21.95 · (1 - e^(-0.01395·t))
```

### Verificación de ajuste

El software calcula automáticamente:

| Métrica | Descripción |
|---------|-------------|
| **R²** | Coeficiente de determinación (1.0 = ajuste perfecto) |
| **MAE** | Error Medio Absoluto entre modelo y sensor (°C) |
| **Error %** | `|T_real - T_modelo| / T_real × 100` promediado |

Un R² ≥ 0.95 indica que el modelo de Newton describe con alta precisión el comportamiento térmico observado.

### Análisis de discrepancias

Las diferencias entre el modelo teórico y los datos reales se deben a:

1. **Ruido del sensor MAX31855** — resolución de ±0.25°C
2. **Temperatura ambiente no perfectamente constante** — el LM35 registra variaciones reales
3. **El modelo asume enfriamiento Newton puro**, pero el objeto también irradia calor (Stefan-Boltzmann), que a temperaturas bajas es despreciable

---

## 5. Implementación Técnica — Hardware

### Componentes

| Componente | Función | Interfaz |
|-----------|---------|---------|
| Arduino UNO/Mega | Microcontrolador central | — |
| MAX31855 | Termopar tipo K, lectura de temperatura del objeto | SPI (pines 3,4,5) |
| LM35 | Sensor de temperatura ambiente | Analógico A0 |
| Relé de estado sólido | Control del ventilador de enfriamiento | Digital pin 7 |
| Ventilador 12V | Acelerar enfriamiento del objeto | Via relé |

### Diagrama de conexiones (Arduino)

```
MAX31855:
  DO  → pin 3
  CS  → pin 4
  CLK → pin 5
  VCC → 3.3V
  GND → GND

LM35:
  OUT → A0
  VCC → 5V
  GND → GND

Relé:
  IN  → pin 7
  COM → +12V fuente
  NO  → ventilador (+)
```

### Firmware Arduino

El Arduino envía por Serial (115200 baud) cada segundo:

```
Tiempo_s: 12.00 | Temp: 46.50 | TAmb: 32.45 | Error: -7.50
```

El sistema acepta comandos desde la PC:
- `RELAY:1` → Encender ventilador
- `RELAY:0` → Apagar ventilador

---

## 6. Implementación Técnica — Software

### Arquitectura

```
index.html ──── estructura UI, tres zonas de gráficas
style.css  ──── tema oscuro tipo terminal industrial
script.js  ──── toda la lógica:
                  ├── Web Serial API (Chrome/Edge)
                  ├── Adquisición en tiempo real (1 Hz)
                  ├── Detección automática del pico térmico
                  ├── Regresión lineal → α y k
                  ├── Cálculo de R², MAE, error porcentual
                  └── Renderizado con Chart.js 4.4
```

### Flujo de operación

```
CONECTAR ARDUINO → INICIAR CAPTURA → [sensor envía datos]
→ DETENER Y ANALIZAR → software detecta pico automáticamente
→ separa fase calentamiento / enfriamiento
→ calcula α y k por regresión lineal
→ dibuja curvas teóricas vs datos reales
→ muestra R², MAE, error %
```

### Algoritmo de cálculo de k (regresión lineal)

El software linealiza la ecuación de Newton tomando logaritmo natural:

```
ln(T(t) - T∞) = ln(T₀ - T∞) - k·t
```

Esto es una recta `y = b + m·x` donde `m = -k`.  
Se aplica mínimos cuadrados sobre todos los puntos de la fase de enfriamiento para obtener la pendiente `m`, y por tanto `k = -m`.

---

## 7. Estructura del Proyecto

```
Thermo/
├── index.html          # Interfaz principal
├── style.css           # Estilos (tema industrial oscuro)
├── script.js           # Lógica completa del simulador
├── arduino/
│   └── Thermo2.0.ino   # Firmware Arduino
└── README.md
```

---

## 8. Instalación y Uso

### Requisitos

- Navegador **Chrome** o **Edge** (para Web Serial API)
- Arduino IDE (solo para cargar el firmware)
- Servidor local para abrir el HTML (o extensión Live Server en VS Code)

### Pasos

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/thermal-monitor.git
   cd thermal-monitor
   ```

2. Carga el firmware en Arduino:
   - Abre `arduino/thermal_monitor.ino` en Arduino IDE
   - Instala la librería **Adafruit_MAX31855** desde el gestor de librerías
   - Sube el sketch al Arduino

3. Abre `index.html` con un servidor local (ej. Live Server en VS Code)

4. En el navegador:
   - Haz clic en **⏚ CONECTAR ARDUINO** y selecciona el puerto COM
   - Haz clic en **▶ INICIAR CAPTURA** para empezar
   - Al terminar el experimento, haz clic en **⏹️ DETENER Y ANALIZAR**
   - El software calcula y muestra automáticamente α, k, R² y error %

### Modo sin Arduino

Si no tienes el hardware conectado, el botón **INICIAR CAPTURA** solo funciona con Arduino conectado. Para demostración, modifica `startCapture()` en `script.js` eliminando la validación de conexión.

---

## Referencias

- Zill, D. G. (2018). *Ecuaciones Diferenciales con Aplicaciones de Modelado* (11ª ed.). Cengage Learning.
- [Ley de Newton en la Práctica — UNAM Zaragoza](https://blogceta.zaragoza.unam.mx/vbioedo/ley-de-newton/)
- [Guía de EDO — Ejemplo de Enfriamiento (ULL)](https://campusvirtual.ull.es/ocw/pluginfile.php/10358/mod_resource/content/18/T8%20EDO%20Ejemplo.pdf)
- Adafruit MAX31855 Library — [github.com/adafruit/Adafruit-MAX31855-library](https://github.com/adafruit/Adafruit-MAX31855-library)

---

*Proyecto desarrollado para la materia de Ecuaciones Diferenciales — Ingeniería.*
