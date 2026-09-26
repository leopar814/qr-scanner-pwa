/**
 * Setup.gs
 * Ejecuta setupSheets() UNA SOLA VEZ, manualmente, para crear las hojas
 * y encabezados del registro maestro (Anexo A del plan). Es seguro
 * volver a correrla después: no borra datos existentes, solo crea lo
 * que falte y reescribe encabezados.
 *
 * Cómo ejecutarla (primera vez usando Apps Script):
 * 1. En el editor, arriba hay un desplegable de funciones junto al botón
 *    ▶ Ejecutar. Selecciona "setupSheets".
 * 2. Clic en ▶ Ejecutar.
 * 3. La primera vez aparecerá "Se requiere autorización" → Revisar permisos
 *    → elige la cuenta de Google que administra el Sheet maestro → Avanzado
 *    → "Ir a [nombre del proyecto] (no seguro)" → Permitir.
 *    (El aviso "no seguro" es normal: aparece porque el proyecto es tuyo y
 *    no ha sido revisado por Google, no porque tenga un problema real.)
 * 4. Revisa el Sheet: deben aparecer las pestañas PARTICIPANTES,
 *    ASISTENCIAS y SCAN_LOG con sus encabezados en la fila 1.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetWithHeaders(ss, SHEETS.PARTICIPANTES, [
    "attendee_id", "access_token", "full_name", "email", "institution",
    "state_country", "registration_status", "payment_status",
    "payment_proof_url", "badge_status", "source_form", "created_at",
    "updated_at",
  ]);

  const asistencias = createSheetWithHeaders(ss, SHEETS.ASISTENCIAS, [
    "attendee_id", "attendance_date", "first_scan_at", "device_id",
    "verification_state",
  ]);
  // Evita que Sheets convierta "2026-09-29" en un objeto Date al escribir,
  // lo cual rompería la comparación de cadenas en findAttendanceToday.
  asistencias.getRange("B2:B").setNumberFormat("@");

  createSheetWithHeaders(ss, SHEETS.SCAN_LOG, [
    "timestamp", "device_id", "token", "attendee_id", "result", "reason",
    "attendance_created", "operator_note",
  ]);

  SpreadsheetApp.getUi().alert("Hojas creadas/verificadas correctamente.");
}

function createSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}
