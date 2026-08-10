/* =========================================================================
   Compila la aplicación: junta las partes de src/ en un solo archivo HTML.

   Salida:
     dist/Nomina_Pagos.html   → el que se usa de verdad (librerías desde CDN)
     dist/test_local.html     → igual, pero leyendo las librerías de node_modules
                                (lo usan las pruebas automáticas, sin internet)

   Se ejecuta con:  npm run build
   ========================================================================= */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const DIST = path.join(RAIZ, "dist");

/* El orden importa: p1/p2 son el HTML, el resto son los scripts.
   p5 (render) y p7 (eventos) van al final porque usan todo lo anterior. */
const PARTES = [
  "p1_head.html",      // <head>, hoja de estilos, barra lateral, panel de control
  "p2_body.html",      // los demás paneles, modales, calendario
  "p3_core.js",        // utilidades, catálogos semilla, modelo de datos
  "p4_eepp.js",        // estados de pago y correo al proveedor
  "p8_excel.js",       // lectura de planillas Excel
  "p9_oc.js",          // órdenes de compra: búsqueda y ficha
  "pA_ocpdf.js",       // lectura de órdenes de compra en PDF
  "pB_editar.js",      // edición de facturas y visor de documentos
  "pC_biblioteca.js",  // biblioteca de OC y creación en lote
  "pD_fecha.js",       // calendario en español
  "p5_render.js",      // pintado de toda la interfaz
  "p6_mail.js",        // correo a finanzas, exportaciones, guardar base
  "p7_events.js"       // eventos: la app se conecta acá
];

let html = PARTES.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("");

/* --- parche de unicode ---------------------------------------------------
   norm() debe quitar tildes pero conservar ° y º (el folio viene como "N°685").
   Los caracteres combinantes no sobreviven bien a algunos editores, así que
   se reescriben acá de forma explícita.                                    */
html = html.replace(
  /return String\(s \?\? ""\)\.replace\(\/[\s\S]{1,3}\/g, " "\)\.normalize\("NFD"\)\s*\n\s*\.replace\(\/\[[\s\S]{1,6}\]\/g, ""\);/,
  'return String(s ?? "").replace(/[\\u00a0\\u2007\\u202f]/g, " ").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");'
);
html = html.replace(/\.replace\(\/ \/g, " "\)/g, '.replace(/\\u00a0/g, " ")');
if (!/u0300-\\u036f/.test(html)) {
  console.error("ERROR: no se pudo aplicar el parche de unicode en norm().");
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, "Nomina_Pagos.html"), html);

/* --- versión para pruebas: librerías locales en vez de CDN --- */
const local = html
  .replace("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", "../node_modules/pdfjs-dist/build/pdf.min.js")
  .replace("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "../node_modules/xlsx/dist/xlsx.full.min.js")
  .replace("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js", "../node_modules/pdfjs-dist/build/pdf.worker.min.js");
fs.writeFileSync(path.join(DIST, "test_local.html"), local);

/* --- comprobaciones que no se pueden romper ------------------------------ */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => {
  try { new Function(s); }
  catch (e) { console.error(`ERROR de sintaxis en el script ${i + 1}: ${e.message}`); process.exit(1); }
});
if (/localStorage|sessionStorage/.test(html)) {
  console.error("ERROR: la app no puede usar localStorage ni sessionStorage (ver CLAUDE.md). El autoguardado usa IndexedDB.");
  process.exit(1);
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
if (dup.length) { console.error("ERROR: hay id repetidos en el HTML: " + dup.join(", ")); process.exit(1); }

console.log(`listo: dist/Nomina_Pagos.html — ${(html.length / 1024).toFixed(0)} KB · ` +
  `${scripts.length} scripts · ${ids.length} id únicos`);
