/**
 * MaestroConsolidacion.gs
 * registrarEnMaestro_() se llama desde procesarFila() en Gafetes.gs,
 * justo después de que el gafete se envió con éxito. Escribe (o
 * actualiza) la fila correspondiente en la hoja "Participantes" del
 * spreadsheet maestro "XXXI CNA PARTICIPANTES" — de ahí es de donde
 * Validacion.gs lee para el escaneo en la entrada.
 */
function registrarEnMaestro_(fuente, d, folio) {
  const ss = getMasterSpreadsheet_();
  const sheet = ss.getSheetByName(MASTER_SHEETS.PARTICIPANTES);
  const now = new Date();

  // Lock propio (no el mismo LockService.getScriptLock() que usa
  // Validacion.gs para asistencia — son secciones críticas distintas,
  // pero LockService ya serializa correctamente aunque se pidan desde
  // dos archivos distintos del mismo proyecto).
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
      // Ya existe (p. ej. se volvió a correr reprocesarTodo()) — solo
      // refresca datos, no duplica la fila.
      const rowIndex = foundRow + 1;
      sheet.getRange(rowIndex, COL_PARTICIPANTES.FULL_NAME + 1).setValue(d.nombre);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.EMAIL + 1).setValue(d.correo);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.CATEGORIA + 1).setValue(d.categoria);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.SECTOR + 1).setValue(d.sector);
      sheet.getRange(rowIndex, COL_PARTICIPANTES.BADGE_STATUS + 1).setValue('ENVIADO');
      sheet.getRange(rowIndex, COL_PARTICIPANTES.UPDATED_AT + 1).setValue(now);
      return;
    }

    sheet.appendRow([
      folio,
      d.nombre,
      d.correo,
      d.categoria,
      d.sector,
      fuente.id,
      d.comprobante || '',
      'ENVIADO',
      'ACTIVE',
      now,
      now,
    ]);
  } finally {
    lock.releaseLock();
  }

   // Fuera del lock: invalida el caché que usa Validacion.gs para que el
  // PRÓXIMO escaneo (de quien sea) reconstruya el índice con este
  // participante ya incluido — sin esto, alguien podría intentar entrar
  // segundos después de inscribirse y encontrar un caché desactualizado.
  invalidateParticipantesCache_();
}
