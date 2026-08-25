<script>
"use strict";
/* =========================================================================
   NÓMINA DE PAGOS — núcleo
   ========================================================================= */
if (typeof pdfjsLib !== "undefined")
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ---------------- utilidades ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => "r" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function nf(n) {                                   // 1234567 -> "1.234.567"
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  return Math.round(Number(n)).toLocaleString("de-DE");
}
function money(n) { return n === null || n === undefined || n === "" ? "" : "$" + nf(n); }
function numLocal(txt) {                            // "35,989,935" | "42.828.023" | "38.542,38" -> número
  let s = String(txt ?? "").replace(/[^\d.,\-]/g, "").trim();
  if (!s || s === "-") return null;
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  const seps = s.match(/[.,]/g) || [];
  let n;
  if (!seps.length) n = Number(s);
  else {
    const iUlt = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    const cola = s.slice(iUlt + 1);
    const distintos = new Set(seps).size;
    if (cola.length === 3 || cola.length === 0 || (distintos === 1 && seps.length > 1)) {
      n = Number(s.replace(/[.,]/g, ""));              // todos son separadores de miles
    } else if (cola.length <= 2) {
      n = Number(s.slice(0, iUlt).replace(/[.,]/g, "") + "." + cola);   // el último es decimal
    } else {
      n = Number(s.replace(/[.,]/g, ""));
    }
  }
  if (isNaN(n)) return null;
  return neg ? -n : n;
}
function toNum(v) {                                 // devuelve un entero redondeado
  if (typeof v === "number") return Math.round(v);
  const n = numLocal(v);
  return n === null ? null : Math.round(n);
}
function norm(s) {                                  // quita tildes, conserva ° y º
  return String(s ?? "").replace(/ /g, " ").normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
function up(s) { return norm(s).toUpperCase(); }
const IVA_RATE = 0.19;
const ivaDe = neto => neto === null || neto === undefined ? null : Math.round(neto * IVA_RATE);

function fmtRut(r) {
  if (!r) return "";
  const c = String(r).replace(/[^\dkK]/g, "").toUpperCase();
  if (c.length < 8) return String(r).toUpperCase();
  const dv = c.slice(-1), body = c.slice(0, -1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}
function isoToCl(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function clToIso(cl) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(cl || "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function periodoDe(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}
function toast(msg, ms = 2200) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), ms);
}

/* ---------------- catálogo semilla ---------------- */
const SOCIEDADES_SEED = [
  { sede: "ABS", rut: "78.404.000-3", nombre: "SOC EDUCACIONAL AMERICAN BRITISH SCHOOL LTDA", pre: "POABS" },
  { sede: "CDE", rut: "96.980.350-K", nombre: "SOC EDUCACIONAL CIUDAD DEL ESTE S A", pre: "POCDE" },
  { sede: "CDV", rut: "99.558.380-1", nombre: "SOC EDUCACIONAL LO AGUIRRE S A", pre: "POCDV" },
  { sede: "CHI", rut: "76.899.160-K", nombre: "SOC EDUCACIONAL CHICUREO SA", pre: "POCHI" },
  { sede: "CMA", rut: "76.435.756-6", nombre: "SOCIEDAD EDUCACIONAL CHICAUMA S.A.", pre: "POCMA" },
  { sede: "CUR", rut: "76.895.340-6", nombre: "SOC EDUCACIONAL CURAUMA SA", pre: "POCUR" },
  { sede: "HUE", rut: "96.858.860-5", nombre: "SOC EDUCACIONAL HUECHURABA S A", pre: "POHUE" },
  { sede: "MNU", rut: "76.760.480-7", nombre: "SOC EDUCACIONAL MANQUECURA ÑUÑOA LIMITADA", pre: "PO0" },
  { sede: "PEN", rut: "96.863.530-1", nombre: "SOC EDUCACIONAL PEÑALOLEN S A", pre: "POPEN" },
  { sede: "PTM", rut: "96.987.460-1", nombre: "SOC EDUCACIONAL PUERTO MONTT S A", pre: "POMON" },
  { sede: "TEM", rut: "96.891.540-1", nombre: "SOC EDUCACIONAL TEMUCO S A", pre: "POTEM" },
  { sede: "TGS", rut: "78.715.670-3", nombre: "THE GREENLAND SCHOOL", pre: "POTGS" },
  { sede: "VLC", rut: "96.946.770-4", nombre: "SOC EDUCACIONAL VALLE LO CAMPINO S A", pre: "POVLC" },
  { sede: "DDEE", rut: "", nombre: "Dirección de Desarrollo / otros", pre: "" }
];
const PROVEEDORES_SEED = [
  ["76.664.873-8", "V022348", "CONSTRUCTORA TU PROXIMO PROYECTO SPA", "CAPEX", ""],
  ["96.899.900-1", "V017985", "INGENIERIA ANDALIEN S A", "CAPEX", ""],
  ["76.865.710-6", "V029486", "MHO CONSULTORES ASOCIADOS SPA", "CAPEX", ""],
  ["77.696.522-7", "V032481", "INSPECCIONES TECNICAS DE OBRA GRUPONEXO LIMITADA", "CAPEX", ""],
  ["77.209.755-7", "V024259", "CONSTRUCTORA ALFA Y OMEGA SPA", "CAPEX", ""],
  ["77.482.382-4", "V028107", "INVERSIONES HAMBURGO SPA", "CAPEX", ""],
  ["76.276.027-4", "V008870", "SOCIEDAD ADAPTOR CHILE SPA", "CAPEX", ""],
  ["77.427.208-9", "V027282", "CAMEVE ARQUITECTURA SPA", "CAPEX", ""],
  ["78.468.760-0", "V033603", "IMPORTADORA Y COMERCIAL NVL LTDA.", "CAPEX", ""],
  ["77.536.484-K", "V031684", "INVERSIONES X&M SPA", "CAPEX", ""],
  ["76.711.064-2", "V042024", "JRC INMOBILIARIA, CONSTRUCCIONES E INVERSIONES SPA", "CAPEX", ""],
  ["78.197.982-1", "V053250", "Instalaciones Power Electric", "CAPEX", "68000"],
  ["77.770.264-5", "V044119", "ALFA UNO SPA", "CAPEX", "68000"],
  ["76.028.554-4", "V050047", "EASTON SPA", "CAPEX", ""],
  ["77.530.698-K", "V030402", "M&J CLIMATIZACION SPA", "MANT", "68500"],
  ["76.163.834-3", "V008063", "SOCIEDAD COMERCIAL E INDUSTRIAL ELEMONT LIMITADA", "MANT", "68500"],
  ["76.257.832-8", "V042026", "SOCIEDAD COMERCIAL ELECTROPOWER S.A.", "MANT", "68500"],
  ["77.552.839-7", "V049055", "S&L SPA", "MANT", "68500"],
  ["76.941.998-5", "V051236", "Delta Activos SpA", "MANT", "68500"],
  ["77.930.311-K", "V045946", "IOTIND SPA", "MANT", "68500"]
].map(([rut, cod, nombre, tipo, cta]) => ({ rut, cod, nombre, tipo, cta, email: "", contacto: "" }));

/* ---------------- estado ---------------- */
const DB_VERSION = 2;
let db = null, dirty = false;

/* ---------------- nóminas: la fecha es la identidad ---------------- */
function proximoViernes(iso) {
  const d = new Date((iso || new Date().toISOString().slice(0, 10)) + "T12:00:00");
  const falta = (5 - d.getDay() + 7) % 7;            // 5 = viernes
  d.setDate(d.getDate() + falta);
  return d.toISOString().slice(0, 10);
}
function nuevaNomina(fechaIso) {
  return { id: uid(), fecha: fechaIso || proximoViernes(), periodo: "", estado: "abierta", enviada: "", fac: [] };
}
function nominasOrdenadas() {
  return db.nominas.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
const nominaPorId = id => db.nominas.find(n => n.id === id) || null;
function nominaActiva() {
  let n = nominaPorId(db.activa);
  if (!n) {
    n = db.nominas.find(x => x.estado === "abierta") || nominasOrdenadas()[0];
    if (!n) { n = nuevaNomina(); db.nominas.push(n); }
    db.activa = n.id;
  }
  return n;
}
function todasLasFacturas() {                        // de todas las nóminas, con su nómina
  const out = [];
  db.nominas.forEach(n => (n.fac || []).forEach(f => out.push({ f, nom: n })));
  return out;
}
/* db.fac queda como alias de las facturas de la nómina activa */
function prepararDb(o) {
  o.nominas = Array.isArray(o.nominas) ? o.nominas : [];
  o.proyectos = Array.isArray(o.proyectos) ? o.proyectos : [];   // presupuesto/categoría por proyecto
  o.nominas.forEach(n => {
    n.id = n.id || uid();
    n.fac = Array.isArray(n.fac) ? n.fac : [];
    n.estado = n.estado || (n.importada ? "cerrada" : "enviada");
    n.fecha = n.fecha || "";
  });
  if (Array.isArray(o.__facSuelta) && o.__facSuelta.length) {      // base guardada con el modelo antiguo
    const f = o.meta?.fecha || proximoViernes();
    let n = o.nominas.find(x => x.fecha === f && x.estado === "abierta");
    if (!n) { n = nuevaNomina(f); n.periodo = o.meta?.periodo || ""; o.nominas.push(n); }
    n.fac = n.fac.concat(o.__facSuelta);
    o.activa = n.id;
  }
  delete o.__facSuelta;
  if (!o.nominas.length) o.nominas.push(nuevaNomina(o.meta?.fecha));
  if (!o.nominas.some(n => n.id === o.activa))
    o.activa = (o.nominas.find(n => n.estado === "abierta") || o.nominas[0]).id;
  Object.defineProperty(o, "fac", {
    configurable: true, enumerable: false,
    get() { return nominaActiva().fac; },
    set(v) { nominaActiva().fac = v; }
  });
  return o;
}
function dbNueva() {
  const hoy = new Date().toISOString().slice(0, 10);
  const n = nuevaNomina(proximoViernes(hoy));
  return prepararDb({
    v: DB_VERSION,
    meta: {
      fecha: hoy, periodo: "", dest: "Patricia",
      firma: "Felipe Horta Jaques", para: "",
      cargo: "Gerente de Infraestructura / Property and Facilities Director", fono: "+56 224 309 800"
    },
    cat: {
      soc: SOCIEDADES_SEED.map(s => ({ ...s })),
      prov: PROVEEDORES_SEED.map(p => ({ ...p })),
      oc: [],
      mapasXl: []
    },
    eepp: [],
    nominas: [n],
    activa: n.id
  });
}
/* Reconstruye una base a partir de un objeto suelto (un .json abierto por el
   usuario o lo recuperado del navegador). Devuelve la base ya preparada y cuántas
   facturas venían del modelo antiguo (para avisar). */
function dbDesdeObjeto(o) {
  const base = dbNueva();
  const nuevo = {
    v: DB_VERSION,
    meta: Object.assign({}, base.meta, o.meta || {}),
    cat: {
      soc: o.cat && o.cat.soc && o.cat.soc.length ? o.cat.soc : base.cat.soc,
      prov: (o.cat && o.cat.prov) || [], oc: (o.cat && o.cat.oc) || [], mapasXl: (o.cat && o.cat.mapasXl) || []
    },
    eepp: o.eepp || [],
    nominas: o.nominas || [],
    proyectos: Array.isArray(o.proyectos) ? o.proyectos : [],
    activa: o.activa || "",
    __facSuelta: Array.isArray(o.fac) ? o.fac : []            // bases del modelo anterior
  };
  const migradas = nuevo.__facSuelta.length;                 // antes de prepararDb: borra __facSuelta
  return { db: prepararDb(nuevo), migradas };
}

/* ---------------- autoguardado en el navegador (IndexedDB) ----------------
   La base se guarda sola en este navegador, así que al reabrir la app los datos
   siguen ahí. El .json de «Guardar base» queda como respaldo para llevar la base
   a otro equipo o recuperarla si el navegador borra sus datos.
   Solo IndexedDB; nada del almacenamiento simple clave-valor (el build lo verifica). */
const IDB_NOMBRE = "nominaPagos", IDB_STORE = "base", IDB_CLAVE = "actual";
function idbDisponible() {
  try { return typeof indexedDB !== "undefined" && !!indexedDB; } catch (e) { return false; }
}
function idbAbrir() {
  return new Promise(res => {
    if (!idbDisponible()) return res(null);
    let req;
    try { req = indexedDB.open(IDB_NOMBRE, 1); } catch (e) { return res(null); }
    req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB_STORE); } catch (e) {} };
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
    req.onblocked = () => res(null);
  });
}
function idbGuardar(obj) {
  return idbAbrir().then(bd => new Promise(res => {
    if (!bd) return res(false);
    try {
      const tx = bd.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(obj, IDB_CLAVE);
      tx.oncomplete = () => { bd.close(); res(true); };
      tx.onerror = () => { bd.close(); res(false); };
      tx.onabort = () => { bd.close(); res(false); };
    } catch (e) { try { bd.close(); } catch (_) {} res(false); }
  })).catch(() => false);
}
function idbLeer() {
  return idbAbrir().then(bd => new Promise(res => {
    if (!bd) return res(null);
    try {
      const tx = bd.transaction(IDB_STORE, "readonly");
      const rq = tx.objectStore(IDB_STORE).get(IDB_CLAVE);
      rq.onsuccess = () => { bd.close(); res(rq.result || null); };
      rq.onerror = () => { bd.close(); res(null); };
    } catch (e) { try { bd.close(); } catch (_) {} res(null); }
  })).catch(() => null);
}
function idbBorrar() {
  return idbAbrir().then(bd => new Promise(res => {
    if (!bd) return res(false);
    try {
      const tx = bd.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_CLAVE);
      tx.oncomplete = () => { bd.close(); res(true); };
      tx.onerror = () => { bd.close(); res(false); };
    } catch (e) { try { bd.close(); } catch (_) {} res(false); }
  })).catch(() => false);
}

