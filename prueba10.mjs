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
await p.setInputFiles('#fileOcPdf', [R('oc_pdfs/OC_POVLC-002849.pdf'),R('oc_pdfs/OC_POHUE-002538.pdf')]);
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, {timeout:60000});
await p.waitForTimeout(600);
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(800);
for (const oc of ['POVLC-002849','POHUE-002538']) {
  await p.fill('#ocBuscar', oc); await p.waitForTimeout(400);
  await p.click(`[data-ocpick="${oc}"]`); await p.waitForTimeout(500);
  console.log(oc, '-> IVA:', await p.inputValue('#epIvaCond'), '| base:', await p.inputValue('#epBase'), '| ficha:', (await p.textContent('#ocFichaTxt')).replace(/\s+/g,' ').slice(0,120));
}
console.log('errores JS:', errs.slice(0,5));
await b.close();
