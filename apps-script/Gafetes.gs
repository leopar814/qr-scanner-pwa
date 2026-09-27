/**
 * Gafetes.gs
 * ============================================================
 * ENVIAR GAFETES CON QR - CONGRESO DE ANATOMÍA (modo instantáneo)
 * ============================================================
 * Generación del gafete (plantilla de Slides + QR de quickchart.io
 * + PDF por correo) TAL CUAL como se venía trabajando — sin cambios
 * respecto a la versión original. Lo único agregado es una llamada
 * a registrarEnMaestro_() (ver MaestroConsolidacion.gs) justo
 * después de que el envío se confirma, para consolidar el registro
 * en el spreadsheet maestro que usa la validación de la PWA.
 *
 * La validación (doPost) y el pase de lista ya NO viven aquí —
 * están en Validacion.gs, adaptados para trabajar contra el
 * spreadsheet maestro en vez de recorrer cada FUENTE por separado.
 */

/**
 * ============================================================
 * ENVIAR GAFETES CON QR - CONGRESO DE ANATOMÍA (modo instantáneo)
 * ============================================================
 *
 * A diferencia de la versión anterior (que corrías a mano y repasaba
 * TODA la hoja), esta versión reacciona AL INSTANTE cuando alguien
 * envía cualquiera de los 2 formularios, procesando solo esa fila nueva.
 *
 * Para activarlo, hay que crear 2 disparadores (uno por formulario) —
 * ver instrucciones al final de este archivo.
 */

// ============================================================
// CONFIG COMPARTIDA
// ============================================================

const PLANTILLA_ID = '1je9KB822uY1GlngpBHEhrulw2jzvXfQ6rVdsrVe8jM0';
const ASUNTO_CORREO = 'Tu gafete - Congreso Nacional de Anatomía 2026';
const WEBAPP_URL = 'https://PENDIENTE-DE-PUBLICAR';

const PLACEHOLDER_NOMBRE = '<<NOMBRE>>';
const PLACEHOLDER_QR     = '<<QR>>';

const COL_FOLIO   = 'Folio';
const COL_SECTOR  = 'Sector de acceso';
const COL_ENVIADO = 'Gafete enviado';

// ============================================================
// FUENTES — una por cada formulario
// ============================================================

const FUENTES = [
  {
    id: 'GENERAL',
    PREFIJO: 'GEN',
    SPREADSHEET_ID: 'PON_AQUI_EL_ID_DEL_SHEET_GENERAL',
    HOJA_NOMBRE: 'PON_AQUI_EL_NOMBRE_DE_LA_PESTAÑA',
    extraerDatos: function (fila, idx) {
      var nombre = [
        fila[idx['Nombre(s):']],
        fila[idx['Apellido Paterno:']],
        fila[idx['Apellido Materno:']],
      ].filter(function (p) {
        return p && p.toString().trim() && p.toString().trim() !== '-';
      }).join(' ').trim();

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
        comprobante: (fila[idx['Comprobante con el motivo de pago: "PARTICIPACIÓN EN LA XXVI REUNIÓN NACIONAL DE MORFOLOGÍA, 2025": ']] || '').toString().trim(),
      };
    },
  },
  {
    id: 'USEP',
    PREFIJO: 'USEP',
    SPREADSHEET_ID: 'PON_AQUI_EL_ID_DEL_SHEET_USEP',
    HOJA_NOMBRE: 'PON_AQUI_EL_NOMBRE_DE_LA_PESTAÑA',
    extraerDatos: function (fila, idx) {
      return {
        nombre: (fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia.']] || '').toString().trim(),
        correo: (fila[idx['Correo electrónico. Favor de asegurarse que esté bien escrito, y que sea el que revise con mayor frecuencia, ya que ahi llegará la constancia correspondiente']] || '').toString().trim(),
        categoria: 'ESTUDIANTE',
        sector: 'USEP',
        comprobante: (fila[idx['Ficha de Pago']] || '').toString().trim(),
      };
    },
  },
  {
    // FUENTE DE PRUEBA — mismo formato que USEP, pero en una pestaña
    // separada solo para pruebas. Bórrala del arreglo cuando ya no la
    // necesites (o coméntala con // delante de cada línea).
    id: 'PRUEBA',
    PREFIJO: 'TEST',
    SPREADSHEET_ID: '1AT53Gxxy9fni9fGKSZqPJt_gzO8yaQ5X6g5xA82HSkY',
    HOJA_NOMBRE: 'Respuestas de formulario 1',
    extraerDatos: function (fila, idx) {
      return {
        nombre: (fila[idx['Nombre completo. Cuide que sea correcto por que asi aparecerá en su constancia.']] || '').toString().trim(),
        correo: (fila[idx['Correo electrónico. Favor de asegurarse que esté bien escrito, y que sea el que revise con mayor frecuencia, ya que ahi llegará la constancia correspondiente']] || '').toString().trim(),
        categoria: 'ESTUDIANTE',
        sector: 'USEP',
        comprobante: (fila[idx['Ficha de Pago']] || '').toString().trim(),
      };
    },
  },
];

