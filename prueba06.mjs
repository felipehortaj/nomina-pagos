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

// 1) importar el catálogo de OC desde el export de Netsuite
await p.setInputFiles('#fileXl', R('test_oc_netsuite.xlsx')); await p.waitForTimeout(1200);
await p.selectOption('#xlModo','oc'); await p.waitForTimeout(200);
console.log('1) botón:', await p.textContent('#btnXlTodas'), '| títulos fila', await p.inputValue('#xlFilaHdr'));
await p.click('#btnXlTodas'); await p.waitForTimeout(800);
console.log('   catálogo OC:', await p.evaluate(() => db.cat.oc.length), '|', await p.textContent('#ocCatInfo'));
console.log('   muestra:', await p.evaluate(() => db.cat.oc.slice(0,3).map(o => `${o.oc} ${o.proy||o.cta} ${o.sede} ${o.monto}`)));

// 2) buscar por proveedor
await p.evaluate(() => modoEp('oc')); await p.waitForTimeout(120);
await p.fill('#ocBuscar','alfa'); await p.waitForTimeout(400);
console.log('\n2) buscando "alfa":', await p.evaluate(() => [...document.querySelectorAll('#tblOcBuscar tbody tr')].map(tr => tr.querySelector('td').textContent)));
await p.fill('#ocBuscar','huechuraba remodel'); await p.waitForTimeout(400);
console.log('   buscando "huechuraba remodel":', await p.evaluate(() => [...document.querySelectorAll('#tblOcBuscar tbody tr')].map(tr => tr.textContent.trim().slice(0,40))));

// 3) elegir una OC -> autollenado
await p.fill('#ocBuscar','POHUE-002538'); await p.waitForTimeout(400);
await p.click('[data-ocpick="POHUE-002538"]'); await p.waitForTimeout(500);
console.log('\n3) tras elegir la OC:');
console.log('   ficha:', (await p.textContent('#ocFichaTxt')).replace(/\s+/g,' ').trim());
console.log('   campos:', await p.evaluate(() => ['epOc','epProy','epSede','epVendor','epGlosa','epEp','epBase'].map(id => id.replace('ep','')+'='+document.querySelector('#'+id).value).join(' | ')));

// 4) solo marcar el % y el IVA
await p.fill('#epPct','5'); await p.waitForTimeout(300);
console.log('\n4) con 5%:', await p.inputValue('#epNeto'), '·', await p.textContent('#epCalc'));
await p.selectOption('#epIvaCond','exenta'); await p.waitForTimeout(300);
console.log('   como exenta:', await p.textContent('#epCalc'));
await p.selectOption('#epIvaCond','afecta'); await p.waitForTimeout(200);
await p.click('#btnEpAdd'); await p.waitForTimeout(700);
console.log('   EEPP creado:', await p.evaluate(() => { const e=db.eepp[db.eepp.length-1]; return `${e.oc} ${e.proy} ${e.sede} ${e.vendor} neto=${e.neto} iva=${e.iva} total=${e.total} ep=${e.ep}`; }));

// 5) segundo EP sobre la misma OC: debe mostrar lo liberado y sugerir EP_2
await p.fill('#ocBuscar','POHUE-002538'); await p.waitForTimeout(400);
await p.click('[data-ocpick="POHUE-002538"]'); await p.waitForTimeout(500);
console.log('\n5) segundo EP sobre la misma OC:');
console.log('   ficha:', (await p.textContent('#ocFichaTxt')).replace(/\s+/g,' ').trim());
console.log('   EP sugerido:', await p.inputValue('#epEp'));
await p.click('#btnPctSaldo'); await p.waitForTimeout(400);
console.log('   botón Saldo ->', await p.inputValue('#epNeto'), '(', await p.inputValue('#epPct'), '%) ·', await p.textContent('#epCalc'));

// 6) sobregiro
await p.fill('#epNeto','600.000.000'); await p.waitForTimeout(300);
console.log('\n6) con neto sobre el saldo:', await p.textContent('#epCalc'));
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_oc.png') });
await b.close();
