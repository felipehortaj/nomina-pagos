/* =========================================================================
   Corre todas las pruebas de la carpeta tests/ y muestra un resumen.

   Cada prueba abre la app en un navegador de verdad (Chromium sin ventana),
   carga archivos reales —facturas en PDF, planillas, órdenes de compra— y
   comprueba lo que quedó en pantalla. Una prueba pasa si termina sin error
   y si la app no lanzó ningún error de JavaScript ("errores JS: []").

   Se ejecuta con:  npm test
   Una sola:        node tests/prueba07.mjs
   ========================================================================= */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, "tests");

if (!fs.existsSync(path.join(RAIZ, "dist", "test_local.html"))) {
  console.error("Falta dist/test_local.html. Ejecuta primero:  npm run build");
  process.exit(1);
}
fs.mkdirSync(path.join(DIR, "salida"), { recursive: true });

const soloEsta = process.argv[2];
const archivos = fs.readdirSync(DIR)
  .filter(f => /^prueba\d+\.mjs$/.test(f))
  .filter(f => !soloEsta || f.includes(soloEsta))
  .sort();

const correr = archivo => new Promise(res => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [path.join(DIR, archivo)], { cwd: RAIZ });
  let salida = "";
  p.stdout.on("data", d => salida += d);
  p.stderr.on("data", d => salida += d);
  p.on("close", code => {
    const errores = /errores JS: \[\]/.test(salida);
    const declara = /errores JS:/.test(salida);
    res({
      archivo, ok: code === 0 && (!declara || errores),
      seg: ((Date.now() - t0) / 1000).toFixed(1), salida, code
    });
  });
});

const fallidas = [];
for (const f of archivos) {
  const r = await correr(f);
  console.log(`${r.ok ? "  ok  " : " FALLA"}  ${r.archivo.padEnd(14)} ${r.seg}s`);
  if (!r.ok) { fallidas.push(r); }
}

console.log(`\n${archivos.length - fallidas.length} de ${archivos.length} pruebas pasaron.`);
if (fallidas.length) {
  console.log("\n--- detalle de las que fallaron ---");
  fallidas.forEach(r => console.log(`\n### ${r.archivo} (código ${r.code})\n${r.salida.slice(-2500)}`));
  process.exit(1);
}