// ============================================================
// DISPARADOR INSTANTÁNEO — se activa solo al enviar cualquiera de
// los 2 formularios (ver instrucciones de instalación al final)
// ============================================================

function onFormSubmitHandler(e) {
  try {
    var hoja = e.range.getSheet();
    var spreadsheetId = hoja.getParent().getId();
    var row = e.range.getRow();

    var fuente = FUENTES.filter(function (f) { return f.SPREADSHEET_ID === spreadsheetId; })[0];
    if (!fuente) {
      Logger.log('Aviso: llegó un envío de un Sheet no configurado en FUENTES (' + spreadsheetId + ').');
      return;
    }

    var headers = asegurarColumnasDeControl(hoja);
    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    procesarFila(fuente, hoja, idx, row);

  } catch (err) {
    Logger.log('Error en onFormSubmitHandler: ' + err);
  }
}

// ============================================================
// PROCESA UNA SOLA FILA (usada por el disparador instantáneo)
// ============================================================

function procesarFila(fuente, hoja, idx, row) {
  var fila = hoja.getRange(row, 1, 1, hoja.getLastColumn()).getValues()[0];
  var d = fuente.extraerDatos(fila, idx);

  var yaEnviado = (fila[idx[COL_ENVIADO]] || '').toString().trim().toUpperCase();

  if (
    yaEnviado === 'ENVIADO' ||
    !d.correo || d.correo.indexOf('@') === -1 ||
    !d.nombre ||
    !d.comprobante
  ) {
    Logger.log('Saltado [' + fuente.id + ' fila ' + row + ']: ' + d.nombre + ' | ' + d.correo + ' | comprobante: ' + (d.comprobante ? 'sí' : 'NO'));
    if (!d.comprobante) {
      hoja.getRange(row, idx[COL_ENVIADO] + 1).setValue('PENDIENTE - sin comprobante');
    }
    return;
  }

  var folio = (fila[idx[COL_FOLIO]] || '').toString().trim();
  if (!folio) {
    folio = fuente.PREFIJO + '-' + String(row).padStart(4, '0');
    hoja.getRange(row, idx[COL_FOLIO] + 1).setValue(folio);
  }

  hoja.getRange(row, idx[COL_SECTOR] + 1).setValue(d.sector);

  try {
    var gafeteBlob = generarGafete(d.nombre, d.categoria, folio);
    enviarGafetePorCorreo(d.correo, d.nombre, gafeteBlob);
    hoja.getRange(row, idx[COL_ENVIADO] + 1).setValue('ENVIADO');
    Logger.log('Enviado [' + fuente.id + ']: ' + d.nombre + ' | ' + d.correo + ' | folio: ' + folio);

    // Consolidación hacia el spreadsheet maestro "XXXI CNA PARTICIPANTES"
    // (MaestroConsolidacion.gs). Va en su propio try/catch: si esto falla,
    // el gafete YA se envió correctamente y eso no debe revertirse ni
    // marcarse como ERROR — solo se registra para revisar aparte.
    try {
      registrarEnMaestro_(fuente, d, folio);
    } catch (errMaestro) {
      Logger.log('Aviso: el gafete de ' + folio + ' se envió bien, pero no se pudo ' +
        'consolidar en el spreadsheet maestro: ' + errMaestro);
    }
  } catch (err) {
    hoja.getRange(row, idx[COL_ENVIADO] + 1).setValue('ERROR: ' + err);
    Logger.log('Error generando gafete [' + fuente.id + ' fila ' + row + ']: ' + err);
  }
}

