/**
 * Badges.gs
 * Fase D del plan: genera el token+QR y envía el gafete digital por
 * correo. El QR se genera con QrCodeLib.gs (librería JS pura, sin
 * llamadas de red) y se incrusta como tabla HTML directamente en el
 * cuerpo del correo — no hay imagen, no hay adjunto, no hay dependencia
 * de ningún servicio externo.
 *
 * CAMBIO DE FLUJO: el Form de inscripción pide como campo obligatorio
 * subir el comprobante de pago, así que se asume que enviar el
 * formulario == pago ya procesado (ver Consolidacion.gs, que es quien
 * decide payment_status). Por eso este archivo emite el gafete de forma
 * INMEDIATA al consolidar la respuesta del Form, no espera a que alguien
 * marque manualmente "PAID". processPendingBadges() sigue existiendo
 * como red de seguridad: reintenta cualquier fila que se quedó en
 * PENDING (p. ej. por un error transitorio o la cuota de correo).
 *
 * IMPORTANTE — cuota de correo: MailApp/GmailApp comparten un límite
 * DIARIO de destinatarios: 100/día en cuentas Gmail personales, 1,500/día
 * en Google Workspace. Con ~1500 asistentes, esto SOLO es viable si el
 * proyecto está autorizado con la cuenta institucional (Workspace) de
 * BUAP.
 */

const BADGE_BATCH_SIZE = 40; // margen seguro para el límite de 6 min por ejecución
const QR_CELL_PX = 8;        // tamaño de cada módulo del QR, en px

/**
 * Red de seguridad — trigger de TIEMPO (Activadores: función
 * "processPendingBadges", origen "Basado en tiempo", cada 5-10 minutos).
 * En operación normal esto debería encontrar pocas filas, porque
 * Consolidacion.gs ya emite el gafete al momento. Solo actúa sobre lo
 * que se haya quedado atorado.
 */
function processPendingBadges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  const values = sheet.getDataRange().getValues();

  const remaining = MailApp.getRemainingDailyQuota();
  let sent = 0;

  for (let row = 1; row < values.length && sent < BADGE_BATCH_SIZE; row++) {
    if (sent >= remaining) {
      Logger.log("Cuota diaria de correo casi agotada — se detiene esta corrida, continuará mañana.");
      break;
    }

    const r = values[row];
    if (isEligibleForBadge(r)) {
      try {
        issueBadge(sheet, row + 1, r);
        sent++;
      } catch (err) {
        // No marcamos badge_status como SENT: el siguiente ciclo del
        // trigger vuelve a intentar esta misma fila automáticamente.
        Logger.log("Error emitiendo gafete en fila " + (row + 1) + ": " + err);
      }
    }
  }
}

function isEligibleForBadge(rowValues) {
  return (
    rowValues[COL_PARTICIPANTES.REGISTRATION_STATUS] === "COMPLETE" &&
    rowValues[COL_PARTICIPANTES.PAYMENT_STATUS] === "PAID" &&
    rowValues[COL_PARTICIPANTES.BADGE_STATUS] === "PENDING"
  );
}

// Llamada desde processPendingBadges() (red de seguridad) y también
// directamente desde Consolidacion.gs (emisión inmediata al registrarse).
function issueBadge(sheet, rowIndex, rowValues) {
  const token = generateAccessToken();
  const qrTableHtml = buildQrTableHtml(token);
  const fullName = rowValues[COL_PARTICIPANTES.FULL_NAME];
  const email = rowValues[COL_PARTICIPANTES.EMAIL];

  sendBadgeEmail(email, fullName, qrTableHtml);

  sheet.getRange(rowIndex, COL_PARTICIPANTES.ACCESS_TOKEN + 1).setValue(token);
  sheet.getRange(rowIndex, COL_PARTICIPANTES.BADGE_STATUS + 1).setValue("SENT");
  sheet.getRange(rowIndex, COL_PARTICIPANTES.UPDATED_AT + 1).setValue(new Date());
}

