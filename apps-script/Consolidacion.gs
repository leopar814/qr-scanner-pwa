/**
 * Consolidacion.gs
 * Normaliza las respuestas de los 3 Forms hacia el registro maestro
 * PARTICIPANTES (RF-01 del plan) y, en cuanto un registro queda completo,
 * emite el gafete de inmediato (ver nota de "Regla de negocio" abajo).
 *
 * ESTE ARCHIVO NO FUNCIONA SOLO CON GUARDARLO. Debes crear el activador
 * (trigger) instalable una vez — instrucciones abajo, antes de onFormSubmit.
 *
 * REGLA DE NEGOCIO (definida por el equipo, no por el plan original):
 * el Form de inscripción exige subir el comprobante de pago como campo
 * obligatorio para poder enviarse. Por lo tanto, aquí se asume que
 * "Form enviado con comprobante adjunto" == "pago procesado", y
 * payment_status se marca PAID automáticamente al consolidar — sin
 * esperar una confirmación manual del organizador.
 *
 * Esto es una decisión de confianza, no una verificación real: el
 * sistema no valida que el comprobante sea auténtico ni que corresponda
 * a este evento, solo que el campo no llegó vacío. Por eso se guarda
 * payment_proof_url (la URL del archivo en Drive) en PARTICIPANTES — así,
 * si alguien detecta después un comprobante falso o incorrecto, pueden
 * revisarlo y corregirlo cambiando badge_status a REVOKED manualmente.
 */

// Ajusta estos nombres EXACTOS a las pestañas de respuestas que Google Forms
// crea automáticamente en el Sheet maestro (Anexo A del plan).
const RAW_SHEET_SOURCE = {
  "FORM_01_RAW": "FORM-01",
  "FORM_02_RAW": "FORM-02",
  "FORM_03_RAW": "FORM-03",
};

// Pendiente de la decisión #16 del plan: "¿cuáles son exactamente las
// columnas de cada Form?". Ajusta cada lista con el TEXTO EXACTO de la
// pregunta tal como aparece en el Form (puede variar entre los 3, por eso
// es una lista de alternativas, no un solo valor).
const FIELD_MAP = {
  full_name: ["Nombre completo", "Nombre y apellidos", "Nombre"],
  email: ["Correo electrónico", "Correo", "Email institucional"],
  institution: ["Institución", "Universidad / Institución", "Institución de procedencia"],
  state_country: ["Estado y país de procedencia", "Procedencia", "Estado / País"],
  payment_proof: ["Comprobante de pago", "Sube tu comprobante de pago", "Comprobante de pago (imagen o PDF)"],
};

/**
 * Cómo crear el activador (una sola vez, cubre las 3 pestañas):
 * 1. En el editor de Apps Script: ícono de reloj "Activadores" (barra
 *    izquierda) → "+ Añadir activador".
 * 2. Función a ejecutar: onFormSubmit
 * 3. Origen del evento: "Desde la hoja de cálculo"
 * 4. Tipo de evento: "Al enviar formulario"
 * 5. Guardar → te pedirá autorizar permisos con la cuenta que administra
 *    el Sheet maestro (debe ser la cuenta institucional, ver Badges.gs).
 */
function onFormSubmit(e) {
  const sheetName = e.range.getSheet().getName();
  const sourceForm = RAW_SHEET_SOURCE[sheetName];

  if (!sourceForm) return; // No es una pestaña de respuestas que nos interese.

  const answers = extractAnswers(e.namedValues);
  if (!answers.email) return; // Sin correo no se puede deduplicar ni contactar.

  upsertParticipant(answers, sourceForm);
}

// e.namedValues llega como { "Pregunta exacta del Form": ["respuesta"], ... }
// Para la pregunta de tipo "Subir archivo", el valor es la URL del archivo
// en la carpeta de Drive que Google Forms crea automáticamente.
function extractAnswers(namedValues) {
  const result = {};
  for (const field in FIELD_MAP) {
    for (const header of FIELD_MAP[field]) {
      if (namedValues[header] && namedValues[header][0]) {
        result[field] = namedValues[header][0].toString().trim();
        break;
      }
    }
  }
  if (result.email) result.email = result.email.toLowerCase();
  return result;
}

