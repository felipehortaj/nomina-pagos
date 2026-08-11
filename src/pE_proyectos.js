<script>
"use strict";
/* =========================================================================
   PROYECTOS Y PRESUPUESTO
   Cruza las OC y las facturas que la app ya tiene con el presupuesto y la
   categoría de cada proyecto, y exporta la hoja de control por proyecto en el
   formato del Excel anual (bloque de presupuesto + OC → facturas → saldo).
   El presupuesto y la categoría se cargan acá (la app no los conoce solos).
   ========================================================================= */

const CATEGORIAS = ["DEVELOPMENT CAPEX", "ENHANCEMENT", "MANTENCIÓN", "GASTOS"];

/* un código de proyecto (HUECN26501) no es una cuenta contable (68500) */
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
    if (!proyectoPorCodigo(cod)) { db.proyectos.push({ codigo: cod, nombre: "", categoria: "", ppto: null }); nuevos++; }
  });
  setDirty(); render();
  toast(nuevos ? `${nuevos} proyecto(s) detectado(s) de las OC y facturas` : "No hay proyectos nuevos por detectar");
}

/* facturas de una OC (por número), de todas las nóminas del historial */
function facturasDeOc(ocNum) {
  const out = [];
  todasLasFacturas().forEach(({ f }) => {
    if (f.oc && up(f.oc) === up(ocNum)) out.push({ fecha: f.fecha || "", doc: (f.exenta ? "FAEX " : "FAE ") + (f.doc || ""), monto: f.total || 0 });
  });
  return out;
}

/* agrega todo lo necesario para armar la hoja de control del proyecto */
function datosProyecto(cod) {
  const p = proyectoPorCodigo(cod) || { codigo: cod, nombre: "", categoria: "", ppto: null };
  const ocs = (db.cat.oc || []).filter(o => String(o.proy || "").trim() === cod).map(o => {
    const facs = facturasDeOc(o.oc);
    const facturado = facs.reduce((s, x) => s + x.monto, 0);
    const orig = (o.monto === null || o.monto === undefined) ? null : o.monto;
    const corr = orig;                                   // corregida = original (el ajuste manual queda para fase 2)
    return {
      oc: o.oc, prov: proveedorTxt(o.rut) || "", desc: o.glosa || "", orig, corr, facs, facturado,
      saldo: corr === null ? null : corr - facturado, dif: (orig === null || corr === null) ? 0 : orig - corr
    };
  }).sort((a, b) => String(a.oc).localeCompare(String(b.oc)));
  const comprometido = ocs.reduce((s, o) => s + (o.corr || 0), 0);
  const facturado = ocs.reduce((s, o) => s + o.facturado, 0);
  return { p, ocs, comprometido, facturado, saldoDisp: (p.ppto || 0) - comprometido };
}

/* ---------------- pantalla ---------------- */
function renderProyectos() {
  const tb = document.querySelector("#tblProy tbody"); if (!tb) return;
  const pill = document.getElementById("pillProy");
  const lista = (db.proyectos || []);
  if (pill) pill.textContent = lista.length;
  tb.innerHTML = lista.map((p, i) => {
    const d = datosProyecto(p.codigo);
    const opts = ["", ...CATEGORIAS].map(c => `<option value="${c}"${(p.categoria || "") === c ? " selected" : ""}>${c || "— elegir —"}</option>`).join("");
    const sobre = p.ppto && d.comprometido > p.ppto;
    return `<tr data-i="${i}" data-cod="${esc(p.codigo)}">
      <td class="mono">${esc(p.codigo)}</td>
      <td class="edit" data-f="nombre" contenteditable>${esc(p.nombre || "")}</td>
      <td><select data-f="categoria">${opts}</select></td>
      <td class="num edit" data-f="ppto" contenteditable>${p.ppto ? nf(p.ppto) : ""}</td>
      <td class="num">${nf(d.comprometido)}</td>
      <td class="num">${nf(d.facturado)}</td>
      <td class="num${sobre ? " neg" : ""}">${p.ppto ? nf(d.saldoDisp) : "—"}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-exportproy="${esc(p.codigo)}" title="Descargar la hoja de este proyecto en Excel">Excel</button></td></tr>`;
  }).join("") || `<tr><td colspan="8" class="muted" style="padding:14px">Aún no hay proyectos. Usa «Detectar proyectos» para traerlos de las OC y las facturas ya cargadas.</td></tr>`;
}

