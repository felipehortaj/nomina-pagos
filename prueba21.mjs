import pw from 'playwright'; const { chromium } = pw;
import path from "path";
import { fileURLToPath } from "url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* R() ubica los archivos de prueba; las capturas y volcados van a tests/salida */
const R = p => /\.png$|_out\.json$/.test(p)
  ? path.join(RAIZ, "tests", "salida", path.basename(p))
  : path.join(RAIZ, "tests", "fixtures", p);
const URL_APP = "file://" + path.join(RAIZ, "dist", "test_local.html");
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1400,height:940} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
p.on('dialog', d => d.accept());
await p.goto(URL_APP); await p.waitForTimeout(1600);

// cargar 620 OC
await p.click('nav.tabs button[data-tab="oc"]'); await p.waitForTimeout(300);
const t0 = Date.now();
await p.setInputFiles('#fileLibXls', R('oc_620.xlsx'));
await p.waitForFunction(() => db.cat.oc.length > 500, null, {timeout:60000});
await p.waitForTimeout(700);
console.log('1) catálogo:', await p.evaluate(()=>db.cat.oc.length), 'OC · importadas en', ((Date.now()-t0)/1000).toFixed(1)+'s');
console.log('   info:', (await p.textContent('#ocLibInfo')).trim(), '| página:', (await p.textContent('#libPagina')).trim());
console.log('   chips por colegio:', await p.evaluate(()=>[...document.querySelectorAll('#libSedes .chip')].map(c=>c.textContent.trim().replace(/\s+/g,' ')).slice(0,6).join(' | ')));
console.log('   filas renderizadas:', await p.evaluate(()=>document.querySelectorAll('#tblLib tbody tr').length), '(paginado)');

// filtrar por colegio
await p.click('#libSedes [data-libsede="HUE"]'); await p.waitForTimeout(400);
const hue = await p.evaluate(()=>({filas:document.querySelectorAll('#tblLib tbody tr').length, pag:document.querySelector('#libPagina').textContent.trim(), soloHue:[...document.querySelectorAll('#tblLib tbody tr')].every(tr=>tr.children[2].textContent.trim()==='HUE')}));
console.log('\n2) filtro por colegio HUE:', hue.pag, '· todas son HUE:', hue.soloHue);

// buscar texto
const t1=Date.now();
await p.fill('#libBuscar','sala cuna'); await p.waitForTimeout(400);
console.log('3) buscando "sala cuna" dentro de HUE:', (await p.textContent('#libPagina')).trim(), `(${Date.now()-t1}ms)`);
await p.fill('#libBuscar',''); await p.waitForTimeout(350);

// seleccionar 3 y crear estados de pago en lote
await p.evaluate(() => {
  const cks=[...document.querySelectorAll('#tblLib tbody [data-libck]')].slice(0,3);
  cks.forEach(c=>{ c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); });
});
await p.waitForTimeout(400);
console.log('\n4) selección:', (await p.textContent('#libLoteTxt')).trim());
await p.fill('#libPct','25');
await p.click('#btnLibLote'); await p.waitForTimeout(900);
console.log('5) panel de lote:', (await p.textContent('#loteInfo')).trim());
console.log('   filas del lote:', await p.evaluate(()=>[...document.querySelectorAll('#tblLote tbody tr')].map(tr=>`${tr.children[0].textContent.trim()} ${tr.children[3].textContent.trim()} ${tr.children[6].textContent.trim()}% neto ${tr.children[7].textContent.trim()}`)));
await p.click('#btnLoteCrear'); await p.waitForTimeout(1000);
console.log('6) EEPP creados:', await p.evaluate(()=>db.eepp.length), '| correo abierto:', await p.evaluate(()=>!document.querySelector('#cardEpMail').classList.contains('hide')));
console.log('   info del correo:', (await p.textContent('#epMailInfo')).trim().slice(0,80));
console.log('   EEPP:', await p.evaluate(()=>db.eepp.map(e=>`${e.oc} ${e.ep} neto=${nf(e.neto)}`).join(' | ')));

// dos OC en PDF -> lote
await p.click('nav.tabs button[data-tab="eepp"]'); await p.waitForTimeout(300);
await p.setInputFiles('#fileOcPdf', [R('oc_real_POHUE002738.pdf'),R('oc_pdfs/OC_POVLC-002849.pdf')]);
await p.waitForFunction(()=>document.querySelector('#ocPdfProg').classList.contains('hide')&&ocPdfLista.length>=2,null,{timeout:60000});
await p.click('#btnOcPdfLote'); await p.waitForTimeout(900);
console.log('\n7) dos OC en PDF -> lote:', (await p.textContent('#loteInfo')).trim());
await p.evaluate(() => { lote.forEach(l => { l.pct = 0.5; l.neto = Math.round((l.base||0)*0.5); }); renderLote(); });
await p.click('#btnLoteCrear'); await p.waitForTimeout(900);
console.log('   EEPP totales:', await p.evaluate(()=>db.eepp.length), '· correos por proveedor:', await p.evaluate(()=>epMailGrupos.length));
await p.screenshot({ path: R('shot_lib.png') });
console.log('\nerrores JS:', errs.slice(0,6));
await b.close();
