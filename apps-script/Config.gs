/**
 * MaestroConfig.gs
 * Constantes compartidas por MaestroSetup.gs, MaestroConsolidacion.gs y
 * Validacion.gs — todo lo relacionado con el spreadsheet
 * "XXXI CNA PARTICIPANTES".
 */

// PENDIENTE: crea (o localiza) un Google Sheet llamado exactamente
// "XXXI CNA PARTICIPANTES", ábrelo, y pega su ID aquí (está en la URL,
// entre /d/ y /edit). Mismo patrón que SPREADSHEET_ID en Gafetes.gs.
const MASTER_SPREADSHEET_ID = '';

const MASTER_SHEETS = {
  PARTICIPANTES: 'Participantes',
  ASISTENCIAS: 'Asistencias',
  SCAN_LOG: 'Scan_log',
};

// El folio conserva el prefijo del formulario (GEN, USEP, BUAP) y usa
// un UUID para evitar secuencias predecibles. El mismo folio se codifica
// en el QR y se utiliza como clave de validación.
const COL_PARTICIPANTES = {
  FOLIO: 0,
  FULL_NAME: 1,
  EMAIL: 2,
  CATEGORIA: 3,
  SECTOR: 4,
  SOURCE_FORM: 5,
  COMPROBANTE_URL: 6,
  BADGE_STATUS: 7,   // espejo de "Gafete enviado": ENVIADO / PENDIENTE / ERROR
  STATUS: 8,         // ACTIVE / REVOKED — para poder anular un folio a mano
  CREATED_AT: 9,
  UPDATED_AT: 10,
  SOURCE_KEY: 11,      // spreadsheetId:fila; identifica el envío original
  ERROR_MESSAGE: 12,   // último error de generación/envío, si existe
};

const COL_ASISTENCIAS = {
  FOLIO: 0,
  ATTENDANCE_DATE: 1,
  FIRST_SCAN_AT: 2,
  DEVICE_ID: 3,
  VERIFICATION_STATE: 4,
};

const COL_SCAN_LOG = {
  TIMESTAMP: 0,
  DEVICE_ID: 1,
  FOLIO: 2,
  RESULT: 3,
  REASON: 4,
  ATTENDANCE_CREATED: 5,
};

const MASTER_LOCK_WAIT_MS = 5000;

// Caché del índice de Participantes (folio -> full_name/status) para no
// releer toda la hoja en cada escaneo. Se invalida por ESCRITURA, no por
// tiempo: MaestroConsolidacion.gs la borra en el instante en que agrega
// un participante nuevo, así que nunca hay una ventana en la que alguien
// recién inscrito no sea encontrado. El TTL de abajo es solo una red de
// seguridad (máximo permitido por CacheService), no el mecanismo real.
const PARTICIPANTES_CACHE_META_KEY = 'participantes_cache_meta';
const PARTICIPANTES_CACHE_CHUNK_PREFIX = 'participantes_chunk_';
const PARTICIPANTES_CACHE_CHUNK_SIZE = 500; // filas por chunk — CacheService limita cada valor a 100 KB
const PARTICIPANTES_CACHE_TTL_SECONDS = 21600; // 6 horas, el máximo que permite CacheService

function getMasterSpreadsheet_() {
  return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
}
