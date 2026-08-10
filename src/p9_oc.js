<script>
"use strict";
/* =========================================================================
   ÓRDENES DE COMPRA — catálogo, saldos y buscador
   ========================================================================= */
const ocKey = o => up(String(o || "")).replace(/\s/g, "");

function ocBuscarEnCatalogo(txt) {
  const q = up(txt).trim();
  if (!q) return [];
  const partes = q.split(/\s+/);
  return db.cat.oc.filter(o => {
    const p = provPorRut(o.rut);
    const soc = socPorSede(o.sede);
    const heno = up([o.oc, o.proy, o.sede, o.glosa || "", p ? p.nombre : "", p ? p.cod : "", o.rut,
                     soc ? soc.nombre : "", o.cta || ""].join(" "));
    return partes.every(t => heno.includes(t));
  }).sort((a, b) => (b.visto || "").localeCompare(a.visto || "") || String(a.oc).localeCompare(String(b.oc)))
    .slice(0, 40);
}
/* monto ya liberado de una OC: EEPP sin factura + facturas de la nómina en curso + facturas archivadas */
function ocLiberado(oc, excluirId) {
  const k = ocKey(oc);
  if (!k) return 0;
  let s = 0;
  db.eepp.forEach(e => { if (e.id !== excluirId && ocKey(e.oc) === k && !e.facId) s += e.neto || 0; });
  todasLasFacturas().forEach(({ f }) => { if (ocKey(f.oc) === k) s += f.neto || 0; });
  return s;
}
function ocFicha(oc) {
  const k = ocKey(oc);
  const c = db.cat.oc.find(o => ocKey(o.oc) === k);
  const p = c ? provPorRut(c.rut) : null;
  const monto = c && c.monto ? c.monto : null;
  const liberado = ocLiberado(oc);
  return { c, p, monto, liberado, saldo: monto === null ? null : monto - liberado };
}
function ocFilaBusqueda(o) {
  const p = provPorRut(o.rut);
  const lib = ocLiberado(o.oc);
  const saldo = o.monto ? o.monto - lib : null;
  const pct = o.monto ? (lib / o.monto * 100) : null;
  return `<tr data-ocsel="${esc(o.oc)}">
    <td class="mono">${esc(o.oc)}</td>
    <td class="small">${esc(p ? p.nombre : (o.rut || "—"))}</td>
    <td class="mono">${esc(o.proy || (o.cta ? "cta " + o.cta : ""))}</td>
    <td>${esc(o.sede || "")}</td>
    <td class="num">${nf(o.monto)}</td>
    <td class="num">${lib ? nf(lib) : ""}${pct !== null && lib ? ` <span class="muted small">(${pct.toFixed(0)}%)</span>` : ""}</td>
    <td class="num">${saldo === null ? "" : nf(saldo)}</td>
    <td><button class="btn sm" data-ocpick="${esc(o.oc)}">Usar</button></td>
  </tr>`;
}
function renderOcBusqueda(txt) {
  const res = ocBuscarEnCatalogo(txt);
  if (!txt.trim()) { $("#ocResultados").classList.add("hide"); return; }
  $("#ocResultados").classList.remove("hide");
  $("#tblOcBuscar tbody").innerHTML = res.map(ocFilaBusqueda).join("")
    || `<tr><td colspan="8" class="muted" style="padding:12px">Ninguna orden de compra coincide. Usa <b>Cargar OC desde Excel</b> para traer el reporte de Netsuite, <b>+ Nueva OC</b> para ingresarla a mano, o escríbela completa y pulsa Enter para usarla igual.</td></tr>`;
}
function usarOc(oc) {
  if (typeof modoEp === "function") modoEp("oc");    /* el formulario vive en el modo «desde una OC» */
  const f = ocFicha(oc);
  const c = f.c || {};
  const p = f.p;
  $("#ocFicha").classList.remove("hide");
  $("#ocVacio").classList.add("hide");
  $("#ocResultados").classList.add("hide");
  $("#ocBuscar").value = oc;
  $("#epOc").value = c.oc || oc;
  $("#epProy").value = c.proy || "";
  $("#epSede").value = c.sede || sedeDeOc(oc) || "";
  $("#epProv").value = p ? p.rut : "";
  $("#epVendor").value = p ? (p.cod || "") : "";
  if (!$("#epGlosa").value && c.glosa) $("#epGlosa").value = c.glosa;
  $("#epBase").value = f.monto === null ? "" : nf(f.monto);
  /* estado de pago sugerido: el siguiente número para esta OC */
  const previos = db.eepp.filter(e => ocKey(e.oc) === ocKey(oc)).length
    + todasLasFacturas().filter(({ f }) => ocKey(f.oc) === ocKey(oc)).length;
  if (!$("#epEp").value) $("#epEp").value = "EP_" + String(previos + 1);
  $("#epIvaCond").value = c.exenta ? "exenta" : "afecta";                 // condición de IVA que trae la OC
  epRecalcular();
  pintarFichaOc(oc);
  if (!f.c) toast("Esa OC no está en el catálogo: completa los datos en «Datos que se toman de la orden de compra»");
  else if (f.monto === null) toast("La OC no tiene monto en el catálogo: escribe el neto o el monto base a mano");
}
function pintarFichaOc(oc) {
  const f = ocFicha(oc);
  const p = f.p;
  const partes = [];
  partes.push(`<b>${esc(oc)}</b>`);
  if (p) partes.push(esc((p.cod ? p.cod + " " : "") + p.nombre));
  if (f.c && f.c.proy) partes.push("proyecto " + esc(f.c.proy));
  if (f.c && f.c.cta) partes.push("cuenta " + esc(f.c.cta));
  if (f.c && f.c.sede) partes.push("sede " + esc(f.c.sede));
  if (f.c && f.c.exenta) partes.push(`<span class="tag neutral">OC exenta de IVA</span>`);
  let linea2 = "";
  if (f.monto !== null) {
    const pct = f.monto ? (f.liberado / f.monto * 100) : 0;
    linea2 = `Monto de la OC ${money(f.monto)} · ya liberado ${money(f.liberado)} (${pct.toFixed(1)}%) · <b>saldo ${money(f.saldo)}</b>`;
    if (f.saldo < 0) linea2 += ` <span style="color:var(--crit)"><b>· la OC quedaría sobregirada</b></span>`;
  } else if (f.liberado) {
    linea2 = `Ya liberado ${money(f.liberado)} en esta OC. Sin monto total en el catálogo, no puedo calcular el saldo.`;
  } else {
    linea2 = `Sin monto total en el catálogo: escribe el monto base o directamente el neto a facturar.`;
  }
  $("#ocFichaTxt").innerHTML = partes.join(" · ") + `<br><span class="small">${linea2}</span>`;
}
/* ---------- importar OC desde un archivo, sin pasar por el conector ---------- */
function ocGuardarEnCatalogo(d) {
  if (!d.oc) return null;
  let p = d.rut ? provPorRut(d.rut) : provPorCod(d.vendor);
  if (!p && (d.rut || d.prov || d.vendor)) {
    p = { rut: d.rut ? fmtRut(d.rut) : "", cod: d.vendor || "", nombre: d.prov || "", tipo: "", cta: "", email: "", contacto: "" };
    db.cat.prov.push(p);
  }
  if (p) { if (d.vendor && !p.cod) p.cod = d.vendor; if (d.prov && !p.nombre) p.nombre = d.prov; }
  const datos = {
    oc: d.oc, rut: p ? p.rut : (d.rut || ""),
    sede: d.sede || sedeDeOc(d.oc) || sedeDeProyecto(d.proy),
    proy: d.proy || "", cta: d.cta || "",
    monto: d.monto !== undefined && d.monto !== null ? d.monto : (d.base !== null && d.base !== undefined ? d.base : (d.neto ?? null)),
    glosa: d.glosa || "", exenta: !!d.exenta, visto: db.meta.fecha,
    pdf: d.pdf || "", archivo: d.archivo || ""
  };
  const ex = db.cat.oc.find(o => ocKey(o.oc) === ocKey(d.oc));
  if (ex) {
    Object.keys(datos).forEach(k => { if (datos[k] !== "" && datos[k] !== null) ex[k] = datos[k]; });
    ex.exenta = !!d.exenta;
    return { reg: ex, nueva: false };
  }
  const nuevo = { cta: "", ...datos };
  db.cat.oc.push(nuevo);
  return { reg: nuevo, nueva: true };
}
async function ocImportarArchivo(file) {
  const buf = await leerArchivoBuffer(file);
  const libro = XLSX.read(buf, { cellDates: false });
  let nuevas = 0, act = 0, sinOc = 0, total = 0;
  libro.SheetNames.forEach(hoja => {
    const { hdr, filas, mapa } = xlPrepararLibro(libro, hoja);
    if (mapa.oc === undefined) return;
    filas.forEach(fila => {
      const d = xlFilaAEepp(fila || [], mapa);
      if (!d.glosa && d.neto === null && !d.oc) return;
      total++;
      if (!d.oc) { sinOc++; return; }
      const r = ocGuardarEnCatalogo(d);
      if (r) r.nueva ? nuevas++ : act++;
    });
  });
  setDirty(); render();
  if (!total) { toast("No reconocí una columna de orden de compra en ese archivo. Ábrelo con «Conectar un Excel» para ajustar las columnas."); return false; }
  toast(`Catálogo de OC: ${nuevas} nuevas, ${act} actualizadas${sinOc ? `, ${sinOc} filas sin OC` : ""}`);
  return true;
}

