/**
 * MaestroSetup.gs
 * Ejecuta setupHojasMaestras() UNA SOLA VEZ, manualmente, después de
 * crear el Sheet "XXXI CNA PARTICIPANTES" y pegar su ID en
 * MaestroConfig.gs. Es seguro volver a correrla: no borra datos, solo
 * crea lo que falte.
 */
function setupHojasMaestras() {
  const ss = getMasterSpreadsheet_();

  asegurarHojaConEncabezados_(ss, MASTER_SHEETS.PARTICIPANTES, [
    'folio', 'full_name', 'email', 'categoria', 'sector', 'source_form',
    'comprobante_url', 'badge_status', 'status', 'created_at', 'updated_at', 'source_key', 'error_message',
  ]);

  const asistencias = asegurarHojaConEncabezados_(ss, MASTER_SHEETS.ASISTENCIAS, [
    'folio', 'attendance_date', 'first_scan_at', 'device_id', 'verification_state',
  ]);
  // Evita que Sheets convierta "2026-09-29" en un objeto Date al escribir.
  asistencias.getRange('B2:B').setNumberFormat('@');

  asegurarHojaConEncabezados_(ss, MASTER_SHEETS.SCAN_LOG, [
    'timestamp', 'device_id', 'folio', 'result', 'reason', 'attendance_created',
  ]);

  SpreadsheetApp.getUi().alert('Hojas del spreadsheet maestro creadas/verificadas.');
}

function asegurarHojaConEncabezados_(ss, nombre, headers) {
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) sheet = ss.insertSheet(nombre);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}
