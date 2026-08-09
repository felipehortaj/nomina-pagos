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
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1300,height:940} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
p.on('dialog', d => d.accept());
await p.goto(URL_APP); await p.waitForTimeout(1600);
await p.click('nav.tabs button[data-tab="facturas"]');
await p.setInputFiles('#fileFac', [R('pdfs/FAE 685 TPP.pdf'),R('pdfs/FAE 22917 ELEMONT.pdf')]);
await p.waitForFunction(()=>document.querySelector('#pdfProg').classList.contains('hide')&&db.fac.length>=2,null,{timeout:120000});
await p.waitForTimeout(800);

// visor propio desde la tabla de facturas
await p.click('#tblFac tbody tr:first-child [data-verpdf]');
await p.waitForFunction(() => !document.querySelector('#modalDoc').classList.contains('hide') && document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
await p.waitForTimeout(900);
const v = await p.evaluate(() => {
  const cv = document.querySelector('#docCanvas');
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0,0,cv.width,Math.min(cv.height,400)).data;
  let noBlanco = 0;
  for (let i=0;i<d.length;i+=4) if (d[i]<240||d[i+1]<240||d[i+2]<240) noBlanco++;
  return { titulo: document.querySelector('#docTitulo').textContent, info: document.querySelector('#docInfo').textContent,
           pag: document.querySelector('#docPag').textContent, w: cv.width, h: cv.height, pixelesDibujados: noBlanco };
});
console.log('1) VISOR PROPIO');
console.log('   título:', v.titulo);
console.log('   info  :', v.info);
console.log('   página:', v.pag, '· canvas', v.w+'x'+v.h, '· píxeles con contenido:', v.pixelesDibujados);
console.log('   ¿se dibujó realmente el PDF?', v.pixelesDibujados > 5000 ? 'SÍ' : 'NO');
await p.screenshot({ path: R('shot_visor2.png') });
// zoom y navegación
await p.click('#docMas'); await p.waitForTimeout(800);
console.log('2) tras zoom +:', await p.evaluate(()=>document.querySelector('#docCanvas').width));
console.log('   botón siguiente deshabilitado (1 página):', await p.evaluate(()=>document.querySelector('#docSig').disabled));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('   cerrado con Escape:', await p.evaluate(()=>document.querySelector('#modalDoc').classList.contains('hide')));

// desde el editor
await p.click('#tblFac tbody tr:first-child [data-facedit]'); await p.waitForTimeout(500);
await p.click('#btnMfVerPdf');
await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
console.log('\n3) desde el editor de la factura:', (await p.textContent('#docPag')).trim());
await p.click('#docCerrar'); await p.click('#btnMfCancelar'); await p.waitForTimeout(300);

// desde el historial, con la nómina ya enviada
await p.evaluate(() => { nominaActiva().estado='enviada'; nominaActiva().enviada='2026-08-14'; render(); });
await p.click('nav.tabs button[data-tab="historial"]'); await p.waitForTimeout(500);
await p.click('[data-nomver]'); await p.waitForTimeout(400);
await p.click('#tblHistDet tbody tr:first-child [data-verpdf]');
await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
console.log('4) desde el historial:', (await p.textContent('#docTitulo')).trim(), '·', (await p.textContent('#docPag')).trim());
await p.click('#docCerrar');

// OC en PDF y su visor
await p.click('nav.tabs button[data-tab="eepp"]'); await p.waitForTimeout(400);
await p.setInputFiles('#fileOcPdf', R('oc_real_POHUE002738.pdf'));
await p.waitForFunction(()=>document.querySelector('#ocPdfProg').classList.contains('hide')&&ocPdfLista.length>0,null,{timeout:60000});
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(900);
await p.click('nav.tabs button[data-tab="catalogos"]'); await p.waitForTimeout(500);
const hayOcDoc = await p.evaluate(()=>document.querySelectorAll('#tblCatOc [data-verocpdf]').length);
console.log('\n5) OC con documento en el catálogo:', hayOcDoc);
if (hayOcDoc) {
  await p.click('#tblCatOc [data-verocpdf]');
  await p.waitForFunction(() => document.querySelector('#docPag').textContent.trim() !== '', null, {timeout:20000});
  console.log('   visor de la OC:', (await p.textContent('#docInfo')).trim().slice(0,80), '·', (await p.textContent('#docPag')).trim());
  await p.click('#docCerrar');
}
console.log('\nerrores JS:', errs.slice(0,5));
await b.close();
