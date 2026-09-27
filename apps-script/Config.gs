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
  STUDENT_ID: 6,         // Matrícula (Formulario estudiantes)
  SECTION: 7,            // Sección (Formulario estudiantes)
  CAMPUS: 8,             // Campus (Formulario estudiantes)
  REGISTRATION_STATUS: 9,
  PAYMENT_STATUS: 10,
  PAYMENT_PROOF_URL: 11, // Comprobante de pago (Drive URL)
  BANK_FOLIO: 12,        // Folio de la operación bancaria
  BADGE_STATUS: 13,
  SOURCE_FORM: 14,
  CREATED_AT: 15,
  UPDATED_AT: 16,
};

const COL_ASISTENCIAS = {
  ATTENDEE_ID: 0,
  ATTENDANCE_DATE: 1,
  FIRST_SCAN_AT: 2,
  DEVICE_ID: 3,
  VERIFICATION_STATE: 4,
};

const LOCK_WAIT_MS = 5000;
