/**
 * Gafetes.gs
 * ============================================================
 * ENVIAR GAFETES CON QR - CONGRESO DE ANATOMÍA (modo instantáneo)
 * ============================================================
 * Cuando alguien envía cualquiera de los 3 formularios (Foráneos,
 * USEP, BUAP) se genera su gafete (plantilla de Slides + QR de
 * quickchart.io), se manda en PDF por correo y se consolida en el
 * spreadsheet maestro (registrarEnMaestro_, en MaestroConsolidacion.gs).
 *
 * La validación (doPost) y el pase de lista viven en Validacion.gs.
 *
 * REQUIERE el archivo LimpiarNombre.gs en el mismo proyecto
 * (usa construirNombreCompleto_ y limpiarNombreCompleto_).
 */

// ============================================================
// CONFIG COMPARTIDA
// ============================================================

const PLANTILLA_ID = '1je9KB822uY1GlngpBHEhrulw2jzvXfQ6rVdsrVe8jM0';
const ASUNTO_CORREO = 'Tu gafete - Congreso Nacional de Anatomía 2026';
const WEBAPP_URL = 'https://PENDIENTE-DE-PUBLICAR';

const PLACEHOLDER_NOMBRE = '<<NOMBRE>>';
const PLACEHOLDER_QR     = '<<QR>>';

// Las hojas de respuestas de Google Forms NO se modifican.
// Folio, estado de envío y demás datos de control viven exclusivamente
// en el spreadsheet maestro "Participantes".

// ============================================================
// FUENTES — una por cada formulario
// ============================================================

const FUENTES = [
  {
    // Formulario general (foráneos)
    id: 'GENERAL',
    PREFIJO: 'GEN',
    SPREADSHEET_ID: '14HtdUluoZkjy28gLKJ6Iu1_VL5ZLIJ4cdEwqMojc36o',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    extraerDatos: function (fila, idx) {
      var nombre = [
        fila[idx['Nombre(s):']],
        fila[idx['Apellido Paterno:']],
        fila[idx['Apellido Materno:']],
      ]
        .map(function (s) { return (s || '').toString().trim(); })
        .filter(function (s) { return s.length > 0; })
        .join(' ');
        
      var universidad = (fila[idx['Universidad a la que pertence']] || '').toString().toUpperCase();
      var sector = 'EXTERNA';
      if (universidad.indexOf('BUAP') !== -1) sector = 'BUAP';
      else if (universidad.indexOf('USEP') !== -1 || universidad.indexOf('SALUD DEL ESTADO DE PUEBLA') !== -1) sector = 'USEP';

      var categoriaOriginal = (fila[idx['Columna 11']] || '').toString().toUpperCase();
      var categoria = categoriaOriginal;
      if (categoriaOriginal.indexOf('PROFESORES') !== -1) categoria = 'PROFESOR';
      else if (categoriaOriginal.indexOf('ESTUDIANTES DE PREGRADO') !== -1) categoria = 'ESTUDIANTE';
      else if (categoriaOriginal.indexOf('MIEMBROS NUMERARIOS') !== -1) categoria = 'MIEMBRO SMA';
      else if (categoriaOriginal.indexOf('CONCURSO') !== -1) categoria = 'CONCURSANTE';
      else categoria = categoriaOriginal.substring(0, 40);

      return {
        nombre: nombre,
        correo: (fila[idx['Dirección de correo electrónico']] || '').toString().trim(),
        categoria: categoria,
        sector: sector,
        comprobante: (fila[idx['Comprobante con el motivo de pago: "PARTICIPACIÓN EN LA XXVI REUNIÓN NACIONAL DE MORFOLOGÍA, 2025":']] || '').toString().trim(),
      };
    },
  },
  {
    // Formulario USEP
    id: 'USEP',
    PREFIJO: 'USEP',
    SPREADSHEET_ID: '1ypM-Qcv2bj-_R96r-Lanuk0qlkRmujpOaOA1Vi823_A',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    extraerDatos: function (fila, idx) {
      return {
        nombre: fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia.']],
        correo: (fila[idx['Correo electrónico. Favor de asegurarse que esté bien escrito, y que sea el que revise con mayor frecuencia, ya que ahi llegará la constancia correspondiente']] || '').toString().trim(),
        categoria: 'ESTUDIANTE',
        sector: 'USEP',
        comprobante: (fila[idx['Ficha de Pago']] || '').toString().trim(),
      };
    },
  },
  {
    // Formulario BUAP. OJO: su encabezado de nombre termina en
    // "constancia" SIN punto (el de USEP sí lleva punto).
    id: 'BUAP',
    PREFIJO: 'BUAP',
    SPREADSHEET_ID: '1yWjJ1nA0WYROmtoAjWri8_frH8DhMHWiQsjEDyRyrzc',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    extraerDatos: function (fila, idx) {
      return {
        nombre: fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia']],
        correo: (fila[idx['Correo electrónico. Favor de asegurarse que esté bien escrito, y que sea el que revise con mayor frecuencia, ya que ahi llegará la constancia correspondiente']] || '').toString().trim(),
        categoria: 'ESTUDIANTE',
        sector: 'BUAP',
        comprobante: (fila[idx['Ficha de Pago']] || '').toString().trim(),
      };
    },
  },
];

