<script>
"use strict";
/* =========================================================================
   CONEXIÓN A EXCEL — lee una planilla cualquiera y llena el formulario
   ========================================================================= */
const XL_CAMPOS = [
  { k: "glosa",  t: "Descripción / glosa",   re: /(descrip|glosa|detalle|partida|item\b|concepto|obra)/i },
  { k: "oc",     t: "Orden de compra",       re: /(purchase\s*order|orden\s*de?\s*compra|^\s*oc\s*$|\boc\b|\bpo\b)/i },
  { k: "proy",   t: "Project code",          re: /(project\s*code|proyecto|c[oó]digo\s*proy)/i },
  { k: "vendor", t: "Vendor #",              re: /(vendor|c[oó]d.*proveedor|proveedor\s*#)/i },
  { k: "rut",    t: "RUT proveedor",         re: /\brut\b/i },
  { k: "prov",   t: "Nombre proveedor",      re: /(proveedor|raz[oó]n\s*social|contratista|empresa)/i },
  { k: "ir",     t: "Reference (IR)",        re: /(reference|\bir\b|recepci[oó]n)/i },
  { k: "ep",     t: "Estado de pago",        re: /(estado\s*de?\s*pago|eepp|\bep\b|avance\s*n)/i },
  { k: "sede",   t: "Sede",                  re: /(sede|colegio|establecimiento|local)/i },
  { k: "base",   t: "Monto base / contrato",  re: /(monto\s*(total|contrato|base)|contrato|presupuesto|valor\s*total|total\s*contrato)/i },
  { k: "pct",    t: "% a facturar",          re: /(%|porcentaje|avance)/i },
  { k: "neto",   t: "Neto a facturar",       re: /(neto|valor\s*\[?clp|monto\s*a\s*facturar|a\s*facturar|monto\s*neto|valor)/i },
  { k: "iva",    t: "IVA (vacío = exenta)",  re: /(^|\s)iva(\s|$)|impuesto/i },
  { k: "exenta", t: "Exenta / afecta",       re: /(exent|afecta|no\s*afect)/i }
];
let xlHandle = null, xlLibro = null, xlNombre = "", xlFilas = [], xlHdr = [];

function xlLeerHoja() {
  if (!xlLibro) return { hdr: [], filas: [] };
  const ws = xlLibro.Sheets[$("#xlHoja").value] || xlLibro.Sheets[xlLibro.SheetNames[0]];
  if (!ws) return { hdr: [], filas: [] };
  if (ws["!ref"]) {
    const r = XLSX.utils.decode_range(ws["!ref"]);
    r.s.r = 0; r.s.c = 0;
    ws["!ref"] = XLSX.utils.encode_range(r);
  }
  const todo = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const iHdr = Math.max(0, (+$("#xlFilaHdr").value || 1) - 1);
  const hdr = (todo[iHdr] || []).map(c => String(c ?? "").replace(/\s+/g, " ").trim());
  return { hdr, filas: todo.slice(iHdr + 1), hoja: ws };
}
function xlDetectarFilaTitulos(libro, nombreHoja) {
  const ws = libro.Sheets[nombreHoja];
  if (!ws) return 1;
  if (ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.r = 0; r.s.c = 0; ws["!ref"] = XLSX.utils.encode_range(r); }
  const todo = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }).slice(0, 25);
  let mejor = 1, mejorPuntaje = -1;
  todo.forEach((fila, i) => {
    const celdas = (fila || []).map(c => String(c ?? "").trim()).filter(Boolean);
    if (celdas.length < 2) return;
    const texto = celdas.filter(c => /[A-Za-zÁÉÍÓÚáéíóúÑñ]{3}/.test(c) && c.length < 40).length;
    const puntaje = XL_CAMPOS.reduce((s, f) => s + (celdas.some(c => f.re.test(c)) ? 2 : 0), 0) + texto * 0.3;
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = i + 1; }
  });
  return mejor;
}
function xlAutoMapa(hdr) {
  const firma = hdr.join("|").toLowerCase();
  const guardado = (db.cat.mapasXl || []).find(m => m.firma === firma);
  if (guardado) return { ...guardado.mapa };
  const mapa = {}, usadas = new Set();
  XL_CAMPOS.forEach(f => {
    let mejor = -1, mejorLargo = 1e9;
    hdr.forEach((h, i) => {
      if (!h || usadas.has(i)) return;
      if (f.re.test(h) && h.length < mejorLargo) { mejor = i; mejorLargo = h.length; }
    });
    if (mejor >= 0) { mapa[f.k] = mejor; usadas.add(mejor); }
  });
  return mapa;
}
function xlGuardarMapa(hdr, mapa) {
  db.cat.mapasXl = db.cat.mapasXl || [];
  const firma = hdr.join("|").toLowerCase();
  const ex = db.cat.mapasXl.find(m => m.firma === firma);
  if (ex) ex.mapa = { ...mapa }; else db.cat.mapasXl.push({ firma, mapa: { ...mapa } });
  setDirty();
}
let xlMapa = {};
function xlValor(fila, k, mapa) {
  const i = (mapa || xlMapa)[k];
  if (i === undefined || i === null || i < 0) return null;
  const v = fila[i];
  return v === null || v === undefined || String(v).trim() === "" ? null : v;
}
function xlPct(v) {
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", "").replace(",", ".").trim());
  if (isNaN(n)) return null;
  return n > 1 ? n / 100 : n;                     // acepta 10 y 0,1
}
function xlFilaAEepp(fila, mapa) {
  const M = mapa || xlMapa;
  const glosa = xlValor(fila, "glosa", M);
  const base = toNum(xlValor(fila, "base", M));
  const pct = xlPct(xlValor(fila, "pct", M));
  let neto = toNum(xlValor(fila, "neto", M));
  if (neto === null && base !== null && pct !== null) neto = Math.round(base * pct);
  const ocRaw = xlValor(fila, "oc", M);
  const oc = ocRaw ? String(ocRaw).replace(/\s/g, "").trim() : "";
  const rut = xlValor(fila, "rut", M) ? fmtRut(String(xlValor(fila, "rut", M))) : "";
  let vendor = xlValor(fila, "vendor", M) ? String(xlValor(fila, "vendor", M)).trim().toUpperCase() : "";
  const mV = /V\s?0?\d{4,6}/.exec(vendor || String(xlValor(fila, "prov", M) || ""));
  if (mV) vendor = mV[0].replace(/\s/g, "");
  const proyRaw = xlValor(fila, "proy", M);
  let proy = proyRaw ? String(proyRaw).replace(/[\s\]\[#]/g, "").toUpperCase() : "";
  if (!proy && glosa) proy = xProject(String(glosa));
  const irRaw = xlValor(fila, "ir", M);
  const mIr = irRaw ? /IR\s*0*(\d{5,8})/i.exec(String(irRaw)) : null;
  /* condición de IVA: si hay columna de IVA y su celda está vacía, la línea es exenta */
  let exenta = null;
  const exRaw = xlValor(fila, "exenta", M);
  if (exRaw !== null) {
    const t = up(exRaw).trim();
    if (/^(EXENT|SI|SI|S|X|TRUE|1|NO\s*AFECTA)/.test(t)) exenta = true;
    else if (/^(AFECT|NO|FALSE|0|IVA)/.test(t)) exenta = false;
  }
  const ivaCol = M.iva;
  const hayColIva = ivaCol !== undefined && ivaCol !== null && ivaCol >= 0;
  const ivaVal = hayColIva ? toNum(xlValor(fila, "iva", M)) : null;
  if (exenta === null && hayColIva) exenta = (ivaVal === null || ivaVal === 0);
  const sedeRaw = xlValor(fila, "sede", M);
  let sede = sedeRaw ? String(sedeRaw).trim().toUpperCase() : "";
  if (sede && !socPorSede(sede)) sede = "";
  const p = rut ? provPorRut(rut) : provPorCod(vendor);
  return {
    glosa: glosa ? String(glosa).replace(/\s+/g, " ").trim() : "",
    oc, proy, vendor: vendor || (p ? p.cod : ""), rut: rut || (p ? p.rut : ""),
    ir: mIr ? "IR" + mIr[1] : "",
    ep: xlValor(fila, "ep", M) ? String(xlValor(fila, "ep", M)).trim() : "",
    sede: sede || sedeDeOc(oc) || sedeDeProyecto(proy),
    base, pct, neto, exenta: exenta === null ? false : exenta,
    prov: xlValor(fila, "prov", M) ? String(xlValor(fila, "prov", M)).trim() : (p ? p.nombre : "")
  };
}
function xlFilasUtiles() {
  return xlFilas.map((f, i) => ({ i, d: xlFilaAEepp(f || []) }))
    .filter(x => x.d.glosa || x.d.neto !== null || x.d.oc);
}
function xlEsFormatoBloques() {
  if (!xlLibro) return false;
  const ws = xlLibro.Sheets[$("#xlHoja").value];
  if (!ws) return false;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  return rows.filter(r => (r || []).some(c => up(c).trim() === "VENDOR")).length >= 1
      && rows.filter(r => (r || []).some(c => /^PURCHASE\s*ORDER$/.test(up(c).trim()))).length >= 1;
}
function xlRender() {
  const { hdr, filas } = xlLeerHoja();
  xlHdr = hdr; xlFilas = filas;
  if (!Object.keys(xlMapa).length) xlMapa = xlAutoMapa(hdr);
  /* selectores de correspondencia */
  const etiq = (h, i) => {
    const t = (h || "").trim() || "(col " + XLSX.utils.encode_col(i) + ")";
    return XLSX.utils.encode_col(i) + " · " + (t.length > 34 ? t.slice(0, 33) + "…" : t);
  };
  $("#xlMap").innerHTML = XL_CAMPOS.map(f => `<label class="fld" style="min-width:0">${f.t}
    <select data-xlmap="${f.k}" style="width:100%;max-width:230px">
      <option value="-1">— ninguna —</option>
      ${hdr.map((h, i) => `<option value="${i}"${xlMapa[f.k] === i ? " selected" : ""}>${esc(etiq(h, i))}</option>`).join("")}
    </select></label>`).join("");
  const reconocidas = XL_CAMPOS.filter(f => xlMapa[f.k] !== undefined && xlMapa[f.k] >= 0);
  $("#xlMapResumen").textContent = `· ${reconocidas.length} de ${XL_CAMPOS.length} reconocidas: ${reconocidas.map(f => f.t).join(", ") || "ninguna"}`;
  /* tabla de filas */
  const utiles = xlFilasUtiles();
  const cols = ["", "Sede", "Project code", "OC", "Vendor", "EP", "Base", "%", "Neto", "IVA", "Glosa"];
  $("#tblXl thead").innerHTML = `<tr>${cols.map((c, i) => `<th class="${[6, 7, 8].includes(i) ? "num" : ""}">${c}</th>`).join("")}</tr>`;
  $("#tblXl tbody").innerHTML = utiles.map(({ i, d }) => `<tr data-xlrow="${i}">
    <td style="white-space:nowrap">
      <button class="btn sm" data-xlform="${i}">→ Formulario</button>
      <button class="btn sm ghost" data-xladd="${i}" title="Agregar directo">+</button>
    </td>
    <td>${esc(d.sede)}</td><td class="mono">${esc(d.proy)}</td><td class="mono">${esc(d.oc)}</td>
    <td class="mono">${esc(d.vendor)}</td><td>${esc(d.ep)}</td>
    <td class="num">${nf(d.base)}</td><td class="num">${d.pct === null ? "" : (d.pct * 100).toFixed(1) + "%"}</td>
    <td class="num">${nf(d.neto)}</td>
    <td>${d.exenta ? `<span class="tag neutral">exenta</span>` : `<span class="tag capex">19%</span>`}</td>
    <td class="wrap small muted">${esc(d.glosa)}</td>
  </tr>`).join("") || `<tr><td colspan="11" class="muted" style="padding:14px">No encontré filas con datos. Revisa la hoja, la fila de títulos y la correspondencia de columnas.</td></tr>`;
  const al = [];
  const bloques = xlEsFormatoBloques();
  $("#btnXlBloques").classList.toggle("primary", bloques);
  if (bloques && reconocidas.length < 4) {
    $("#xlAlertas").innerHTML = `<div class="alert info">Esta hoja está armada por <b>bloques</b> (con las etiquetas Vendor / Purchase Order / Project Code), como el <code>Generador_EEPP</code>, no como una tabla de columnas. Pulsa <b>«Leer como bloques EEPP»</b> y se cargan todos de una vez.</div>`;
    $("#tblXl tbody").innerHTML = `<tr><td colspan="11" class="muted" style="padding:14px">Usa «Leer como bloques EEPP» para esta hoja.</td></tr>`;
    return;
  }
  if (!utiles.length && filas.length) al.push({ n: "warn", t: "La hoja tiene datos pero ninguna columna quedó reconocida como glosa, OC o monto. Ajusta la correspondencia de columnas." });
  const sinNeto = utiles.filter(x => x.d.neto === null).length;
  if (sinNeto) al.push({ n: "warn", t: `${sinNeto} fila(s) sin neto a facturar: asigna la columna del monto, o la del contrato más el porcentaje.` });
  const sinOc = utiles.filter(x => !x.d.oc).length;
  if (sinOc) al.push({ n: "warn", t: `${sinOc} fila(s) sin orden de compra.` });
  alertBox($("#xlAlertas"), al);
}
function xlPrepararLibro(libro, nombreHoja) {
  const hoja = nombreHoja || libro.SheetNames[0];
  const ws = libro.Sheets[hoja];
  if (!ws) return { hdr: [], filas: [], mapa: {} };
  if (ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.r = 0; r.s.c = 0; ws["!ref"] = XLSX.utils.encode_range(r); }
  const todo = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const iHdr = Math.max(0, xlDetectarFilaTitulos(libro, hoja) - 1);
  const hdr = (todo[iHdr] || []).map(c => String(c ?? "").replace(/\s+/g, " ").trim());
  return { hdr, filas: todo.slice(iHdr + 1), mapa: xlAutoMapa(hdr) };
}
async function xlCargarArchivo(file) {
  const buf = await leerArchivoBuffer(file);
  xlLibro = XLSX.read(buf, { cellDates: false });
  xlNombre = file.name;
  $("#xlHoja").innerHTML = xlLibro.SheetNames.map(n => `<option>${esc(n)}</option>`).join("");
  $("#xlFilaHdr").value = xlDetectarFilaTitulos(xlLibro, xlLibro.SheetNames[0]);
  xlMapa = {};
  $("#xlConf").classList.remove("hide");
  if (typeof modoEp === "function") modoEp("excel");        /* muestra el bloque de la planilla */
  $("#xlEstado").innerHTML = `<b>${esc(xlNombre)}</b>${xlHandle ? " · conectado" : ""}`;
  $("#btnXlRecargar").disabled = !xlHandle;
  xlRender();
  const rec = XL_CAMPOS.filter(f => xlMapa[f.k] >= 0).length;
  toast(`${esc(xlNombre)}: ${xlFilasUtiles().length} fila(s) útiles, ${rec} columnas reconocidas`);
  if (rec < 3) $("#xlMapDet").open = true;
}
function eeppDesdeFilaXl(d) {
  const neto = d.neto;
  const e = {
    id: uid(), vendor: d.vendor || "", rut: d.rut || "", oc: d.oc || "", proy: d.proy || "",
    ir: d.ir || "", glosa: d.glosa || "", ep: d.ep || "",
    sede: d.sede || sedeDeOc(d.oc) || sedeDeProyecto(d.proy),
    neto, exenta: !!d.exenta, origen: xlNombre
  };
  cuadraMontos(e);
  if (!d.rut && d.prov && !d.vendor) {
    const p = db.cat.prov.find(x => up(x.nombre) && up(d.prov).includes(up(x.nombre).slice(0, 14)));
    if (p) { e.rut = p.rut; e.vendor = p.cod; }
  }
  return e;
}
</script>
