# Nómina de Pagos — Cognita Chile

Aplicación que automatiza la nómina semanal de pagos de facturas de los proyectos de
construcción y mantención de los 13 colegios: registra los estados de pago, lee las
facturas en PDF, arma la nómina de cada viernes y genera los correos al proveedor y a
finanzas.

**Para usarla no hace falta nada de lo que viene más abajo:** basta abrir
`dist/Nomina_Pagos.html` con doble clic. Todo lo demás es para modificarla.

## Qué hay en cada carpeta

| Carpeta | Qué contiene |
|---|---|
| `dist/` | La aplicación lista para usar (`Nomina_Pagos.html`). **Generada: no editar a mano.** |
| `src/` | El código fuente, partido en piezas (interfaz, lectura de PDF, Excel, nómina, correos). |
| `scripts/` | `build.mjs`, que junta las piezas de `src/` en el archivo final. |
| `tests/` | 22 pruebas automáticas que abren la app en un navegador y comprueban su comportamiento. |
| `tests/fixtures/` | Archivos reales de prueba: facturas en PDF, órdenes de compra, planillas, bases guardadas. |
| `docs/` | Decisiones de diseño y la validación contra la nómina real del 03/07/2026. |
| `CLAUDE.md` | Instrucciones para Claude Code: reglas del proyecto y del negocio. Se lee solo. |

## Modificar la app

Requisitos: [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install          # una sola vez
npm run build        # genera dist/Nomina_Pagos.html
npm test             # corre las 22 pruebas (tarda unos minutos)
node tests/prueba07.mjs   # una prueba puntual, con su salida completa
```

Regla de oro: se edita `src/`, nunca `dist/`. Después de cada cambio,
`npm run build && npm test`.

El build no solo concatena: verifica que no haya errores de sintaxis, que no se use
almacenamiento del navegador y que no haya identificadores repetidos en el HTML.

## Cómo está armada

Un único archivo HTML sin instalación ni servidor: se abre desde el computador y los PDF se
leen dentro del navegador, así que **ninguna factura sale del equipo**. Las librerías
`pdf.js` (lectura de PDF) y `SheetJS` (Excel) se cargan desde CDN la primera vez.

Los datos viven en memoria y se conservan exportando la **base**: un archivo `.json` con el
historial completo de nóminas, la biblioteca de órdenes de compra y los catálogos. Se abre
con «Abrir base» y se guarda con «Guardar base» (`Ctrl+S`).

## Las pruebas

Cada prueba levanta Chromium sin ventana, carga archivos reales y comprueba el resultado:
lectura de facturas, IVA y exentas, calce con el estado de pago, control de duplicados entre
nóminas, órdenes de compra en PDF y en Excel, biblioteca con 620 OC, calendario, edición y
visor de documentos, correos al proveedor y a finanzas. Pasan solo si la app no emite
ningún error de JavaScript.

`tests/fixtures/pdfs/` trae una **muestra** de facturas. Si copias ahí las 71 facturas de
una semana real, `prueba02` reproduce la validación completa de la nómina.
