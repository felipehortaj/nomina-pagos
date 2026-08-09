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
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(URL_APP); await p.waitForTimeout(1500);
await p.click('nav.tabs button[data-tab="eepp"]');

// simula el error del navegador: arrayBuffer() y FileReader fallan como en OneDrive/Outlook
const r = await p.evaluate(async () => {
  const falso = {
    name: 'POVLC-002618.pdf', size: 1234,
    arrayBuffer: () => Promise.reject(new DOMException(
      'The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.', 'NotReadableError')),
    slice: () => ({ arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) })
  };
  const origFR = window.FileReader;
  window.FileReader = class { readAsArrayBuffer(){ setTimeout(()=>this.onerror&&this.onerror(),0); } };
  let motivo = '';
  try { await pdfATexto(falso); } catch (e) { motivo = pdfMotivo(e); }
  window.FileReader = origFR;
  const oc = ocDesdeNombre(falso.name);
  return { motivo, oc, sede: sedeDeOc(oc) };
});
console.log('motivo mostrado:\n  ' + r.motivo);
console.log('\nOC rescatada del nombre:', r.oc, '| sede:', r.sede);

// el reintento recupera cuando el primer intento falla y el segundo sí lee
const b64 = fs.readFileSync(R('oc_pdfs/OC_POHUE-002538.pdf')).toString('base64');
const r2 = await p.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  let n = 0;
  const falso = { name: 'OC_POHUE-002538.pdf', size: bytes.byteLength,
    arrayBuffer: () => { n++; return n === 1
      ? Promise.reject(new DOMException('could not be read','NotReadableError'))
      : Promise.resolve(bytes.buffer.slice(0)); },
    slice: () => ({ arrayBuffer: () => Promise.resolve(bytes.buffer.slice(0)) }) };
  const t = await pdfATexto(falso);
  const o = ocDesdePdf(t, falso.name);
  return `intentos: ${n} · OC ${o.oc} · monto ${nf(o.monto)} · proveedor ${o.prov}`;
}, b64);
console.log('\nrecuperación con reintento ->', r2);

console.log('\nerrores JS:', errs.slice(0,4));
await b.close();