/* ---------------- eventos ---------------- */
if (document.getElementById("btnDetectarProy")) {
  document.getElementById("btnDetectarProy").addEventListener("click", detectarProyectos);
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
    p[sel.dataset.f] = sel.value; setDirty(); render();
  });
  tp.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-exportproy]"); if (!b) return;
    exportarHojaProyecto(b.dataset.exportproy);
  });
}

/* ---------------- exportación a Excel (formato del libro anual) ---------------- */
function exportarHojaProyecto(cod) {
  if (typeof XLSX === "undefined") { toast("La librería de Excel no cargó: revisa tu conexión y reintenta"); return; }
  const D = datosProyecto(cod), p = D.p;
  const BORDE = { top: b(), bottom: b(), left: b(), right: b() };
  function b() { return { style: "thin", color: { rgb: "BFBFBF" } }; }
  const Z = "#,##0";
  const S = {
    titulo: { font: { bold: true, sz: 13 }, alignment: { horizontal: "center" } },
    logo: { font: { bold: true, sz: 12, color: { rgb: "ED7D31" } }, alignment: { horizontal: "right" } },
    sub: { font: { italic: true, color: { rgb: "808080" } } },
    lbl: { font: { bold: true } },
    uni: { font: { bold: true }, alignment: { horizontal: "right" } },
    blq: { fill: { patternType: "solid", fgColor: { rgb: "DDEBF7" } }, alignment: { horizontal: "right" }, border: BORDE },
    th: { font: { bold: true, sz: 9, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F3864" } }, alignment: { wrapText: true, vertical: "center" }, border: BORDE },
    ocT: { fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } }, border: BORDE, alignment: { vertical: "top" } },
    ocN: { fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } }, border: BORDE, alignment: { horizontal: "right" }, font: { bold: false } },
    amar: { fill: { patternType: "solid", fgColor: { rgb: "FFC000" } }, font: { bold: true }, alignment: { horizontal: "right" }, border: BORDE },
    amar2: { fill: { patternType: "solid", fgColor: { rgb: "FFE08A" } }, alignment: { horizontal: "right" }, border: BORDE },
    num: { alignment: { horizontal: "right" }, border: BORDE },
    cen: { alignment: { horizontal: "center" }, border: BORDE },
    txt: { border: BORDE },
    tot: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F3864" } }, alignment: { horizontal: "right" } }
  };
  const ws = {}, merges = [];
  const put = (addr, val, opt = {}) => {
    const c = {};
    if (opt.f) { c.t = "n"; c.f = opt.f; if (val !== undefined && val !== null) c.v = val; }
    else if (typeof val === "number") { c.t = "n"; c.v = val; }
    else { c.t = "s"; c.v = val == null ? "" : String(val); }
    if (opt.z) c.z = opt.z;
    if (opt.s) c.s = opt.s;
    ws[addr] = c;
  };

  put("K1", "COGNITA", { s: S.logo });
  put("A2", p.nombre || cod, { s: S.titulo }); merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 10 } });
  put("C7", "PROYECTO", { s: S.lbl }); put("D7", cod, { s: S.lbl });
  put("C8", "CLASIFICACIÓN", { s: S.lbl }); put("D8", p.categoria || "");
  put("E10", "CLP", { s: S.uni }); put("F10", "M$ CLP", { s: S.uni });
  put("D11", "PRESUPUESTO TOTAL", { s: S.lbl }); put("E11", p.ppto || 0, { z: Z, s: S.blq }); put("F11", (p.ppto || 0) / 1000, { f: "E11/1000", z: Z, s: S.blq });

  const HEAD = ["", "ORDEN DE COMPRA", "PROVEEDOR", "DESCRIPCIÓN", "OC ORIGINAL", "OC CORREGIDA", "FECHA", "DOCUMENTO", "FACTURADO", "SALDOS", "DIF"];
  HEAD.forEach((h, i) => put(XLSX.utils.encode_cell({ r: 18, c: i }), h, { s: S.th }));

  let r = 20;                                            // fila 21 (0-indexed 20): primera OC
  const ocRows = [];
  const cel = (r0, c) => XLSX.utils.encode_cell({ r: r0, c });
  for (const o of D.ocs) {
    const r0 = r, R1 = r0 + 1, nf = o.facs.length;       // R1 = fila 1-indexed de la OC
    ocRows.push(r0);
    put(cel(r0, 1), o.oc, { s: { ...S.ocT, font: { bold: true } } });
    put(cel(r0, 2), o.prov, { s: S.ocT });
    put(cel(r0, 3), o.desc, { s: S.ocT });
    if (o.orig !== null) {
      put(`E${R1}`, o.orig, { z: Z, s: S.num });
      put(`F${R1}`, o.corr, { f: `E${R1}`, z: Z, s: S.num });
      put(`J${R1}`, o.saldo, { f: `F${R1}-I${R1}`, z: Z, s: S.num });
      put(`K${R1}`, o.dif, { f: `E${R1}-F${R1}`, z: Z, s: S.num });
    }
    // FACTURADO de la OC (celda amarilla fuerte) = suma de sus facturas, que van debajo
    if (nf) put(`I${R1}`, o.facturado, { f: `SUM(I${R1 + 1}:I${R1 + nf})`, z: Z, s: S.amar });
    else    put(`I${R1}`, 0, { z: Z, s: S.amar });
    // una fila por factura, debajo de la OC
    o.facs.forEach((f, k) => {
      const rr = r0 + 1 + k;
      put(cel(rr, 6), f.fecha, { s: S.cen });
      put(cel(rr, 7), f.doc, { s: S.txt });
      put(`I${rr + 1}`, f.monto, { z: Z, s: S.amar2 });
    });
    r = r0 + 1 + nf;                                      // siguiente bloque: fila OC + sus facturas
  }

  const sum = col => ocRows.map(rr => `${col}${rr + 1}`).join(",");
  put("D12", "COMPROMETIDO TOTAL", { s: S.lbl });
  put("E12", D.comprometido, { f: ocRows.length ? `SUM(${sum("F")})` : undefined, z: Z, s: S.blq });
  put("F12", D.comprometido / 1000, { f: "E12/1000", z: Z, s: S.blq });
  put("D13", "SALDO DISPONIBLE CONSTRUCCIÓN", { s: S.lbl });
  put("E13", (p.ppto || 0) - D.comprometido, { f: "E11-E12", z: Z, s: S.blq });
  put("F13", ((p.ppto || 0) - D.comprometido) / 1000, { f: "E13/1000", z: Z, s: S.blq });

  const rt = r;                                          // fila de totales
  put(XLSX.utils.encode_cell({ r: rt, c: 3 }), "TOTAL", { s: { ...S.tot, alignment: { horizontal: "left" } } });
  put(`E${rt + 1}`, D.comprometido, { f: ocRows.length ? `SUM(${sum("E")})` : undefined, z: Z, s: S.tot });
  put(`F${rt + 1}`, D.comprometido, { f: ocRows.length ? `SUM(${sum("F")})` : undefined, z: Z, s: S.tot });
  put(`I${rt + 1}`, D.facturado, { f: ocRows.length ? `SUM(${sum("I")})` : undefined, z: Z, s: S.tot });
  put(`J${rt + 1}`, D.comprometido - D.facturado, { f: ocRows.length ? `SUM(${sum("J")})` : undefined, z: Z, s: S.tot });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rt + 1, c: 10 } });
  ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 52 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 13 }, { wch: 16 }, { wch: 14 }, { wch: 8 }];
  ws["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  const nombreHoja = String(cod).slice(0, 31).replace(/[\\/?*\[\]:]/g, "-");
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, `Proyecto_${cod}_${hoyIso().replace(/-/g, "")}.xlsx`);
  toast(`Hoja de ${cod} exportada a Excel`);
}
</script>
