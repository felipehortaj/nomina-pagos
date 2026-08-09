<script>
"use strict";
/* =========================================================================
   BIBLIOTECA DE ÓRDENES DE COMPRA — pensada para cientos de registros
   ========================================================================= */
let libSede = "", libQ = "", libProv = "", libEstado = "saldo", libOrden = "reciente";
let libTope = 60;
const libSel = new Set();

function ocFila(o) {                                  // datos derivados de una OC del catálogo
  const p = provPorRut(o.rut);
  const lib = ocLiberado(o.oc);
  const saldo = o.monto ? o.monto - lib : null;
  const pct = o.monto ? lib / o.monto : null;
  const eps = db.eepp.filter(e => ocKey(e.oc) === ocKey(o.oc));
  const facs = todasLasFacturas().filter(({ f }) => ocKey(f.oc) === ocKey(o.oc));
  const ult = eps.map(e => e.ep).filter(Boolean).slice(-1)[0]
    || (facs.length ? `${facs.length} factura(s)` : "");
  return { o, p, lib, saldo, pct, nEps: eps.length + facs.length, ult };
}
function libFiltradas() {
  const q = up(libQ).trim(), partes = q ? q.split(/\s+/) : [];
  const out = db.cat.oc.map(ocFila).filter(({ o, p, saldo }) => {
    if (libSede && o.sede !== libSede) return false;
    if (libProv && fmtRut(o.rut) !== fmtRut(libProv)) return false;
    if (libEstado === "saldo" && !(o.monto && saldo > 0)) return false;
    if (libEstado === "agotadas" && !(o.monto && saldo <= 0)) return false;
    if (libEstado === "sinmonto" && o.monto) return false;
    if (!partes.length) return true;
    const soc = socPorSede(o.sede);
    const heno = up([o.oc, o.proy, o.cta || "", o.sede, o.glosa || "", o.rut,
      p ? p.nombre : "", p ? p.cod : "", soc ? soc.nombre : ""].join(" "));
    return partes.every(t => heno.includes(t));
  });
  const cmp = {
    reciente: (a, b) => String(b.o.visto || "").localeCompare(String(a.o.visto || "")) || String(b.o.oc).localeCompare(String(a.o.oc)),
    saldo: (a, b) => (b.saldo || 0) - (a.saldo || 0),
    oc: (a, b) => String(a.o.oc).localeCompare(String(b.o.oc)),
    prov: (a, b) => String(a.p ? a.p.nombre : "").localeCompare(String(b.p ? b.p.nombre : ""))
  }[libOrden];
  return out.sort(cmp);
}
function renderLib() {
  if (!$("#tblLib")) return;
  /* chips por colegio, con el conteo de cada uno */
  const porSede = {};
  db.cat.oc.forEach(o => { porSede[o.sede || "—"] = (porSede[o.sede || "—"] || 0) + 1; });
  const sedes = db.cat.soc.map(s => s.sede).filter(s => porSede[s]);
  if (porSede["—"]) sedes.push("—");
  $("#libSedes").innerHTML = [`<button class="chip ${libSede === "" ? "on" : ""}" data-libsede="">Todos los colegios <span class="n">${db.cat.oc.length}</span></button>`]
    .concat(sedes.map(s => `<button class="chip ${libSede === s ? "on" : ""}" data-libsede="${esc(s)}">${esc(s)} <span class="n">${porSede[s]}</span></button>`)).join("");
  /* proveedores presentes en el catálogo */
  const ruts = [...new Set(db.cat.oc.map(o => fmtRut(o.rut)).filter(Boolean))];
  const selP = $("#libProv");
  const provs = ruts.map(r => ({ r, n: provPorRut(r)?.nombre || r })).sort((a, b) => a.n.localeCompare(b.n));
  selP.innerHTML = `<option value="">Todos los proveedores</option>` +
    provs.map(x => `<option value="${esc(x.r)}"${x.r === libProv ? " selected" : ""}>${esc(x.n)}</option>`).join("");
  /* filas */
  const todas = libFiltradas();
  const vista = todas.slice(0, libTope);
  $("#tblLib tbody").innerHTML = vista.map(({ o, p, lib, saldo, pct, ult }) => {
    const clase = pct === null ? "" : pct >= 1.0001 ? "over" : pct >= 0.999 ? "full" : "";
    return `<tr data-librow="${esc(o.oc)}" class="${libSel.has(ocKey(o.oc)) ? "sel" : ""}">
      <td><input type="checkbox" class="ckl" data-libck="${esc(o.oc)}"${libSel.has(ocKey(o.oc)) ? " checked" : ""}></td>
      <td class="mono"><b>${esc(o.oc)}</b></td>
      <td>${esc(o.sede || "")}</td>
      <td class="small">${esc(p ? p.nombre : (o.rut || "—"))}</td>
      <td class="mono small">${esc(o.proy || (o.cta ? "cta " + o.cta : ""))}</td>
      <td class="num">${nf(o.monto)}</td>
      <td class="num">${lib ? nf(lib) : ""}</td>
      <td class="num"${saldo !== null && saldo < 0 ? ' style="color:var(--crit);font-weight:600"' : ""}>${saldo === null ? "" : nf(saldo)}</td>
      <td>${pct === null ? `<span class="muted small">sin monto</span>`
        : `<div class="barra" title="${(pct * 100).toFixed(1)}% liberado"><i class="${clase}" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div>`}</td>
      <td class="small">${esc(ult)}</td>
      <td class="wrap small muted">${esc((o.glosa || "").slice(0, 90))}</td>
      <td style="white-space:nowrap">
        <button class="btn sm primary" data-libep="${esc(o.oc)}">Nuevo EP</button>
        ${o.pdf ? `<button class="btn sm ghost" data-libpdf="${esc(o.oc)}" title="Ver la OC original">📄</button>` : ""}
      </td></tr>`;
  }).join("") || `<tr><td colspan="12" class="muted" style="padding:16px">Ninguna orden de compra coincide con el filtro. Cárgalas con <b>Cargar OC desde PDF</b> o revisa los filtros.</td></tr>`;
  $("#libPagina").textContent = todas.length
    ? `mostrando ${Math.min(libTope, todas.length)} de ${todas.length} · saldo total ${money(todas.reduce((s, x) => s + (x.saldo || 0), 0))}`
    : "";
  $("#btnLibMas").classList.toggle("hide", todas.length <= libTope);
  refrescarBarraLote();
  const info = $("#ocLibInfo");
  if (info) {
    const conSaldo = db.cat.oc.map(ocFila).filter(x => x.o.monto && x.saldo > 0).length;
    info.textContent = `${db.cat.oc.length} órdenes · ${conSaldo} con saldo`;
  }
  const pill = $("#pillOc");
  if (pill) pill.textContent = db.cat.oc.length;
}

