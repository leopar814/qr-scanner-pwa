/**
 * MaestroConsolidacion.gs
 * registrarEnMaestro_() se llama desde procesarFila() en Gafetes.gs,
 * justo después de que el gafete se envió con éxito. Escribe (o
 * actualiza) la fila correspondiente en la hoja "Participantes" del
 * spreadsheet maestro "XXXI CNA PARTICIPANTES" — de ahí es de donde
 * Validacion.gs lee para el escaneo en la entrada.
 */
function registrarEnMaestro_(fuente, d, folio, badgeStatus, errorMessage) {
  const ss = getMasterSpreadsheet_();
  const sheet = ss.getSheetByName(MASTER_SHEETS.PARTICIPANTES);
  const now = new Date();
  const status = badgeStatus || 'ENVIADO';
  const error = errorMessage || '';

  const lock = LockService.getScriptLock();
  lock.waitLock(MASTER_LOCK_WAIT_MS);

  try {
    const values = sheet.getDataRange().getValues();
    let foundRow = -1;

    for (let row = 1; row < values.length; row++) {
      if (values[row][COL_PARTICIPANTES.FOLIO] === folio) {
        foundRow = row;
        break;
      }
    }

    if (foundRow >= 0) {
      const rowIndex = foundRow + 1;
      sheet.getRange(rowIndex, COL_PARTICIPANTES.FULL_NAME + 1).setValue(d.nombre || '');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.EMAIL + 1).setValue(d.correo || '');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.CATEGORIA + 1).setValue(d.categoria || '');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.SECTOR + 1).setValue(d.sector || '');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.COMPROBANTE_URL + 1).setValue(d.comprobante || '');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.BADGE_STATUS + 1).setValue(status);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.ERROR_MESSAGE + 1).setValue(error);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.UPDATED_AT + 1).setValue(now);
    } else {
      sheet.appendRow([
        folio,
        d.nombre || '',
        d.correo || '',
        d.categoria || '',
        d.sector || '',
        fuente.id,
        d.comprobante || '',
        status,
        'ACTIVE',
        now,
        now,
        '',
        error,
      ]);
    }
  } finally {
    lock.releaseLock();
  }

  invalidateParticipantesCache_();
}
