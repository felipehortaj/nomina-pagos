import fs from 'fs';
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

// parser de cifras
console.log('--- numLocal ---');
console.log(await p.evaluate(() => ['35,989,935','42.828.023','$42.828.023','6,838,088','38.542,38','1.234.567','122,500,028','578.136','0,5','19%','1,234'].map(x => `${x} -> ${numLocal(x)}`)));

await p.click('nav.tabs button[data-tab="eepp"]');
await p.setInputFiles('#fileOcPdf', R('oc_real_POHUE002738.pdf'));
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, {timeout:60000});
await p.waitForTimeout(700);
const o = await p.evaluate(() => ocPdfLista[0]);
console.log('\n--- OC REAL POHUE-002738 ---');
console.log('OC        :', o.oc);
console.log('Fecha     :', o.fecha);
console.log('Vendor #  :', o.vendor);
console.log('RUT prov  :', o.rut, '|', o.prov);
console.log('Sede      :', o.sede, '| Project code:', o.proy);
console.log('Monto neto:', o.monto, '(', o.fuente, ')');
console.log('IVA       :', o.exenta ? 'EXENTA' : '19%');
console.log('Glosa     :', o.glosa);
console.log('Avisos    :', o.avisos);
// EP al 30% y correo
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(800);
await p.fill('#epPct','30'); await p.waitForTimeout(400);
console.log('\nEP al 30%:', await p.inputValue('#epNeto'), '·', await p.textContent('#epCalc'));
console.log('\nerrores JS:', errs.slice(0,5));
await b.close();
