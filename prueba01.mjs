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
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(URL_APP);
await p.waitForTimeout(2500);
console.log('title:', await p.title());
console.log('pdfjs loaded:', await p.evaluate(() => typeof pdfjsLib));
console.log('xlsx loaded:', await p.evaluate(() => typeof XLSX));

// 1) cargar EEPP
await p.setInputFiles('#fileEepp', R('Generador_EEPP.xlsx'));
await p.waitForTimeout(1200);
console.log('EEPP filas:', await p.evaluate(() => db.eepp.length));
console.log('EEPP muestra:', await p.evaluate(() => db.eepp.slice(0,3).map(e=>[e.sede,e.proy,e.oc,e.ir,e.neto,e.total])));

// 2) cargar todos los PDFs
const files = fs.readdirSync(R('pdfs')).map(f => R('pdfs/') + f);
await p.setInputFiles('#fileFac', files);
await p.waitForFunction(() => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length > 0, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const res = await p.evaluate(() => ({
  n: db.fac.length,
  capex: db.fac.filter(f=>f.tipo==='CAPEX').length,
  mant: db.fac.filter(f=>f.tipo==='MANT').length,
  totCapex: db.fac.filter(f=>f.tipo==='CAPEX').reduce((s,f)=>s+(f.total||0),0),
  totMant: db.fac.filter(f=>f.tipo==='MANT').reduce((s,f)=>s+(f.total||0),0),
  total: db.fac.reduce((s,f)=>s+(f.total||0),0),
  soc: resumenSociedad(),
  sinSede: db.fac.filter(f=>!f.sede).map(f=>f.archivo),
  sinOc: db.fac.filter(f=>!f.oc).map(f=>[f.archivo,f.rut,f.sede]),
  calzados: db.fac.filter(f=>f.eeppId).length,
  filas: db.fac.map(f=>[f.archivo,f.tipo,f.sede,f.proy,f.oc,f.rut,f.fecha,f.doc,f.neto,f.iva,f.total,f.ir])
}));
fs.writeFileSync(R('test_out.json'), JSON.stringify(res,null,1));
console.log('facturas:', res.n, 'capex', res.capex, 'mant', res.mant);
console.log('total CAPEX', res.totCapex.toLocaleString('de-DE'), '| MANT', res.totMant.toLocaleString('de-DE'), '| TOTAL', res.total.toLocaleString('de-DE'));
console.log('sin sede:', res.sinSede);
console.log('sin OC:', res.sinOc);
console.log('calzados con EEPP:', res.calzados);
console.log('errores JS:', errs.slice(0,8));
await p.screenshot({ path: R('shot_fac.png'), fullPage: false });
await p.click('nav.tabs button[data-tab="nomina"]'); await p.waitForTimeout(600);
await p.screenshot({ path: R('shot_nom.png'), fullPage: false });
await p.click('nav.tabs button[data-tab="correo"]'); await p.waitForTimeout(600);
await p.screenshot({ path: R('shot_mail.png'), fullPage: false });
await b.close();