// ============================================================
// DISPARADOR INSTANTÁNEO — se activa solo al enviar cualquiera de
// los formularios (ver instrucciones de instalación al final)
// ============================================================

function onFormSubmitHandler(e) {
  try {
    if (!e || !e.range) {
      Logger.log('Aviso: Esta función se ejecuta automáticamente al recibir un Formulario.');
      return;
    }

    var hoja = e.range.getSheet();
    var spreadsheetId = hoja.getParent().getId();
    var row = e.range.getRow();

    var fuente = FUENTES.filter(function (f) { return f.SPREADSHEET_ID === spreadsheetId; })[0];
    if (!fuente) {
      Logger.log('Aviso: llegó un envío de un Sheet no configurado en FUENTES (' + spreadsheetId + ').');
      return;
    }

    // Solo leemos los encabezados originales de Forms. Nunca agregamos
    // columnas ni escribimos nada en la hoja de respuestas.
    var idx = construirIndiceEncabezados_(hoja);
    procesarFila(fuente, hoja, idx, row);

  } catch (err) {
    Logger.log('Error en onFormSubmitHandler: ' + err);
  }
}

function construirIndiceEncabezados_(hoja) {
  var lastCol = Math.max(1, hoja.getLastColumn());
  var headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  var idxMap = {};

  headers.forEach(function (h, i) {
    var key = h.toString().trim();
    if (key) idxMap[key] = i;
  });

  return idxMap;
}

function procesarFila(fuente, hoja, idx, row) {
  var lastCol = hoja.getLastColumn();
  var fila = hoja.getRange(row, 1, 1, lastCol).getValues()[0];
  var d;

  try {
    d = fuente.extraerDatos(fila, idx);
  } catch (errExtraccion) {
    Logger.log('Error extrayendo datos [' + fuente.id + ' fila ' + row + ']: ' + errExtraccion);
    return false;
  }

  // La identidad del envío permite volver a procesar una fila con error
  // sin generar un folio nuevo.
  var sourceKey = fuente.SPREADSHEET_ID + ':' + row;
  var participante = obtenerOCrearParticipante_(fuente, d, sourceKey);
  var folio = participante.folio;

  // Guard anti-duplicados: si ya se envió, no volver a mandar correo.
  if (participante.badgeStatus === 'ENVIADO') {
    return false;
  }

  // Validamos después de crear el registro maestro: incluso un correo
  // inválido o un comprobante ausente queda identificado con folio.
  var problemas = [];
  if (!d.correo || d.correo.indexOf('@') === -1) problemas.push('correo inválido o vacío');
  if (!d.nombre) problemas.push('nombre vacío');
  if (!d.comprobante) problemas.push('sin comprobante');

  if (problemas.length) {
    actualizarEstadoParticipante_(folio, 'PENDIENTE', problemas.join('; '));
    Logger.log('Pendiente [' + fuente.id + ' fila ' + row + '] folio ' + folio + ': ' + problemas.join('; '));
    return false;
  }

  try {
    var gafeteBlob = generarGafete(d.nombre, d.categoria, folio);
    enviarGafetePorCorreo(d.correo, d.nombre, gafeteBlob);

    actualizarEstadoParticipante_(folio, 'ENVIADO', '');
    Logger.log('Enviado [' + fuente.id + ']: ' + d.nombre + ' | ' + d.correo + ' | folio: ' + folio);
    return true;

  } catch (err) {
    // El folio ya existe en Participantes. Guardamos el error para poder
    // localizar el correo y reintentar posteriormente sin cambiar el folio.
    actualizarEstadoParticipante_(folio, 'ERROR', String(err));
    Logger.log('Error enviando gafete [' + fuente.id + ' fila ' + row + '] folio ' + folio + ': ' + err);
    return false;
  }
}

/**
 * Crea el registro maestro antes de intentar generar/enviar el gafete.
 * Si ya existe el sourceKey, reutiliza el folio existente.
 */
