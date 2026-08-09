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
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1280,height:900} });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP); await p.waitForTimeout(1600);
await p.click('nav.tabs button[data-tab="facturas"]');
const pdfs = ['FAE 685 TPP.pdf','FAE 22917 ELEMONT.pdf','FAEX 455 GRUPONEXO.pdf'].map(f=>R('pdfs/')+f);
await p.setInputFiles('#fileFac', pdfs);
await p.waitForFunction(() => document.querySelector('#pdfProg').classList.contains('hide') && db.fac.length>=3, null, {timeout:120000});
await p.waitForTimeout(900);

console.log('1) PDF guardados:', await p.evaluate(() => db.fac.map(f=>`${f.doc}:${f.pdf?pesoLegible(pesoB64(f.pdf)):'NO'}`).join(' | ')));
console.log('   medidor:', (await p.textContent('#pesoBase')).trim());
console.log('   botón 📄 en la tabla:', await p.evaluate(() => document.querySelectorAll('#tblFac [data-verpdf]').length));

// abrir el documento original en el visor propio
await p.click('#tblFac tbody tr:first-child [data-verpdf]');
await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
console.log('2) visor propio:', (await p.textContent('#docTitulo')).trim(), '·', (await p.textContent('#docPag')).trim());
await p.click('#docCerrar'); await p.waitForTimeout(300);

// previsualizar dentro del editor
await p.click('#tblFac tbody tr:first-child [data-facedit]'); await p.waitForTimeout(500);
console.log('3) editor · info del documento:', (await p.textContent('#mfPdfInfo')).trim());
await p.click('#btnMfVerPdf');
await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
console.log('   visor desde el editor:', (await p.textContent('#docPag')).trim());
await p.click('#docCerrar'); await p.waitForTimeout(300);
await p.screenshot({ path: R('shot_visor.png') });
await p.click('#btnMfCancelar'); await p.waitForTimeout(400);

// nómina y historial
await p.click('nav.tabs button[data-tab="nomina"]'); await p.waitForTimeout(500);
console.log('\n4) botones 📄 en la nómina:', await p.evaluate(() => document.querySelectorAll('#tblNomCapex [data-verpdf], #tblNomMant [data-verpdf]').length));
await p.evaluate(() => { nominaActiva().estado='enviada'; nominaActiva().enviada='2026-08-14'; render(); });
await p.click('nav.tabs button[data-tab="historial"]'); await p.waitForTimeout(600);
await p.click('[data-nomver]'); await p.waitForTimeout(500);
console.log('5) historial · columna Documento:', await p.evaluate(() => [...document.querySelectorAll('#tblHistDet tbody tr')].map(tr=>tr.querySelector('td').textContent.trim()).join(' | ')));

// guardar base con PDFs y recargar
const json = await p.evaluate(() => JSON.stringify({v:DB_VERSION, meta:db.meta, cat:db.cat, eepp:db.eepp, nominas:db.nominas, activa:db.activa}));
fs.writeFileSync(R('base_pdf.json'), json);
console.log('\n6) base con PDF pesa', (fs.statSync(R('base_pdf.json')).size/1048576).toFixed(2), 'MB');
await p.reload(); await p.waitForTimeout(1500);
await p.setInputFiles('#fileDb', R('base_pdf.json')); await p.waitForTimeout(1200);
console.log('   tras recargar, PDF disponibles:', await p.evaluate(() => todasLasFacturas().filter(({f})=>f.pdf).length), '/', await p.evaluate(()=>todasLasFacturas().length));
await p.evaluate(() => { const f=todasLasFacturas()[0].f; verDocumento(f.pdf, f.archivo); });
await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
console.log('   el PDF recuperado se dibuja:', (await p.textContent('#docPag')).trim());
await p.click('#docCerrar'); await p.waitForTimeout(300);

// liberar espacio
await p.click('nav.tabs button[data-tab="historial"]'); await p.waitForTimeout(400);
await p.click('#btnPurgarPdf'); await p.waitForTimeout(800);
console.log('\n7) tras liberar espacio:', (await p.textContent('#pesoBase')).trim() || '(sin PDF)', '· con PDF:', await p.evaluate(() => todasLasFacturas().filter(({f})=>f.pdf).length));
console.log('\nerrores JS:', errs.slice(0,6));
await b.close();
