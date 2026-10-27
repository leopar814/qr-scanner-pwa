/**
 * ZipGradeQR.gs
 * Gafete completo (plantilla + nombre + QR) para el listado ZipGrade.
 *  - Si la fila tiene correo válido: envía el gafete por correo y marca ENVIADO.
 *  - Si no tiene correo: guarda el PDF en la carpeta de Drive.
 * No modifica funciones existentes. Reutiliza generarGafete,
 * enviarGafetePorCorreo, obtenerOCrearParticipante_,
 * actualizarEstadoParticipante_, cargarEstadosPorSourceKey_ y
 * construirIndiceEncabezados_.
 */

const ZG_SPREADSHEET_ID = '';
const ZG_CARPETA_GAFETES = 'Gafetes';

function generarGafetesZipGrade() {
  var inicio = new Date().getTime();
  var LIMITE_MS = 5 * 60 * 1000;

  var hoja = SpreadsheetApp.openById(ZG_SPREADSHEET_ID).getSheets()[0];
  var idx = construirIndiceEncabezados_(hoja);
  ['CATEGORÍA', 'ESCUELA', 'NOMBRE', 'ZipGrade ID'].forEach(function (h) {
    if (idx[h] === undefined) throw new Error('No se encontró la columna "' + h + '".');
  });

  var colCorreo = buscarColumnaCorreoZG_(idx);
  if (colCorreo === -1) {
    throw new Error('No se encontró la columna de correo. Ponle al encabezado un nombre que contenga "CORREO".');
  }

  var filas = hoja.getDataRange().getValues();
  var carpeta = obtenerOCrearCarpeta_(ZG_CARPETA_GAFETES);
  var estados = cargarEstadosPorSourceKey_();

  // PDFs que ya existen en la carpeta, para no repetirlos.
  var existentes = {};
  var it = carpeta.getFiles();
  while (it.hasNext()) existentes[it.next().getName()] = true;

  var fuente = { id: 'ZIPGRADE', PREFIJO: 'ZG' };
  var enviados = 0, guardados = 0, saltados = 0, invalidos = 0, correosMalos = 0, errores = 0;
  var terminoPorTiempo = false;

  for (var r = 1; r < filas.length; r++) {
    if (new Date().getTime() - inicio > LIMITE_MS) {
      terminoPorTiempo = true;
      break;
    }

    var fila = filas[r];
    var nombre = (fila[idx['NOMBRE']] || '').toString().trim();
    var zgId = (fila[idx['ZipGrade ID']] || '').toString().trim();
    var correo = (fila[colCorreo] || '').toString().trim();

    if (!nombre || !zgId) {
      invalidos++;
      continue;
    }

    var sourceKey = 'ZIPGRADE:' + zgId;
    var tieneCorreo = correo.indexOf('@') !== -1;
    if (correo && !tieneCorreo) {
      correosMalos++;
      Logger.log('Correo inválido [' + zgId + ' ' + nombre + ']: "' + correo + '" (se guardará en la carpeta)');
    }

    // Ya enviado por correo antes: no repetir.
    if (estados[sourceKey] === 'ENVIADO') {
      saltados++;
      continue;
    }

    var nombreArchivo = (zgId + ' - ' + nombre).replace(/[\\\/:*?"<>|]/g, '') + '.pdf';

    // Sin correo y con PDF ya guardado: no repetir.
    if (!tieneCorreo && existentes[nombreArchivo]) {
      saltados++;
      continue;
    }

    try {
      var d = {
        nombre: nombre,
        correo: tieneCorreo ? correo : '',
        categoria: (fila[idx['CATEGORÍA']] || '').toString().trim(),
        sector: (fila[idx['ESCUELA']] || '').toString().trim(),
        comprobante: '',
      };

      // Si la persona ya está registrada, reutiliza su folio (el QR no cambia).
      var participante = obtenerOCrearParticipante_(fuente, d, sourceKey);
      var folio = participante.folio;

      // Doble protección contra duplicados.
      if (participante.badgeStatus === 'ENVIADO') {
        estados[sourceKey] = 'ENVIADO';
        saltados++;
        continue;
      }

      var gafetePdf = generarGafete(d.nombre, d.categoria, folio);

      if (tieneCorreo) {
        enviarGafetePorCorreo(correo, nombre, gafetePdf);
        try {
          actualizarEstadoParticipante_(folio, 'ENVIADO', '');
          estados[sourceKey] = 'ENVIADO';
        } catch (errEstado) {
          Logger.log('OJO: el correo SÍ salió pero no se pudo marcar ENVIADO [' + zgId + ' ' + nombre + ']: ' + errEstado);
        }
        enviados++;
        Utilities.sleep(1000);
      } else {
        gafetePdf.setName(nombreArchivo);
        carpeta.createFile(gafetePdf);
        existentes[nombreArchivo] = true;
        guardados++;
        Utilities.sleep(500);
      }
    } catch (err) {
      errores++;
      Logger.log('Error [' + zgId + ' ' + nombre + ']: ' + err);
    }
  }

  Logger.log('Carpeta: ' + carpeta.getUrl());
  Logger.log('Enviados por correo: ' + enviados +
             ' | Guardados en carpeta: ' + guardados +
             ' | Ya hechos: ' + saltados +
             ' | Sin nombre o ID: ' + invalidos +
             ' | Correo inválido: ' + correosMalos +
             ' | Errores: ' + errores);
  if (terminoPorTiempo) {
    Logger.log('Se cortó por tiempo. Vuelve a ejecutar generarGafetesZipGrade() para continuar.');
  }
}

// Busca el encabezado de la columna de correo sin importar mayúsculas ni acentos.
function buscarColumnaCorreoZG_(idx) {
  var claves = Object.keys(idx);
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (k.indexOf('correo') !== -1 || k.indexOf('email') !== -1 || k.indexOf('e-mail') !== -1) {
      return idx[claves[i]];
    }
  }
  return -1;
}

function obtenerOCrearCarpeta_(nombre) {
  var it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}