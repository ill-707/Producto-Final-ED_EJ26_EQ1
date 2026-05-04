// ═══════════════════════════════════════════════════════════════════
// THERMAL MONITOR — Captura en tiempo real + análisis post-captura
// Dos gráficas separadas: calentamiento (exponencial) y enfriamiento (Newton)
// ═══════════════════════════════════════════════════════════════════

// --- Datos capturados ---
let timeData = [], tempData = [], ambData = [];
let sampleCount = 0, startTime = null, intervalId = null, isCapturing = false;
let liveChart;                 // gráfica en tiempo real (solo sensor)
let heatingChart, coolingChart; // gráficas de calentamiento y enfriamiento
let serialPort = null, isConnected = false;
let serialWriter = null;
let lastTemp = null, tempMin = Infinity, tempMax = -Infinity;
let serialBuffer = '';
let lastTAmb = null;


const TEMP_MIN_RANGE = 20, TEMP_MAX_RANGE = 85;


// --- Control manual del ventilador ---
let relayState = false; // false = apagado, true = encendido





async function setRelay(on) {
  if (!isConnected || !serialWriter) {
    console.error("❌ No conectado o serialWriter no disponible");
    alert("Arduino no conectado. Conéctalo primero.");
    return;
  }
  const cmd = on ? "RELAY:1\n" : "RELAY:0\n";
  try {
    // Asegurarse de usar TextEncoder para enviar el string como bytes
    const encoder = new TextEncoder();
    await serialWriter.write(encoder.encode(cmd));
    console.log(`✅ Comando enviado: ${cmd.trim()}`);
    // Actualizar botón visualmente
    const btn = document.getElementById('relayToggleBtn');
    if (btn) {
      btn.textContent = on ? "🌀 VENTILADOR ON" : "🌀 VENTILADOR OFF";
      btn.style.borderColor = on ? "var(--green)" : "var(--dim)";
    }
    relayState = on;
  } catch (err) {
    console.error("Error al enviar comando:", err);
    alert("Error al enviar comando. Revisa la conexión.");
  }
}

// Evento del botón (asegúrate de que el botón exista en el HTML)
const relayBtn = document.getElementById('relayToggleBtn');
if (relayBtn) {
  relayBtn.onclick = () => {
    setRelay(!relayState);
  };
} else {
  console.warn("Botón 'relayToggleBtn' no encontrado en el DOM");
}


// --- Reloj ---
function updateClock() {
  document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('es-MX');
}
setInterval(updateClock, 1000);
updateClock();

// --- Gauge ---
function setGauge(tempC) {
  const pct = Math.max(0, Math.min(1, (tempC - TEMP_MIN_RANGE) / (TEMP_MAX_RANGE - TEMP_MIN_RANGE)));
  const ARC_LEN = 414;
  const dashOffset = ARC_LEN - (pct * ARC_LEN);
  const arc = document.getElementById('gaugeArc');
  if (arc) arc.setAttribute('stroke-dashoffset', dashOffset.toFixed(1));
  const color = pct < 0.35 ? '#2A86D4' : pct < 0.65 ? '#F5A623' : '#E03C2E';
  if (arc) arc.setAttribute('stroke', color);
  document.getElementById('gaugeTempVal').textContent = tempC.toFixed(1);
  document.getElementById('miniBarFill').style.width = (pct * 100) + '%';
}