function refrescarBarraLote() {
  const n = libSel.size;
  const barra = $("#libLote");
  if (!barra) return;
  barra.style.display = n ? "flex" : "none";
  const seleccion = db.cat.oc.filter(o => libSel.has(ocKey(o.oc)));
  const saldo = seleccion.reduce((s, o) => { const f = ocFicha(o.oc); return s + (f.saldo || 0); }, 0);
  $("#libLoteTxt").textContent = n
    ? `${n} orden(es) seleccionada(s) · saldo ${nf(saldo)}` : "";
}

/* =========================================================================
   ESTADOS DE PAGO EN LOTE
   ========================================================================= */
let lote = [];
function abrirLote(ocs, pctComun) {
  const pct = pctComun === null || pctComun === undefined || isNaN(pctComun) ? null : pctComun;
  lote = ocs.map(oc => {
    const f = ocFicha(oc);
    const c = f.c || {};
    const p = f.p;
    const previos = db.eepp.filter(e => ocKey(e.oc) === ocKey(oc)).length
      + todasLasFacturas().filter(({ f: x }) => ocKey(x.oc) === ocKey(oc)).length;
    const base = f.monto;
    const neto = pct !== null && base ? Math.round(base * pct) : (f.saldo !== null && f.saldo > 0 ? f.saldo : null);
    return {
      oc, sede: c.sede || sedeDeOc(oc), proy: c.proy || "", cta: c.cta || "",
      rut: p ? p.rut : (c.rut || ""), vendor: p ? p.cod : "",
      base, saldo: f.saldo, pct: pct !== null ? pct : (base && neto ? neto / base : null),
      neto, exenta: !!c.exenta, ep: "EP_" + (previos + 1), glosa: c.glosa || ""
    };
  });
  $("#cardLote").classList.remove("hide");
  renderLote();
  $("#cardLote").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderLote() {
  if (!lote.length) { $("#cardLote").classList.add("hide"); return; }
  $("#tblLote tbody").innerHTML = lote.map((l, i) => {
    const iva = l.exenta ? 0 : ivaDe(l.neto || 0);
    const total = (l.neto || 0) + iva;
    const quedaria = l.saldo === null || l.neto === null ? null : l.saldo - l.neto;
    return `<tr data-lote="${i}">
      <td class="mono"><b>${esc(l.oc)}</b></td>
      <td>${esc(l.sede || "")}</td>
      <td class="small">${esc(provPorRut(l.rut)?.nombre || l.rut || "—")}</td>
      <td class="edit" data-f="ep" contenteditable>${esc(l.ep)}</td>
      <td class="num">${nf(l.base)}</td>
      <td class="num"${quedaria !== null && quedaria < 0 ? ' style="color:var(--crit);font-weight:600"' : ""}>${nf(l.saldo)}</td>
      <td class="num edit" data-f="pct" contenteditable>${l.pct === null ? "" : String(+(l.pct * 100).toFixed(4))}</td>
      <td class="num edit" data-f="neto" contenteditable>${nf(l.neto)}</td>
      <td><select data-f="exenta"><option value=""${l.exenta ? "" : " selected"}>19%</option><option value="1"${l.exenta ? " selected" : ""}>exenta</option></select></td>
      <td class="num">${nf(total)}</td>
      <td class="edit wrap small" data-f="glosa" contenteditable>${esc(l.glosa)}</td>
      <td><button class="btn sm ghost danger" data-lotedel="${i}">×</button></td>
    </tr>`;
  }).join("");
  const listos = lote.filter(l => l.neto && l.glosa).length;
  const netoTot = lote.reduce((s, l) => s + (l.neto || 0), 0);
  $("#loteInfo").textContent = `${lote.length} orden(es) · ${listos} listas · neto total ${nf(netoTot)}`;
  const al = [];
  lote.forEach(l => {
    if (!l.neto) al.push({ n: "crit", t: `${l.oc}: falta el neto a facturar` });
    if (!l.glosa) al.push({ n: "crit", t: `${l.oc}: falta la glosa que va en la factura` });
    if (l.saldo !== null && l.neto !== null && l.neto > l.saldo)
      al.push({ n: "warn", t: `${l.oc}: el neto ${nf(l.neto)} supera el saldo ${nf(l.saldo)}` });
    if (!provPorRut(l.rut)) al.push({ n: "warn", t: `${l.oc}: sin proveedor identificado, el correo no sabrá a quién enviarse` });
  });
  alertBox($("#loteAlertas"), al);
}
function recalcLote(i, campo) {
  const l = lote[i];
  if (!l) return;
  if (campo === "pct" && l.base) l.neto = l.pct === null ? null : Math.round(l.base * l.pct);
  if (campo === "neto" && l.base) l.pct = l.neto === null ? null : l.neto / l.base;
}
function crearLote() {
  const malas = lote.filter(l => !l.neto || !l.glosa);
  if (malas.length && !confirm(`${malas.length} orden(es) no tienen neto o glosa y se van a omitir. ¿Seguir con las demás?`)) return;
  const buenas = lote.filter(l => l.neto && l.glosa);
  if (!buenas.length) { toast("Ninguna orden quedó lista"); return; }
  const creados = buenas.map(l => {
    const e = cuadraMontos({
      id: uid(), vendor: l.vendor || "", rut: l.rut || "", oc: l.oc, proy: l.proy || "",
      ir: "", glosa: l.glosa, ep: l.ep, sede: l.sede || "",
      neto: l.neto, exenta: !!l.exenta, base: l.base, pct: l.pct
    });
    db.eepp.push(e);
    if (e.rut && e.sede && e.oc) aprenderOc(e.rut, e.sede, e.oc, "", db.meta.fecha, e.proy);
    return e;
  });
  lote = []; libSel.clear();
  $("#cardLote").classList.add("hide");
  setDirty(); render();
  abrirCorreoProveedor(creados);
  const provs = agrupaPorProveedor(creados).length;
  toast(`${creados.length} estado(s) de pago creados · ${provs} correo(s) por enviar`);
}
function irAEepp() {
  $$("nav.tabs button").forEach(x => x.classList.remove("active"));
  $$("section.panel").forEach(p => p.classList.remove("active"));
  document.querySelector('nav.tabs button[data-tab="eepp"]').classList.add("active");
  $("#tab-eepp").classList.add("active");
  window.scrollTo({ top: 0 });
}
</script>
