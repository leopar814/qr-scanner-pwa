# Control de Acceso — Congreso de Medicina (PWA)

UI de escaneo para los 3 Android de entrada (Fase C del plan de implementación).
No incluye el backend (Fase B, Apps Script) — solo el frontend que lo consume.

## Contrato de API que espera esta UI

`POST {API_URL}` con body:
```json
{ "token": "GEN-0001", "device_id": "AND-01" }
```
`token` es el mismo texto que trae el QR del gafete — con el backend
actual (ver sección 3) ese texto es el **folio** (`GEN-0001`,
`USEP-0001`, etc.), no un token aleatorio.

Respuesta esperada:
```json
{ "result": "VALID_FIRST_ENTRY", "full_name": "Nombre Apellido" }
{ "result": "VALID_REENTRY",     "full_name": "Nombre Apellido" }
{ "result": "REJECTED", "reason": "UNKNOWN_TOKEN" }
{ "result": "REJECTED", "reason": "REVOKED" }
```
Cualquier otro caso (timeout, error HTTP, JSON inválido, `LOCK_TIMEOUT`)
se muestra como "NO SE PUDO VALIDAR — REINTENTAR" con botón de reintento.
Este archivo (`js/app.js`) **no necesitó ningún cambio** al adaptar el
backend — el contrato se mantuvo idéntico a propósito.

## 1. Entorno recomendado

- **IDE:** VS Code.
- **Extensiones:** *Live Server* (ritwickdey.liveserver) para servir con recarga
  en caliente, *ESLint* opcional si luego se agrega backend en Node.
- No se requiere build tool (sin bundler, sin npm): son archivos estáticos.

## 2. Ejecutar en local

1. Abre la carpeta en VS Code.
2. Clic derecho en `index.html` → "Open with Live Server" (o `npx serve .`).
3. La cámara solo funciona en **HTTPS o `localhost`** — Live Server sirve en
   `localhost`, así que funciona sin certificado en desarrollo.
4. En el primer arranque la app pedirá elegir `device_id` y pegar la URL del
   Apps Script (una vez que Fase B esté desplegada). Se guarda en
   `localStorage` del dispositivo.

## 3. Backend — `apps-script/`

**Cambio importante de arquitectura (revisar antes de seguir):** el
backend ahora combina el trabajo de dos personas del equipo en un solo
proyecto de Apps Script:

- **Gafetes + QR** (`Gafetes.gs`) — código de tu compañera, **sin
  cambios**: plantilla de Google Slides, QR generado con
  [quickchart.io](https://quickchart.io), exportado a PDF y enviado por
  correo. Sigue reaccionando al instante cuando alguien llena cualquiera
  de los Forms (`FUENTES`: `GENERAL`, `USEP`).
- **Validación + pase de lista** (`Validacion.gs`) — reescrito para
  funcionar con la PWA: en vez de recorrer cada Form por separado en
  cada escaneo, lee de un spreadsheet maestro consolidado, con
  `LockService` para que dos Android no dupliquen una asistencia.
- **Consolidación** (`MaestroConsolidacion.gs`) — el puente entre las
  dos partes: cuando `Gafetes.gs` termina de enviar un gafete, escribe
  ese registro en el spreadsheet maestro.
- **Constancias SMA** (`Constancias.gs`) — sin relación con el congreso;
  se separó a su propio archivo solo por orden.

### El folio ahora ES el token

El QR de cada gafete codifica el **folio** (`GEN-0001`, `USEP-0001`,
...), no un token aleatorio — así se generaba en el código de tu
compañera y no se tocó esa parte a propósito. `Validacion.gs` busca por
ese mismo folio. Diferencia a tener en cuenta: un folio es predecible
(consecutivo), no opaco como un token aleatorio — si en algún momento
les preocupa que alguien pueda adivinar/fabricar un folio válido, es
algo que se puede endurecer después; no es parte de este cambio.

### Dónde vive cada dato ahora

- Los Sheets de **GENERAL** y **USEP** (uno por Form, definidos en
  `FUENTES` dentro de `Gafetes.gs`) siguen recibiendo las respuestas
  crudas de cada formulario, como siempre.
- Cada vez que un gafete se envía con éxito, ese registro **también**
  se escribe en un spreadsheet nuevo y separado, **"XXXI CNA
  PARTICIPANTES"**, con 3 pestañas:
  - **Participantes** — un renglón por folio con gafete ya enviado.
  - **Asistencias** — un renglón por folio y día en que entró (esto es
    lo que evita duplicar el pase de lista si alguien reingresa).
  - **Scan_log** — bitácora de cada intento de escaneo, válido o no.
- `Validacion.gs` (el `doPost` que usa la PWA) **solo** lee de este
  spreadsheet maestro — no toca los Sheets de GENERAL/USEP directamente,
  por eso la validación es rápida sin importar cuántas fuentes de
  registro haya.

### Rendimiento en el pico del martes (caché de Participantes)

`CacheParticipantes.gs` cachea el índice de Participantes para que
`Validacion.gs` no relea toda la hoja en cada escaneo — importante
porque el martes hay inscripciones de último momento **y** escaneos
ocurriendo al mismo tiempo, compitiendo por la misma cuota de Sheets. La
invalidación es por **escritura**, no por tiempo:
`MaestroConsolidacion.gs` borra el caché en el instante en que agrega un
participante nuevo, así que alguien que se acaba de inscribir es
encontrado en su primer intento de escaneo, sin importar cuándo fue el
último refresco. No requiere ningún paso de instalación aparte — ya
queda activo con solo tener el archivo en el proyecto.

### Primeros pasos para dejarlo funcionando

1. En el mismo proyecto de Apps Script donde ya trabajan (o uno nuevo,
   según cómo lo tengan organizado), agrega los 6 archivos de
   `apps-script/`: `Gafetes.gs`, `Constancias.gs`, `MaestroConfig.gs`,
   `MaestroSetup.gs`, `MaestroConsolidacion.gs`, `Validacion.gs`.
2. **Crea un Google Sheet nuevo llamado exactamente "XXXI CNA
   PARTICIPANTES"**, ábrelo, copia su ID de la URL (entre `/d/` y
   `/edit`), y pégalo en `MaestroConfig.gs`, en la constante
   `MASTER_SPREADSHEET_ID` (reemplaza el `PON_AQUI_...`).