// --- Inicializar gráfica en tiempo real ---
function initLiveChart() {
  const canvas = document.getElementById('lineChart');
  if (!canvas) return;
  if (liveChart) liveChart.destroy();
  const ctx = canvas.getContext('2d');
  liveChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Sensor MAX31855', data: [], borderColor: '#E03C2E', borderWidth: 2, pointRadius: 3, fill: false, tension: 0.2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { title: { display: true, text: 'Tiempo (s)' } }, y: { min: 20, max: 85, title: { display: true, text: 'Temperatura (°C)' } } },
      plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}°C` } } }
    }
  });
}

// --- Inicializar gráficas de calentamiento y enfriamiento (vacías) ---
function initHeatingCoolingCharts() {
  const heatCanvas = document.getElementById('heatingChart');
  const coolCanvas = document.getElementById('coolingChart');
  if (!heatCanvas || !coolCanvas) return;
  if (heatingChart) heatingChart.destroy();
  if (coolingChart) coolingChart.destroy();
  const ctxHeat = heatCanvas.getContext('2d');
  const ctxCool = coolCanvas.getContext('2d');
  heatingChart = new Chart(ctxHeat, {
    type: 'scatter',
    data: { datasets: [{ label: 'Datos reales', data: [], backgroundColor: '#E03C2E', pointRadius: 4 },
                       { label: 'Ajuste exponencial', data: [], type: 'line', borderColor: '#2A86D4', borderWidth: 2, fill: false }] },
    options: { scales: { x: { title: { display: true, text: 'Tiempo (s)' } }, y: { title: { display: true, text: 'Temperatura (°C)' }, min: 20, max: 85 } } }
  });
  coolingChart = new Chart(ctxCool, {
    type: 'scatter',
    data: { datasets: [{ label: 'Datos reales', data: [], backgroundColor: '#E03C2E', pointRadius: 4 },
                       { label: 'Ley de Newton', data: [], type: 'line', borderColor: '#2A86D4', borderWidth: 2, fill: false }] },
    options: { scales: { x: { title: { display: true, text: 'Tiempo desde pico (s)' } }, y: { title: { display: true, text: 'Temperatura (°C)' }, min: 20, max: 85 } } }
  });
}

// --- Añadir punto de datos en tiempo real ---
function addDataPoint(t, temp, tAmb) {
  timeData.push(t);
  tempData.push(temp);
  if (tAmb !== null && !isNaN(tAmb)) {
    lastTAmb = tAmb;
    ambData.push(tAmb);
    document.getElementById('tempAmbVal').textContent = tAmb.toFixed(1) + '°C';
    document.getElementById('statTAmb').textContent = tAmb.toFixed(1) + ' °C';
  } else {
    ambData.push(lastTAmb);
  }
  if (timeData.length > 500) { timeData.shift(); tempData.shift(); ambData.shift(); }
  sampleCount++;
  document.getElementById('sampleCount').textContent = sampleCount;
  document.getElementById('elapsedTime').textContent = t.toFixed(1);
  document.getElementById('statTime').textContent = t.toFixed(1) + ' s';

  if (temp < tempMin) { tempMin = temp; document.getElementById('tempMin').textContent = temp.toFixed(1) + '°C'; }
  if (temp > tempMax) { tempMax = temp; document.getElementById('tempMax').textContent = temp.toFixed(1) + '°C'; }

  // Tendencia
  if (lastTemp !== null) {
    const delta = temp - lastTemp;
    const trendEl = document.getElementById('tempTrend');
    if (delta > 0.3) trendEl.innerHTML = 'Tendencia: <span class="v" style="color:var(--accent)">↑ CALENTANDO</span>';
    else if (delta < -0.3) trendEl.innerHTML = 'Tendencia: <span class="v" style="color:var(--blue)">↓ ENFRIANDO</span>';
    else trendEl.innerHTML = 'Tendencia: <span class="v" style="color:var(--green)">→ ESTABLE</span>';
  }
  lastTemp = temp;
  setGauge(temp);

  // Lista de muestras
  const container = document.getElementById('sampleContainer');
  const item = document.createElement('div');
  item.className = 'sample-item';
  item.innerHTML = `<span class="ts">${new Date().toLocaleTimeString('es-MX')}</span><span class="tv">${temp.toFixed(2)}°C</span>`;
  container.prepend(item);
  if (container.children.length > 12) container.removeChild(container.lastChild);

  // Actualizar gráfica en tiempo real
  if (liveChart) {
    liveChart.data.labels = timeData.map(t => t.toFixed(1));
    liveChart.data.datasets[0].data = [...tempData];
    liveChart.update('none');
  }
}

// --- Calcular R² ---
function computeR2(observed, predicted) {
  if (observed.length < 2) return 0;
  const mean = observed.reduce((a, b) => a + b, 0) / observed.length;
  const ssTot = observed.reduce((a, b) => a + (b - mean) ** 2, 0);
  const ssRes = observed.reduce((a, b, i) => a + (b - predicted[i]) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

// --- Análisis principal: separar, calcular α y k, dibujar gráficas ---
function analizarYMostrarGraficas() {
  if (timeData.length < 5) {
    alert("Datos insuficientes. Captura más tiempo.");
    return;
  }

  // 1. Temperatura ambiente promedio (LM35)
  let ambVals = ambData.filter(v => v !== null && !isNaN(v));
  let Tamb = ambVals.length ? ambVals.reduce((a, b) => a + b, 0) / ambVals.length : 25;

  // 2. Encontrar pico máximo
  let peakIdx = 0;
  let peakTemp = tempData[0];
  for (let i = 1; i < tempData.length; i++) {
    if (tempData[i] > peakTemp) { peakTemp = tempData[i]; peakIdx = i; }
  }
  let t_peak = timeData[peakIdx];

  // ---- Calentamiento: datos desde inicio hasta el pico ----
  let heatTimes = timeData.slice(0, peakIdx + 1);
  let heatTemps = tempData.slice(0, peakIdx + 1);
  let alpha = 0.02;
  if (heatTimes.length >= 3 && Tamb < peakTemp) {
    let x = [], y = [];
    for (let i = 0; i < heatTimes.length; i++) {
      let ratio = (peakTemp - heatTemps[i]) / (peakTemp - Tamb);
      if (ratio > 0 && isFinite(ratio)) {
        x.push(heatTimes[i]);
        y.push(Math.log(ratio));
      }
    }
    if (x.length >= 2) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < x.length; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
      }
      const n = x.length;
      const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      alpha = -pendiente;
      if (alpha <= 0 || alpha > 0.1) alpha = 0.02;
    }
  }
  let heatModel = heatTimes.map(t => Tamb + (peakTemp - Tamb) * (1 - Math.exp(-alpha * t)));
  let r2Heat = computeR2(heatTemps, heatModel);

  // ---- Enfriamiento: datos desde el pico hasta el final ----
  let coolTimes = [], coolTemps = [];
  for (let i = peakIdx; i < timeData.length; i++) {
    coolTimes.push(timeData[i] - t_peak);
    coolTemps.push(tempData[i]);
  }
  let k = 0.02;
  if (coolTimes.length >= 3 && Tamb < peakTemp) {
    let x = [], y = [];
    for (let i = 0; i < coolTimes.length; i++) {
      let delta = coolTemps[i] - Tamb;
      if (delta > 0.1) {
        x.push(coolTimes[i]);
        y.push(Math.log(delta));
      }
    }
    if (x.length >= 2) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < x.length; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
      }
      const n = x.length;
      const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      k = -pendiente;
      if (k <= 0 || k > 0.2) k = 0.02;
    }
  }
  let coolModel = coolTimes.map(dt => Tamb + (peakTemp - Tamb) * Math.exp(-k * dt));
  let r2Cool = computeR2(coolTemps, coolModel);

  // --- Actualizar UI con parámetros calculados ---
  document.getElementById('alphaVal').textContent = alpha.toFixed(5);
  document.getElementById('kVal').textContent = k.toFixed(5);
  document.getElementById('heatingTinf').textContent = Tamb.toFixed(1) + '°C';
  document.getElementById('coolingTinf').textContent = Tamb.toFixed(1) + '°C';
  document.getElementById('heatingT0').textContent = peakTemp.toFixed(1) + '°C';
  document.getElementById('coolingT0').textContent = peakTemp.toFixed(1) + '°C';
  document.getElementById('r2Heating').textContent = r2Heat.toFixed(4);
  document.getElementById('r2Cooling').textContent = r2Cool.toFixed(4);
  
  // R² promedio (global)
  let r2Global = (r2Heat + r2Cool) / 2;
  document.getElementById('bigR2').textContent = r2Global.toFixed(4);
  document.getElementById('r2BarFill').style.width = (r2Global * 100) + '%';
  const r2color = r2Global >= 0.95 ? 'var(--green)' : (r2Global >= 0.8 ? 'var(--yellow)' : 'var(--accent)');
  document.getElementById('bigR2').style.color = r2color;
  document.getElementById('r2BarFill').style.background = r2color;

  // MAE general (sobre todos los puntos usando el modelo combinado)
  let combinedModel = [];
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] <= t_peak) {
      combinedModel.push(heatModel[i]);
    } else {
      let dt = timeData[i] - t_peak;
      combinedModel.push(Tamb + (peakTemp - Tamb) * Math.exp(-k * dt));
    }
  }
  const mae = tempData.reduce((a, b, i) => a + Math.abs(b - combinedModel[i]), 0) / tempData.length;
  document.getElementById('meanError').textContent = mae.toFixed(3) + ' °C';
  // --- Error porcentual ---
const errorPorcentual = tempData.map((real, i) => 
  Math.abs((real - combinedModel[i]) / real) * 100
);

const errorPromedio = errorPorcentual.reduce((a, b) => a + b, 0) / errorPorcentual.length;

// Mostrar en UI (asegúrate de tener este elemento en HTML)
document.getElementById('percentError').textContent = errorPromedio.toFixed(2) + ' %';

  // --- Dibujar gráficas separadas ---
  if (heatingChart) {
    heatingChart.data.datasets[0].data = heatTimes.map((t, i) => ({ x: t, y: heatTemps[i] }));
    heatingChart.data.datasets[1].data = heatTimes.map((t, i) => ({ x: t, y: heatModel[i] }));
    heatingChart.update();
  }
  if (coolingChart) {
    coolingChart.data.datasets[0].data = coolTimes.map((dt, i) => ({ x: dt, y: coolTemps[i] }));
    coolingChart.data.datasets[1].data = coolTimes.map((dt, i) => ({ x: dt, y: coolModel[i] }));
    coolingChart.update();
  }
  console.log(`✅ α = ${alpha.toFixed(5)}, k = ${k.toFixed(5)}, R²_cal = ${r2Heat.toFixed(4)}, R²_enf = ${r2Cool.toFixed(4)}`);
}

// --- Parseo de línea serial ---
function parseArduinoLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  document.getElementById('serialRaw').textContent = trimmed.slice(0, 60);
  const tempMatch = trimmed.match(/(?:Temp|Temperatura)[:= ]*([\d.]+)/i);
  const tambMatch = trimmed.match(/(?:TAmb|Tamb)[:= ]*([\d.]+)/i);
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1]);
    const tAmb = tambMatch ? parseFloat(tambMatch[1]) : null;
    if (!isNaN(temp) && isCapturing && startTime) {
      addDataPoint((Date.now() - startTime) / 1000, temp, tAmb);
    }
  }
}

// --- Web Serial API ---
async function connectArduino() {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    serialPort = port;
    isConnected = true;
    // Obtener writer directamente del puerto (más fiable)
    serialWriter = serialPort.writable.getWriter();
    const el = document.getElementById('connectionStatus');
    el.innerHTML = '';
    const dot = document.createElement('span');
    dot.className = 'pulse-dot';
    el.appendChild(dot);
    el.appendChild(document.createTextNode('CONECTADO'));
    el.className = 'status-pill connected';
    console.log('✅ Arduino conectado');
    // Pequeña pausa para estabilizar
    await new Promise(r => setTimeout(r, 500));
    readSerialData();
  } catch (err) {
    alert('No se pudo conectar. Usa Chrome o Edge.');
    console.error(err);
  }
}

async function setRelay(on) {
  if (!isConnected || !serialWriter) {
    console.error("❌ No conectado o serialWriter no disponible");
    alert("Arduino no conectado. Conéctalo primero.");
    return;
  }
  const cmd = on ? "RELAY:1\n" : "RELAY:0\n";
  try {
    // Enviar como Uint8Array para mayor seguridad
    const data = new TextEncoder().encode(cmd);
    await serialWriter.write(data);
    console.log(`✅ Comando enviado: ${cmd.trim()}`);
    // Actualizar botón visualmente
    const btn = document.getElementById('relayToggleBtn');
    if (btn) {
      btn.textContent = on ? "🌀 VENTILADOR ON" : "🌀 VENTILADOR OFF";
      btn.style.borderColor = on ? "var(--green)" : "var(--dim)";
    }
    relayState = on;
  } catch (err) {
    console.error("Error al enviar comando:", err);
    alert("Error al enviar comando. Revisa la conexión.");
  }
}
async function readSerialData() {
  const decoder = new TextDecoder();
  const reader = serialPort.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      serialBuffer += decoder.decode(value);
      const lines = serialBuffer.split('\n');
      serialBuffer = lines.pop();
      for (const line of lines) parseArduinoLine(line);
    }
  } catch (err) { console.error(err); } finally { reader.releaseLock(); }
}
async function disconnectArduino() {
  if (serialPort) {
    if (serialWriter) await serialWriter.close();
    await serialPort.close();
    serialPort = null;
    isConnected = false;
    const el = document.getElementById('connectionStatus');
    el.innerHTML = '<span class="pulse-dot red"></span>DESCONECTADO';
    el.className = 'status-pill disconnected';
    console.log('⛔ Arduino desconectado');
  }
}

// --- Captura y control ---
function startCapture() {
  // 🔒 VALIDACIÓN DE CONEXIÓN
  if (!isConnected || !serialPort) {
    alert("❌ No puedes iniciar sin conectar el Arduino.");
    console.warn("Intento de inicio sin conexión");
    return;
  }

  if (intervalId) clearInterval(intervalId);

  if (!isCapturing) {
    // Reiniciar todo
    timeData = []; tempData = []; ambData = [];
    sampleCount = 0; tempMin = Infinity; tempMax = -Infinity; lastTemp = null; lastTAmb = null;
    startTime = Date.now();
    isCapturing = true;
    document.getElementById('sampleContainer').innerHTML = '';
    initLiveChart();
    initHeatingCoolingCharts();
    document.getElementById('alphaVal').textContent = '---';
    document.getElementById('kVal').textContent = '---';
    document.getElementById('bigR2').textContent = '---';
    document.getElementById('meanError').textContent = '---';
    console.log("🚀 Captura iniciada");
  }
}

function stopAndAnalyze() {
  if (!isCapturing) {
    alert("No hay captura activa. Presiona 'INICIAR CAPTURA' primero.");
    return;
  }
  if (intervalId) clearInterval(intervalId);
  isCapturing = false;
  analizarYMostrarGraficas();
}

function resetAll() {
  if (intervalId) clearInterval(intervalId);
  isCapturing = false;
  startTime = null;
  timeData = []; tempData = []; ambData = [];
  sampleCount = 0; tempMin = Infinity; tempMax = -Infinity; lastTemp = null; lastTAmb = null;
  document.getElementById('sampleCount').textContent = '0';
  document.getElementById('elapsedTime').textContent = '0.0';
  document.getElementById('statTime').textContent = '0.0 s';
  document.getElementById('bigR2').textContent = '---';
  document.getElementById('meanError').textContent = '---';
  document.getElementById('serialRaw').textContent = '---';
  document.getElementById('tempMin').textContent = '--°C';
  document.getElementById('tempMax').textContent = '--°C';
  document.getElementById('tempAmbVal').textContent = '--°C';
  document.getElementById('statTAmb').textContent = '-- °C';
  document.getElementById('gaugeTempVal').textContent = '--';
  document.getElementById('miniBarFill').style.width = '0%';
  document.getElementById('sampleContainer').innerHTML = '<div class="sample-item"><span class="ts">--:--:--</span><span class="tv">--°C</span></div>';
  document.getElementById('tempTrend').innerHTML = 'Tendencia: <span class="v">--</span>';
  document.getElementById('alphaVal').textContent = '---';
  document.getElementById('kVal').textContent = '---';
  document.getElementById('heatingTinf').textContent = '---';
  document.getElementById('coolingTinf').textContent = '---';
  document.getElementById('heatingT0').textContent = '---';
  document.getElementById('coolingT0').textContent = '---';
  document.getElementById('r2Heating').textContent = '---';
  document.getElementById('r2Cooling').textContent = '---';
  initLiveChart();
  initHeatingCoolingCharts();
  console.log("🔄 Todo reiniciado");
}

// --- Eventos ---
document.getElementById('startBtn').onclick = startCapture;
document.getElementById('analyzeBtn').onclick = stopAndAnalyze;
document.getElementById('resetBtn').onclick = resetAll;
document.getElementById('connectBtn').onclick = connectArduino;
document.getElementById('disconnectBtn').onclick = disconnectArduino;

// Toggle (solo para datos del sensor principal)
document.getElementById('toggleExperimental').onclick = () => {
  if (liveChart) {
    const ds = liveChart.data.datasets[0];
    ds.hidden = !ds.hidden;
    document.getElementById('toggleExperimental').classList.toggle('active', !ds.hidden);
    liveChart.update();
  }
};

// Inicializar
initLiveChart();
initHeatingCoolingCharts();