let cargaManual = false;                 // el usuario abrió un .json o borró: no pisar con lo recuperado
let autoTimer = null, autoPend = false;
function programarAutoguardado() {
  if (!idbDisponible() || !db) return;
  autoPend = true;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(autoguardarYa, 500);
}
function autoguardarYa() {
  clearTimeout(autoTimer);
  if (!idbDisponible() || !db || typeof snapshotBase !== "function") { autoPend = false; return Promise.resolve(); }
  return idbGuardar(snapshotBase()).then(ok => {
    autoPend = false;
    if (ok) pieGuardado("navegador");
  });
}
function pieGuardado(estado) {
  const p = document.getElementById("pieGuardado");
  if (!p) return;
  if (!idbDisponible()) { p.textContent = dirty ? "Cambios sin guardar" : "Todo guardado"; return; }
  p.textContent = estado === "guardando" ? "Guardando…"
    : estado === "navegador" ? "Guardado en este navegador"
    : "Todo guardado";
}
/* Recupera al abrir la base guardada en este navegador (si la hay y el usuario no
   abrió ya un archivo a mano). Devuelve una promesa. */
function restaurarDesdeNavegador() {
  if (!idbDisponible()) return Promise.resolve(false);
  return idbLeer().then(o => {
    if (cargaManual || dirty || !o || !o.cat) return false;
    db = dbDesdeObjeto(o).db;
    aplicarMetaAlFormulario(); render(); setDirty(false);
    const hayDatos = (o.nominas || []).some(n => (n.fac || []).length) || (o.eepp || []).length;
    if (hayDatos) toast("Recuperé tus datos guardados en este navegador");
    return true;
  }).catch(() => false);
}

