/**
 * Gafetes.gs
 * ============================================================
 * ENVIAR GAFETES CON QR - CONGRESO DE ANATOMÍA (modo instantáneo)
 * ============================================================
 * Cuando alguien envía cualquiera de los 3 formularios (Foráneos,
 * USEP, BUAP) se genera su gafete (plantilla de Slides + QR de
 * quickchart.io), se manda en PDF por correo y se consolida en el
 * spreadsheet maestro (registrarEnMaestro_, en MaestroConsolidacion.gs).
 * Cuando alguien envía cualquiera de los 3 formularios (Foráneos,
 * USEP, BUAP) se genera su gafete (plantilla de Slides + QR de
 * quickchart.io), se manda en PDF por correo y se consolida en el
 * spreadsheet maestro (registrarEnMaestro_, en MaestroConsolidacion.gs).
 *
 * La validación (doPost) y el pase de lista viven en Validacion.gs.
 *
 * REQUIERE el archivo LimpiarNombre.gs en el mismo proyecto
 * (usa construirNombreCompleto_ y limpiarNombreCompleto_).
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
    // Formulario general (foráneos)
    id: 'GENERAL',
    PREFIJO: 'GEN',
    SPREADSHEET_ID: '1BW5ifXpmGlanJbo2HXGWCbt3M9qAUDDDVXDK2O8mNZo',
    HOJA_NOMBRE: 'Respuestas de formulario 2',
    extraerDatos: function (fila, idx) {
      var nombre = construirNombreCompleto_([
        fila[idx['Nombre(s):']],
        fila[idx['Apellido Paterno:']],
        fila[idx['Apellido Materno:']],
      ]);

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
    // Formulario USEP
    id: 'USEP',
    PREFIJO: 'USEP',
    SPREADSHEET_ID: '1ypM-Qcv2bj-_R96r-Lanuk0qlkRmujpOaOA1Vi823_A',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    SPREADSHEET_ID: '1ypM-Qcv2bj-_R96r-Lanuk0qlkRmujpOaOA1Vi823_A',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    extraerDatos: function (fila, idx) {
      return {
        nombre: limpiarNombreCompleto_(fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia.']]),
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
    SPREADSHEET_ID: '1xYaskYRKFcJ_Wfwc0mGNygQetYrUbwjXc_RknMJL5NY',
    HOJA_NOMBRE: 'Respuestas de formulario 2',
    extraerDatos: function (fila, idx) {
      return {
        nombre: limpiarNombreCompleto_(fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia']]),
        correo: (fila[idx['Correo electrónico. Favor de asegurarse que esté bien escrito, y que sea el que revise con mayor frecuencia, ya que ahi llegará la constancia correspondiente']] || '').toString().trim(),
        categoria: 'ESTUDIANTE',
        sector: 'BUAP',
        sector: 'BUAP',
        comprobante: (fila[idx['Ficha de Pago']] || '').toString().trim(),
      };
    },
  },
];

// ============================================================
// DISPARADOR INSTANTÁNEO — se activa solo al enviar cualquiera de
// los formularios (ver instrucciones de instalación al final)
// los formularios (ver instrucciones de instalación al final)
// ============================================================

function onFormSubmitHandler(e) {
  try {
    if (!e || !e.range) {
      Logger.log('Aviso: Esta función se ejecuta automáticamente al recibir un Formulario.');
      return;
    }

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

    // 1. Asegura columnas en el Sheet y obtiene el mapa de índices ACTUALIZADO
    var idx = asegurarColumnasDeControl(hoja);

    procesarFila(fuente, hoja, idx, row);

  } catch (err) {
    Logger.log('Error en onFormSubmitHandler: ' + err);
  }
}

function procesarFila(fuente, hoja, idx, row) {
  // Leemos la fila completa con el ancho de columnas actualizado
  var lastCol = hoja.getLastColumn();
  var fila = hoja.getRange(row, 1, 1, lastCol).getValues()[0];
  var d = fuente.extraerDatos(fila, idx);

  var colEnviadoIdx = idx[COL_ENVIADO];
  var colFolioIdx   = idx[COL_FOLIO];
  var colSectorIdx  = idx[COL_SECTOR];

  var yaEnviado = (colEnviadoIdx !== undefined && fila[colEnviadoIdx]) 
    ? fila[colEnviadoIdx].toString().trim().toUpperCase() 
    : '';

  if (
    yaEnviado === 'ENVIADO' ||
    !d.correo || d.correo.indexOf('@') === -1 ||
    !d.nombre ||
    !d.comprobante
  ) {
    Logger.log('Saltado [' + fuente.id + ' fila ' + row + ']: ' + d.nombre + ' | ' + d.correo + ' | comprobante: ' + (d.comprobante ? 'sí' : 'NO'));
    if (!d.comprobante && colEnviadoIdx !== undefined) {
      hoja.getRange(row, colEnviadoIdx + 1).setValue('PENDIENTE - sin comprobante');
    }
    return false;
  }

  // Obtener o asignar Folio
  var folio = (colFolioIdx !== undefined && fila[colFolioIdx]) 
    ? fila[colFolioIdx].toString().trim() 
    : '';

  if (!folio) {
    folio = fuente.PREFIJO + '-' + String(row).padStart(4, '0');
    if (colFolioIdx !== undefined) {
      hoja.getRange(row, colFolioIdx + 1).setValue(folio);
    }
  }

  // Registrar Sector de acceso
  if (colSectorIdx !== undefined) {
    hoja.getRange(row, colSectorIdx + 1).setValue(d.sector);
  }

  try {
    var gafeteBlob = generarGafete(d.nombre, d.categoria, folio);
    enviarGafetePorCorreo(d.correo, d.nombre, gafeteBlob);
    
    if (colEnviadoIdx !== undefined) {
      hoja.getRange(row, colEnviadoIdx + 1).setValue('ENVIADO');
    }
    
    Logger.log('Enviado [' + fuente.id + ']: ' + d.nombre + ' | ' + d.correo + ' | folio: ' + folio);

    try {
      registrarEnMaestro_(fuente, d, folio);
    } catch (errMaestro) {
      Logger.log('Aviso: el gafete de ' + folio + ' se envió bien, pero no se pudo consolidar en el maestro: ' + errMaestro);
    }
    return true;

  } catch (err) {
    if (colEnviadoIdx !== undefined) {
      hoja.getRange(row, colEnviadoIdx + 1).setValue('ERROR: ' + err);
    }
    Logger.log('Error generando gafete [' + fuente.id + ' fila ' + row + ']: ' + err);
    return false;
  }
}

function asegurarColumnasDeControl(hoja) {
  var headers = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0];

  [COL_FOLIO, COL_SECTOR, COL_ENVIADO].forEach(function (col) {
    if (headers.indexOf(col) === -1) {
      hoja.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  // Retorna el mapa completo de índices (NombreEncabezado -> PosiciónBase0)
  var idxMap = {};
  headers.forEach(function (h, i) { 
    idxMap[h.toString().trim()] = i; 
  });
  
  return idxMap;
}

// ============================================================
// REPROCESAR TODO (opcional) — red de seguridad / primera carga
// Manda gafete a TODA fila con comprobante que no diga ENVIADO.
// Apps Script corta cada ejecución a los 6 minutos, así que aquí se
// detiene a los ~5 min: si quedan filas pendientes, vuelve a correrla
// (las ya enviadas se saltan solas).
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

  for (var f = 0; f < FUENTES.length && !terminoPorTiempo; f++) {
    var fuente = FUENTES[f];
    try {
      var hoja = SpreadsheetApp.openById(fuente.SPREADSHEET_ID).getSheetByName(fuente.HOJA_NOMBRE);
      if (!hoja) {
        Logger.log('Fuente ' + fuente.id + ': no se encontró la pestaña "' + fuente.HOJA_NOMBRE + '" (revisa el nombre).');
        continue;
      }
      var idx = construirIndiceEncabezados_(hoja);
      var totalFilas = hoja.getLastRow();
      stats.filas = Math.max(0, totalFilas - 1); // sin contar encabezados

      for (var row = 2; row <= totalFilas; row++) {
        if (new Date().getTime() - inicio > LIMITE_MS) {
          terminoPorTiempo = true;
          Logger.log('Se alcanzó el límite de tiempo. Vuelve a ejecutar reprocesarTodo() para continuar.');
          break;
        }
        var envio = procesarFila(fuente, hoja, idx, row);
        if (envio) Utilities.sleep(1000);
      }
      Logger.log('Fuente ' + fuente.id + ': revisada.');
    } catch (err) {
      Logger.log('Fuente ' + fuente.id + ': se omitió por error — ' + err);
    }
  }
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
// desborde de su recuadro. Ajusta los números (longitud y factor) a tu
// gusto, según qué tan grande sea el recuadro en tu plantilla.
function ajustarTamanoDeFuente(shape, nombre, tamanoOriginal) {
  var longitud = nombre.length;
  var factor = 1;

  if (longitud > 30) factor = 0.45;
  else if (longitud > 24) factor = 0.55;
  else if (longitud > 18) factor = 0.7;
  else if (longitud > 12) factor = 0.85;
  if (longitud > 30) factor = 0.45;
  else if (longitud > 24) factor = 0.55;
  else if (longitud > 18) factor = 0.7;
  else if (longitud > 12) factor = 0.85;

  if (factor < 1) {
    var nuevoTamano = Math.max(9, Math.round(tamanoOriginal * factor));
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
    // manteniendo el mismo borde SUPERIOR (crece hacia abajo, no hacia
    // arriba, para no invadir la barra de categoría que está encima).
    var factorCrecimiento = 1.25;
    var nuevoAncho = posicionQR.width * factorCrecimiento;
    var nuevoAlto = posicionQR.height * factorCrecimiento;
    var centroX = posicionQR.left + posicionQR.width / 2;

    caja = {
      left: centroX - nuevoAncho / 2,
      top: posicionQR.top,
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
 * CÓMO ACTIVAR EL MODO INSTANTÁNEO (hacerlo 3 veces, una por Sheet)
 * ============================================================
 * 1. En este proyecto de Apps Script, ícono del reloj (Activadores).
 * 2. Botón "+ Añadir activador".
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