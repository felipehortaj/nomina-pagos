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
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(URL_APP); await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="eepp"]');
await p.setInputFiles('#fileOcPdf', [R('oc_bad/POCHI-002921.pdf'),R('oc_bad/POVLC-003007.pdf'),R('oc_pdfs/OC_POHUE-002538.pdf')]);
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, {timeout:60000});
await p.waitForTimeout(700);
const r = await p.evaluate(() => ocPdfLista.map(o => ({archivo:o.archivo, oc:o.oc, sede:o.sede, monto:o.monto, avisos:o.avisos})));
r.forEach(o => {
  console.log(`\n${o.archivo}`);
  console.log(`  OC: ${o.oc || '(vacía)'} | sede: ${o.sede || '-'} | monto: ${o.monto===null?'-':o.monto}`);
  (o.avisos||[]).forEach(a => console.log('  · ' + a));
});
console.log('\nerrores JS:', errs.slice(0,4));
await b.close();