function setDirty(v = true) {
  dirty = v;
  document.body.classList.toggle("dirty", v);
  const b = document.getElementById("btnSaveDb");
  if (b) b.classList.toggle("primary", v);   /* destaca el respaldo .json cuando hay cambios nuevos */
  if (v) { pieGuardado("guardando"); programarAutoguardado(); }
  else pieGuardado("guardado");
}
window.addEventListener("beforeunload", e => {
  /* Con autoguardado no molestamos al cerrar; solo aseguramos el último cambio.
     Si el navegador no soporta IndexedDB, volvemos al aviso de siempre. */
  if (!idbDisponible()) { if (dirty) { e.preventDefault(); e.returnValue = ""; } return; }
  if (autoPend) autoguardarYa();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && autoPend) autoguardarYa();
});

/* ---------------- catálogo: consultas ---------------- */
const socPorRut = r => db.cat.soc.find(s => s.rut && fmtRut(s.rut) === fmtRut(r));
const socPorSede = s => db.cat.soc.find(x => x.sede === s);
const provPorRut = r => db.cat.prov.find(p => fmtRut(p.rut) === fmtRut(r));
const provPorCod = c => c ? db.cat.prov.find(p => up(p.cod) === up(c)) : null;
function provDeEepp(e) { return provPorCod(e.vendor) || (e.rut ? provPorRut(e.rut) : null); }
function nombreProv(e) { const p = provDeEepp(e); return p ? ((p.cod ? p.cod + " " : "") + (p.nombre || "")) : (e.vendor || ""); }
function sumaDias(iso, d) {
  if (!iso) return "";
  const x = new Date(iso + "T12:00:00"); x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

function sedeDeOc(oc) {
  const o = up(oc).replace(/\s/g, "");
  if (!o) return "";
  let best = "";
  db.cat.soc.forEach(s => {
    if (!s.pre) return;
    if (o.startsWith(up(s.pre)) && s.pre.length > best.length) best = s.sede;
  });
  if (best) return best;
  if (/^PO0\d{5,6}$/.test(o)) return "MNU";
  return "";
}
function ocDeCatalogo(rut, sede) {
  const hit = db.cat.oc.filter(o => fmtRut(o.rut) === fmtRut(rut) && o.sede === sede)
    .sort((a, b) => (b.visto || "").localeCompare(a.visto || ""));
  return hit[0] || null;
}
function aprenderOc(rut, sede, oc, cta, fecha, proy) {
  if (!rut || !sede || !oc) return;
  const ex = db.cat.oc.find(o => fmtRut(o.rut) === fmtRut(rut) && o.sede === sede && up(o.oc) === up(oc));
  if (ex) { ex.visto = fecha || ex.visto; if (cta) ex.cta = cta; if (proy && !ex.proy) ex.proy = proy; return; }
  db.cat.oc.push({ rut: fmtRut(rut), sede, oc, cta: cta || "", proy: proy || "", visto: fecha || "" });
}
function aprenderProv(rut, nombre, cod, tipo, cta) {
  if (!rut) return;
  let p = provPorRut(rut);
  if (!p) { p = { rut: fmtRut(rut), cod: cod || "", nombre: nombre || "", tipo: tipo || "", cta: cta || "", email: "", contacto: "" }; db.cat.prov.push(p); return p; }
  if (cod && !p.cod) p.cod = cod;
  if (nombre && !p.nombre) p.nombre = nombre;
  if (cta && !p.cta) p.cta = cta;
  return p;
}
function proveedorTxt(rut) {
  const p = provPorRut(rut);
  if (!p) return "";
  return (p.cod ? p.cod + " " : "") + (p.nombre || "");
}

/* =========================================================================
   LECTURA DE PDF — reconstruye líneas por coordenada, como pdftotext -layout
   ========================================================================= */
const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfUltimoError = "";

const esperar = ms => new Promise(r => setTimeout(r, ms));
function errNoLegible(e) {
  const m = String((e && (e.message || e.name)) || e || "");
  return /NotReadableError|NotFoundError|could not be read|permission problems|no pudo leer el archivo/i.test(m);
}
function leerConFileReader(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error || new Error("FileReader fallo"));
    fr.readAsArrayBuffer(file);
  });
}
/* lee el archivo del disco con reintentos: OneDrive puede tardar en descargarlo */
async function leerArchivoBuffer(file) {
  const intentos = [
    () => file.arrayBuffer(),
    async () => { await esperar(500); return file.arrayBuffer(); },
    () => leerConFileReader(file),
    async () => { await esperar(1200); return file.slice(0, file.size).arrayBuffer(); }
  ];
  let primero = null;
  for (const intento of intentos) {
    try {
      const buf = await intento();
      if (buf && buf.byteLength) return buf;
      primero = primero || new Error("el archivo llegó vacío (0 bytes)");
    } catch (e) { primero = primero || e; }
  }
  const err = new Error(errNoLegible(primero)
    ? "el navegador no pudo leer el archivo desde el disco"
    : String((primero && primero.message) || primero || "error desconocido"));
  err.noLegible = errNoLegible(primero);
  throw err;
}
async function pdfAbrir(file) {
  const buf = await leerArchivoBuffer(file);
  return pdfjsLib.getDocument({
    data: buf,
    cMapUrl: PDFJS_BASE + "cmaps/", cMapPacked: true,
    standardFontDataUrl: PDFJS_BASE + "standard_fonts/",
    useSystemFonts: true, isEvalSupported: false, password: ""
  }).promise;
}
function pdfMotivo(e) {
  const m = String((e && (e.message || e.name)) || e || "");
  if (/NotReadableError|NotFoundError|could not be read|permission problems|no pudo leer el archivo/i.test(m))
    return "el navegador no pudo leer el archivo desde el disco. Suele pasar cuando el PDF está en OneDrive o SharePoint sin descargar, o cuando se arrastra directo desde Outlook: guárdalo primero en una carpeta del computador (o márcalo como «Mantener siempre en este dispositivo») y vuelve a cargarlo";
  if (/0 bytes|vac[ií]o/i.test(m)) return "el archivo llegó vacío: vuelve a descargarlo";
  if (/password|Password/i.test(m)) return "el PDF está protegido con contraseña";
  if (/InvalidPDF|structure|corrupt/i.test(m)) return "el archivo no tiene una estructura de PDF válida";
  if (/Worker|worker/i.test(m)) return "no se pudo iniciar el lector de PDF (revisa el acceso a cdnjs.cloudflare.com)";
  if (/fetch|network|Failed to load/i.test(m)) return "no se pudo descargar un recurso del lector de PDF";
  return m.slice(0, 160) || "motivo desconocido";
}
function bufferAB64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  const paso = 0x8000;
  for (let i = 0; i < b.length; i += paso) s += String.fromCharCode.apply(null, b.subarray(i, i + paso));
  return btoa(s);
}
function b64ABlob(b64, tipo) {
  const bin = atob(b64 || "");
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Blob([b], { type: tipo || "application/pdf" });
}
const urlsAbiertas = [];
function abrirPdfGuardado(b64, nombre, subtitulo) {
  if (typeof verDocumento === "function") return verDocumento(b64, nombre, subtitulo);
  toast("No pude abrir el visor de documentos");
}
function pesoB64(b64) { return b64 ? Math.round(b64.length * 0.75) : 0; }
function pesoLegible(bytes) {
  if (!bytes) return "0 KB";
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.round(bytes / 1024) + " KB";
}
async function pdfLeer(file) {                        // texto + documento original
  const buf = await leerArchivoBuffer(file);
  const b64 = bufferAB64(buf.slice(0));               // se copia antes de que pdf.js consuma el buffer
  const texto = await pdfATextoDeBuffer(buf, file.name);
  return { texto, b64 };
}
async function pdfATexto(file) {
  const buf = await leerArchivoBuffer(file);
  return pdfATextoDeBuffer(buf, file.name);
}
async function pdfATextoDeBuffer(buf, nombre) {
  pdfUltimoError = "";
  const pdf = await pdfjsLib.getDocument({
    data: buf,
    cMapUrl: PDFJS_BASE + "cmaps/", cMapPacked: true,
    standardFontDataUrl: PDFJS_BASE + "standard_fonts/",
    useSystemFonts: true, isEvalSupported: false, password: ""
  }).promise;
  const paginas = [];
  let fallidas = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        items.push({
          x: it.transform[4], y: it.transform[5], s: it.str,
          h: Math.abs(it.transform[3]) || it.height || 8,
          w: it.width || (it.str.length * 4)
        });
      });
      if (!items.length) { paginas.push(""); continue; }
      const anchos = items.filter(i => i.s.trim().length > 2).map(i => i.w / i.s.length).sort((a, b) => a - b);
      const chW = Math.max(2.2, anchos[Math.floor(anchos.length / 2)] || 4.6);
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lineas = [];
      let grupo = null;
      items.forEach(it => {
        const tol = Math.max(1.8, it.h * 0.55);
        if (grupo && Math.abs(grupo.y - it.y) <= tol) { grupo.items.push(it); grupo.y = (grupo.y * grupo.items.length + it.y) / (grupo.items.length + 1); }
        else { grupo = { y: it.y, items: [it] }; lineas.push(grupo); }
      });
      paginas.push(lineas.map(g => {
        g.items.sort((a, b) => a.x - b.x);
        let out = "", cursor = 0, derechaPrev = null;
        g.items.forEach(it => {
          const col = Math.round(it.x / chW);
          const hueco = derechaPrev === null ? null : it.x - derechaPrev;
          if (col > cursor && (hueco === null || hueco > chW * 0.6)) {
            out += " ".repeat(Math.min(col - cursor, 240));                   // columnas separadas
          } else if (out && hueco !== null && hueco > chW * 0.28 && !/\s$/.test(out) && !/^[\s.,:;)%]/.test(it.s)) {
            out += " ";                                                       // espacio real entre palabras
          }
          out += it.s;
          cursor = Math.max(col, cursor) + it.s.length;
          derechaPrev = it.x + it.w;
        });
        return juntarLetrasSueltas(out.replace(/\s+$/, ""));
      }).join("\n"));
    } catch (e) {
      fallidas++;
      pdfUltimoError = pdfMotivo(e);
      console.warn("página " + p + " ilegible:", e);
    }
  }
  if (fallidas && !paginas.some(x => x.trim()))
    throw new Error(`no se pudo leer ninguna de las ${pdf.numPages} páginas (${pdfUltimoError})`);
  if (fallidas) pdfUltimoError = `${fallidas} de ${pdf.numPages} páginas quedaron ilegibles`;
  return paginas.join("\n\n");
}
/* algunos PDF escriben el texto con las letras separadas: "C O N S T RU C C I Ó N" */
function juntarLetrasSueltas(linea) {
  return linea.split(/(\s{2,})/).map(seg => {
    if (/^\s*$/.test(seg)) return seg;
    const tok = seg.trim().split(" ").filter(x => x !== "");
    if (tok.length < 5) return seg;
    const cortos = tok.filter(x => x.length <= 2).length;
    if (cortos / tok.length < 0.7) return seg;
    let junto = tok.join("");
    junto = junto
      .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2")       // minúscula seguida de mayúscula: nueva palabra
      .replace(/([A-Za-zÁÉÍÓÚÑáéíóúñ])([-–])([A-Za-zÁÉÍÓÚÑ])/g, "$1 $2 $3")
      .replace(/([a-záéíóúñ])(\d)/g, "$1 $2")
      .replace(/(\d)([A-Za-zÁÉÍÓÚÑ])/g, "$1 $2");
    const izq = seg.match(/^\s*/)[0], der = seg.match(/\s*$/)[0];
    return izq + junto + der;
  }).join("");
}
function quitarCopia(t) {                        // descarta la copia "cedible"
  const n = t.length;
  for (let cut = Math.floor(n / 2) - 60; cut < Math.floor(n / 2) + 60; cut++) {
    if (cut > 200 && t.slice(0, cut).trim() === t.slice(cut, 2 * cut).trim()) return t.slice(0, cut);
  }
  return t;
}

