<script>
"use strict";
/* =========================================================================
   CORREO
   ========================================================================= */
const MAIL_TH = 'style="border:1px solid #7f7f7f;background:#dce6f1;padding:3px 5px;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;text-align:center"';
const MAIL_TD = 'style="border:1px solid #7f7f7f;padding:3px 5px;font-family:Calibri,Arial,sans-serif;font-size:10pt"';
const MAIL_TDN = 'style="border:1px solid #7f7f7f;padding:3px 5px;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:right"';
const MAIL_TF = 'style="border:1px solid #7f7f7f;padding:3px 5px;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;text-align:right;background:#f2f2f2"';

function tablaMail(cols, filas) {
  const th = `<tr>${cols.map(c => `<th ${MAIL_TH}>${c}</th>`).join("")}</tr>`;
  const tr = filas.map(r => `<tr>
    <td ${MAIL_TDN}>${r.item}</td><td ${MAIL_TD}>${esc(r.sede)}</td><td ${MAIL_TD}>${esc(r.proy)}</td>
    <td ${MAIL_TD}>${esc(r.oc)}</td><td ${MAIL_TD}>${esc(r.rut)}</td><td ${MAIL_TD}>${esc(r.prov)}</td>
    <td ${MAIL_TD}>${esc(r.fecha)}</td><td ${MAIL_TD}>${esc(r.doc)}</td><td ${MAIL_TD}>${esc(r.periodo)}</td>
    <td ${MAIL_TDN}>${nf(r.neto)}</td><td ${MAIL_TDN}>${nf(r.iva)}</td><td ${MAIL_TDN}>${nf(r.total)}</td>
    <td ${MAIL_TD}>${r.cont}</td><td ${MAIL_TD}>${r.pag}</td><td ${MAIL_TD}>${esc(r.ir)}</td>
    <td ${MAIL_TD}>${esc(r.obs)}</td></tr>`).join("");
  const sum = filas.reduce((s, r) => s + (r.total || 0), 0);
  const foot = `<tr><td ${MAIL_TD} colspan="8"></td><td ${MAIL_TF}>TOTAL</td><td ${MAIL_TD}></td><td ${MAIL_TD}></td><td ${MAIL_TF}>${nf(sum)}</td><td ${MAIL_TD} colspan="4"></td></tr>`;
  return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${th}${tr}${foot}</table>`;
}
function correoHtml() {
  const cap = lineasNomina("CAPEX"), man = lineasNomina("MANT");
  const res = resumenSociedad(), tot = res.reduce((s, [, v]) => s + v, 0);
  const P = 'style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0 0 11pt"';
  const H = 'style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin:14pt 0 5pt"';
  const resTabla = `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse">
    <tr><th ${MAIL_TH}>COLEGIO</th><th ${MAIL_TH}>MONTO</th></tr>
    ${res.map(([s, v]) => `<tr><td ${MAIL_TD}>${s}</td><td ${MAIL_TDN}>$${nf(v)}</td></tr>`).join("")}
    <tr><td ${MAIL_TF} style="text-align:left;border:1px solid #7f7f7f;padding:3px 5px;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;background:#f2f2f2">TOTAL</td><td ${MAIL_TF}>$${nf(tot)}</td></tr>
  </table>`;
  return `<div>
<p ${P}>Estimada ${esc(nominaActiva().dest || db.meta.dest || "Patricia")},</p>
<p ${P}>Esperando que te encuentres bien, adjunto nómina de pago de facturas para tu VB y poder incluirlas en la nómina más próxima:</p>
<p ${H}>FACTURAS Y BOLETAS A CONTABILIZAR DEVELOPMENT CAPEX Y ENHANCEMENT CAPEX</p>
${cap.length ? tablaMail(COLS_CAPEX, cap) : `<p ${P}>(sin líneas)</p>`}
<p ${H}>MAITENANCE</p>
${man.length ? tablaMail(COLS_MANT, man) : `<p ${P}>(sin líneas)</p>`}
<p ${H}>Adjunto detalle por sociedad:</p>
${resTabla}
<p ${P} style="margin-top:14pt">Muchas gracias.<br>Saludos,<br>${esc(db.meta.firma || "")}</p>
</div>`;
}
function correoTexto() {
  const cap = lineasNomina("CAPEX"), man = lineasNomina("MANT");
  const res = resumenSociedad(), tot = res.reduce((s, [, v]) => s + v, 0);
  const fila = r => [r.item, r.sede, r.proy, r.oc, r.rut, r.prov, r.fecha, r.doc, r.periodo,
    nf(r.neto), nf(r.iva), nf(r.total), r.cont, r.pag, r.ir, r.obs].join("\t");
  const L = [];
  L.push(`Estimada ${nominaActiva().dest || db.meta.dest || "Patricia"},`, "",
    "Esperando que te encuentres bien, adjunto nómina de pago de facturas para tu VB y poder incluirlas en la nómina más próxima:", "",
    "FACTURAS Y BOLETAS A CONTABILIZAR DEVELOPMENT CAPEX Y ENHANCEMENT CAPEX", COLS_CAPEX.join("\t"));
  cap.forEach(r => L.push(fila(r)));
  L.push(`\t\t\t\t\t\t\t\tTOTAL\t\t\t${nf(cap.reduce((s, r) => s + (r.total || 0), 0))}`, "", "MAITENANCE", COLS_MANT.join("\t"));
  man.forEach(r => L.push(fila(r)));
  L.push(`\t\t\t\t\t\t\t\tTOTAL\t\t\t${nf(man.reduce((s, r) => s + (r.total || 0), 0))}`, "",
    "Adjunto detalle por sociedad:", "COLEGIO\tMONTO");
  res.forEach(([s, v]) => L.push(`${s}\t$${nf(v)}`));
  L.push(`TOTAL\t$${nf(tot)}`, "", "Muchas gracias.", "Saludos,", db.meta.firma || "");
  return L.join("\n");
}
function renderCorreo() {
  $("#mailPreview").innerHTML = correoHtml();
  const f = nominaActiva().fecha ? isoToCl(nominaActiva().fecha) : "";
  if (!$("#mailAsunto").value || $("#mailAsunto").dataset.auto !== "0")
    $("#mailAsunto").value = `Nómina de pago facturas ${nominaActiva().periodo || periodoSugerido()}${f ? " — " + f : ""}`;
}
async function copiarHtml(html, txt) {
  try {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([txt], { type: "text/plain" })
    })]);
    toast("Correo copiado con las tablas: pégalo en Outlook");
  } catch (e) {
    const d = document.createElement("div");
    d.contentEditable = "true"; d.innerHTML = html;
    d.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(d);
    const r = document.createRange(); r.selectNodeContents(d);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const ok = document.execCommand("copy");
    sel.removeAllRanges(); d.remove();
    toast(ok ? "Correo copiado con las tablas" : "No se pudo copiar: selecciona la vista previa y usa Ctrl+C");
  }
}
async function copiarRico() { return copiarHtml(correoHtml(), correoTexto()); }

/* =========================================================================
   EXPORTACIÓN
   ========================================================================= */
function hojaDe(cols, filas) {
  const aoa = [cols];
  filas.forEach(r => aoa.push([r.item, r.sede, r.proy, r.oc, r.rut, r.prov, r.fecha, r.doc, r.periodo,
    r.neto, r.iva, r.total, r.cont, r.pag, r.ir, r.obs]));
  const s = (k) => filas.reduce((a, r) => a + (r[k] || 0), 0);
  aoa.push([]); aoa.push(["", "", "", "", "", "", "", "", "TOTAL", s("neto"), s("iva"), s("total")]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 6 }, { wch: 15 }, { wch: 19 }, { wch: 14 }, { wch: 46 }, { wch: 11 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 11 }, { wch: 34 }];
  const rango = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = 1; R <= rango.e.r; R++) for (const C of [9, 10, 11]) {
    const cel = ws[XLSX.utils.encode_cell({ r: R, c: C })];
    if (cel && typeof cel.v === "number") cel.z = "#,##0";
  }
  return ws;
}
function exportarXlsx() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaDe(COLS_CAPEX, lineasNomina("CAPEX")), "CAPEX");
  XLSX.utils.book_append_sheet(wb, hojaDe(COLS_MANT, lineasNomina("MANT")), "MANTENCION");
  const res = resumenSociedad();
  const ws3 = XLSX.utils.aoa_to_sheet([["COLEGIO", "MONTO"], ...res, ["TOTAL", res.reduce((s, [, v]) => s + v, 0)]]);
  ws3["!cols"] = [{ wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, "POR SOCIEDAD");
  XLSX.writeFile(wb, `Nomina_Pagos_${(db.meta.fecha || "").replace(/-/g, "")}.xlsx`);
}
function exportarCsv() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const bloque = (titulo, cols, filas) => [titulo, cols.map(q).join(";"),
    ...filas.map(r => [r.item, r.sede, r.proy, r.oc, r.rut, r.prov, r.fecha, r.doc, r.periodo,
      r.neto, r.iva, r.total, r.cont, r.pag, r.ir, r.obs].map(q).join(";"))].join("\n");
  const txt = "﻿" + [
    bloque("FACTURAS Y BOLETAS A CONTABILIZAR DEVELOPMENT CAPEX Y ENHANCEMENT CAPEX", COLS_CAPEX, lineasNomina("CAPEX")),
    "", bloque("MAITENANCE", COLS_MANT, lineasNomina("MANT")),
    "", "DETALLE POR SOCIEDAD", ...resumenSociedad().map(([s, v]) => `${q(s)};${q(v)}`)
  ].join("\n");
  bajar(new Blob([txt], { type: "text/csv;charset=utf-8" }), `Nomina_Pagos_${(db.meta.fecha || "").replace(/-/g, "")}.csv`);
}
function bajar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function guardarDb() {
  const copia = JSON.parse(JSON.stringify({
    v: DB_VERSION, meta: db.meta, cat: db.cat, eepp: db.eepp, nominas: db.nominas, activa: db.activa
  }));
  copia.nominas.forEach(n => (n.fac || []).forEach(f => { delete f.texto; }));
  bajar(new Blob([JSON.stringify(copia, null, 1)], { type: "application/json" }),
    `NominaPagos_base_${(nominaActiva().fecha || "").replace(/-/g, "")}.json`);
  setDirty(false);
  toast("Base guardada. Guárdala en tu carpeta y cárgala la próxima semana.");
}

/* =========================================================================
   REFERENCIAS IR (Netsuite) — asignación masiva
   ========================================================================= */
function parseIr(txt) {
  const pares = [];
  norm(txt).split(/\r?\n/).forEach(l => {
    const irs = (l.match(/\bIR\s*#?\s*0*(\d{5,8})/gi) || []).map(x => "IR" + /(\d{5,8})/.exec(x)[1]);
    if (!irs.length) return;
    const ocs = [];
    let m;
    const re = /\bPO[A-Za-z]{0,3}(?:\([A-Za-z]{2,5}\))?-?\d{4,7}\b/g;
    while ((m = re.exec(l))) ocs.push(m[0]);
    const montos = (l.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || []).map(toNum);
    irs.forEach((ir, i) => pares.push({ ir, oc: ocs[i] || ocs[0] || "", montos }));
  });
  return pares;
}
function asignarIr(txt) {
  const pares = parseIr(txt);
  if (!pares.length) return { ok: 0, total: 0, msg: "No encontré líneas con un número IR" };
  const usados = new Set(db.fac.map(f => up(f.ir)).filter(Boolean));
  let ok = 0;
  /* 1ª pasada: OC + monto */
  pares.forEach(p => {
    if (usados.has(up(p.ir))) return;
    const c = db.fac.filter(f => !f.ir && p.oc && up(f.oc) === up(p.oc)
      && p.montos.some(v => [f.neto, f.total, f.iva].some(x => x !== null && Math.abs(x - v) <= 2)));
    if (c.length === 1) { c[0].ir = p.ir; usados.add(up(p.ir)); ok++; }
  });
  /* 2ª pasada: solo OC, cuando queda una sola factura sin IR para esa OC */
  pares.forEach(p => {
    if (usados.has(up(p.ir)) || !p.oc) return;
    const c = db.fac.filter(f => !f.ir && up(f.oc) === up(p.oc));
    if (c.length === 1) { c[0].ir = p.ir; usados.add(up(p.ir)); ok++; }
  });
  /* 3ª pasada: por monto exacto único */
  pares.forEach(p => {
    if (usados.has(up(p.ir))) return;
    const c = db.fac.filter(f => !f.ir && p.montos.some(v => [f.neto, f.total].some(x => x !== null && Math.abs(x - v) <= 2)));
    if (c.length === 1) { c[0].ir = p.ir; usados.add(up(p.ir)); ok++; }
  });
  /* 4ª pasada: reparte lo que queda entre las facturas de la misma OC, en orden */
  const porOc = {};
  pares.forEach(p => { if (!usados.has(up(p.ir)) && p.oc) (porOc[up(p.oc)] = porOc[up(p.oc)] || []).push(p.ir); });
  Object.keys(porOc).forEach(oc => {
    const libres = db.fac.filter(f => !f.ir && up(f.oc) === oc);
    porOc[oc].forEach((ir, i) => {
      if (!libres[i]) return;
      libres[i].ir = ir; usados.add(up(ir)); ok++;
      if (libres.length > 1) libres[i].irReparto = true;   // varias recepciones para la misma OC
    });
  });
  const faltan = db.fac.filter(f => !f.ir).length;
  return { ok, total: pares.length, faltan,
    msg: `${ok} de ${pares.length} referencias asignadas${faltan ? ` · quedan ${faltan} línea(s) sin IR` : " · todas las líneas quedaron con IR"}` };
}

/* =========================================================================
   IMPORTAR NÓMINA ANTERIOR (texto pegado) — alimenta catálogo e historial
   ========================================================================= */
function importarNominaTexto(txt, fechaIso) {
  const lineas = norm(txt).split(/\r?\n/);
  const fac = [];
  let tipo = "CAPEX";
  lineas.forEach(l => {
    if (/^\s*MAITENANCE|MANTENCI/i.test(l)) { tipo = "MANT"; return; }
    if (/DEVELOPMENT CAPEX/i.test(l)) { tipo = "CAPEX"; return; }
    const cel = l.split(/\t|\s{2,};|;/).map(s => s.trim()).filter(s => s !== "");
    const rut = (cel.find(c => /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(c)) || "");
    const oc = (cel.find(c => /^PO[A-Z0-9()]*-?\d{4,7}$/i.test(c)) || "");
    const ir = (cel.find(c => /^IR\d{5,8}$/i.test(c)) || "");
    if (!rut || !oc) return;
    const sede = cel.find(c => /^[A-Z]{3,4}$/.test(c) && socPorSede(c)) || sedeDeOc(oc);
    const proy = cel.find(c => /^\d{5}$/.test(c)) || cel.find(c => /^[A-Z]{3}[A-Z0-9]{5,10}$/.test(c) && c !== sede) || "";
    const fecha = cel.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c)) || "";
    const doc = (cel.find(c => /^FAE(X)?\s*\d*$/i.test(c)) || "").replace(/^FAEX?\s*/i, "");
    const nums = cel.map(toNum).filter(n => n !== null && n > 999);
    const total = nums.length ? Math.max(...nums) : null;
    const neto = nums.length > 1 ? nums.sort((a, b) => a - b)[0] : null;
    fac.push({ id: uid(), tipo: /^\d{5}$/.test(proy) ? "MANT" : tipo, sede, proy, oc, rut, ir, fecha, doc, neto, iva: null, total });
    aprenderOc(rut, sede, oc, /^\d{5}$/.test(proy) ? proy : "", clToIso(fecha), /^\d{5}$/.test(proy) ? "" : proy);
  });
  if (!fac.length) { toast("No se reconocieron filas: revisa que estén separadas por tabulaciones"); return; }
  const fechas = fac.map(f => clToIso(f.fecha)).filter(Boolean).sort();
  const iso = fechaIso || fechas[fechas.length - 1] || db.meta.fecha;
  let n = db.nominas.find(x => x.fecha === iso);
  if (!n) { n = nuevaNomina(iso); db.nominas.push(n); }
  n.fac = (n.fac || []).concat(fac);
  n.periodo = n.periodo || periodoDe(iso);
  n.estado = "cerrada"; n.importada = true;
  setDirty(); render();
  toast(`${fac.length} líneas importadas a la nómina del ${isoToCl(iso)}`);
}
</script>
