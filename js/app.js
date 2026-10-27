// app.js
// Flujo principal de la app de escaneo (sección 7 y 8 del plan de implementación).

const els = {
  setupScreen: document.getElementById("setup-screen"),
  scanScreen: document.getElementById("scan-screen"),
  resultScreen: document.getElementById("result-screen"),

  deviceSelect: document.getElementById("device-select"),
  apiUrlInput: document.getElementById("api-url-input"),
  setupForm: document.getElementById("setup-form"),

  video: document.getElementById("camera-feed"),
  canvas: document.getElementById("scan-canvas"),
  connectionBadge: document.getElementById("connection-badge"),
  deviceBadge: document.getElementById("device-badge"),
  scanHint: document.getElementById("scan-hint"),
  configBtn: document.getElementById("config-btn"),
  toggleCamBtn: document.getElementById("toggle-cam-btn"),
  codeInput: document.getElementById('codeInput'),
  codeInputBtn: document.getElementById('codeInputBtn'),
  resultIcon: document.getElementById("result-icon"),
  resultTitle: document.getElementById("result-title"),
  resultName: document.getElementById("result-name"),
  resultSubtitle: document.getElementById("result-subtitle"),
  rescanBtn: document.getElementById("rescan-btn"),
};

let scanning = false;
let rafId = null;
let lastToken = null;
let stream = null;
let autoRescanTimer = null; // Temporizador para el reinicio automático del escáner
let currentFacingMode = "user";

// ---------- Arranque ----------

function init() {
  registerServiceWorker();
  updateConnectionBadge();
  window.addEventListener("online", updateConnectionBadge);
  window.addEventListener("offline", updateConnectionBadge);

  populateDeviceSelect();

  const savedDevice = getDeviceId();
  const savedApiUrl = getApiUrl();

  if (savedDevice && savedApiUrl) {
    els.deviceBadge.textContent = savedDevice;
    showScreen("scan");
  } else {
    els.deviceSelect.value = savedDevice || "";
    els.apiUrlInput.value = savedApiUrl || "";
    showScreen("setup");
  }

  els.setupForm.addEventListener("submit", onSetupSubmit);
  els.configBtn.addEventListener("click", () => {
    els.deviceSelect.value = getDeviceId();
    els.apiUrlInput.value = getApiUrl();
    showScreen("setup");
  });
  
  els.codeInputBtn.addEventListener("click", () => {
    extractCode();
  });
  els.rescanBtn.addEventListener("click", () => {
    showScreen("scan");
  });
}

function populateDeviceSelect() {
  els.deviceSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona el dispositivo…";
  placeholder.disabled = true;
  placeholder.selected = true;
  els.deviceSelect.appendChild(placeholder);

  CONFIG.DEVICE_IDS.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    els.deviceSelect.appendChild(opt);
  });
}

function onSetupSubmit(e) {
  e.preventDefault();
  const device = els.deviceSelect.value;
  const apiUrl = els.apiUrlInput.value.trim();
  if (!device || !apiUrl) return;

  setDeviceId(device);
  setApiUrl(apiUrl);
  els.deviceBadge.textContent = device;
  showScreen("scan");
}

function showScreen(name) {
  els.setupScreen.classList.toggle("hidden", name !== "setup");
  els.scanScreen.classList.toggle("hidden", name !== "scan");
  els.resultScreen.classList.toggle("hidden", name !== "result");

  els.scanHint.textContent="Escribe el folio"
}

// ---------- Conexión ----------

function updateConnectionBadge() {
  const online = navigator.onLine;
  els.connectionBadge.textContent = online ? "EN LÍNEA" : "SIN CONEXIÓN";
  els.connectionBadge.classList.toggle("online", online);
  els.connectionBadge.classList.toggle("offline", !online);
}

function extractCode() {
  folio = els.codeInput.value;
  validateToken(folio);
}
// ---------- Validación contra el API (Apps Script) ----------

async function validateToken(token) {
  lastToken = token;
  const device = getDeviceId();
  const apiUrl = getApiUrl();

  els.scanHint.textContent = "Validando…";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    // Content-Type: text/plain a propósito. El cuerpo sigue siendo JSON,
    // pero con application/json el navegador manda antes una petición
    // OPTIONS (preflight CORS) que Apps Script Web Apps no responde bien,
    // y la validación fallaría con un error de CORS aunque el backend esté
    // correcto. Con text/plain el navegador la trata como "simple request"
    // y no hay preflight. Apps Script sigue recibiendo el JSON tal cual en
    // e.postData.contents y lo parsea con JSON.parse().
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ token, device_id: device }),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error("HTTP Status: " + res.status);

    const data = await res.json();
    renderResult(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.error("Validation error: Tiempo de espera agotado (Timeout)");
    } else {
      console.error("Validation error:", err);
    }
    renderResult({
      result: "ERROR",
      reason: "NETWORK_ERROR",
      full_name: "",
    });
  }
}

// Mapea el contrato del API (sección 8) a los estados visuales (sección 7.2).
function renderResult(data) {
  const result = data.result || "ERROR";
  const reason = data.reason || "";
  const name = data.full_name || "";

  const STATES = {
    VALID_FIRST_ENTRY: {
      cls: "state-success",
      title: "REGISTRO VÁLIDO",
      subtitle: "ASISTENCIA REGISTRADA",
    },
    VALID_REENTRY: {
      cls: "state-success",
      title: "REGISTRO VÁLIDO",
      subtitle: "ASISTENCIA YA REGISTRADA HOY",
    },
    REJECTED: {
      UNKNOWN_TOKEN: { cls: "state-error", title: "QR NO VÁLIDO", subtitle: "No permitir acceso" },
      UNPAID: { cls: "state-warning", title: "REGISTRO PENDIENTE DE PAGO", subtitle: "Canalizar a registro/pagos" },
      INCOMPLETE: { cls: "state-warning", title: "REGISTRO INCOMPLETO", subtitle: "Canalizar a registro" },
      REVOKED: { cls: "state-error", title: "QR CANCELADO", subtitle: "Escalar la incidencia" },
    },
    ERROR: {
      cls: "state-error",
      title: "NO SE PUDO VALIDAR",
      subtitle: "REINTENTAR",
    },
  };

  let state;
  if (result === "VALID_FIRST_ENTRY" || result === "VALID_REENTRY") {
    state = STATES[result];
  } else if (result === "REJECTED") {
    state = STATES.REJECTED[reason] || {
      cls: "state-error",
      title: "QR NO VÁLIDO",
      subtitle: reason || "No permitir acceso",
    };
  } else {
    state = STATES.ERROR;
  }

  els.resultScreen.className = `result ${state.cls}`;
  els.resultTitle.textContent = state.title;
  els.resultSubtitle.textContent = state.subtitle;
  els.resultName.textContent = name;
  els.resultName.classList.toggle("hidden", !name);

  showScreen("result");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);