function upsertParticipant(answers, sourceForm) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  const isComplete = !!(answers.full_name && answers.email);
  // Ver "Regla de negocio" arriba: comprobante presente == pago procesado.
  // Si por algún motivo el comprobante no llegó (p. ej. FIELD_MAP
  // desactualizado respecto al Form real), cae a PENDING por seguridad
  // en vez de asumir el pago.
  const paymentStatus = answers.payment_proof ? "PAID" : "PENDING";
  const now = new Date();

  // Protegido con lock: dos envíos de Forms casi simultáneos no deben
  // crear dos participantes duplicados para el mismo correo.
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);

  let rowIndex, rowValuesAfterUpdate;

  try {
    const values = sheet.getDataRange().getValues();
    let foundRow = -1;

    for (let row = 1; row < values.length; row++) {
      if ((values[row][COL_PARTICIPANTES.EMAIL] || "").toString().toLowerCase() === answers.email) {
        foundRow = row;
        break;
      }
    }

    if (foundRow >= 0) {
      rowIndex = foundRow + 1;
      rowValuesAfterUpdate = updateExistingParticipant(
        sheet, rowIndex, values[foundRow], answers, isComplete, paymentStatus, now
      );
    } else {
      const attendeeId = generateAttendeeId(values.length);
      const newRow = [
        attendeeId,
        "", // access_token: lo asigna issueBadge() al emitir el gafete.
        answers.full_name || "",
        answers.email,
        answers.institution || "",
        answers.state_country || "",
        isComplete ? "COMPLETE" : "INCOMPLETE",
        paymentStatus,
        answers.payment_proof || "",
        "PENDING", // badge_status
        sourceForm,
        now,
        now,
      ];
      sheet.appendRow(newRow);
      rowIndex = sheet.getLastRow();
      rowValuesAfterUpdate = newRow;
    }
  } finally {
    lock.releaseLock();
  }

  // Emisión inmediata: en cuanto el registro queda completo y con
  // comprobante, se manda el gafete en el mismo ciclo — sin esperar al
  // trigger de tiempo. Si falla (red, cuota, etc.), badge_status se
  // queda en PENDING y processPendingBadges() lo reintenta después.
  if (isEligibleForBadge(rowValuesAfterUpdate)) {
    try {
      issueBadge(sheet, rowIndex, rowValuesAfterUpdate);
    } catch (err) {
      Logger.log("No se pudo emitir el gafete de inmediato para fila " + rowIndex + ": " + err);
    }
  }
}

function updateExistingParticipant(sheet, rowIndex, currentValues, answers, isComplete, paymentStatus, now) {
  // Actualiza datos de contacto y el estatus derivado del Form. No
  // sobreescribe badge_status ni access_token — eso lo controla
  // exclusivamente issueBadge().
  const updated = currentValues.slice();

  updated[COL_PARTICIPANTES.FULL_NAME] = answers.full_name || currentValues[COL_PARTICIPANTES.FULL_NAME];
  updated[COL_PARTICIPANTES.INSTITUTION] = answers.institution || currentValues[COL_PARTICIPANTES.INSTITUTION];
  updated[COL_PARTICIPANTES.STATE_COUNTRY] = answers.state_country || currentValues[COL_PARTICIPANTES.STATE_COUNTRY];
  if (isComplete) updated[COL_PARTICIPANTES.REGISTRATION_STATUS] = "COMPLETE";
  // Solo avanza payment_status hacia PAID; nunca lo regresa a PENDING con
  // una resubmisión rara que llegara sin comprobante.
  if (paymentStatus === "PAID") updated[COL_PARTICIPANTES.PAYMENT_STATUS] = "PAID";
  if (answers.payment_proof) updated[COL_PARTICIPANTES.PAYMENT_PROOF_URL] = answers.payment_proof;
  updated[COL_PARTICIPANTES.UPDATED_AT] = now;

  sheet.getRange(rowIndex, COL_PARTICIPANTES.FULL_NAME + 1).setValue(updated[COL_PARTICIPANTES.FULL_NAME]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.INSTITUTION + 1).setValue(updated[COL_PARTICIPANTES.INSTITUTION]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.STATE_COUNTRY + 1).setValue(updated[COL_PARTICIPANTES.STATE_COUNTRY]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.REGISTRATION_STATUS + 1).setValue(updated[COL_PARTICIPANTES.REGISTRATION_STATUS]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.PAYMENT_STATUS + 1).setValue(updated[COL_PARTICIPANTES.PAYMENT_STATUS]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.PAYMENT_PROOF_URL + 1).setValue(updated[COL_PARTICIPANTES.PAYMENT_PROOF_URL]);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.UPDATED_AT + 1).setValue(now);

  return updated;
}

function generateAttendeeId(currentRowCount) {
  const n = currentRowCount.toString().padStart(6, "0");
  return "MED-" + n;
}