function obtenerOCrearParticipante_(fuente, d, sourceKey) {
  var ss = getMasterSpreadsheet_();
  var sheet = ss.getSheetByName(MASTER_SHEETS.PARTICIPANTES);
  var lock = LockService.getScriptLock();
  lock.waitLock(MASTER_LOCK_WAIT_MS);

  try {
    var encontrado = buscarParticipantePorSourceKey_(sheet, sourceKey);
    if (encontrado) {
      return {
        folio: encontrado.values[COL_PARTICIPANTES.FOLIO],
        row: encontrado.row,
        badgeStatus: encontrado.values[COL_PARTICIPANTES.BADGE_STATUS],
      };
    }

    var folio = fuente.PREFIJO + '-' + Utilities.getUuid();
    var now = new Date();

    sheet.appendRow([
      folio,
      d.nombre || '',
      d.correo || '',
      d.categoria || '',
      d.sector || '',
      fuente.id,
      d.comprobante || '',
      'PENDIENTE',
      'ACTIVE',
      now,
      now,
      sourceKey,
      '',
    ]);

    invalidateParticipantesCache_();
    return { folio: folio, row: sheet.getLastRow(), badgeStatus: 'PENDIENTE' };
  } finally {
    lock.releaseLock();
  }
}

function actualizarEstadoParticipante_(folio, estado, errorMensaje) {
  var ss = getMasterSpreadsheet_();
  var sheet = ss.getSheetByName(MASTER_SHEETS.PARTICIPANTES);
  var lock = LockService.getScriptLock();
  lock.waitLock(MASTER_LOCK_WAIT_MS);

  try {
    var values = sheet.getDataRange().getValues();

    // Validamos los índices de columna y aseguramos que mínimo sea columna 1
    var colBadgeStatus  = Math.max(1, (COL_PARTICIPANTES.BADGE_STATUS !== undefined ? COL_PARTICIPANTES.BADGE_STATUS : 7) + 1);
    var colErrorMessage = Math.max(1, (COL_PARTICIPANTES.ERROR_MESSAGE !== undefined ? COL_PARTICIPANTES.ERROR_MESSAGE : 12) + 1);
    var colUpdatedAt   = Math.max(1, (COL_PARTICIPANTES.UPDATED_AT !== undefined ? COL_PARTICIPANTES.UPDATED_AT : 10) + 1);

    for (var row = 1; row < values.length; row++) {
      if (values[row][COL_PARTICIPANTES.FOLIO] === folio) {
        var rowIndex = row + 1;

        sheet.getRange(rowIndex, colBadgeStatus).setValue(estado);
        sheet.getRange(rowIndex, colErrorMessage).setValue(errorMensaje || '');
        sheet.getRange(rowIndex, colUpdatedAt).setValue(new Date());

        invalidateParticipantesCache_();
        return;
      }
    }
    throw new Error('No se encontró el folio ' + folio + ' en Participantes.');
  } finally {
    lock.releaseLock();
  }
}

function buscarParticipantePorSourceKey_(sheet, sourceKey) {
  var values = sheet.getDataRange().getValues();
  for (var row = 1; row < values.length; row++) {
    if (values[row][COL_PARTICIPANTES.SOURCE_KEY] === sourceKey) {
      return { values: values[row], row: row + 1 };
    }
  }
  return null;
}

// ============================================================
// REPROCESAR TODO (opcional) — red de seguridad / primera carga
// Manda gafete a TODA fila con comprobante que no diga ENVIADO.
// Apps Script corta cada ejecución a los 6 minutos, así que aquí se
// detiene a los ~5 min: si quedan filas pendientes, vuelve a correrla
// (las ya enviadas se saltan solas).
// ============================================================

function cargarEstadosPorSourceKey_() {
  var sheet = getMasterSpreadsheet_().getSheetByName(MASTER_SHEETS.PARTICIPANTES);
  var values = sheet.getDataRange().getValues();
  var mapa = {};
  for (var i = 1; i < values.length; i++) {
    var key = values[i][COL_PARTICIPANTES.SOURCE_KEY];
    if (key) mapa[key] = values[i][COL_PARTICIPANTES.BADGE_STATUS];
  }
  return mapa;
}

