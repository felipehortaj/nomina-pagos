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
p.on('dialog', d => d.accept(String(d.message()).includes('confirm')?'':'30/10/2026'));
await p.goto(URL_APP); await p.waitForTimeout(1600);

console.log('1) al arrancar:', await p.evaluate(() => `${db.nominas.length} nómina(s), activa ${isoToCl(nominaActiva().fecha)} (${nominaActiva().estado}), viernes=${new Date(nominaActiva().fecha+'T12:00').getDay()===5}`));

// fija la fecha de la nómina activa al 23/10/2026
await p.evaluate(() => { nominaActiva().fecha = '2026-10-23'; render(); });
console.log('2) fecha fijada:', await p.evaluate(() => isoToCl(nominaActiva().fecha)));

// carga 4 facturas en la nómina del 23/10
await p.click('nav.tabs button[data-tab="facturas"]');
const pdfs = fs.readdirSync(R('pdfs')).slice(0,4).map(f=>R('pdfs/')+f);
await p.setInputFiles('#fileFac', pdfs);
await p.waitForFunction(() => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length>0, null, {timeout:120000});
await p.waitForTimeout(800);
console.log('3) nómina 23/10 tiene', await p.evaluate(()=>db.fac.length), 'facturas | barra dice:', (await p.textContent('#nomEstadoTxtCtx')).trim());

// marca como enviada -> debe abrir la siguiente (viernes 30/10)
await p.click('nav.tabs button[data-tab="nomina"]');
await p.click('#btnNomEnviada'); await p.waitForTimeout(700);
console.log('4) tras marcar enviada:', await p.evaluate(() => nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.estado}:${n.fac.length}`).join(' | ')));
console.log('   activa ahora:', await p.evaluate(()=>isoToCl(nominaActiva().fecha)));

// carga las MISMAS facturas en la nueva nómina -> debe detectar duplicado con la del 23/10
await p.click('nav.tabs button[data-tab="facturas"]');
await p.setInputFiles('#fileFac', pdfs.slice(0,2));
await p.waitForFunction(() => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length>0, null, {timeout:120000});
await p.waitForTimeout(800);
const dup = await p.evaluate(() => db.fac.map(f => controles(f).filter(c=>/ya está en la nómina/.test(c.t)).map(c=>c.t)).flat());
console.log('5) control de duplicado entre nóminas:');
dup.forEach(d => console.log('   ·', d));

// mover una factura a otra nómina
await p.evaluate(() => { document.querySelectorAll('#tblFac tbody tr')[0].querySelector('.ck').checked = true; });
await p.click('#btnMoverFac'); await p.waitForTimeout(500);
await p.click('#btnMovOk'); await p.waitForTimeout(700);
console.log('6) tras mover:', await p.evaluate(() => nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.fac.length}`).join(' | ')));

// historial: buscar por fecha
await p.click('nav.tabs button[data-tab="historial"]');
await p.fill('#histBuscar','23/10'); await p.waitForTimeout(500);
console.log('7) buscando "23/10" en historial:', await p.evaluate(() => [...document.querySelectorAll('#tblHist tbody tr')].map(tr=>tr.textContent.trim().slice(0,28))));
await p.click('[data-nomver]'); await p.waitForTimeout(400);
console.log('   detalle:', (await p.textContent('#histDetTitulo')).trim(), '|', (await p.textContent('#histDetInfo')).trim());

// guardar y recargar la base
const json = await p.evaluate(() => JSON.stringify({v:DB_VERSION, meta:db.meta, cat:db.cat, eepp:db.eepp, nominas:db.nominas, activa:db.activa}));
fs.writeFileSync(R('base_test.json'), json);
await p.reload(); await p.waitForTimeout(1500);
await p.setInputFiles('#fileDb', R('base_test.json')); await p.waitForTimeout(900);
console.log('8) tras guardar y recargar:', await p.evaluate(() => nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.estado}:${n.fac.length}`).join(' | ')));
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_nominas.png') });
await b.close();
