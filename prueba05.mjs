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
await p.click('#segModoEp button[data-modo="masiva"]'); await p.waitForTimeout(150);
await p.setInputFiles('#fileEepp', R('Generador_EEPP.xlsx'));
await p.waitForTimeout(1200);
const r = await p.evaluate(() => db.eepp.map(e => ({ oc: e.oc, exenta: !!e.exenta, neto: e.neto, iva: e.iva, total: e.total, cuadra: e.neto + e.iva === e.total })));
console.log('--- BLOQUES DEL GENERADOR ---');
r.forEach(x => console.log(`  ${x.oc.padEnd(20)} ${x.exenta ? 'EXENTA' : ' 19%  '} neto ${String(x.neto).padStart(10)} iva ${String(x.iva).padStart(9)} total ${String(x.total).padStart(11)}  cuadra=${x.cuadra}`));
console.log('exentas:', r.filter(x=>x.exenta).length, '| todas cuadran:', r.every(x=>x.cuadra));

// correo del bloque exento de ABS
const iAbs = await p.evaluate(() => db.eepp.findIndex(e => /POABS/.test(e.oc)));
await p.evaluate(i => { document.querySelectorAll('#tblEepp tbody tr')[i].querySelector('.ck').checked = true; }, iAbs);
await p.click('#btnEpCorreo'); await p.waitForTimeout(600);
console.log('\n--- CORREO DEL BLOQUE EXENTO (ABS) ---');
console.log(await p.evaluate(() => correoProveedorTexto(epMailLista, document.querySelector('#epVenc').value)));

// alta manual exenta
await p.evaluate(() => modoEp('oc')); await p.waitForTimeout(120);
await p.click('#btnOcNueva'); await p.waitForTimeout(400);
await p.fill('#nocOc','POTGS-002318'); await p.fill('#nocProy','TGSHSA23401');
await p.fill('#nocProvNom','REVISOR ARQUITECTURA LTDA'); await p.fill('#nocRut','76.999.888-7');
await p.fill('#nocMonto','816.896'); await p.click('#btnNocGuardar'); await p.waitForTimeout(700);
await p.fill('#epGlosa','CONSTRUCCIÓN - Revisión Independiente de Arquitectura'); await p.fill('#epEp','EEPP_01');
await p.fill('#epNeto','816.896'); await p.selectOption('#epIvaCond','exenta'); await p.waitForTimeout(300);
console.log('\nformulario exento ->', await p.textContent('#epCalc'));
await p.click('#btnEpAdd'); await p.waitForTimeout(500);
console.log('línea creada:', await p.evaluate(() => { const e=db.eepp[db.eepp.length-1]; return `exenta=${e.exenta} neto=${e.neto} iva=${e.iva} total=${e.total}`; }));

// cambiar la condición desde la tabla
await p.evaluate(() => {
  const tr = document.querySelectorAll('#tblEepp tbody tr')[db.eepp.length-1];
  const s = tr.querySelector('select[data-f="exenta"]'); s.value = ''; s.dispatchEvent(new Event('change', {bubbles:true}));
});
await p.waitForTimeout(500);
console.log('tras cambiar a 19% en la tabla:', await p.evaluate(() => { const e=db.eepp[db.eepp.length-1]; return `exenta=${e.exenta} neto=${e.neto} iva=${e.iva} total=${e.total}`; }));
console.log('\nerrores JS:', errs.slice(0,5));
await b.close();