function reprocesarTodo() {
  var inicio = new Date().getTime();
  var LIMITE_MS = 5 * 60 * 1000;
  var terminoPorTiempo = false;
  var estados = cargarEstadosPorSourceKey_();
  var resumen = {};

  for (var f = 0; f < FUENTES.length && !terminoPorTiempo; f++) {
    var fuente = FUENTES[f];
    var stats = { filas: 0, enviados: 0, saltados: 0, noEnviados: 0 };
    resumen[fuente.id] = stats;

    try {
      var hoja = SpreadsheetApp.openById(fuente.SPREADSHEET_ID).getSheetByName(fuente.HOJA_NOMBRE);
      if (!hoja) {
        Logger.log('Fuente ' + fuente.id + ': no se encontró la pestaña "' + fuente.HOJA_NOMBRE + '".');
        continue;
      }
      var idx = construirIndiceEncabezados_(hoja);
      var totalFilas = hoja.getLastRow();
      stats.filas = Math.max(0, totalFilas - 1); // sin contar encabezados

      for (var row = 2; row <= totalFilas; row++) {
        if (new Date().getTime() - inicio > LIMITE_MS) {
          terminoPorTiempo = true;
          Logger.log('Límite de tiempo. Vuelve a ejecutar reprocesarTodo() para continuar.');
          break;
        }

        var sourceKey = fuente.SPREADSHEET_ID + ':' + row;
        if (estados[sourceKey] === 'ENVIADO') {
          stats.saltados++;
          continue;
        }

        var envio = procesarFila(fuente, hoja, idx, row);
        if (envio) {
          stats.enviados++;
          estados[sourceKey] = 'ENVIADO';
          Utilities.sleep(1000);
        } else {
          stats.noEnviados++;
        }
      }
    } catch (err) {
      Logger.log('Fuente ' + fuente.id + ': se omitió por error — ' + err);
    }
  }

  // Resumen por formulario
  var totEnv = 0, totSalt = 0, totNo = 0;
  Logger.log('========== RESUMEN POR FORMULARIO ==========');
  FUENTES.forEach(function (fu) {
    var s = resumen[fu.id];
    if (!s) {
      Logger.log(fu.id + ': no se alcanzó a revisar');
      return;
    }
    Logger.log(fu.id + ' | Filas: ' + s.filas +
               ' | Enviados ahora: ' + s.enviados +
               ' | Ya enviados: ' + s.saltados +
               ' | Pendientes/Error: ' + s.noEnviados);
    totEnv += s.enviados;
    totSalt += s.saltados;
    totNo += s.noEnviados;
  });
  Logger.log('TOTAL | Enviados ahora: ' + totEnv +
             ' | Ya enviados: ' + totSalt +
             ' | Pendientes/Error: ' + totNo);
  if (terminoPorTiempo) Logger.log('OJO: se cortó por tiempo, faltan filas por revisar.');
  Logger.log('Reproceso terminado.');
}

// ============================================================
// GENERACIÓN DEL GAFETE (igual para todas las fuentes)
// ============================================================

function recopilarFormas(elementos, resultado) {
  elementos.forEach(function (el) {
    var tipo = el.getPageElementType();
    if (tipo === SlidesApp.PageElementType.SHAPE) {
      resultado.push(el.asShape());
    } else if (tipo === SlidesApp.PageElementType.GROUP) {
      recopilarFormas(el.asGroup().getChildren(), resultado);
    }
  });
}

// Reduce el tamaño de letra del nombre si es muy largo, para que no se
// desborde de su recuadro. Ajusta los números (longitud y factor) a tu
// gusto, según qué tan grande sea el recuadro en tu plantilla.
function ajustarTamanoDeFuente(shape, nombre, tamanoOriginal) {
  var longitud = nombre.length;
  var factor = 1;

  if (longitud > 30) factor = 0.45;
  else if (longitud > 24) factor = 0.55;
  else if (longitud > 18) factor = 0.7;
  else if (longitud > 12) factor = 0.85;

  if (factor < 1) {
    var nuevoTamano = Math.max(9, Math.round(tamanoOriginal * factor));
    shape.getText().getTextStyle().setFontSize(nuevoTamano);
  }
}

