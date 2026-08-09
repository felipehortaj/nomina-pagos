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
p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
await p.goto(URL_APP); await p.waitForTimeout(1500);

// --- A) carga masiva sigue funcionando
await p.click('nav.tabs button[data-tab="eepp"]');
await p.click('#segModoEp button[data-modo="masiva"]'); await p.waitForTimeout(150);
await p.setInputFiles('#fileEepp', R('Generador_EEPP.xlsx'));
await p.waitForTimeout(1000);
console.log('A) carga masiva ->', await p.evaluate(() => db.eepp.length), 'EEPP');

// --- B) alta individual: ahora arranca en la OC (+ Nueva OC)
await p.evaluate(() => modoEp('oc')); await p.waitForTimeout(120);
await p.click('#btnOcNueva'); await p.waitForTimeout(400);
await p.fill('#nocOc','POCHI-002415');
await p.fill('#nocProvNom','CONSTRUCTORA TU PROXIMO PROYECTO SPA');
await p.fill('#nocRut','76.664.873-8'); await p.fill('#nocVendor','V022348');
await p.fill('#nocProy','CHCRN25401'); await p.fill('#nocMonto','5.781.360');
await p.fill('#nocGlosa','CONSTRUCCIÓN - Obras de Mitigación Cierre EISTU - Desarrollo de Proyectos de Ingeniería en Detalle');
await p.click('#btnNocGuardar'); await p.waitForTimeout(700);
await p.fill('#epIr','IR415509'); await p.fill('#epEp','EEPP_08');
await p.fill('#epPct','10'); await p.waitForTimeout(400);
console.log('B) neto calculado:', await p.inputValue('#epNeto'), '|', await p.textContent('#epCalc'));
await p.click('#btnEpAdd');
await p.waitForTimeout(700);
const st = await p.evaluate(() => ({
  n: db.eepp.length,
  ultimo: db.eepp[db.eepp.length-1],
  cardVisible: !document.querySelector('#cardEpMail').classList.contains('hide'),
  asunto: document.querySelector('#epAsunto').value,
  venc: document.querySelector('#epVenc').value,
  para: document.querySelector('#epPara').value
}));
console.log('C) EEPP creado:', st.n, 'total | sede', st.ultimo.sede, '| neto', st.ultimo.neto, '| iva', st.ultimo.iva, '| total', st.ultimo.total);
console.log('   correo abierto:', st.cardVisible, '| asunto:', st.asunto, '| vencimiento:', st.venc, '| para:', st.para || '(sin correo en catálogo)');
console.log('--- CORREO AL PROVEEDOR (texto) ---');
console.log(await p.evaluate(() => correoProveedorTexto([db.eepp[db.eepp.length-1]], document.querySelector('#epVenc').value)));

// --- D) correo agrupando varias líneas del mismo proveedor (desde la carga masiva)
await p.evaluate(() => {
  const g = db.eepp.filter(e => /V05004/.test(e.vendor || ''));
  document.querySelectorAll('#tblEepp tbody tr').forEach(tr => {
    const e = db.eepp.find(x => x.id === tr.dataset.id);
    tr.querySelector('.ck').checked = !!(e && g.includes(e));
  });
});
await p.click('#btnEpCorreo'); await p.waitForTimeout(600);
console.log('D) info agrupación:', (await p.textContent('#epMailInfo')).trim());
console.log('   bloques en el correo:', await p.evaluate(() => document.querySelectorAll('#epMailPreview table').length));

// --- E) marcar enviado / estados
await p.click('#btnEpCopyTxt'); await p.waitForTimeout(500);
console.log('E) enviados:', await p.evaluate(() => db.eepp.filter(e => e.enviado).length), '| por enviar:', await p.evaluate(() => db.eepp.filter(e => !e.enviado).length));
console.log('errores JS:', errs.slice(0,6));
await p.screenshot({ path: R('shot_eepp.png'), fullPage: false });
await b.close();
