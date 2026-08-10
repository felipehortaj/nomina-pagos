import pw from 'playwright'; const { chromium } = pw;
import fs from 'fs';
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
await p.setInputFiles('#fileOcPdf', [R('oc_pdfs/OC_POHUE-002538.pdf'),R('oc_pdfs/OC_POVLC-002849.pdf')]);
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, { timeout: 60000 });
await p.waitForTimeout(600);
// guardar y usar la OC exenta
await p.click('[data-ocpdfusar="1"]'); await p.waitForTimeout(900);
console.log('OC usada:', await p.inputValue('#epOc'), '| exenta detectada en la OC:', await p.evaluate(() => db.cat.oc.find(o=>/VLC/.test(o.oc)) ? 'guardada' : 'no'));
await p.click('#btnPctSaldo'); await p.waitForTimeout(300);
await p.selectOption('#epIvaCond','exenta'); await p.waitForTimeout(300);
await p.click('#btnEpAdd'); await p.waitForTimeout(800);
console.log('\n' + await p.evaluate(() => correoProveedorTexto(epMailLista, document.querySelector('#epVenc').value)));
console.log('\nerrores JS:', errs.slice(0,5));
await b.close();
