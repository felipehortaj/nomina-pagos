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
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
await p.goto(URL_APP); await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="eepp"]');

const files = fs.readdirSync(R('oc_pdfs')).map(f => R('oc_pdfs/') + f);
await p.setInputFiles('#fileOcPdf', files);
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, { timeout: 60000 });
await p.waitForTimeout(900);
const r = await p.evaluate(() => ocPdfLista.map(o => ({
  archivo: o.archivo, oc: o.oc, vendor: o.vendor, rut: o.rut, prov: o.prov, proy: o.proy,
  sede: o.sede, monto: o.monto, fuente: o.fuente, exenta: o.exenta, fecha: o.fecha,
  glosa: (o.glosa||'').slice(0,70), avisos: o.avisos
})));
console.log('--- OC LEÍDAS DEL PDF ---');
r.forEach(o => {
  console.log(`\n${o.archivo}`);
  console.log(`  OC ${o.oc || '(falta)'} | vendor ${o.vendor||'-'} | rut ${o.rut||'-'} | ${o.prov||'-'}`);
  console.log(`  proy ${o.proy||'-'} | sede ${o.sede||'-'} | monto ${o.monto===null?'FALTA':o.monto.toLocaleString('de-DE')} (${o.fuente||'-'}) | ${o.exenta?'EXENTA':'19%'} | fecha ${o.fecha||'-'}`);
  console.log(`  glosa: ${o.glosa}`);
  if (o.avisos.length) console.log('  avisos: ' + o.avisos.join(' | '));
});
// guardar y usar la primera
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(900);
console.log('\ncatálogo OC:', await p.evaluate(() => db.cat.oc.map(o => `${o.oc} | ${o.proy||o.cta} | ${o.sede} | ${nf(o.monto)}`)));
// preparar EP al 5% sobre la primera
await p.fill('#ocBuscar','POHUE-002538'); await p.waitForTimeout(400);
await p.click('[data-ocpick="POHUE-002538"]'); await p.waitForTimeout(500);
await p.fill('#epPct','5'); await p.waitForTimeout(300);
console.log('\nEP al 5% sobre la OC leída del PDF:', await p.inputValue('#epNeto'), '·', await p.textContent('#epCalc'));
console.log('ficha:', (await p.textContent('#ocFichaTxt')).replace(/\s+/g,' ').trim());
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_ocpdf.png') });
await b.close();