function generarGafete(nombre, categoria, folio) {
  var templateFile = DriveApp.getFileById(PLANTILLA_ID);
  var copia = templateFile.makeCopy('Gafete_' + nombre);
  var presentacion = SlidesApp.openById(copia.getId());
  var diapositivas = presentacion.getSlides();
  var posicionQR = null;

  diapositivas.forEach(function (diap) {
    var formas = [];
    recopilarFormas(diap.getPageElements(), formas);

    formas.forEach(function (shape) {
      if (shape.getText) {
        var texto = shape.getText();
        var contenido = texto.asString();

        if (contenido.indexOf(PLACEHOLDER_QR) !== -1) {
          posicionQR = {
            left: shape.getLeft(), top: shape.getTop(),
            width: shape.getWidth(), height: shape.getHeight(),
          };
          shape.remove();
          return;
        }
        if (contenido.indexOf(PLACEHOLDER_NOMBRE) !== -1) {
          var tamanoOriginal = texto.getTextStyle().getFontSize() || 24;
          texto.replaceAllText(PLACEHOLDER_NOMBRE, nombre);
          ajustarTamanoDeFuente(shape, nombre, tamanoOriginal);
        }
      }
    });
  });

  var qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(folio) + '&size=1000&margin=1&ecLevel=M';
  var qrBlob = UrlFetchApp.fetch(qrUrl).getBlob().setName('qr_' + folio);

  var slidePrincipal = diapositivas[0];
  var caja;
  if (posicionQR) {
    // Crece un poco desde el tamaño original del recuadro (25% más grande),
    // manteniendo el mismo borde SUPERIOR (crece hacia abajo, no hacia
    // arriba, para no invadir la barra de categoría que está encima).
    var factorCrecimiento = 1.25;
    var nuevoAncho = posicionQR.width * factorCrecimiento;
    var nuevoAlto = posicionQR.height * factorCrecimiento;
    var centroX = posicionQR.left + posicionQR.width / 2;

    caja = {
      left: centroX - nuevoAncho / 2,
      top: posicionQR.top,
      width: nuevoAncho,
      height: nuevoAlto,
    };
  } else {
    caja = { left: 400, top: 400, width: 110, height: 110 };
    Logger.log('Aviso: no se encontró "' + PLACEHOLDER_QR + '"; QR insertado en posición de respaldo.');
  }

  slidePrincipal.insertImage(qrBlob, caja.left, caja.top, caja.width, caja.height);

  presentacion.saveAndClose();

  var url = 'https://docs.google.com/presentation/d/' + copia.getId() + '/export/pdf';
  var response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  var gafetePdf = response.getBlob().setName('Gafete_' + nombre + '.pdf');

  DriveApp.getFileById(copia.getId()).setTrashed(true);
  return gafetePdf;
}

function enviarGafetePorCorreo(correo, nombre, gafetePdf) {
  var cuerpo =
    'Hola ' + nombre + ',\n\n' +
    'Gracias por tu inscripción al Congreso Nacional de Anatomía 2026.\n' +
    'Adjunto tu gafete en PDF con tu código QR personal.\n\n' +
    'Preséntalo, desde tu celular, el día del evento para el acceso y pase de lista.\n\n' +
    'Nos vemos pronto.';

  GmailApp.sendEmail(correo, ASUNTO_CORREO, cuerpo, {
    attachments: [gafetePdf],
    name: 'Congreso Nacional de Anatomía',
  });
}

/**
 * ============================================================
 * CÓMO ACTIVAR EL MODO INSTANTÁNEO (hacerlo 3 veces, una por Sheet)
 * ============================================================
 * 1. En este proyecto de Apps Script, ícono del reloj (Activadores).
 * 2. Botón "+ Añadir activador".
 * 3. Función a ejecutar: onFormSubmitHandler
 * 4. Implementación: Head
 * 5. Origen del evento: "Desde la hoja de cálculo"
 * 6. Tipo de evento: "Al enviarse el formulario"
 * 7. Elige el Sheet (Foráneos / USEP / BUAP) y guarda.
 * 8. Repite para cada uno de los otros Sheets.
 *
 * Al final: 3 activadores, todos con la función onFormSubmitHandler,
 * cada uno vigilando un Sheet distinto.
 */

/**
 * Ejecuta esta función UNA SOLA VEZ desde el editor de Apps Script
 * para vincular automáticamente los 3 Sheets externos a tu función onFormSubmitHandler.
 */
function crearActivadoresParaLos3Sheets() {
  // 1. Limpiamos activadores previos para no duplicarlos si la vuelves a correr
  const triggersExistentes = ScriptApp.getProjectTriggers();
  triggersExistentes.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onFormSubmitHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 2. Creamos un activador por cada fuente definida en tu arreglo FUENTES
  FUENTES.forEach(fuente => {
    try {
      const ss = SpreadsheetApp.openById(fuente.SPREADSHEET_ID);
      
      ScriptApp.newTrigger('onFormSubmitHandler')
        .forSpreadsheet(ss)
        .onFormSubmit()
        .create();

      Logger.log(' Activador creado con éxito para: ' + fuente.id + ' (' + ss.getName() + ')');
    } catch (err) {
      Logger.log('Error al crear activador para ' + fuente.id + ': ' + err);
    }
  });
}