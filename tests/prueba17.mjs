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
p.on('dialog', d => d.accept());
await p.goto(URL_APP); await p.waitForTimeout(1600);

// --- A) crear un EEPP desde la OC real y luego EDITARLO
await p.click('nav.tabs button[data-tab="eepp"]');
await p.setInputFiles('#fileOcPdf', R('oc_real_POHUE002738.pdf'));
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length>0, null, {timeout:60000});
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(900);
await p.fill('#epPct','30'); await p.waitForTimeout(400);
await p.click('#btnEpAdd'); await p.waitForTimeout(800);
console.log('A) EEPP creado:', await p.evaluate(() => { const e=db.eepp[0]; return `${e.ep} ${e.oc} neto=${nf(e.neto)} base=${nf(e.base)} pct=${e.pct} exenta=${e.exenta}`; }));

// editar: cambiar el % a 45 y marcarlo exento
await p.click('[data-epedit]'); await p.waitForTimeout(700);
console.log('B) modo edición · banner:', (await p.textContent('#epEditTxt')).trim().slice(0,60));
console.log('   campos recuperados: base', await p.inputValue('#epBase'), '| pct', await p.inputValue('#epPct'), '| neto', await p.inputValue('#epNeto'), '| botón:', await p.textContent('#btnEpAdd'));
await p.fill('#epPct','45'); await p.waitForTimeout(400);
await p.selectOption('#epIvaCond','exenta'); await p.waitForTimeout(300);
await p.fill('#epEp','EP_2');
await p.click('#btnEpAdd'); await p.waitForTimeout(800);
console.log('C) tras guardar:', await p.evaluate(() => `${db.eepp.length} EEPP en total · ${(()=>{const e=db.eepp[0];return `${e.ep} neto=${nf(e.neto)} iva=${nf(e.iva)} total=${nf(e.total)} exenta=${e.exenta} pct=${e.pct}`})()}`));
console.log('   correo regenerado:', await p.evaluate(() => !document.querySelector('#cardEpMail').classList.contains('hide')));

// --- D) editor de factura completo
await p.click('nav.tabs button[data-tab="facturas"]');
await p.setInputFiles('#fileFac', [R('pdfs/FAE 685 TPP.pdf'),R('pdfs/FAE 22917 ELEMONT.pdf')]);
await p.waitForFunction(() => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length>=2, null, {timeout:120000});
await p.waitForTimeout(800);
await p.click('#tblFac tbody tr:first-child [data-facedit]'); await p.waitForTimeout(600);
console.log('\nD) editor abierto:', (await p.textContent('#modalFacTitulo')).trim(), '|', (await p.textContent('#modalFacInfo')).trim());
console.log('   valores:', await p.evaluate(() => ['mfTipo','mfSede','mfProy','mfOc','mfRut','mfFecha','mfDoc','mfNeto','mfIva','mfTotal'].map(i=>i.replace('mf','')+'='+document.querySelector('#'+i).value).join(' | ')));
// cambiar sede, IR, monto y tipo de documento
await p.selectOption('#mfSede','CDE');
await p.fill('#mfIr','IR999888');
await p.fill('#mfNeto','20.000.000');
await p.selectOption('#mfExenta','1'); await p.waitForTimeout(300);
console.log('   tras marcar exenta:', await p.inputValue('#mfIva'), '/', await p.inputValue('#mfTotal'));
await p.fill('#mfObs','Corregida en el editor');
await p.click('#btnMfGuardar'); await p.waitForTimeout(700);
console.log('E) factura actualizada:', await p.evaluate(() => { const f=db.fac.find(x=>x.ir==='IR999888'); return `sede=${f.sede} ir=${f.ir} neto=${nf(f.neto)} iva=${nf(f.iva)} total=${nf(f.total)} exenta=${f.exenta} obs="${f.obs}"`; }));
console.log('   en la nómina aparece como:', await p.evaluate(() => lineasNomina('CAPEX').concat(lineasNomina('MANT')).find(r=>r.ir==='IR999888')?.doc));

// --- F) mover de nómina desde el editor
await p.evaluate(() => { const n = nuevaNomina('2026-11-06'); db.nominas.push(n); render(); });
await p.click('#tblFac tbody tr:first-child [data-facedit]'); await p.waitForTimeout(500);
await p.selectOption('#mfNom', await p.evaluate(() => db.nominas.find(n=>n.fecha==='2026-11-06').id));
await p.click('#btnMfGuardar'); await p.waitForTimeout(700);
console.log('\nF) reparto por nómina:', await p.evaluate(() => nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.fac.length}`).join(' | ')));

// --- G) editar una línea desde la pestaña Nómina
await p.click('nav.tabs button[data-tab="nomina"]'); await p.waitForTimeout(500);
const hayBoton = await p.evaluate(() => !!document.querySelector('#tblNomCapex [data-facedit], #tblNomMant [data-facedit]'));
console.log('G) botón de edición en la tabla de la nómina:', hayBoton);
console.log('\nerrores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_editar.png') });
await b.close();
