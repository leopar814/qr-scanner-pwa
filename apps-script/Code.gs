/**
 * Code.gs
 * Punto de entrada del Web App que consumen los 3 Android (js/app.js del PWA).
 * Este proyecto debe estar VINCULADO al Sheet maestro
 * (ábrelo desde Extensiones > Apps Script en el propio Sheet), para que
 * SpreadsheetApp.getActiveSpreadsheet() siempre apunte al archivo correcto,
 * sin necesitar un ID hardcodeado.
 */

// ---------- Punto de entrada HTTP ----------

function doPost(e) {
  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ result: "ERROR", reason: "BAD_REQUEST" });
    }

    const token = (payload.token || "").toString().trim();
    const deviceId = (payload.device_id || "").toString().trim();

    if (!token || token.length < 6 || !deviceId) {
      return jsonResponse({ result: "ERROR", reason: "BAD_REQUEST" });
    }

    const result = validateAndRegister(token, deviceId);
    return jsonResponse(result);

  } catch (globalErr) {
    // Si algo falla internamente (hoja no encontrada, constante indefinida, etc.)
    // atrapamos el error aquí para que Apps Script SIEMPRE responda con JSON y no de CORS.
    return jsonResponse({ 
      result: "ERROR", 
      reason: "SERVER_EXCEPTION: " + globalErr.toString() 
    });
  }
}

function doGet(e) {
  return ContentService.createTextOutput("API activa")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Lógica principal ----------

function validateAndRegister(token, deviceId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const participantesSheet = ss.getSheetByName(SHEETS.PARTICIPANTES);

  const attendee = findAttendeeByToken(participantesSheet, token);

  if (!attendee) {
    logScan(ss, deviceId, token, "", "REJECTED", "UNKNOWN_TOKEN", false);
    return { result: "REJECTED", reason: "UNKNOWN_TOKEN" };
  }

  if (attendee.values[COL_PARTICIPANTES.PAYMENT_STATUS] !== "PAID") {
    logScan(ss, deviceId, token, attendee.id, "REJECTED", "UNPAID", false);
    return { result: "REJECTED", reason: "UNPAID" };
  }

  if (attendee.values[COL_PARTICIPANTES.REGISTRATION_STATUS] !== "COMPLETE") {
    logScan(ss, deviceId, token, attendee.id, "REJECTED", "INCOMPLETE", false);
    return { result: "REJECTED", reason: "INCOMPLETE" };
  }

  if (attendee.values[COL_PARTICIPANTES.BADGE_STATUS] === "REVOKED") {
    logScan(ss, deviceId, token, attendee.id, "REJECTED", "REVOKED", false);
    return { result: "REJECTED", reason: "REVOKED" };
  }

  const fullName = attendee.values[COL_PARTICIPANTES.FULL_NAME];
  const today = todayString();

  // Sección crítica mínima: solo "¿ya hay asistencia hoy? / crearla si no"
  // queda protegida por el lock — todo lo demás ya se resolvió antes de
  // entrar aquí, para no bloquear a los otros 2 Android más de lo necesario.
  const lock = LockService.getScriptLock();
  let created = false;
  let isReentry = false;

  try {
    lock.waitLock(LOCK_WAIT_MS);

    const asistenciasSheet = ss.getSheetByName(SHEETS.ASISTENCIAS);
    const existing = findAttendanceToday(asistenciasSheet, attendee.id, today);

    if (existing) {
      isReentry = true;
    } else {
      asistenciasSheet.appendRow([attendee.id, today, new Date(), deviceId, "SUCCESS"]);
      created = true;
    }
  } catch (err) {
    logScan(ss, deviceId, token, attendee.id, "ERROR", "LOCK_TIMEOUT", false);
    return { result: "ERROR", reason: "LOCK_TIMEOUT" };
  } finally {
    lock.releaseLock();
  }

  const result = isReentry ? "VALID_REENTRY" : "VALID_FIRST_ENTRY";
  logScan(ss, deviceId, token, attendee.id, result, "", created);

  return { result: result, full_name: fullName };
}

// ---------- Helpers de lectura ----------

// Una sola lectura por request (getDataRange().getValues()) y búsqueda en
// memoria — evita releer la hoja celda por celda, que sería mucho más lento.
function findAttendeeByToken(sheet, token) {
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) { // fila 0 = encabezados
    if (values[row][COL_PARTICIPANTES.ACCESS_TOKEN] === token) {
      return { id: values[row][COL_PARTICIPANTES.ATTENDEE_ID], values: values[row] };
    }
  }
  return null;
}

function findAttendanceToday(sheet, attendeeId, dateStr) {
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (
      values[row][COL_ASISTENCIAS.ATTENDEE_ID] === attendeeId &&
      normalizeDateCell(values[row][COL_ASISTENCIAS.ATTENDANCE_DATE]) === dateStr
    ) {
      return values[row];
    }
  }
  return null;
}

function logScan(ss, deviceId, token, attendeeId, result, reason, created) {
  const sheet = ss.getSheetByName(SHEETS.SCAN_LOG);
  sheet.appendRow([
    new Date(),
    deviceId,
    maskToken(token),
    attendeeId || "",
    result,
    reason || "",
    created,
    "",
  ]);
}

// Sección 13 del plan: "limitar su exposición en reportes" — se guarda
// enmascarado, nunca el token completo.
function maskToken(token) {
  if (token.length <= 8) return token;
  return token.slice(0, 4) + "…" + token.slice(-4);
}

function todayString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

// Google Sheets puede guardar una fecha como texto o como objeto Date según
// el formato de la celda — este helper normaliza cualquiera de los dos a
// "yyyy-MM-dd" antes de comparar, para no fallar por un problema de tipos.
function normalizeDateCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}