/* ---------- importar órdenes de compra desde una planilla ---------- */
function importarOcDesdeXl() {
  const filas = xlFilasUtiles();
  if (!filas.length) { toast("No hay filas para importar"); return; }
  let nuevas = 0, act = 0, sinOc = 0;
  filas.forEach(({ d }) => {
    if (!d.oc) { sinOc++; return; }
    let p = d.rut ? provPorRut(d.rut) : provPorCod(d.vendor);
    if (!p && (d.rut || d.prov)) {
      p = { rut: d.rut ? fmtRut(d.rut) : "", cod: d.vendor || "", nombre: d.prov || "", tipo: "", cta: "", email: "", contacto: "" };
      if (p.rut || p.cod) db.cat.prov.push(p);
    }
    const ex = db.cat.oc.find(o => ocKey(o.oc) === ocKey(d.oc));
    const datos = {
      oc: d.oc, rut: p ? p.rut : (d.rut || ""), sede: d.sede || sedeDeOc(d.oc) || sedeDeProyecto(d.proy),
      proy: d.proy || "", monto: d.base !== null ? d.base : (d.neto !== null ? d.neto : null),
      glosa: d.glosa || "", visto: db.meta.fecha
    };
    if (ex) {
      Object.keys(datos).forEach(k => { if (datos[k] !== "" && datos[k] !== null) ex[k] = datos[k]; });
      act++;
    } else { db.cat.oc.push({ cta: "", ...datos }); nuevas++; }
  });
  xlGuardarMapa(xlHdr, xlMapa);
  setDirty(); render();
  toast(`Catálogo de OC: ${nuevas} nuevas, ${act} actualizadas${sinOc ? `, ${sinOc} filas sin OC` : ""}`);
}
function renderOcCat() {
  const info = $("#ocCatInfo");
  if (info) {
    const conMonto = db.cat.oc.filter(o => o.monto).length;
    info.textContent = db.cat.oc.length
      ? `${db.cat.oc.length} órdenes en el catálogo · ${conMonto} con monto`
      : "catálogo de órdenes de compra vacío";
  }
}
</script>
