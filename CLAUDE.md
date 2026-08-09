# Nómina de Pagos — Cognita Chile

App de una sola página que automatiza la nómina semanal de facturas de proyectos de
construcción y mantención de 13 colegios. Interfaz **en español**, para un usuario de
negocio (no técnico).

## Cómo se trabaja acá

- **Nunca edites `dist/Nomina_Pagos.html`**: es generado. Edita las partes en `src/` y
  ejecuta `npm run build`. El orden de concatenación está en `scripts/build.mjs`.
- Compilar: `npm run build` · Probar todo: `npm test` · Una sola: `node tests/prueba07.mjs`
- Después de **cualquier** cambio: `npm run build && npm test`. Las 22 pruebas abren la app
  en Chromium con archivos reales; una prueba pasa solo si imprime `errores JS: []`.

## Reglas que no se pueden romper

- **Un solo archivo, sin dependencias locales.** Se abre con doble clic desde el
  computador del usuario (`file://`). pdf.js y SheetJS vienen por CDN.
- **Prohibido `localStorage`, `sessionStorage` e `indexedDB`.** La persistencia es
  exportar/importar el archivo `.json` de la base (botón «Guardar base»). El build falla
  si aparece alguna de esas APIs.
- **Sin ids repetidos en el HTML** (el build también lo verifica).
- Todo texto visible va en español, en tono de usuario de negocio, sin jerga técnica.

## Reglas del negocio (vienen del proceso real, no inventar)

- **IVA 19%**: `iva = round(neto * 0.19)` y `total = neto + iva`. Si el cuadro no trae IVA,
  la factura es **exenta**: `iva = 0`, `total = neto`, y el documento se emite como FAEX.
- **La nómina se identifica por su fecha de envío (un viernes).** Las facturas recibidas
  hasta el viernes van en esa nómina; las que llegan desde el lunes, en la siguiente.
  Una misma factura **no puede estar en dos nóminas** (se pagaría dos veces): el control de
  duplicados compara RUT + folio contra todas las nóminas del historial.
- **La sede** se determina por el RUT de la sociedad que recibe la factura, y se
  contrasta con el prefijo de la OC (ver `SOCIEDADES_SEED` en `src/p3_core.js`).
- CAPEX se imputa a *project code*; mantención, a *cuenta contable* (68500 / 68000).
- Los montos chilenos usan punto de miles; las OC de Netsuite a veces traen coma. `numLocal()`
  en `src/p3_core.js` decide cuál es separador de miles y cuál decimal — no simplificar.

## Diseño: liviano por pedido explícito del usuario

- Un solo peso fuerte (600), reservado a títulos y cifras clave; el resto en 400.
- Sin sombras salvo en capas flotantes. Color solo cuando significa algo.
- Todo lo explicativo va oculto detrás del interruptor de ayuda: usa las clases
  `.d`, `.hint`, `.page-h p`, `.tbl-leyenda` o `.solo-ayuda`, nunca texto suelto.
- Detalle completo en `docs/diseno.md`.
