// config.js
// Configuración central de la aplicación de escaneo.
// Ajusta API_URL con la URL de despliegue del Google Apps Script (doPost)
// una vez que la Fase B (servicio de validación) esté lista.

const CONFIG = {
  // URL del Web App de Apps Script, ej:
  // "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL: "",

  // Dispositivos válidos según el documento
  DEVICE_IDS: ["AND-01", "AND-02", "AND-03"],

  // Claves de localStorage.
  STORAGE_KEYS: {
    DEVICE_ID: "congreso_device_id",
    API_URL: "congreso_api_url",
  },

  // Tiempo máximo de espera de una validación antes de mostrar reintento (RF-12 / T09).
  REQUEST_TIMEOUT_MS: 8000,

  // Milisegundos que se muestra la pantalla de resultado antes de reactivar la cámara.
  RESULT_DISPLAY_MS: 2500,
};

function getApiUrl() {
  return localStorage.getItem(CONFIG.STORAGE_KEYS.API_URL) || CONFIG.API_URL;
}

function setApiUrl(url) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.API_URL, url.trim());
}

function getDeviceId() {
  return localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID) || "";
}

function setDeviceId(id) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.DEVICE_ID, id);
}
