# Control de Acceso — Congreso de Medicina (PWA)

UI de escaneo para los 3 Android de entrada (Fase C del plan de implementación).
No incluye el backend (Fase B, Apps Script) — solo el frontend que lo consume.

## Contrato de API que espera esta UI

`POST {API_URL}` con body:
```json
{ "token": "ACCESS-7f3c...", "device_id": "AND-01" }
```

Respuesta esperada (mapeada 1:1 con la sección 7.2 del plan):
```json
{ "result": "VALID_FIRST_ENTRY", "full_name": "Nombre Apellido" }
{ "result": "VALID_REENTRY",     "full_name": "Nombre Apellido" }
{ "result": "REJECTED", "reason": "UNKNOWN_TOKEN" }
{ "result": "REJECTED", "reason": "UNPAID" }
{ "result": "REJECTED", "reason": "INCOMPLETE" }
{ "result": "REJECTED", "reason": "REVOKED" }
```
Cualquier otro caso (timeout, error HTTP, JSON inválido) se muestra como
"NO SE PUDO VALIDAR — REINTENTAR" con botón de reintento.

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

## 3. Backend (Fase B) — `apps-script/`

Ya incluido: `Config.gs` (constantes), `Code.gs` (`doPost`, validación y
pase de lista), `Consolidacion.gs` (trigger `onFormSubmit`, normaliza los
3 Forms hacia `PARTICIPANTES`) y `Setup.gs` (crea las hojas la primera vez).

### Qué es Apps Script, en corto

Es JavaScript que corre en los servidores de Google, ligado a un archivo
de Google (en este caso, el Sheet maestro) o de forma independiente. En
vez de instalar nada, se edita en un editor web dentro del propio Sheet,
y en vez de un `package.json`, los permisos de qué puede tocar el script
(Sheets, correo, red) se autorizan la primera vez que corres algo.

### Primeros pasos (primera vez usando Apps Script)

1. Abre el Google Sheet maestro (o créalo) → menú **Extensiones → Apps
   Script**. Esto abre un editor web y crea un proyecto **vinculado** a
   ese Sheet — por eso el código puede usar `SpreadsheetApp.getActiveSpreadsheet()`
   sin necesitar ningún ID.
2. Borra el `Code.gs` vacío que trae por defecto y pega el contenido de
   los 4 archivos de `apps-script/` (crea cada uno con el botón **+** junto
   a "Archivos", como archivo de **Script**, con el mismo nombre sin la
   extensión `.gs` visible en el editor).
3. En el desplegable de funciones (arriba, junto a ▶ Ejecutar), selecciona
   `setupSheets` y dale **Ejecutar**. La primera vez pedirá autorizar
   permisos — es normal que Google muestre "app no verificada", acéptalo
   con **Avanzado → Ir a [proyecto] (no seguro)**, porque el proyecto es
   tuyo.
4. Crea el trigger de consolidación: ícono de reloj **Activadores** (barra
   izquierda) → **+ Añadir activador** → función `onFormSubmit`, evento
   "Desde la hoja de cálculo", tipo "Al enviar formulario" → Guardar.
5. Despliega el Web App: botón **Implementar → Nueva implementación** →
   tipo **Aplicación web** → "Ejecutar como": **Yo**, "Quién tiene acceso":
   **Cualquier usuario** → Implementar. Copia la URL que te da (termina en
   `/exec`) — esa es tu `API_URL` para configurar los 3 Android.
6. **Importante:** si editas el código después, los cambios NO se
   reflejan en la URL ya desplegada hasta que hagas **Implementar →
   Gestionar implementaciones → ✏️ → Nueva versión → Implementar**. Guardar
   el archivo (Ctrl+S) no es suficiente.

### Dónde ver errores

Panel **Ejecuciones** (barra izquierda, ícono de lista) muestra cada
llamada al `doPost`, su duración y si falló — es tu principal herramienta
de depuración, ya que no hay una terminal como tal. `console.log(...)`
dentro del código aparece ahí también.

### Ajustes pendientes antes de usarlo con los Forms reales

En `Consolidacion.gs`, `RAW_SHEET_SOURCE` y `FIELD_MAP` tienen nombres de
ejemplo — ajústalos exactamente a como se llaman las pestañas y las
preguntas de tus 3 Forms reales (decisión #16 del plan, aún abierta).

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
    ├── Config.gs           # nombres de hojas e índices de columna
    ├── Code.gs             # doPost: validación + pase de lista
    ├── Consolidacion.gs    # onFormSubmit: normaliza los 3 Forms
    └── Setup.gs            # crea las hojas la primera vez (ejecutar una vez)
```