function asegurarColumnasDeControl(hoja) {
  var headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  [COL_FOLIO, COL_SECTOR, COL_ENVIADO].forEach(function (col) {
    if (headers.indexOf(col) === -1) {
      hoja.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });
  return headers;
}

// ============================================================
// REPROCESAR TODO (opcional) — red de seguridad / primera carga
// Úsala si quieres procesar inscripciones que ya existían ANTES de
// activar los disparadores, o si alguna fila quedó en PENDIENTE/ERROR.
// ============================================================

function reprocesarTodo() {
  FUENTES.forEach(function (fuente) {
    try {
      var hoja = SpreadsheetApp.openById(fuente.SPREADSHEET_ID).getSheetByName(fuente.HOJA_NOMBRE);
      if (!hoja) {
        Logger.log('Fuente ' + fuente.id + ': no se encontró la pestaña "' + fuente.HOJA_NOMBRE + '" (revisa el nombre).');
        return;
      }
      var headers = asegurarColumnasDeControl(hoja);
      var idx = {};
      headers.forEach(function (h, i) { idx[h] = i; });

      var totalFilas = hoja.getLastRow();
      for (var row = 2; row <= totalFilas; row++) {
        procesarFila(fuente, hoja, idx, row);
        Utilities.sleep(1000);
      }
      Logger.log('Fuente ' + fuente.id + ': reprocesada correctamente.');
    } catch (err) {
      Logger.log('Fuente ' + fuente.id + ': se omitió por error (¿SPREADSHEET_ID sigue con PON_AQUI?) — ' + err);
    }
  });
  Logger.log('Reproceso completo.');
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
// desborde de su recuadro. Ajusta los números de abajo (longitud de
// caracteres y el factor de reducción) a tu gusto, según qué tan grande
// sea el recuadro real en tu plantilla.
function ajustarTamanoDeFuente(shape, nombre, tamanoOriginal) {
  var longitud = nombre.length;
  var factor = 1;

  if (longitud > 32) factor = 0.55;
  else if (longitud > 26) factor = 0.7;
  else if (longitud > 20) factor = 0.85;

  if (factor < 1) {
    var nuevoTamano = Math.max(10, Math.round(tamanoOriginal * factor));
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
    // pero manteniendo el mismo borde SUPERIOR (no se recorre hacia arriba,
    // para no invadir la barra de categoría que está justo encima).
    var factorCrecimiento = 1.25;
    var nuevoAncho = posicionQR.width * factorCrecimiento;
    var nuevoAlto = posicionQR.height * factorCrecimiento;
    var centroX = posicionQR.left + posicionQR.width / 2;

    caja = {
      left: centroX - nuevoAncho / 2,
      top: posicionQR.top, // se queda igual, crece hacia abajo, no hacia arriba
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
    'Preséntalo, impreso o desde tu celular, el día del evento para el acceso y pase de lista.\n\n' +
    'Nos vemos pronto.';

  GmailApp.sendEmail(correo, ASUNTO_CORREO, cuerpo, {
    attachments: [gafetePdf],
    name: 'Congreso Nacional de Anatomía',
  });
}


/**
 * ============================================================
 * CÓMO ACTIVAR EL MODO INSTANTÁNEO (hacerlo 2 veces, una por Sheet)
 * ============================================================
 * 1. En este proyecto de Apps Script, ícono del reloj (Activadores) en
 *    el menú de la izquierda.
 * 2. Botón "+ Añadir activador" (esquina inferior derecha).
 * 3. Función a ejecutar: onFormSubmitHandler
 * 4. Implementación: Head
 * 5. Origen del evento: "Desde la hoja de cálculo"
 * 6. Tipo de evento: "Al enviarse el formulario"
 * 7. Te va a pedir seleccionar/pegar CUÁL hoja de cálculo — elige la
 *    del Sheet GENERAL. Guarda.
 * 8. Repite los pasos 2-7, pero eligiendo la hoja de cálculo de USEP.
 *
 * Al final debes tener 2 activadores en la lista, ambos apuntando a
 * la misma función "onFormSubmitHandler", cada uno vigilando un Sheet.
 */
