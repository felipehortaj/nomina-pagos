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

// 1) cargar OC directo desde el botón de la tarjeta
console.log('1) catálogo antes:', await p.evaluate(() => db.cat.oc.length));
await p.setInputFiles('#fileOcXl', R('test_oc_netsuite.xlsx'));
await p.waitForTimeout(1200);
console.log('   catálogo después:', await p.evaluate(() => db.cat.oc.length), '|', await p.textContent('#ocCatInfo'));
console.log('   muestra:', await p.evaluate(() => db.cat.oc.slice(0,3).map(o => `${o.oc} | ${o.proy||o.cta} | ${o.sede} | ${nf(o.monto)} | ${provPorRut(o.rut)?.nombre||''}`)));

// 2) usar una y generar
await p.fill('#ocBuscar','POCDE-002487'); await p.waitForTimeout(400);
await p.click('[data-ocpick="POCDE-002487"]'); await p.waitForTimeout(500);
await p.fill('#epPct','32'); await p.waitForTimeout(300);
console.log('\n2) POCDE-002487 al 32%:', await p.inputValue('#epNeto'), '·', await p.textContent('#epCalc'));

// 3) nueva OC a mano
await p.fill('#ocBuscar','POTGS-002318'); await p.waitForTimeout(400);
const vacio = await p.evaluate(() => document.querySelector('#tblOcBuscar tbody').textContent.includes('Ninguna orden'));
console.log('\n3) OC inexistente -> mensaje con opciones:', vacio);
await p.click('#btnOcNueva'); await p.waitForTimeout(400);
console.log('   OC precargada en el formulario:', await p.inputValue('#nocOc'), '| sede sugerida:', await p.inputValue('#nocSede'));
await p.fill('#nocProvNom','REVISOR INDEPENDIENTE ARQUITECTURA LTDA');
await p.fill('#nocRut','76.333.444-5'); await p.fill('#nocVendor','V037491');
await p.fill('#nocProy','TGSHSA23401'); await p.fill('#nocMonto','816.896');
await p.fill('#nocGlosa','CONSTRUCCIÓN - Edificio de Salas de Clases / Revisión Independiente de Arquitectura');
await p.click('#btnNocGuardar'); await p.waitForTimeout(700);
console.log('   catálogo:', await p.evaluate(() => db.cat.oc.length), '| ficha:', (await p.textContent('#ocFichaTxt')).replace(/\s+/g,' ').trim());
console.log('   campos autollenados:', await p.evaluate(() => ['epOc','epProy','epSede','epVendor','epBase','epEp'].map(i=>i.replace('ep','')+'='+document.querySelector('#'+i).value).join(' | ')));

// 4) exenta y correo
await p.click('#btnPctSaldo'); await p.waitForTimeout(300);
await p.selectOption('#epIvaCond','exenta'); await p.waitForTimeout(300);
console.log('\n4) saldo completo exento:', await p.textContent('#epCalc'));
await p.click('#btnEpAdd'); await p.waitForTimeout(800);
console.log('   correo generado:', await p.evaluate(() => !document.querySelector('#cardEpMail').classList.contains('hide')));
const t = await p.evaluate(() => correoProveedorTexto(epMailLista, document.querySelector('#epVenc').value));
console.log('   ---'); console.log(t.split('\n').filter(l=>/NETO|IVA|TOTAL|Purchase|Project|Vendor|exenta/.test(l)).map(l=>'   '+l).join('\n'));
console.log('\n5) OC persistida en el catálogo tras guardar base:', await p.evaluate(() => { const c=JSON.parse(JSON.stringify(db)); return c.cat.oc.filter(o=>/TGS/.test(o.oc)).map(o=>`${o.oc} monto=${o.monto} proy=${o.proy}`); }));
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_ocload.png') });
await b.close();
