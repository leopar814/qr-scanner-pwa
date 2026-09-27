/**
 * Validacion.gs
 * Reemplaza el doPost() original de Gafetes.gs. Mismo contrato de
 * respuesta que ya esperaba la PWA (result/reason/full_name), pero
 * ahora lee de un solo spreadsheet maestro consolidado (en vez de
 * recorrer cada FUENTE por separado en cada escaneo) y usa LockService
 * para que dos Android no puedan crear dos asistencias del mismo día
 * para el mismo folio.
 *
 * IMPORTANTE sobre el folio como "token": a diferencia de un token
 * opaco/aleatorio, folio es predecible (GEN-0001, GEN-0002, ...) y es
 * el mismo valor visible impreso en el gafete — se mantiene así porque
 * la generación del QR no se tocó (a petición explícita). Esto es una
 * decisión ya tomada sobre el diseño del gafete, no algo que este
 * archivo cambie; solo qué tan buena idea es dejarlo así a futuro es
 * charla aparte si les interesa revisarlo.
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ result: 'ERROR', reason: 'BAD_REQUEST' });
  }

  const folio = (payload.token || '').toString().trim();
  const deviceId = (payload.device_id || '').toString().trim();

  if (!folio || !deviceId) {
    return jsonResponse({ result: 'ERROR', reason: 'BAD_REQUEST' });
  }

  return jsonResponse(validarYRegistrarAsistencia_(folio, deviceId));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function validarYRegistrarAsistencia_(folio, deviceId) {
  const ss = getMasterSpreadsheet_();
  const participantesSheet = ss.getSheetByName(MASTER_SHEETS.PARTICIPANTES);

  const participante = buscarPorFolio_(participantesSheet, folio);

  if (!participante) {
    logScan_(ss, deviceId, folio, 'REJECTED', 'UNKNOWN_TOKEN', false);
    return { result: 'REJECTED', reason: 'UNKNOWN_TOKEN' };
  }

  if (participante.values[COL_PARTICIPANTES.STATUS] === 'REVOKED') {
    logScan_(ss, deviceId, folio, 'REJECTED', 'REVOKED', false);
    return { result: 'REJECTED', reason: 'REVOKED' };
  }

  const fullName = participante.values[COL_PARTICIPANTES.FULL_NAME];
  const today = todayString_();

  const lock = LockService.getScriptLock();
  let created = false;
  let isReentry = false;

  try {
    lock.waitLock(MASTER_LOCK_WAIT_MS);

    const asistenciasSheet = ss.getSheetByName(MASTER_SHEETS.ASISTENCIAS);
    const existing = buscarAsistenciaHoy_(asistenciasSheet, folio, today);

    if (existing) {
      isReentry = true;
    } else {
      asistenciasSheet.appendRow([folio, today, new Date(), deviceId, 'SUCCESS']);
      created = true;
    }
  } catch (err) {
    logScan_(ss, deviceId, folio, 'ERROR', 'LOCK_TIMEOUT', false);
    return { result: 'ERROR', reason: 'LOCK_TIMEOUT' };
  } finally {
    lock.releaseLock();
  }

  const result = isReentry ? 'VALID_REENTRY' : 'VALID_FIRST_ENTRY';
  logScan_(ss, deviceId, folio, result, '', created);

  return { result: result, full_name: fullName };
}

// Una sola lectura por request — igual que en el diseño original, para
// no releer la hoja celda por celda en cada escaneo.
function buscarPorFolio_(sheet, folio) {
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (values[row][COL_PARTICIPANTES.FOLIO] === folio) {
      return { values: values[row] };
    }
  }
  return null;
}

function buscarAsistenciaHoy_(sheet, folio, dateStr) {
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (
      values[row][COL_ASISTENCIAS.FOLIO] === folio &&
      normalizeDateCell_(values[row][COL_ASISTENCIAS.ATTENDANCE_DATE]) === dateStr
    ) {
      return values[row];
    }
  }
  return null;
}

function logScan_(ss, deviceId, folio, result, reason, created) {
  const sheet = ss.getSheetByName(MASTER_SHEETS.SCAN_LOG);
  sheet.appendRow([new Date(), deviceId, folio, result, reason || '', created]);
}

function todayString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normalizeDateCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}
