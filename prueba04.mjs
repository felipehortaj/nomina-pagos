import pw from 'playwright'; const { chromium } = pw;
import path from "path";
import { fileURLToPath } from "url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* R() ubica los archivos de prueba; las capturas y volcados van a tests/salida */
const R = p => /\.png$|_out\.json$/.test(p)
  ? path.join(RAIZ, "tests", "salida", path.basename(p))
  : path.join(RAIZ, "tests", "fixtures", p);
const URL_APP = "file://" + path.join(RAIZ, "dist", "test_local.html");
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
await p.goto(URL_APP); await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="eepp"]');
await p.click('#segModoEp button[data-modo="excel"]'); await p.waitForTimeout(150);

async function probar(archivo, etiqueta) {
  await p.setInputFiles('#fileXl', archivo);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({
    nombre: xlNombre, hoja: document.querySelector('#xlHoja').value,
    filaHdr: document.querySelector('#xlFilaHdr').value,
    resumen: document.querySelector('#xlMapResumen').textContent.trim(),
    filas: xlFilasUtiles().map(x => x.d)
  }));
  console.log(`\n### ${etiqueta} — hoja "${r.hoja}", títulos en fila ${r.filaHdr}`);
  console.log('   ' + r.resumen);
  r.filas.forEach(d => console.log(`   ${d.sede||'--'} | ${d.proy||'--'} | ${d.oc||'--'} | ${d.vendor||'--'} | ${d.ep||'--'} | base ${d.base??'-'} | pct ${d.pct??'-'} | NETO ${d.neto??'FALTA'} | ${d.ir||''}`));
  return r;
}
await probar(R('test_eepp_simple.xlsx'), 'Planilla simple');
// pasar la primera fila al formulario
await p.click('[data-xlform="0"]'); await p.waitForTimeout(500);
console.log('\n--- Formulario tras "→ Formulario" ---');
console.log(await p.evaluate(() => ['epProv','epVendor','epOc','epProy','epSede','epIr','epGlosa','epEp','epBase','epPct','epNeto']
  .map(id => id.replace('ep','') + '=' + document.querySelector('#'+id).value).join(' | ')));
console.log('calculado:', await p.textContent('#epCalc'));
await p.click('#btnEpAdd'); await p.waitForTimeout(600);
console.log('EEPP creados:', await p.evaluate(() => db.eepp.length), '| correo abierto:', await p.evaluate(() => !document.querySelector('#cardEpMail').classList.contains('hide')));

await probar(R('test_eepp_raro.xlsx'), 'Planilla con títulos en fila 4 y % en texto');
await p.click('#btnXlTodas'); await p.waitForTimeout(700);
console.log('EEPP totales:', await p.evaluate(() => db.eepp.length));
console.log('mapas guardados:', await p.evaluate(() => db.cat.mapasXl.length));

// bloques EEPP del Generador
await p.setInputFiles('#fileXl', R('Generador_EEPP.xlsx')); await p.waitForTimeout(1000);
await p.click('#btnXlBloques'); await p.waitForTimeout(700);
console.log('tras "Leer como bloques":', await p.evaluate(() => db.eepp.length), 'EEPP');
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_xl.png') });
await b.close();
