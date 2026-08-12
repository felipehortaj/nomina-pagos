<script>
"use strict";
/* =========================================================================
   PROYECTOS Y PRESUPUESTO
   Cruza las OC y las facturas que la app ya tiene con el presupuesto y la
   categoría de cada proyecto. Muestra la hoja de control con el formato del
   libro anual dentro de la app, y la exporta a Excel: una hoja por proyecto o
   el libro completo de un año fiscal (con una hoja resumen y el flujo de caja).
   El presupuesto y la categoría se cargan acá (la app no los conoce solos).
   ========================================================================= */

const CATEGORIAS = ["DEVELOPMENT CAPEX", "ENHANCEMENT", "MANTENCIÓN", "GASTOS"];
const MESES_FY = ["SEP", "OCT", "NOV", "DIC", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO"];

/* ---------------- año fiscal (Cognita: 1-sep a 31-ago) ---------------- */
function fiscalYear(iso) { if (!iso) return null; const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 9 ? y + 1 : y; }
function fyLabel(y) { return y ? "FY" + String(y).slice(-2) : "—"; }
function fyDeFecha(clFecha) { const iso = clToIso(clFecha); return iso ? fiscalYear(iso) : null; }
function mesesDeFy(y) {                                   // 12 claves "YYYY-MM" en orden fiscal (sep→ago)
  const out = [];
  for (let m = 9; m <= 12; m++) out.push(`${y - 1}-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= 8; m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  return out;
}

/* ---------------- detección de proyectos ---------------- */
function esCodigoProyecto(p) { return !!p && !/^\d{5}$/.test(String(p).trim()); }
function codigosDetectados() {
  const set = new Set();
  (db.cat.oc || []).forEach(o => { if (esCodigoProyecto(o.proy)) set.add(String(o.proy).trim()); });
  todasLasFacturas().forEach(({ f }) => { if (esCodigoProyecto(f.proy)) set.add(String(f.proy).trim()); });
  return [...set].sort();
}
function proyectoPorCodigo(cod) { return (db.proyectos || []).find(p => p.codigo === cod); }
function detectarProyectos() {
  db.proyectos = db.proyectos || [];
  let nuevos = 0;
  codigosDetectados().forEach(cod => {
    if (!proyectoPorCodigo(cod)) { db.proyectos.push({ codigo: cod, nombre: "", categoria: "", ppto: null, fy: fyInferido(cod) }); nuevos++; }
  });
  setDirty(); render();
  toast(nuevos ? `${nuevos} proyecto(s) detectado(s) de las OC y facturas` : "No hay proyectos nuevos por detectar");
}

/* ---------------- alta manual y carga masiva del maestro ---------------- */
function agregarProyecto() {
  db.proyectos = db.proyectos || [];
  db.proyectos.unshift({ codigo: "", nombre: "", categoria: "", ppto: null, fy: fySeleccionado() || null });
  setDirty(); render();
  const c = document.querySelector('#tblProy tbody tr td[data-f="codigo"]'); if (c) c.focus();
}
function borrarProyecto(i) {
  const p = (db.proyectos || [])[i]; if (!p) return;
  if (!confirm(`Quitar el proyecto ${p.codigo || "(sin código)"} de la lista? No borra sus OC ni facturas, solo el presupuesto y la categoría cargados acá.`)) return;
  db.proyectos.splice(i, 1); setDirty(); render();
}
function normCategoria(s) {
  const u = up(s || ""); if (!u) return "";
  if (u.includes("ENHANCE")) return "ENHANCEMENT";
  if (u.includes("DEVELOP") || u.includes("CAPEX")) return "DEVELOPMENT CAPEX";
  if (u.includes("MANTEN") || u.includes("MAINTEN")) return "MANTENCIÓN";
  if (u.includes("GASTO")) return "GASTOS";
  return CATEGORIAS.find(c => up(c) === u) || "";
}
function parseFyTxt(s) {
  if (!s) return null; const m = String(s).match(/(\d{2,4})/); if (!m) return null;
  let y = +m[1]; if (y < 100) y = 2000 + y; return y;
}
function parsearProyectos(txt) {
  const res = [];
  String(txt || "").split(/\r?\n/).forEach(l => {
    if (!l.trim()) return;
    const c = l.split(/\t|;/).map(x => x.trim());
    if (/^(c[oó]d|code)/i.test(c[0] || "")) return;             // encabezado
    const codigo = (c[0] || "").trim(); if (!codigo) return;
    res.push({ codigo, nombre: c[1] || "", categoria: normCategoria(c[2] || ""), ppto: toNum(c[3] || "") || null, fy: parseFyTxt(c[4] || "") });
  });
  return res;
}
function cargarPegarProy() {
  const filas = parsearProyectos(document.getElementById("pegarProyTxt").value);
  if (!filas.length) { toast("No reconocí filas. Pega: Código, Nombre, Categoría, Presupuesto, Año (tab o ; entre columnas)"); return; }
  db.proyectos = db.proyectos || [];
  let creados = 0, actualizados = 0;
  filas.forEach(f => {
    const p = db.proyectos.find(x => up(x.codigo) === up(f.codigo));
    if (p) { if (f.nombre) p.nombre = f.nombre; if (f.categoria) p.categoria = f.categoria; if (f.ppto != null) p.ppto = f.ppto; if (f.fy) p.fy = f.fy; actualizados++; }
    else { db.proyectos.push({ codigo: f.codigo, nombre: f.nombre, categoria: f.categoria, ppto: f.ppto, fy: f.fy }); creados++; }
  });
  setDirty(); render();
  document.getElementById("modalPegarProy").classList.add("hide");
  document.getElementById("pegarProyTxt").value = "";
  toast(`Proyectos cargados: ${creados} nuevo(s), ${actualizados} actualizado(s)`);
}

/* ---------------- facturas y agregación ---------------- */
function facturasDeOc(ocNum) {
  const out = [];
  todasLasFacturas().forEach(({ f }) => {
    if (f.oc && up(f.oc) === up(ocNum)) out.push({ fecha: f.fecha || "", doc: (f.exenta ? "FAEX " : "FAE ") + (f.doc || ""), monto: f.total || 0 });
  });
  return out;
}
function facturasDelProyecto(cod) {                       // para el flujo de caja: todas las del proyecto
  const ocSet = new Set((db.cat.oc || []).filter(o => String(o.proy || "").trim() === cod).map(o => up(o.oc)));
  const out = [];
  todasLasFacturas().forEach(({ f }) => {
    if (String(f.proy || "").trim() === cod || (f.oc && ocSet.has(up(f.oc)))) out.push({ fecha: f.fecha || "", monto: f.total || 0 });
  });
  return out;
}
function fyInferido(cod) {
  const c = {}; facturasDelProyecto(cod).forEach(f => { const y = fyDeFecha(f.fecha); if (y) c[y] = (c[y] || 0) + 1; });
  const k = Object.keys(c).sort((a, b) => c[b] - c[a]); return k.length ? +k[0] : null;
}
function fyDeProyecto(cod) { const p = proyectoPorCodigo(cod); return (p && p.fy) ? p.fy : fyInferido(cod); }
function sedeDeProyecto(cod) {
  const c = {}; (db.cat.oc || []).filter(o => String(o.proy || "").trim() === cod).forEach(o => { if (o.sede) c[o.sede] = (c[o.sede] || 0) + 1; });
  const k = Object.keys(c).sort((a, b) => c[b] - c[a]); return k[0] || "";
}
function datosProyecto(cod) {
  const p = proyectoPorCodigo(cod) || { codigo: cod, nombre: "", categoria: "", ppto: null };
  const ocs = (db.cat.oc || []).filter(o => String(o.proy || "").trim() === cod).map(o => {
    const facs = facturasDeOc(o.oc);
    const facturado = facs.reduce((s, x) => s + x.monto, 0);
    const orig = (o.monto === null || o.monto === undefined) ? null : o.monto;
    const corr = orig;
    return {
      oc: o.oc, prov: proveedorTxt(o.rut) || "", desc: o.glosa || "", orig, corr, facs, facturado,
      saldo: corr === null ? null : corr - facturado, dif: (orig === null || corr === null) ? 0 : orig - corr
    };
  }).sort((a, b) => String(a.oc).localeCompare(String(b.oc)));
  const comprometido = ocs.reduce((s, o) => s + (o.corr || 0), 0);
  const facturado = ocs.reduce((s, o) => s + o.facturado, 0);
  return { p, ocs, comprometido, facturado, saldoDisp: (p.ppto || 0) - comprometido };
}
function flujoProyecto(cod, y) {
  const keys = mesesDeFy(y), sums = keys.map(() => 0);
  facturasDelProyecto(cod).forEach(f => { const iso = clToIso(f.fecha); if (!iso) return; const i = keys.indexOf(iso.slice(0, 7)); if (i >= 0) sums[i] += f.monto; });
  return sums;
}

/* ---------------- años fiscales disponibles / activo ---------------- */
let fyActivo = null;                                      // null = todos
function todosLosFy() {
  const s = new Set();
  (db.proyectos || []).forEach(p => { const y = fyDeProyecto(p.codigo); if (y) s.add(y); });
  return [...s].sort((a, b) => b - a);
}
function fySeleccionado() { const fys = todosLosFy(); return (fyActivo && fys.includes(fyActivo)) ? fyActivo : (fys[0] || null); }
function proyectosDeFy(fy) { return (db.proyectos || []).filter(p => !fy || fyDeProyecto(p.codigo) === fy).map(p => p.codigo); }

/* ---------------- pantalla ---------------- */
function renderProyectos() {
  const tb = document.querySelector("#tblProy tbody"); if (!tb) return;
  const pill = document.getElementById("pillProy");
  const lista = (db.proyectos || []);
  if (pill) pill.textContent = lista.length;

  const fys = todosLosFy();
  const sel = document.getElementById("selFyProy");
  if (sel) {
    sel.innerHTML = `<option value="">Todos los años</option>` + fys.map(y => `<option value="${y}"${y === fyActivo ? " selected" : ""}>${fyLabel(y)}</option>`).join("");
  }
  const candidatos = fys.length ? fys : [];
  const filtradas = lista.filter(p => !fyActivo || fyDeProyecto(p.codigo) === fyActivo);
  tb.innerHTML = filtradas.map(p => {
    const i = lista.indexOf(p);
    const d = datosProyecto(p.codigo);
    const fyp = fyDeProyecto(p.codigo);
    const optCat = ["", ...CATEGORIAS].map(c => `<option value="${c}"${(p.categoria || "") === c ? " selected" : ""}>${c || "— elegir —"}</option>`).join("");
    const setFy = [...new Set([...candidatos, fyp].filter(Boolean))].sort((a, b) => b - a);
    const optFy = setFy.map(y => `<option value="${y}"${y === fyp ? " selected" : ""}>${fyLabel(y)}</option>`).join("");
    const sobre = p.ppto && d.comprometido > p.ppto;
    return `<tr data-i="${i}" data-cod="${esc(p.codigo)}">
      <td class="mono edit" data-f="codigo" contenteditable>${esc(p.codigo)}</td>
      <td class="edit" data-f="nombre" contenteditable>${esc(p.nombre || "")}</td>
      <td><select data-f="categoria">${optCat}</select></td>
      <td><select data-f="fy">${optFy || `<option value="">—</option>`}</select></td>
      <td class="num edit" data-f="ppto" contenteditable>${p.ppto ? nf(p.ppto) : ""}</td>
      <td class="num">${nf(d.comprometido)}</td>
      <td class="num">${nf(d.facturado)}</td>
      <td class="num${sobre ? " neg" : ""}">${p.ppto ? nf(d.saldoDisp) : "—"}</td>
      <td style="white-space:nowrap">
        <button class="btn sm ghost" data-verproy="${esc(p.codigo)}" title="Ver la hoja del proyecto en pantalla">Ver</button>
        <button class="btn sm" data-exportproy="${esc(p.codigo)}" title="Descargar la hoja de este proyecto en Excel">Excel</button>
        <button class="btn sm ghost" data-delproy="${i}" title="Quitar este proyecto">✕</button></td></tr>`;
  }).join("") || `<tr><td colspan="9" class="muted" style="padding:14px">Aún no hay proyectos${fyActivo ? " en " + fyLabel(fyActivo) : ""}. Usa «Agregar proyecto», «Pegar lista» o «Detectar proyectos».</td></tr>`;
}

/* ---------------- eventos ---------------- */
if (document.getElementById("btnDetectarProy")) {
  document.getElementById("btnDetectarProy").addEventListener("click", detectarProyectos);
  const selFy = document.getElementById("selFyProy");
  if (selFy) selFy.addEventListener("change", e => { fyActivo = e.target.value ? +e.target.value : null; renderProyectos(); });
  const bLibro = document.getElementById("btnExportLibro");
  if (bLibro) bLibro.addEventListener("click", () => exportarLibroFY(fyActivo));   // null = todos los años
  const bRes = document.getElementById("btnVerResumen");
  if (bRes) bRes.addEventListener("click", () => verResumen(fyActivo));

  const tp = document.getElementById("tblProy");
  tp.addEventListener("blur", e => {
    const td = e.target.closest && e.target.closest("td.edit"); if (!td) return;
    const p = db.proyectos[+td.closest("tr").dataset.i]; if (!p) return;
    if (td.dataset.f === "ppto") p.ppto = toNum(td.textContent) || null;
    else p[td.dataset.f] = td.textContent.trim();
    setDirty(); render();
  }, true);
  tp.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest && e.target.closest("td.edit")) { e.preventDefault(); e.target.blur(); } });
  tp.addEventListener("change", e => {
    const sel = e.target.closest && e.target.closest("select[data-f]"); if (!sel) return;
    const p = db.proyectos[+sel.closest("tr").dataset.i]; if (!p) return;
    p[sel.dataset.f] = sel.dataset.f === "fy" ? (sel.value ? +sel.value : null) : sel.value;
    setDirty(); render();
  });
  tp.addEventListener("click", e => {
    const v = e.target.closest && e.target.closest("[data-verproy]");
    const x = e.target.closest && e.target.closest("[data-exportproy]");
    const d = e.target.closest && e.target.closest("[data-delproy]");
    if (v && v.dataset.verproy) verHojaProyecto(v.dataset.verproy);
    else if (x && x.dataset.exportproy) exportarHojaProyecto(x.dataset.exportproy);
    else if (d) borrarProyecto(+d.dataset.delproy);
  });

  const bAdd = document.getElementById("btnAgregarProy");
  if (bAdd) bAdd.addEventListener("click", agregarProyecto);
  const bPeg = document.getElementById("btnPegarProy");
  if (bPeg) bPeg.addEventListener("click", () => document.getElementById("modalPegarProy").classList.remove("hide"));
  const cerrarPeg = () => document.getElementById("modalPegarProy").classList.add("hide");
  if (document.getElementById("pegarProyCerrar")) document.getElementById("pegarProyCerrar").addEventListener("click", cerrarPeg);
  if (document.getElementById("modalPegarProy")) document.getElementById("modalPegarProy").addEventListener("click", e => { if (e.target.id === "modalPegarProy") cerrarPeg(); });
  if (document.getElementById("pegarProyCargar")) document.getElementById("pegarProyCargar").addEventListener("click", cargarPegarProy);

  // modal de vista previa
  const cerrar = () => document.getElementById("modalProy").classList.add("hide");
  document.getElementById("proyCerrar").addEventListener("click", cerrar);
  document.getElementById("modalProy").addEventListener("click", e => { if (e.target.id === "modalProy") cerrar(); });
  document.getElementById("proyExcelDesde").addEventListener("click", () => {
    if (previewActual.tipo === "resumen") exportarLibroFY(previewActual.fy);
    else exportarHojaProyecto(previewActual.cod);
  });
}

/* ---------------- vista previa en pantalla (mismo formato del Excel) ---------------- */
let previewActual = { tipo: "proyecto", cod: null, fy: null };
function abrirModalProy(titulo, html) {
  document.getElementById("proyTitulo").textContent = titulo;
  document.getElementById("proyPreview").innerHTML = html;
  document.getElementById("modalProy").classList.remove("hide");
}
function verHojaProyecto(cod) { previewActual = { tipo: "proyecto", cod, fy: null }; abrirModalProy(`Hoja de proyecto · ${cod}`, htmlHojaProyecto(cod)); }
function verResumen(fy) {
  if (!proyectosDeFy(fy).length) { toast(fy ? `No hay proyectos en ${fyLabel(fy)}` : "Aún no hay proyectos que resumir"); return; }
  previewActual = { tipo: "resumen", cod: null, fy: fy || null };
  abrirModalProy(fy ? `Resumen y flujo de caja · ${fyLabel(fy)}` : "Resumen · todos los años", htmlResumen(fy || null));
}

const PVCSS = `<style>
.pv{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111}
.pv .logo{text-align:right;color:#ED7D31;font-weight:700}
.pv h3{font-size:14px;text-align:center;margin:2px 0 12px}
.pv .hd td{padding:1px 8px}.pv .hd .l{font-weight:700}
.pv table{border-collapse:collapse}
.pv .blk td{border:1px solid #bfbfbf;padding:2px 10px}.pv .blk .l{font-weight:700;border:none}.pv .blk .v{background:#DDEBF7;text-align:right;min-width:110px}.pv .blk .u{font-weight:700;text-align:right;border:none}
.pv .det{width:100%}
.pv .det th{background:#1F3864;color:#fff;font-size:9px;padding:6px;border:1px solid #1F3864;text-align:right;vertical-align:middle}
.pv .det th.l{text-align:left}
.pv .det td{border:1px solid #d8d8d8;padding:2px 6px;font-size:11px;vertical-align:top}
.pv .num{text-align:right;font-variant-numeric:tabular-nums}.pv .c{text-align:center}
.pv tr.oc td{background:#F2F2F2}.pv tr.oc td:first-child{font-weight:700}
.pv .prov,.pv .desc{font-size:9px}.pv .pc{color:#999}
.pv td.amar{background:#FFC000;font-weight:700}.pv td.amar2{background:#FFE08A}
.pv tr.tot td{background:#1F3864;color:#fff;font-weight:700}
.pv tr.sub td{background:#e9edf5;font-weight:700}
</style>`;

function htmlHojaProyecto(cod) {
  const D = datosProyecto(cod), p = D.p;
  let filas = "";
  for (const o of D.ocs) {
    filas += `<tr class="oc"><td>${esc(o.oc)}</td><td class="prov">${esc(o.prov)}</td><td class="desc">${esc(o.desc)}</td>
      <td class="num">${o.orig == null ? "" : nf(o.orig)}</td><td class="num">${o.corr == null ? "" : nf(o.corr)}</td>
      <td></td><td></td><td class="num amar">${nf(o.facturado)}</td><td class="num">${o.saldo == null ? "" : nf(o.saldo)}</td><td class="num">${o.orig == null ? "" : nf(o.dif)}</td></tr>`;
    o.facs.forEach(f => {
      filas += `<tr><td></td><td></td><td></td><td></td><td></td><td class="c">${esc(f.fecha)}</td><td>${esc(f.doc)}</td><td class="num amar2">${nf(f.monto)}</td><td></td><td></td></tr>`;
    });
  }
  const M = n => nf(Math.round((n || 0) / 1000));
  return `${PVCSS}<div class="pv">
    <div class="logo">COGNITA</div><h3>${esc(p.nombre || cod)}</h3>
    <table class="hd"><tr><td class="l">PROYECTO</td><td>${esc(cod)}</td></tr>
      <tr><td class="l">CLASIFICACIÓN</td><td>${esc(p.categoria || "—")}</td></tr>
      <tr><td class="l">AÑO FISCAL</td><td>${fyLabel(fyDeProyecto(cod))}</td></tr></table>
    <table class="blk" style="margin:8px 0 14px">
      <tr><td class="l"></td><td class="u">CLP</td><td class="u">M$ CLP</td></tr>
      <tr><td class="l">PRESUPUESTO TOTAL</td><td class="v">${nf(p.ppto || 0)}</td><td class="v">${M(p.ppto)}</td></tr>
      <tr><td class="l">COMPROMETIDO TOTAL</td><td class="v">${nf(D.comprometido)}</td><td class="v">${M(D.comprometido)}</td></tr>
      <tr><td class="l">SALDO DISPONIBLE</td><td class="v">${nf((p.ppto || 0) - D.comprometido)}</td><td class="v">${M((p.ppto || 0) - D.comprometido)}</td></tr>
    </table>
    <table class="det"><thead><tr>
      <th class="l">ORDEN DE COMPRA</th><th class="l">PROVEEDOR</th><th class="l">DESCRIPCIÓN</th><th>OC ORIGINAL</th><th>OC CORREGIDA</th><th>FECHA</th><th class="l">DOCUMENTO</th><th>FACTURADO</th><th>SALDOS</th><th>DIF</th>
    </tr></thead><tbody>${filas}
      <tr class="tot"><td></td><td></td><td>TOTAL</td><td class="num">${nf(D.comprometido)}</td><td class="num">${nf(D.comprometido)}</td><td></td><td></td><td class="num">${nf(D.facturado)}</td><td class="num">${nf(D.comprometido - D.facturado)}</td><td class="num">0</td></tr>
    </tbody></table></div>`;
}

function htmlResumen(fy) {
  const conMeses = !!fy;
  const cods = proyectosDeFy(fy);
  const items = cods.map(c => { const d = datosProyecto(c); return { c, p: d.p, sede: sedeDeProyecto(c), comp: d.comprometido, fact: d.facturado, ppto: d.p.ppto || 0, fl: conMeses ? flujoProyecto(c, fy) : null }; })
    .sort((a, b) => String(a.p.categoria || "ZZ").localeCompare(String(b.p.categoria || "ZZ")) || String(a.c).localeCompare(String(b.c)));
  const g = { ppto: 0, comp: 0, fact: 0, pf: 0, sal: 0, m: new Array(12).fill(0) };
  let filas = "";
  for (const it of items) {
    const pf = it.comp - it.fact, sal = it.ppto - it.comp;
    g.ppto += it.ppto; g.comp += it.comp; g.fact += it.fact; g.pf += pf; g.sal += sal; if (conMeses) it.fl.forEach((v, m) => g.m[m] += v);
    filas += `<tr><td class="c">${esc(it.sede)}</td><td>${esc(it.c)}</td><td class="desc">${esc(it.p.nombre || "")}</td><td class="desc">${esc(it.p.categoria || "")}</td>
      <td class="num">${nf(it.ppto)}</td><td class="num">${nf(it.comp)}</td><td class="num amar">${nf(it.fact)}</td><td class="num">${nf(pf)}</td><td class="num">${nf(sal)}</td>
      ${conMeses ? it.fl.map(v => `<td class="num">${v ? nf(v) : ""}</td>`).join("") : ""}</tr>`;
  }
  const totMes = conMeses ? g.m.map(v => `<td class="num">${v ? nf(v) : ""}</td>`).join("") : "";
  const titulo = conMeses ? `Resumen ${fyLabel(fy)} · flujo de caja por mes (facturado)` : `Resumen · todos los proyectos (${items.length})`;
  return `${PVCSS}<div class="pv"><h3>${titulo}</h3>
    <table class="det"><thead><tr>
      <th class="l">COLEGIO</th><th class="l">CÓDIGO</th><th class="l">PROYECTO</th><th class="l">CLASIFICACIÓN</th>
      <th>PPTO</th><th>COMPROMETIDO</th><th>FACTURADO</th><th>POR FACTURAR</th><th>SALDO</th>
      ${conMeses ? MESES_FY.map(m => `<th>${m}</th>`).join("") : ""}
    </tr></thead><tbody>${filas}
      <tr class="tot"><td></td><td></td><td>TOTAL${conMeses ? " " + fyLabel(fy) : ""}</td><td></td>
        <td class="num">${nf(g.ppto)}</td><td class="num">${nf(g.comp)}</td><td class="num">${nf(g.fact)}</td><td class="num">${nf(g.pf)}</td><td class="num">${nf(g.sal)}</td>${totMes}</tr>
    </tbody></table>
    ${conMeses ? `<p style="font-size:11px;color:#666;margin-top:8px">El flujo mensual muestra lo <b>facturado</b> en cada mes según la fecha de la factura. La proyección de lo pendiente por facturar se puede cargar a mano en el Excel.</p>` : `<p style="font-size:11px;color:#666;margin-top:8px">Están todos los proyectos, de todos los años. Elige un año fiscal arriba para ver el flujo de caja mes a mes.</p>`}</div>`;
}

/* ---------------- Excel: estilos y armado de hojas ---------------- */
function xb() { return { style: "thin", color: { rgb: "BFBFBF" } }; }
const XBORDE = { top: xb(), bottom: xb(), left: xb(), right: xb() };
const XS = {
  titulo: { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } },
  logo: { font: { bold: true, sz: 12, color: { rgb: "ED7D31" } }, alignment: { horizontal: "right" } },
  lbl: { font: { bold: true } },
  uni: { font: { bold: true }, alignment: { horizontal: "right" } },
  blq: { fill: { patternType: "solid", fgColor: { rgb: "DDEBF7" } }, alignment: { horizontal: "right" }, border: XBORDE },
  th: { font: { bold: true, sz: 9, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F3864" } }, alignment: { wrapText: true, vertical: "center", horizontal: "center" }, border: XBORDE },
  ocT: { fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } }, border: XBORDE, alignment: { vertical: "top" } },
  amar: { fill: { patternType: "solid", fgColor: { rgb: "FFC000" } }, font: { bold: true }, alignment: { horizontal: "right" }, border: XBORDE },
  amar2: { fill: { patternType: "solid", fgColor: { rgb: "FFE08A" } }, alignment: { horizontal: "right" }, border: XBORDE },
  num: { alignment: { horizontal: "right" }, border: XBORDE },
  cen: { alignment: { horizontal: "center" }, border: XBORDE },
  txt: { border: XBORDE },
  sub: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "E9EDF5" } }, border: XBORDE },
  tot: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F3864" } }, alignment: { horizontal: "right" }, border: XBORDE }
};
const Z = "#,##0";
function mkPut(ws) {
  return (addr, val, opt = {}) => {
    const c = {};
    if (opt.f) { c.t = "n"; c.f = opt.f; if (val !== undefined && val !== null) c.v = val; }
    else if (typeof val === "number") { c.t = "n"; c.v = val; }
    else { c.t = "s"; c.v = val == null ? "" : String(val); }
    if (opt.z) c.z = opt.z; if (opt.s) c.s = opt.s;
    ws[addr] = c;
  };
}
const cc = (r, c) => XLSX.utils.encode_cell({ r, c });

function hojaProyectoWS(cod) {
  const D = datosProyecto(cod), p = D.p;
  const ws = {}, merges = [], put = mkPut(ws);
  put("K1", "COGNITA", { s: XS.logo });
  put("A2", p.nombre || cod, { s: XS.titulo }); merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 10 } });
  put("C7", "PROYECTO", { s: XS.lbl }); put("D7", cod, { s: XS.lbl });
  put("C8", "CLASIFICACIÓN", { s: XS.lbl }); put("D8", p.categoria || "");
  put("E10", "CLP", { s: XS.uni }); put("F10", "M$ CLP", { s: XS.uni });
  put("D11", "PRESUPUESTO TOTAL", { s: XS.lbl }); put("E11", p.ppto || 0, { z: Z, s: XS.blq }); put("F11", (p.ppto || 0) / 1000, { f: "E11/1000", z: Z, s: XS.blq });
  const HEAD = ["", "ORDEN DE COMPRA", "PROVEEDOR", "DESCRIPCIÓN", "OC ORIGINAL", "OC CORREGIDA", "FECHA", "DOCUMENTO", "FACTURADO", "SALDOS", "DIF"];
  HEAD.forEach((h, i) => put(cc(18, i), h, { s: XS.th }));
  let r = 20; const ocRows = [];
  for (const o of D.ocs) {
    const r0 = r, R1 = r0 + 1, nf0 = o.facs.length; ocRows.push(r0);
    put(cc(r0, 1), o.oc, { s: { ...XS.ocT, font: { bold: true } } });
    put(cc(r0, 2), o.prov, { s: XS.ocT });
    put(cc(r0, 3), o.desc, { s: XS.ocT });
    if (o.orig !== null) {
      put(`E${R1}`, o.orig, { z: Z, s: XS.num });
      put(`F${R1}`, o.corr, { f: `E${R1}`, z: Z, s: XS.num });
      put(`J${R1}`, o.saldo, { f: `F${R1}-I${R1}`, z: Z, s: XS.num });
      put(`K${R1}`, o.dif, { f: `E${R1}-F${R1}`, z: Z, s: XS.num });
    }
    if (nf0) put(`I${R1}`, o.facturado, { f: `SUM(I${R1 + 1}:I${R1 + nf0})`, z: Z, s: XS.amar });
    else put(`I${R1}`, 0, { z: Z, s: XS.amar });
    o.facs.forEach((f, k) => { const rr = r0 + 1 + k; put(cc(rr, 6), f.fecha, { s: XS.cen }); put(cc(rr, 7), f.doc, { s: XS.txt }); put(`I${rr + 1}`, f.monto, { z: Z, s: XS.amar2 }); });
    r = r0 + 1 + nf0;
  }
  const sum = col => ocRows.map(rr => `${col}${rr + 1}`).join(",");
  put("D12", "COMPROMETIDO TOTAL", { s: XS.lbl });
  put("E12", D.comprometido, { f: ocRows.length ? `SUM(${sum("F")})` : undefined, z: Z, s: XS.blq });
  put("F12", D.comprometido / 1000, { f: "E12/1000", z: Z, s: XS.blq });
  put("D13", "SALDO DISPONIBLE CONSTRUCCIÓN", { s: XS.lbl });
  put("E13", (p.ppto || 0) - D.comprometido, { f: "E11-E12", z: Z, s: XS.blq });
  put("F13", ((p.ppto || 0) - D.comprometido) / 1000, { f: "E13/1000", z: Z, s: XS.blq });
  const rt = r;
  put(cc(rt, 3), "TOTAL", { s: { ...XS.tot, alignment: { horizontal: "left" } } });
  put(`E${rt + 1}`, D.comprometido, { f: ocRows.length ? `SUM(${sum("E")})` : undefined, z: Z, s: XS.tot });
  put(`F${rt + 1}`, D.comprometido, { f: ocRows.length ? `SUM(${sum("F")})` : undefined, z: Z, s: XS.tot });
  put(`I${rt + 1}`, D.facturado, { f: ocRows.length ? `SUM(${sum("I")})` : undefined, z: Z, s: XS.tot });
  put(`J${rt + 1}`, D.comprometido - D.facturado, { f: ocRows.length ? `SUM(${sum("J")})` : undefined, z: Z, s: XS.tot });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rt + 1, c: 10 } });
  ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 52 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 14 }, { wch: 8 }];
  ws["!merges"] = merges;
  return ws;
}

function hojaResumenWS(fy, cods) {
  const conMeses = !!fy;
  const ws = {}, put = mkPut(ws);
  put("A1", "RESUMEN " + (fy ? fyLabel(fy) : "· TODOS LOS AÑOS"), { s: { font: { bold: true, sz: 14 } } });
  const HEAD = ["COLEGIO", "CÓDIGO", "PROYECTO", "CLASIFICACIÓN", "PPTO", "COMPROMETIDO", "FACTURADO", "POR FACTURAR", "SALDO", ...(conMeses ? MESES_FY : [])];
  HEAD.forEach((h, i) => put(cc(2, i), h, { s: XS.th }));
  const items = cods.map(c => { const d = datosProyecto(c); return { c, p: d.p, sede: sedeDeProyecto(c), comp: d.comprometido, fact: d.facturado, ppto: d.p.ppto || 0, fl: conMeses ? flujoProyecto(c, fy) : null }; })
    .sort((a, b) => String(a.p.categoria || "ZZ").localeCompare(String(b.p.categoria || "ZZ")) || String(a.c).localeCompare(String(b.c)));
  let r = 3; const g = { ppto: 0, comp: 0, fact: 0, pf: 0, sal: 0, m: new Array(12).fill(0) };
  for (const it of items) {
    const pf = it.comp - it.fact, sal = it.ppto - it.comp;
    g.ppto += it.ppto; g.comp += it.comp; g.fact += it.fact; g.pf += pf; g.sal += sal; if (conMeses) it.fl.forEach((v, m) => g.m[m] += v);
    put(cc(r, 0), it.sede, { s: XS.cen }); put(cc(r, 1), it.c, { s: XS.txt }); put(cc(r, 2), it.p.nombre || "", { s: XS.txt }); put(cc(r, 3), it.p.categoria || "", { s: XS.txt });
    [it.ppto, it.comp].forEach((v, k) => put(cc(r, 4 + k), v, { z: Z, s: XS.num }));
    put(cc(r, 6), it.fact, { z: Z, s: XS.amar });
    [pf, sal].forEach((v, k) => put(cc(r, 7 + k), v, { z: Z, s: XS.num }));
    if (conMeses) it.fl.forEach((v, m) => put(cc(r, 9 + m), v, { z: Z, s: XS.num }));
    r++;
  }
  put(cc(r, 2), "TOTAL" + (conMeses ? " " + fyLabel(fy) : ""), { s: { ...XS.tot, alignment: { horizontal: "left" } } });
  [g.ppto, g.comp, g.fact, g.pf, g.sal].forEach((v, k) => put(cc(r, 4 + k), v, { z: Z, s: XS.tot }));
  if (conMeses) g.m.forEach((v, m) => put(cc(r, 9 + m), v, { z: Z, s: XS.tot }));
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: conMeses ? 8 + 12 : 8 } });
  ws["!cols"] = [{ wch: 8 }, { wch: 13 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, ...(conMeses ? MESES_FY.map(() => ({ wch: 11 })) : [])];
  return ws;
}

/* ---------------- exportaciones ---------------- */
function nombreHoja(cod) { return String(cod).slice(0, 31).replace(/[\\/?*\[\]:]/g, "-"); }
function exportarHojaProyecto(cod) {
  if (typeof XLSX === "undefined") { toast("La librería de Excel no cargó: revisa tu conexión y reintenta"); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaProyectoWS(cod), nombreHoja(cod));
  XLSX.writeFile(wb, `Proyecto_${cod}_${hoyIso().replace(/-/g, "")}.xlsx`);
  toast(`Hoja de ${cod} exportada a Excel`);
}
function exportarLibroFY(fy) {                             // fy null = todos los años
  if (typeof XLSX === "undefined") { toast("La librería de Excel no cargó: revisa tu conexión y reintenta"); return; }
  const cods = proyectosDeFy(fy);
  if (!cods.length) { toast(fy ? `No hay proyectos en ${fyLabel(fy)}` : "No hay proyectos para exportar"); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaResumenWS(fy, cods), fy ? "RESUMEN " + fyLabel(fy) : "RESUMEN");
  const usados = {};
  cods.forEach(c => { let n = nombreHoja(c) || "PROYECTO"; while (usados[n]) n = n.slice(0, 28) + "_" + (Object.keys(usados).length); usados[n] = 1; XLSX.utils.book_append_sheet(wb, hojaProyectoWS(c), n); });
  const suf = fy ? fyLabel(fy) : "todos";
  XLSX.writeFile(wb, `Libro_Proyectos_${suf}_${hoyIso().replace(/-/g, "")}.xlsx`);
  toast(fy ? `Libro de ${fyLabel(fy)} exportado: ${cods.length} proyecto(s) + resumen` : `Libro exportado: ${cods.length} proyecto(s) de todos los años + resumen`);
}
</script>
