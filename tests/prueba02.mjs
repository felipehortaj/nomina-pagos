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
await p.goto(URL_APP);
await p.waitForTimeout(1600);

// PASO 1: importar la nómina anterior como historial (alimenta el catálogo de OC)
const ref = fs.readFileSync(R('ref_paste.txt'), 'utf8');
await p.click('nav.tabs button[data-tab="historial"]');
await p.click('#btnImportHist');
await p.fill('#txtHist', ref);
await p.click('#btnDoImportHist');
await p.waitForTimeout(900);
console.log('catálogo OC aprendidas:', await p.evaluate(() => db.cat.oc.length));
console.log('historial:', await p.evaluate(() => db.nominas.length), 'nómina(s),', await p.evaluate(() => db.nominas[0].fac.length), 'líneas');

// PASO 2: cuadro EEPP
await p.click('nav.tabs button[data-tab="eepp"]');
await p.click('#segModoEp button[data-modo="masiva"]'); await p.waitForTimeout(150);
await p.setInputFiles('#fileEepp', R('Generador_EEPP.xlsx'));
await p.waitForTimeout(1000);

// PASO 3: facturas
await p.click('nav.tabs button[data-tab="facturas"]');
const files = fs.readdirSync(R('pdfs')).map(f => R('pdfs/') + f);
await p.setInputFiles('#fileFac', files);
/* espera a que se procesen todas las facturas que haya en tests/fixtures/pdfs
   (el repo trae una muestra; si dejas ahí las 71 de una semana real, valida la nómina completa) */
await p.waitForFunction(n => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length >= n,
  Math.max(1, files.length - 2), { timeout: 300000 });
await p.waitForTimeout(1200);
// PASO 4: referencias IR desde Netsuite
await p.fill('#txtIr', fs.readFileSync(R('ir_paste.txt'),'utf8'));
await p.click('#btnIr');
await p.waitForTimeout(1500);
console.log('IR:', await p.evaluate(() => document.querySelector('#irMsg').textContent));
const res = await p.evaluate(() => ({
  n: db.fac.length, capex: db.fac.filter(f=>f.tipo==='CAPEX').length, mant: db.fac.filter(f=>f.tipo==='MANT').length,
  total: db.fac.reduce((s,f)=>s+(f.total||0),0),
  sinOc: db.fac.filter(f=>!f.oc).map(f=>f.archivo),
  dupDetect: db.fac.filter(f=>controles(f).some(c=>/Ya fue en la n/.test(c.t))).length,
  soc: resumenSociedad(),
  filas: db.fac.map(f=>[f.archivo,f.tipo,f.sede,f.proy,f.oc,f.rut,f.fecha,f.doc,f.neto,f.iva,f.total,f.ir]),
  alertas: db.fac.flatMap(f=>controles(f).map(c=>[f.archivo,c.n,c.t]))
}));
fs.writeFileSync(R('test2_out.json'), JSON.stringify(res,null,1));
console.log('facturas', res.n, '| capex', res.capex, '| mant', res.mant);
console.log('sin OC:', res.sinOc);
console.log('detectadas como ya contabilizadas:', res.dupDetect, '/', files.length);
console.log('errores JS:', errs.slice(0,5));
await p.click('nav.tabs button[data-tab="facturas"]'); await p.waitForTimeout(500);
await p.screenshot({ path: R('shot_fac.png') });
await p.click('nav.tabs button[data-tab="nomina"]'); await p.waitForTimeout(700);
await p.screenshot({ path: R('shot_nom.png') });
await p.click('nav.tabs button[data-tab="correo"]'); await p.waitForTimeout(700);
await p.screenshot({ path: R('shot_mail.png') });
await p.click('nav.tabs button[data-tab="inicio"]'); await p.waitForTimeout(500);
await p.screenshot({ path: R('shot_home.png') });
console.log('correo texto (primeras líneas):');
console.log((await p.evaluate(() => correoTexto())).split('\n').slice(0,8).join('\n'));
await b.close();
