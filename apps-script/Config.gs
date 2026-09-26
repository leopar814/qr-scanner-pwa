/**
 * Config.gs
 * Constantes compartidas entre Code.gs y Consolidacion.gs.
 * Si cambias el orden de columnas aquí, corre setupSheets() de nuevo
 * (o ajusta las hojas a mano) para que coincida.
 */

const SHEETS = {
  PARTICIPANTES: "PARTICIPANTES",
  ASISTENCIAS: "ASISTENCIAS",
  SCAN_LOG: "SCAN_LOG",
};

// Índices de columna, base 0 (columna A = 0).
const COL_PARTICIPANTES = {
  ATTENDEE_ID: 0,
  ACCESS_TOKEN: 1,
  FULL_NAME: 2,
  EMAIL: 3,
  INSTITUTION: 4,
  STATE_COUNTRY: 5,
  REGISTRATION_STATUS: 6,
  PAYMENT_STATUS: 7,
  PAYMENT_PROOF_URL: 8, // URL del comprobante subido en el Form (auditoría)
  BADGE_STATUS: 9,
  SOURCE_FORM: 10,
  CREATED_AT: 11,
  UPDATED_AT: 12,
};

const COL_ASISTENCIAS = {
  ATTENDEE_ID: 0,
  ATTENDANCE_DATE: 1,
  FIRST_SCAN_AT: 2,
  DEVICE_ID: 3,
  VERIFICATION_STATE: 4,
};

const LOCK_WAIT_MS = 5000;
