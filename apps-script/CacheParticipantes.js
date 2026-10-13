/**
 * CacheParticipantes.gs
 * Evita releer TODA la hoja Participantes en cada escaneo. Se divide en
 * "chunks" porque CacheService limita cada valor a 100 KB, y con ~1500+
 * participantes el índice completo no cabría en una sola clave.
 *
 * La invalidación es por ESCRITURA (ver invalidateParticipantesCache_,
 * llamada desde MaestroConsolidacion.gs), no por tiempo — así alguien que
 * se acaba de inscribir es encontrado en su primer intento de escaneo,
 * sin importar cuándo fue el último refresco del caché.
 */

function getParticipantesIndexCached_(sheet) {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get(PARTICIPANTES_CACHE_META_KEY);

  if (metaRaw) {
    const meta = JSON.parse(metaRaw);
    const index = [];
    let ok = true;

    for (let c = 0; c < meta.chunks; c++) {
      const chunkRaw = cache.get(PARTICIPANTES_CACHE_CHUNK_PREFIX + c);
      if (chunkRaw === null) {
        // Un chunk se perdió o expiró a medias — mejor reconstruir todo
        // que trabajar con un índice incompleto.
        ok = false;
        break;
      }
      Array.prototype.push.apply(index, JSON.parse(chunkRaw));
    }

    if (ok) return index;
  }

  return buildAndCacheParticipantesIndex_(sheet);
}

function buildAndCacheParticipantesIndex_(sheet) {
  const values = sheet.getDataRange().getValues();
  const index = [];

  for (let row = 1; row < values.length; row++) { // fila 0 = encabezados
    index.push({
      folio: values[row][COL_PARTICIPANTES.FOLIO],
      full_name: values[row][COL_PARTICIPANTES.FULL_NAME],
      status: values[row][COL_PARTICIPANTES.STATUS],
    });
  }

  const cache = CacheService.getScriptCache();
  const chunkCount = Math.max(1, Math.ceil(index.length / PARTICIPANTES_CACHE_CHUNK_SIZE));

  for (let c = 0; c < chunkCount; c++) {
    const chunk = index.slice(
      c * PARTICIPANTES_CACHE_CHUNK_SIZE,
      (c + 1) * PARTICIPANTES_CACHE_CHUNK_SIZE
    );
    cache.put(PARTICIPANTES_CACHE_CHUNK_PREFIX + c, JSON.stringify(chunk), PARTICIPANTES_CACHE_TTL_SECONDS);
  }
  cache.put(PARTICIPANTES_CACHE_META_KEY, JSON.stringify({ chunks: chunkCount }), PARTICIPANTES_CACHE_TTL_SECONDS);

  return index;
}

// Llamar SIEMPRE justo después de agregar o modificar una fila en
// Participantes (ver registrarEnMaestro_ en MaestroConsolidacion.gs).
// No hace falta borrar los chunks viejos: quedan huérfanos e inofensivos
// hasta que expiran solos — lo único que importa borrar es la clave meta,
// porque su ausencia es la señal de "reconstruye desde la hoja".
function invalidateParticipantesCache_() {
  CacheService.getScriptCache().remove(PARTICIPANTES_CACHE_META_KEY);
}