3. En el desplegable de funciones, elige `setupHojasMaestras` y
   **Ejecutar** — esto crea las 3 pestañas con sus encabezados. Solo se
   corre una vez.
4. Confirma que `FUENTES` en `Gafetes.gs` ya tenga los `SPREADSHEET_ID`
   reales de GENERAL y USEP (no `PON_AQUI_...`) y que los 2 activadores
   de `onFormSubmitHandler` (uno por Form) sigan activos — eso no
   cambió, ver el comentario "CÓMO ACTIVAR EL MODO INSTANTÁNEO" al final
   de `Gafetes.gs`.
5. Vuelve a desplegar el Web App: **Implementar → Gestionar
   implementaciones → ✏️ → Nueva versión → Implementar** (si ya tenían
   una URL en uso) — la URL no cambia, así que **no hace falta tocar
   `API_URL` en la PWA**.

**Cuota de correo (sigue aplicando igual que antes):** `GmailApp`
comparte el límite diario de 100/día en Gmail personal vs 1,500/día en
Workspace — confirma que este proyecto esté autorizado con la cuenta
institucional.

## 4. Probar en un Android real

1. Conecta el teléfono por USB con "Depuración USB" activada.
2. En Chrome desktop: `chrome://inspect` → selecciona el dispositivo para
   ver la consola remota mientras pruebas.
3. Concede el permiso de cámara cuando la app lo solicite.
4. Agrega a pantalla de inicio (menú ⋮ → "Instalar aplicación") para que
   abra en modo `standalone`, sin barra de navegador — ideal para el uso
   fijo en el acceso.

## 5. Despliegue

Opciones simples sin infraestructura nueva:
- **GitHub Pages**: sirve esta carpeta como sitio estático (HTTPS gratis,
  requisito para la cámara).
- **Apps Script HTML Service**: si se prefiere todo en un solo proyecto de
  Google, se puede servir el `index.html` desde el mismo Apps Script.

## 6. Configurar los 3 dispositivos

Repite el arranque en cada Android eligiendo un `device_id` distinto
(`AND-01`, `AND-02`, `AND-03`) — ver checklist "Antes de abrir acceso"
(sección 17 del plan).

## Estructura

```
congreso-medicina-pwa/
├── index.html
├── manifest.json
├── sw.js
├── css/styles.css
├── js/config.js           # API_URL, device_id, timeouts
├── js/app.js               # cámara, jsQR, fetch al API, estados visuales
├── icons/icon.svg
└── apps-script/
    ├── Gafetes.gs              # gafete+QR (código de tu compañera, sin cambios)
    ├── Constancias.gs          # constancias SMA — sistema aparte
    ├── MaestroConfig.gs        # ID del Sheet maestro e índices de columna
    ├── MaestroSetup.gs         # crea Participantes/Asistencias/Scan_log (una vez)
    ├── MaestroConsolidacion.gs # escribe en el maestro tras cada gafete enviado
    ├── CacheParticipantes.gs   # caché del índice de Participantes, invalidado por escritura
    └── Validacion.gs           # doPost: validación + pase de lista (para la PWA)
```