/* ---------------- extracción de campos ---------------- */
const NUM_RE = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const MESES_N = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

const MES_RE = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic";
const D_NUM  = String.raw`\b(\d{1,2})\s?[/\-.]\s?(\d{1,2})\s?[/\-.]\s?(\d{4})\b`;
const D_TXT  = String.raw`\b(\d{1,2})\s*(?:de\s+)?[-/\s]?\s*(` + MES_RE + String.raw`)\.?\s*(?:de[l]?\s+)?[-/\s]?\s*(\d{4})\b`;
const D_ISO  = String.raw`\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b`;
function armaFecha(d, mo, y) {
  d = +d; y = +y;
  const m = /^\d+$/.test(String(mo)) ? +mo : MESES_N[String(mo).toLowerCase()];
  if (!m || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function xFecha(t) {
  let s = norm(t).toLowerCase();
  s = s.replace(/(resoluci[o]n|res\.?\s*n[°º]|timbre|verifique|www\.sii)[^\n]{0,90}/g, " ");   // timbre del SII
  /* saca las fechas que no son de emisión (vencimiento, referencia de la OC, pagos) */
  const noEmision = /(vencimiento|vence|pagos?|fecha\s*de\s*ref\.?|fecha\s*ref\.?|fecha\s*de\s*la\s*oc|fecha\s*de\s*entrega|entrega|delivery|due\s*date)[^\S\n]*:?[^\S\n]*/;
  [D_NUM, D_TXT, D_ISO].forEach(d => {
    s = s.replace(new RegExp(noEmision.source + "(?:" + d + ")", "gi"), " ");
    s = s.replace(new RegExp(String.raw`(orden[^\S\n]*(?:de)?[^\S\n]*compra|folio[^\S\n]*de[^\S\n]*ref\.?)[^\n]{0,70}?(?:` + d + ")", "gi"), " ");
  });
  const conEtiqueta = String.raw`(?:fecha|emitido|emision)[^\S\n]*(?:de[^\S\n]*)?(?:emision|documento|emitido)?[^\S\n]*:?[^\S\n]*`;
  const intentos = [
    new RegExp(conEtiqueta + "(?:" + D_TXT + ")", "i"),
    new RegExp(conEtiqueta + "(?:" + D_NUM + ")", "i"),
    new RegExp(conEtiqueta + "(?:" + D_ISO + ")", "i"),
    new RegExp(D_TXT, "i"), new RegExp(D_NUM, "i"), new RegExp(D_ISO, "i")
  ];
  for (let i = 0; i < intentos.length; i++) {
    const m = intentos[i].exec(s);
    if (!m) continue;
    const g = m.slice(1).filter(x => x !== undefined);
    const esIso = (i === 2 || i === 5);
    const r = esIso ? armaFecha(g[2], g[1], g[0]) : armaFecha(g[0], g[1], g[2]);
    if (r) return r;
  }
  return "";
}
function xFolio(t) {
  let s = norm(t).replace(/(TELEFONO|FONO|Telefono|TEL|Fax|FAX)\s*:?\s*[\d\s\-/()+]{6,}/gi, " ")
                 .replace(/N\s*[°º]\s*SAP[^\n]*/gi, " ")
                 .replace(/(Folio|N)\s*[°º]?\s*(de\s*)?Ref[^\n]*/gi, " ");
  const pats = [/Folio\s*N\s*[°º]\s*:?\s*0*(\d{1,9})/i, /\bN\s*[°º]\s*:?\s*0*(\d{1,9})/,
                /Folio\s*:?\s*0*(\d{1,9})/i, /\bN\s*[°º]\s*:?[^A-Za-z\d]{0,120}?0*(\d{2,9})/];
  for (const p of pats) { const m = p.exec(s); if (m) return m[1]; }
  return "";
}
function xRuts(t) {
  const s = norm(t);
  const out = [];
  const re = /(\d{1,2})\.?(\d{3})\.?(\d{3})\s*-\s*([\dkK])/g;
  let m;
  while ((m = re.exec(s))) out.push(`${m[1]}.${m[2]}.${m[3]}-${m[4].toUpperCase()}`);
  return out;
}
function normOc(pre, mid, digs) {
  const p = "PO" + (pre || "").toUpperCase();
  const m = mid ? mid.replace(/[()]/g, "") : "";
  if (m) return `${p}(${m[0].toUpperCase() + m.slice(1).toLowerCase()})${digs}`;
  return `${p}-${digs}`;
}
function xOc(t) {
  const s = norm(t);
  /* la fuente más confiable: el bloque "Purchase Order # ..." que agregamos en la glosa */
  const mPO = /Purchase\s*Order\s*#?\s*:?\s*(PO[A-Za-z()]{0,10}-?\d{4,7})/i.exec(s);
  if (mPO) {
    const m2 = /^PO([A-Z]{2,3})(\(?[A-Za-z]{2,5}\)?)?-?(\d{4,7})$/i.exec(mPO[1].replace(/\s/g, ""));
    if (m2) return { oc: normOc(m2[1], m2[2], m2[3]), parcial: "" };
  }
  const cands = [];
  let m;
  /* formas aceptadas — evita capturar palabras como "PORTALES 07045" */
  const reGuion = /\bPO([A-Z]{2,3})[^\S\n]{0,3}-[^\S\n]{0,3}(\d{4,7})\b/g;                       // POCDE-002237
  while ((m = reGuion.exec(s))) cands.push(normOc(m[1], "", m[2]));
  const rePar = /\bPO([A-Z]{2,3})[^\S\n]{0,3}\(([A-Za-z]{2,5})\)[^\S\n]{0,3}-?[^\S\n]{0,3}(\d{4,7})\b/g;   // POABS(Nat)002643
  while ((m = rePar.exec(s))) cands.push(normOc(m[1], m[2], m[3]));
  const reMix = /\bPO([A-Z]{2,3})([A-Z][a-z]{1,4})(\d{4,7})\b/g;                  // POABSNat002308 (paréntesis perdidos)
  while ((m = reMix.exec(s))) cands.push(normOc(m[1], m[2], m[3]));
  const reNum = /\bPO\s?-?\s?(\d{6,7})\b/g;                                      // PO009322 (Manquecura Ñuñoa)
  while ((m = reNum.exec(s))) cands.push("PO" + m[1]);
  const re2 = /\bPO([A-Z]{2,3})\s?-\s*(?:\n|\s{2,})[\s\S]{0,400}?(?<![\d.])(\d{6})(?![\d.])/g;   // OC partida en dos líneas
  while ((m = re2.exec(s))) cands.push(`PO${m[1]}-${m[2]}`);
  if (!cands.length) {
    const m3 = /(?:Orden\s*(?:de)?\s*Compra|\bOC\b)[^\n]{0,40}?\b(\d{6})\b/i.exec(s);
    if (m3) return { oc: "", parcial: m3[1] };
    return { oc: "", parcial: "" };
  }
  const cnt = {};
  cands.forEach(c => cnt[c] = (cnt[c] || 0) + 1);
  const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || b.length - a.length)[0] || "";
  return { oc: best, parcial: "" };
}
function digitosOc(oc) { const m = /(\d+)\s*$/.exec(String(oc || "")); return m ? m[1] : ""; }
function ocIncompleta(oc) { const d = digitosOc(oc); return !!oc && d.length > 0 && d.length < 6; }
function xIr(t) { const m = /\bIR\s*#?\s*0*(\d{5,8})/i.exec(norm(t)); return m ? "IR" + m[1] : ""; }
function xVendor(t) { const m = /Vendor\s*#?\s*(V\s?0?\d{4,6})/i.exec(norm(t)); return m ? m[1].replace(/\s/g, "").toUpperCase() : ""; }
function esProjectCode(c) {
  if (!/^[A-Z]{3,6}\d{5}$/.test(c)) return false;
  const pre3 = c.slice(0, 3);
  if (db && db.cat && socPorSede(pre3)) return true;
  if (pre3 === "CHC" || pre3 === "CHI") return true;
  return /^[A-Z]{5,6}\d{5}$/.test(c);
}
function xProject(t) {
  const s = norm(t);
  const re = /PROJECT\s*CODE\s*#?\s*\[?\s*([A-Z]{3}[A-Z0-9]{5,10})/gi;
  let m;
  while ((m = re.exec(s))) {
    const c = m[1].toUpperCase().replace(/[\]]/g, "");
    if (!["REFERENCE", "VENDOR"].includes(c) && esProjectCode(c)) return c;
  }
  const re2 = /\b([A-Z]{3,6}\d{5})\b/g;                     // respaldo: HUECN26501, CHCMA27101…
  const vistos = {};
  while ((m = re2.exec(s))) { const c = m[1].toUpperCase(); if (esProjectCode(c)) vistos[c] = (vistos[c] || 0) + 1; }
  const k = Object.keys(vistos).sort((a, b) => vistos[b] - vistos[a]);
  return k[0] || "";
}
function montoTrasEtiqueta(t, labels) {
  const s = norm(t);
  for (const lab of labels) {
    const re = new RegExp(lab, "gi");
    let m;
    while ((m = re.exec(s))) {
      const antes = s.slice(Math.max(0, m.index - 16), m.index);
      if (/(TAX|IVA|IMPTO|IMPUESTO|RETENCI[OÓ]N|SUB)\s*$/i.test(antes)) continue;   // "Tax Total" no es el total
      let tail = s.slice(m.index + m[0].length, m.index + m[0].length + 320);
      tail = tail.replace(/^\s*\(?\s*\d{1,2}([.,]\d{1,2})?\s*%\s*\)?/, "");   // salta "(19%)"
      tail = tail.replace(/^\s*\(?\s*19([.,]\d{1,2})?\s*\)?(?=[\s$])/, "");    // salta "19.00"
      // 1) en la misma línea
      let mm = new RegExp(`^[^\\S\\n]*:?[^\\S\\n]*\\$?[^\\S\\n]*${NUM_RE}`).exec(tail);
      // 2) más adelante, siempre que no haya letras en medio (otra etiqueta)
      if (!mm) mm = new RegExp(`^[^A-Za-z]{0,240}?${NUM_RE}`).exec(tail);
      if (mm) return toNum(mm[1]);
    }
  }
  return null;
}
function xMontos(t) {
  const s = norm(t);
  const exenta = /NO\s*AFECTA\s*O\s*EXENTA|FACTURA\s*EXENTA|FACTURA\s*NO\s*AFECTA/i.test(s);
  let total = montoTrasEtiqueta(t, [String.raw`MONTO\s*TOTAL`, String.raw`\bTOTAL\b(?!\s*ES)`]);
  const avisos = [];
  let neto, iva;
  if (exenta) {
    neto = montoTrasEtiqueta(t, [String.raw`\bEXENTO\b`, String.raw`Monto\s*Exento`]);
    if (neto === null) neto = total;
    iva = 0;
    if (total === null) total = neto;
  } else {
    neto = montoTrasEtiqueta(t, [String.raw`MONTO\s*NETO`, String.raw`\bNETO\b`, String.raw`SUB\s*TOTAL`, String.raw`\bAFECTO\b`]);
    const ivaLbl = montoTrasEtiqueta(t, [String.raw`I\.?\s?V\.?\s?A\.?\s*\(?\s*19`, String.raw`19\s*%\s*IVA`, String.raw`I\.?\s?V\.?\s?A\.?`]);
    if (neto === null && total !== null) neto = Math.round(total / 1.19);
    iva = ivaDe(neto);
    if (ivaLbl !== null && iva !== null && Math.abs(ivaLbl - iva) > 2)
      avisos.push(`IVA impreso ${nf(ivaLbl)} vs 19% del neto ${nf(iva)}`);
    const calc = neto === null ? null : neto + iva;
    if (calc !== null && (total === null || Math.abs(total - calc) > 2)) {
      if (total !== null) avisos.push(`TOTAL impreso ${nf(total)} vs neto+IVA ${nf(calc)}`);
      total = calc;
    }
  }
  return { neto, iva, total, exenta, avisos };
}

/* ---------------- extrae una factura completa ---------------- */
const RE_CAPEX_GLOSA = /(CONSTRUCCI[OÓ]N|HABILITACI[OÓ]N|AMPLIACI[OÓ]N|REMODELACI[OÓ]N|EEPP|\bEP[\s_]*\d|OBRAS\s+DE|PROJECT\s*CODE)/i;

function leerFactura(texto, nombreArchivo) {
  const t = quitarCopia(texto);
  const f = { id: uid(), archivo: nombreArchivo, texto: t.slice(0, 20000) };
  if (!t.trim()) {
    return Object.assign(f, {
      sinTexto: true, tipo: "MANT", sede: "", proy: "68500", oc: "", rut: "", fecha: "", doc: "",
      neto: null, iva: null, total: null, ir: "", obs: "", avisos: ["PDF escaneado sin texto: ingresa los datos a mano"]
    });
  }
  const avisos = [];
  const ruts = xRuts(t);
  const emisor = ruts[0] || "";
  const { oc, parcial } = xOc(t);
  const m = xMontos(t);
  avisos.push(...m.avisos);

  /* --- sede: RUT del colegio en la factura, con el prefijo de OC como contraste --- */
  let sede = "";
  for (const r of ruts) { const s = socPorRut(r); if (s) { sede = s.sede; break; } }
  const sedeOc = sedeDeOc(oc);
  if (sede && sedeOc && sede !== sedeOc)
    avisos.push(`Sede por RUT del colegio (${sede}) distinta de la del prefijo de OC (${sedeOc})`);
  if (!sede) sede = sedeOc;

  /* --- OC: completar la parcial, detectar truncados, buscar en catálogo --- */
  let ocFinal = oc;
  const pre = sede ? (socPorSede(sede)?.pre || "") : "";
  if (!ocFinal && parcial && pre) {
    ocFinal = pre === "PO0" ? "PO0" + parcial : pre + "-" + parcial;
    avisos.push(`OC armada con el N° ${parcial} que trae la factura y la sede ${sede}`);
  }
  if (ocIncompleta(ocFinal)) {
    const d = digitosOc(ocFinal);
    const cat = db.cat.oc.filter(o => fmtRut(o.rut) === fmtRut(emisor) && (!sede || o.sede === sede)
      && digitosOc(o.oc).startsWith(d) && digitosOc(o.oc).length === 6);
    if (cat.length === 1) { avisos.push(`OC cortada en la factura (${ocFinal}); completada como ${cat[0].oc} según el catálogo`); ocFinal = cat[0].oc; }
    else avisos.push(`OC cortada en la factura (${ocFinal}): confirma el número completo`);
  }
  if (!ocFinal && sede && emisor) {
    const cat = ocDeCatalogo(emisor, sede);
    if (cat) { ocFinal = cat.oc; avisos.push(`OC tomada del catálogo (${cat.oc}${cat.visto ? ", visto " + isoToCl(cat.visto) : ""}): confirma que corresponde`); }
    else avisos.push("Sin OC: no viene en la factura ni está en el catálogo");
  }

  if (emisor) aprenderProv(emisor, nombreProveedorDeTexto(t, emisor), xVendor(t), "", "");
  const prov = provPorRut(emisor);

  /* --- project code y clasificación --- */
  let proy = xProject(t);
  if (!proy && ocFinal) {
    const porOc = db.cat.oc.find(o => up(o.oc) === up(ocFinal) && o.proy);
    if (porOc) { proy = porOc.proy; avisos.push(`Project code ${proy} tomado del catálogo por la OC`); }
  }
  const catOcExacta = ocFinal ? db.cat.oc.find(o => up(o.oc) === up(ocFinal)) : null;
  let tipo;
  if (proy) tipo = "CAPEX";
  else if (catOcExacta && catOcExacta.cta) tipo = "MANT";                       // la OC ya se usó como mantención
  else if (RE_CAPEX_GLOSA.test(norm(t))) { tipo = "CAPEX"; avisos.push("Clasificada como CAPEX por la glosa, sin project code: confírmalo"); }
  else tipo = "MANT";

  let cta = "";
  if (tipo === "MANT") {
    const catOc = (emisor && sede) ? ocDeCatalogo(emisor, sede) : null;
    cta = (catOcExacta && catOcExacta.cta) || (catOc && catOc.cta) || prov?.cta || "68500";
  }

  return Object.assign(f, {
    tipo, sede, proy: tipo === "CAPEX" ? proy : cta, oc: ocFinal, rut: emisor,
    fecha: xFecha(t), doc: xFolio(t), neto: m.neto, iva: m.iva, total: m.total,
    exenta: m.exenta, ir: xIr(t), obs: "", avisos
  });
}
function nombreProveedorDeTexto(t, rut) {
  const lineas = norm(t).split("\n").slice(0, 14);
  const cand = lineas.map(l => l.trim())
    .filter(l => /[A-Z]{4}/.test(l) && !/R\.?U\.?T|FACTURA|GIRO|S\.I\.I|Fecha|eMail|Telefono|DIRECCION|www/i.test(l))
    .sort((a, b) => b.length - a.length)[0] || "";
  return cand.replace(/\s{2,}/g, " ").trim().slice(0, 80);
}
</script>
