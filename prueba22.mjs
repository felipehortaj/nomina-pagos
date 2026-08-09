import pw from 'playwright'; const { chromium } = pw;
import path from "path";
import { fileURLToPath } from "url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* R() ubica los archivos de prueba; las capturas y volcados van a tests/salida */
const R = p => /\.png$|_out\.json$/.test(p)
  ? path.join(RAIZ, "tests", "salida", path.basename(p))
  : path.join(RAIZ, "tests", "fixtures", p);
const URL_APP = "file://" + path.join(RAIZ, "dist", "test_local.html");
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1360,height:920} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
p.on('dialog', d => d.accept());
await p.goto(URL_APP); await p.waitForTimeout(1600);

// 1) el campo de fecha muestra dd/mm/aaaa con el día de la semana
await p.click('nav.tabs button[data-tab="nomina"]'); await p.waitForTimeout(400);
console.log('1) campo de fecha:', (await p.textContent('#nomFechaSel')).trim());

// 2) abre el calendario
await p.click('#nomFechaSel'); await p.waitForTimeout(400);
const cal = await p.evaluate(() => ({
  visible: !document.querySelector('#calPop').classList.contains('hide'),
  titulo: document.querySelector('#calTitulo').textContent,
  dias: [...document.querySelectorAll('#calDias .cal-h')].map(x=>x.textContent).join(' '),
  celdas: document.querySelectorAll('#calCuerpo [data-caldia]').length,
  sel: document.querySelector('#calCuerpo .sel')?.textContent,
  viernes: [...document.querySelectorAll('#calCuerpo .vie')].map(x=>x.textContent).join(','),
  atajos: [...document.querySelectorAll('#calPie button')].map(x=>x.textContent)
}));
console.log('2) calendario abierto:', cal.visible, '| mes:', cal.titulo);
console.log('   semana:', cal.dias, '| días del mes:', cal.celdas, '| seleccionado:', cal.sel);
console.log('   viernes marcados:', cal.viernes);
console.log('   atajos:', cal.atajos.join(' · '));
await p.screenshot({ path: R('shot_cal.png') });

// 3) elegir un día
await p.click('#calCuerpo [data-caldia$="-10-23"]').catch(async () => {
  await p.click('#calSig'); await p.waitForTimeout(200);
  await p.click('#calSig'); await p.waitForTimeout(200);
});
await p.waitForTimeout(400);
if (await p.evaluate(()=>!document.querySelector('#calPop').classList.contains('hide'))) {
  // navegar hasta octubre 2026 y elegir el 23
  for (let i=0;i<14;i++) {
    const t = await p.textContent('#calTitulo');
    if (/octubre 2026/.test(t)) break;
    await p.click('#calSig'); await p.waitForTimeout(120);
  }
  await p.click('#calCuerpo [data-caldia="2026-10-23"]'); await p.waitForTimeout(400);
}
console.log('\n3) tras elegir en el calendario:', (await p.textContent('#nomFechaSel')).trim(), '| dato guardado:', await p.evaluate(()=>nominaActiva().fecha));
console.log('   calendario cerrado:', await p.evaluate(()=>document.querySelector('#calPop').classList.contains('hide')));

// 4) nueva nómina con calendario (sin prompt)
await p.click('#btnNomNuevaCtx'); await p.waitForTimeout(400);
const cal2 = await p.evaluate(() => ({ vis: !document.querySelector('#calPop').classList.contains('hide'), sel: document.querySelector('#calCuerpo .sel')?.title, atajos: [...document.querySelectorAll('#calPie button')].map(x=>x.textContent) }));
console.log('\n4) nueva nómina abre calendario:', cal2.vis, '| preseleccionado:', cal2.sel);
console.log('   atajos:', cal2.atajos.join(' · '));
await p.click('#calPie [data-calatajo]'); await p.waitForTimeout(600);
console.log('   nóminas:', await p.evaluate(()=>nominasOrdenadas().map(n=>fechaLarga(n.fecha)).join(' | ')));

// 5) atajo de vencimiento en el correo al proveedor
await p.click('nav.tabs button[data-tab="eepp"]'); await p.waitForTimeout(300);
await p.evaluate(() => {
  ocGuardarEnCatalogo({oc:'POHUE-002738', rut:'76.664.873-8', vendor:'V022348', prov:'CONSTRUCTORA TU PROXIMO PROYECTO SPA', proy:'HUECN26501', sede:'HUE', monto:35989935, glosa:'CONSTRUCCIÓN - Obras'});
  render(); usarOc('POHUE-002738');
});
await p.fill('#epPct','30'); await p.waitForTimeout(300);
await p.click('#btnEpAdd'); await p.waitForTimeout(800);
console.log('\n5) vencimiento del cuadro:', (await p.textContent('#epVenc')).trim());
await p.click('#epVenc'); await p.waitForTimeout(400);
console.log('   atajos de vencimiento:', await p.evaluate(()=>[...document.querySelectorAll('#calPie button')].map(x=>x.textContent).join(' · ')));
await p.click('#calPie [data-calatajo]'); await p.waitForTimeout(500);
console.log('   tras el atajo:', (await p.textContent('#epVenc')).trim(), '| en el correo:', await p.evaluate(()=>/vencimiento para el (\d\d\/\d\d\/\d{4})/.exec(correoProveedorTexto(epMailLista, document.querySelector('#epVenc').dataset.iso))?.[1]));

// 6) mover facturas: modal con lista y calendario, sin escribir
await p.click('nav.tabs button[data-tab="facturas"]'); await p.waitForTimeout(300);
await p.setInputFiles('#fileFac',R('pdfs/FAE 685 TPP.pdf'));
await p.waitForFunction(()=>document.querySelector('#pdfProg').classList.contains('hide')&&db.fac.length>0,null,{timeout:60000});
await p.waitForTimeout(600);
await p.evaluate(()=>{document.querySelector('#tblFac tbody .ck').checked=true;});
await p.click('#btnMoverFac'); await p.waitForTimeout(500);
console.log('\n6) modal mover:', (await p.textContent('#movInfo')).trim());
console.log('   destinos en la lista:', await p.evaluate(()=>[...document.querySelectorAll('#movNom option')].map(o=>o.textContent.trim())));
await p.click('#movFecha'); await p.waitForTimeout(400);
console.log('   abre calendario para fecha nueva:', await p.evaluate(()=>!document.querySelector('#calPop').classList.contains('hide')));
await p.click('#calPie [data-calatajo]'); await p.waitForTimeout(400);
console.log('   fecha elegida:', (await p.textContent('#movFecha')).trim());
await p.click('#btnMovOk'); await p.waitForTimeout(700);
console.log('   reparto:', await p.evaluate(()=>nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.fac.length}`).join(' | ')));
console.log('\nerrores JS:', errs.slice(0,6));
await b.close();
