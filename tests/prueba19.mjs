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
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(URL_APP); await p.waitForTimeout1500?.()??await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="facturas"]');
await p.setInputFiles('#fileFac', R('pdfs/FAE 685 TPP.pdf'));
await p.waitForFunction(()=>document.querySelector('#pdfProg').classList.contains('hide')&&db.fac.length>0,null,{timeout:60000});
await p.waitForTimeout(700);
// 1) blob en pestaña nueva desde file://
const [pop] = await Promise.all([p.waitForEvent('popup',{timeout:8000}).catch(()=>null), p.click('[data-verpdf]')]);
if (pop) {
  await pop.waitForTimeout(2500);
  const info = await pop.evaluate(() => ({ url: location.href, tipo: document.contentType || '', emb: !!document.querySelector('embed,object,iframe'), body: (document.body?document.body.innerHTML.length:0) })).catch(e=>({err:String(e).slice(0,90)}));
  console.log('pestaña nueva ->', JSON.stringify(info));
  await pop.close();
} else console.log('pestaña nueva -> no se abrió');
// 2) blob en iframe desde file://
const r = await p.evaluate(async () => {
  const f = db.fac[0];
  const url = URL.createObjectURL(b64ABlob(f.pdf));
  const ifr = document.createElement('iframe');
  ifr.style.cssText='width:600px;height:400px';
  document.body.appendChild(ifr);
  ifr.src = url;
  await new Promise(res => { ifr.onload = res; setTimeout(res, 3000); });
  return { src: ifr.src.slice(0,12), cargó: true };
});
console.log('iframe ->', JSON.stringify(r));
console.log('errores JS:', errs.slice(0,4));
await b.close();
