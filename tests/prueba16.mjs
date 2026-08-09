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
// base del modelo ANTIGUO (con db.fac suelto y nominas sin id/estado)
const vieja = {
  v: 1, meta: { fecha: '2026-10-16', periodo: 'Oct 2026', dest: 'Patricia', firma: 'Felipe Horta Jaques' },
  cat: { soc: [], prov: [], oc: [], mapasXl: [] },
  eepp: [],
  fac: [
    { id:'a1', tipo:'CAPEX', sede:'HUE', proy:'HUECN26501', oc:'POHUE-002538', rut:'76.664.873-8', fecha:'01/10/2026', doc:'700', neto:1000000, iva:190000, total:1190000, ir:'IR400001' },
    { id:'a2', tipo:'MANT', sede:'CUR', proy:'68500', oc:'POCUR-002558', rut:'76.163.834-3', fecha:'02/10/2026', doc:'22990', neto:592285, iva:112534, total:704819, ir:'IR400002' }
  ],
  nominas: [ { fecha:'2026-10-09', periodo:'Oct 2026', fac:[
    { id:'b1', tipo:'CAPEX', sede:'VLC', proy:'VLCAMP26401', oc:'POVLC-002737', rut:'77.696.522-7', fecha:'25/09/2026', doc:'450', neto:3000000, iva:570000, total:3570000, ir:'IR399001' }
  ], importada: true } ]
};
await p.evaluate(() => {});
const buf = Buffer.from(JSON.stringify(vieja));
await p.setInputFiles('#fileDb', { name:'base_vieja.json', mimeType:'application/json', buffer: buf });
await p.waitForTimeout(1000);
console.log('migración de una base del modelo anterior:');
console.log('  nóminas:', await p.evaluate(() => nominasOrdenadas().map(n=>`${isoToCl(n.fecha)}:${n.estado}:${n.fac.length}`).join(' | ')));
console.log('  activa :', await p.evaluate(() => isoToCl(nominaActiva().fecha)), '· facturas activas:', await p.evaluate(()=>db.fac.length));
console.log('  total registrado:', await p.evaluate(() => nf(todasLasFacturas().reduce((s,x)=>s+(x.f.total||0),0))));
console.log('  duplicados detectados:', await p.evaluate(() => todasLasFacturas().filter(({f})=>controles(f).some(c=>/dos veces/.test(c.t))).length));
console.log('errores JS:', errs.slice(0,4));
await b.close();
