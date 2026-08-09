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
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(URL_APP); await p.waitForTimeout1500?.() ?? await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="eepp"]');
await p.setInputFiles('#fileOcPdf', R('oc_real_POHUE002738.pdf'));
await p.waitForFunction(() => document.querySelector('#ocPdfProg').classList.contains('hide') && ocPdfLista.length > 0, null, {timeout:60000});
await p.waitForTimeout(600);
await p.click('#btnOcPdfGuardar'); await p.waitForTimeout(900);
await p.fill('#epPct','30'); await p.waitForTimeout(400);
await p.click('#btnEpAdd'); await p.waitForTimeout(900);
console.log('=== CORREO AL PROVEEDOR, generado desde la OC real ===\n');
console.log(await p.evaluate(() => correoProveedorTexto(epMailLista, document.querySelector('#epVenc').value)));
console.log('\nerrores JS:', errs.slice(0,4));
await p.screenshot({ path: R('shot_ocreal.png') });
await b.close();