// "ACCESS-" + 12 caracteres opacos — nunca el nombre, correo ni ID interno
// (sección 6.1 del plan).
function generateAccessToken() {
  const raw = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  return "ACCESS-" + raw;
}

// Genera el QR con QrCodeLib.gs (qrcode(0, 'M'): 0 = autodetecta la
// versión más chica que alcanza para el token) y lo dibuja como una
// tabla HTML compacta.
//
// OJO con esto: el método createTableTag() que trae la librería es muy
// legible pero generа ~100 KB de HTML por el estilo repetido en cada
// celda — Gmail RECORTA los correos que pasan de ~102 KB ("[Mensaje
// recortado]"), lo que literalmente partiría el QR a la mitad. Por eso
// este renderer propio usa los atributos width/height en vez de CSS
// repetido (además de ser mucho más compatible con Outlook) y omite el
// estilo por completo en las celdas blancas. Con esto un QR típico de
// este token pesa ~27 KB en vez de ~100 KB.
function buildQrTableHtml(token) {
  const qr = qrcode(0, "M");
  qr.addData(token);
  qr.make();

  const n = qr.getModuleCount();
  let html = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">';
  for (let r = 0; r < n; r++) {
    html += "<tr>";
    for (let c = 0; c < n; c++) {
      const dark = qr.isDark(r, c);
      html += '<td width="' + QR_CELL_PX + '" height="' + QR_CELL_PX + '"' +
        (dark ? ' style="background:#000"' : "") + "></td>";
    }
    html += "</tr>";
  }
  html += "</table>";
  return html;
}

function sendBadgeEmail(email, fullName, qrTableHtml) {
  const subject = "Tu gafete digital — Congreso de Medicina";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>${escapeHtml(fullName)}</h2>
      <p>Este es tu gafete digital para el <strong>Congreso de Medicina</strong>,
      del 29 de septiembre al 2 de octubre de 2026.</p>
      <div style="text-align:center; padding: 12px 0;">
        ${qrTableHtml}
      </div>
      <p><strong>Conserva este correo y presenta el QR en cada ingreso.</strong>
      La primera lectura del día registra tu asistencia; las lecturas
      posteriores permiten reingreso sin duplicarla.</p>
      <p>Si tienes algún problema con tu QR, acude a la mesa de soporte del
      congreso.</p>
    </div>
  `;

  GmailApp.sendEmail(email, subject, "Tu gafete digital está incluido en este correo (ábrelo en HTML).", {
    htmlBody: html,
    name: "Congreso de Medicina — Servicio Social",
  });
}

function escapeHtml(text) {
  return (text || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Reenvío manual (sección 12.2: "fallo de correo"). Corre esta función
 * desde el editor (Ejecutar → resendBadgeByEmail, ajustando el correo
 * abajo en una llamada de prueba, o desde el depurador con un parámetro).
 * Reutiliza el token existente — no genera uno nuevo, para no invalidar
 * un QR que el asistente ya pudiera tener guardado o impreso.
 */
function resendBadgeByEmail(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  const values = sheet.getDataRange().getValues();
  const target = (email || "").toLowerCase().trim();

  for (let row = 1; row < values.length; row++) {
    if ((values[row][COL_PARTICIPANTES.EMAIL] || "").toLowerCase() === target) {
      const token = values[row][COL_PARTICIPANTES.ACCESS_TOKEN];
      if (!token) {
        Logger.log("Este participante aún no tiene token — revisa payment_status/badge_status.");
        return;
      }
      const qrTableHtml = buildQrTableHtml(token);
      sendBadgeEmail(
        values[row][COL_PARTICIPANTES.EMAIL],
        values[row][COL_PARTICIPANTES.FULL_NAME],
        qrTableHtml
      );
      Logger.log("Gafete reenviado a " + target);
      return;
    }
  }
  Logger.log("No se encontró un participante con ese correo.");
}
