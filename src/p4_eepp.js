<script>
"use strict";
/* =========================================================================
   CUADRO EEPP — lectura del xlsx y del texto del correo
   ========================================================================= */
/* deja neto / IVA / total consistentes con la condición de IVA de la línea */
function cuadraMontos(o) {
  if (o.neto === null || o.neto === undefined) { o.iva = null; o.total = null; return o; }
  o.iva = o.exenta ? 0 : ivaDe(o.neto);
  o.total = o.neto + o.iva;
  return o;
}
function celdasTxt(row) { return (row || []).map(c => (c === null || c === undefined) ? "" : String(c)); }
function valorTras(row, j) {                       // primer valor no vacío después de la columna j
  for (let k = j + 1; k < row.length; k++) {
    const v = row[k];
    if (v === null || v === undefined || String(v).trim() === "" || String(v).trim() === "#") continue;
    return v;
  }
  return null;
}
function buscaEtiqueta(row, re) {
  const c = celdasTxt(row);
  for (let j = 0; j < c.length; j++) if (re.test(up(c[j]).trim())) return j;
  return -1;
}
function eeppDesdeFilas(rows) {
  const anclas = [];
  rows.forEach((r, i) => { if (buscaEtiqueta(r, /^VENDOR$/) >= 0) anclas.push(i); });
  const bloques = [];
  anclas.forEach((iv, k) => {
    const iniGlosa = k === 0 ? 0 : anclas[k - 1] + 1;
    const b = { id: uid(), vendor: "", oc: "", proy: "", ir: "", ep: "", glosa: "", neto: null, iva: null, total: null };
    const glosas = [];
    for (let i = iv; i < Math.min(iv + 8, rows.length); i++) {
      const r = rows[i] || [];
      let j;
      if ((j = buscaEtiqueta(r, /^VENDOR$/)) >= 0 && !b.vendor) b.vendor = String(valorTras(r, j) ?? "").trim();
      if ((j = buscaEtiqueta(r, /^PURCHASE\s*ORDER$/)) >= 0 && !b.oc) b.oc = String(valorTras(r, j) ?? "").replace(/\s/g, "").trim();
      if ((j = buscaEtiqueta(r, /^PROJECT\s*CODE$/)) >= 0 && !b.proy) b.proy = String(valorTras(r, j) ?? "").replace(/[\s\]\[#]/g, "").trim();
      if ((j = buscaEtiqueta(r, /^REFERENCE$/)) >= 0 && !b.ir) b.ir = String(valorTras(r, j) ?? "").replace(/\s/g, "").trim();
    }
    let hayFilaIva = false;
    for (let i = iv; i < Math.min(iv + 16, rows.length); i++) {
      const r = rows[i] || [];
      let j;
      if ((j = buscaEtiqueta(r, /^MONTO\s*NETO$/)) >= 0 && b.neto === null) b.neto = toNum(valorTras(r, j));
      if ((j = buscaEtiqueta(r, /^IVA$/)) >= 0 && !hayFilaIva) { hayFilaIva = true; b.iva = toNum(valorTras(r, j)); }
      if ((j = buscaEtiqueta(r, /^TOTAL$/)) >= 0 && b.total === null) b.total = toNum(valorTras(r, j));
    }
    /* la celda del IVA vacía o en cero significa factura exenta */
    b.exenta = hayFilaIva && (b.iva === null || b.iva === 0);
    for (let i = iniGlosa; i < iv; i++) {
      celdasTxt(rows[i]).forEach(v => {
        const g = v.replace(/\u00a0/g, " ").trim();
        if (g.length > 25 && !/^Factura a 30/i.test(g) && !/^DESCRIPCI/i.test(g)) glosas.push(g);
      });
    }
    if (b.neto === null && b.total !== null) b.neto = b.exenta ? b.total : Math.round(b.total / 1.19);
    cuadraMontos(b);
    b.glosa = glosas.join(" // ");
    const mep = /(?:EEPP?|EP)[\s_]*([A-Za-z0-9]+)\s*\(([\d.,]+)\)/.exec(b.glosa);
    if (mep) b.ep = `EP ${mep[1]} (${mep[2]})`;
    if (!b.proy) b.proy = xProject(b.glosa);
    b.sede = sedeDeOc(b.oc) || sedeDeProyecto(b.proy);
    if (b.oc || b.proy) bloques.push(b);
  });
  return bloques;
}
function sedeDeProyecto(p) {
  const s = up(p);
  if (!s) return "";
  const hit = db.cat.soc.find(x => x.sede && s.startsWith(x.sede));
  if (hit) return hit.sede;
  const m = /^CH([A-Z]{3})/.exec(s);                       // CHCMA27101 -> CMA
  if (m && socPorSede(m[1])) return m[1];
  const m2 = /^([A-Z]{3})/.exec(s);
  return m2 && socPorSede(m2[1]) ? m2[1] : "";
}
async function eeppDesdeXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: false });
  let out = [];
  wb.SheetNames.forEach(n => {
    const ws = wb.Sheets[n];
    if (ws["!ref"]) {                                  // fuerza el rango a partir de A1
      const r = XLSX.utils.decode_range(ws["!ref"]);
      r.s.r = 0; r.s.c = 0;
      ws["!ref"] = XLSX.utils.encode_range(r);
    }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    out = out.concat(eeppDesdeFilas(rows));
  });
  return out;
}
function eeppDesdeTexto(txt) {
  // divide por bloques que contengan "Vendor #"
  const t = norm(txt).replace(/ /g, " ");
  const partes = t.split(/(?=Factura a 30)/i).filter(p => /Vendor\s*#/i.test(p));
  const src = partes.length ? partes : (/Vendor\s*#/i.test(t) ? [t] : []);
  return src.map(p => {
    const g = (re) => { const m = re.exec(p); return m ? m[1].trim() : ""; };
    const neto = montoTrasEtiqueta(p, [String.raw`MONTO\s*NETO`]);
    const iva = montoTrasEtiqueta(p, [String.raw`19\s*%\s*IVA`, String.raw`IVA`]);
    const tot = montoTrasEtiqueta(p, [String.raw`\bTOTAL\b`]);
    const exenta = /EXENT|NO\s*AFECTA/i.test(p)
      || (iva === null || iva === 0)
      || (neto !== null && tot !== null && Math.abs(tot - neto) <= 2);
    const glosa = (g(/(?:VALOR\s*\[CLP\]|detalle:)([\s\S]{20,600}?)(?:Vendor\s*#)/i) || p.slice(0, 400))
      .replace(/\s{2,}/g, " ").trim();
    const b = {
      id: uid(),
      vendor: g(/Vendor\s*#?\s*(V\s?0?\d{4,6})/i).replace(/\s/g, ""),
      oc: g(/Purchase\s*Order\s*#?\s*([A-Za-z0-9()\-]+)/i),
      proy: g(/Project\s*Code\s*#?\s*([A-Za-z0-9]+)/i),
      ir: g(/Reference\s*#?\s*(IR\s?\d{5,8})/i).replace(/\s/g, ""),
      glosa, ep: "", neto, iva: iva ?? null, total: tot, exenta
    };
    if (b.neto === null && b.total !== null) b.neto = b.exenta ? b.total : Math.round(b.total / 1.19);
    cuadraMontos(b);
    const mep = /(?:EEPP?|EP)[\s_]*([A-Za-z0-9]+)\s*\(([\d.,]+)\)/.exec(glosa);
    if (mep) b.ep = `EP ${mep[1]} (${mep[2]})`;
    b.sede = sedeDeOc(b.oc) || sedeDeProyecto(b.proy);
    return b;
  }).filter(b => b.oc || b.proy);
}
function agregarEepp(lista) {
  let nuevos = 0, dup = 0;
  lista.forEach(b => {
    const ya = db.eepp.find(e => up(e.oc) === up(b.oc) && up(e.ir || "") === up(b.ir || "") && e.neto === b.neto);
    if (ya) { dup++; return; }
    db.eepp.push(b); nuevos++;
    if (b.vendor) {
      // el código V del cuadro es la mejor fuente del código de proveedor
      const p = db.cat.prov.find(x => x.cod === b.vendor);
      if (p && b.oc && b.sede) aprenderOc(p.rut, b.sede, b.oc, "", db.meta.fecha);
    }
  });
  setDirty(); render();
  toast(`${nuevos} EEPP agregados${dup ? `, ${dup} ya estaban` : ""}`);
}

/* =========================================================================
   CALCE FACTURA ↔ EEPP
   ========================================================================= */
function calzarEepp(f) {
  const cands = db.eepp.filter(e => !e.facId);
  const score = e => {
    let s = 0;
    if (f.oc && up(e.oc) === up(f.oc)) s += 50;
    if (f.ir && e.ir && up(e.ir) === up(f.ir)) s += 40;
    if (f.proy && e.proy && up(e.proy) === up(f.proy)) s += 15;
    if (f.neto !== null && e.neto !== null && Math.abs(f.neto - e.neto) <= 2) s += 30;
    else if (f.neto !== null && e.neto !== null && Math.abs(f.neto - e.neto) / Math.max(e.neto, 1) < 0.02) s += 12;
    if (f.rut && e.vendor) { const p = provPorRut(f.rut); if (p && p.cod === e.vendor) s += 10; }
    return s;
  };
  const best = cands.map(e => ({ e, s: score(e) })).sort((a, b) => b.s - a.s)[0];
  return best && best.s >= 50 ? best : null;
}
function aplicarCalce(f) {
  const hit = calzarEepp(f);
  f.eeppId = null; f.avisosCalce = [];
  if (!hit) {
    if (f.tipo === "CAPEX") f.avisosCalce.push("CAPEX sin EEPP asociado en el cuadro");
    return;
  }
  const e = hit.e;
  f.eeppId = e.id; e.facId = f.id;
  if (!f.proy && e.proy) f.proy = e.proy;
  if (!f.oc && e.oc) f.oc = e.oc;
  if (!f.ir && e.ir) f.ir = e.ir;
  if (!f.sede && e.sede) f.sede = e.sede;
  if (f.rut && f.sede && f.oc) aprenderOc(f.rut, f.sede, f.oc, "", clToIso(f.fecha) || db.meta.fecha, f.tipo === "CAPEX" ? f.proy : "");
  if (e.exenta !== undefined && f.exenta !== undefined && !!e.exenta !== !!f.exenta)
    f.avisosCalce.push(e.exenta
      ? "El cuadro estaba como exento de IVA y la factura llegó con IVA"
      : "El cuadro llevaba IVA y la factura llegó exenta");
  if (e.neto !== null && f.neto !== null && Math.abs(e.neto - f.neto) > 2)
    f.avisosCalce.push(`Neto facturado ${nf(f.neto)} vs comprometido en el EEPP ${nf(e.neto)} (dif ${nf(f.neto - e.neto)})`);
}

/* ---------------- controles de la factura ---------------- */
function controles(f) {
  const out = [];
  (f.avisos || []).forEach(a => out.push({ n: "warn", t: a }));
  (f.avisosCalce || []).forEach(a => out.push({ n: "warn", t: a }));
  if (!f.doc) out.push({ n: "crit", t: "Falta el N° de documento" });
  if (!f.fecha) out.push({ n: "crit", t: "Falta la fecha" });
  if (!f.sede) out.push({ n: "crit", t: "Falta la sede" });
  if (!f.oc) out.push({ n: "crit", t: "Falta la OC" });
  if (!f.ir) out.push({ n: "warn", t: "Falta el reference (IR): cárgalo desde Netsuite" });
  else if (f.irReparto) out.push({ n: "warn", t: `IR ${f.ir} asignado por reparto (la OC ${f.oc} tiene varias recepciones del mismo monto): verifica cuál corresponde` });
  if (f.neto === null || f.total === null) out.push({ n: "crit", t: "Faltan montos" });
  if (f.tipo === "CAPEX" && !f.proy) out.push({ n: "crit", t: "Falta el project code" });
  if (f.tipo === "MANT" && !/^\d{5}$/.test(String(f.proy || ""))) out.push({ n: "warn", t: "Cuenta contable no válida" });
  if (f.neto !== null && f.iva !== null && f.total !== null && f.neto + f.iva !== f.total)
    out.push({ n: "crit", t: `Neto + IVA (${nf(f.neto + f.iva)}) distinto del total (${nf(f.total)})` });
  /* el mismo documento no puede estar en dos nóminas: se pagaría dos veces */
  if (f.doc && f.rut) {
    const act = nominaActiva();
    const gemelas = todasLasFacturas().filter(({ f: o }) => o.id !== f.id
      && o.rut && fmtRut(o.rut) === fmtRut(f.rut) && String(o.doc) === String(f.doc));
    const enOtra = gemelas.filter(x => x.nom.id !== act.id);
    const enEsta = gemelas.filter(x => x.nom.id === act.id);
    if (enEsta.length) out.push({ n: "crit", t: "Documento repetido dentro de esta misma nómina" });
    enOtra.forEach(x => out.push({ n: "crit",
      t: `El documento ya está en la nómina del ${isoToCl(x.nom.fecha)}${x.nom.estado === "enviada" ? " (ya enviada)" : ""}: se pagaría dos veces` }));
  }
  /* la factura debería corresponder al período de corte de esta nómina */
  const nom = nominaActiva();
  const fIso = clToIso(f.fecha);
  if (fIso && nom.fecha && fIso > nom.fecha)
    out.push({ n: "warn", t: `La factura es del ${f.fecha} y esta nómina es del ${isoToCl(nom.fecha)}: debería ir en la siguiente` });
  const irRep = db.fac.filter(o => o.id !== f.id && f.ir && up(o.ir) === up(f.ir));
  if (irRep.length) out.push({ n: "warn", t: "Reference (IR) repetido en esta nómina" });
  return out;
}
function facturasHistoricas() {                     // todas las facturas registradas, con la fecha de su nómina
  return todasLasFacturas().map(({ f, nom }) => ({ ...f, nomFecha: nom.fecha, nomEstado: nom.estado, nomId: nom.id }));
}
function nivel(cs) { return cs.some(c => c.n === "crit") ? "crit" : cs.some(c => c.n === "warn") ? "warn" : "ok"; }
</script>
<script>
"use strict";
/* =========================================================================
   CORREO AL PROVEEDOR — el cuadro de pago que inicia el proceso
   ========================================================================= */
function eeppSeleccionados() {
  const ids = $$("#tblEepp tbody tr").filter(tr => $(".ck", tr)?.checked).map(tr => tr.dataset.id);
  return db.eepp.filter(e => ids.includes(e.id));
}
function agrupaPorProveedor(lista) {
  const g = new Map();
  lista.forEach(e => {
    const k = up(e.vendor || e.rut || "sin-proveedor");
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(e);
  });
  return Array.from(g.values());
}
function agrupaPorOc(lista) {
  const g = new Map();
  lista.forEach(e => {
    const k = up(e.oc || "sin-oc") + "|" + up(e.proy || "");
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(e);
  });
  return Array.from(g.values());
}
const PV_TH = 'style="border:1px solid #7f7f7f;background:#dce6f1;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold"';
const PV_TD = 'style="border:1px solid #7f7f7f;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt"';
const PV_TDN = 'style="border:1px solid #7f7f7f;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:right"';
const PV_TDB = 'style="border:1px solid #7f7f7f;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold"';
const PV_TDNB = 'style="border:1px solid #7f7f7f;padding:4px 7px;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;text-align:right"';
const PV_P = 'style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0 0 11pt"';

function epSufijo(e) {
  if (!e.ep) return "";
  const g = up(e.glosa || "");
  return g.includes(up(e.ep)) ? "" : ` - ${e.ep}`;
}
function bloqueCuadro(grupo) {
  const neto = grupo.reduce((s, e) => s + (e.neto || 0), 0);
  const iva = grupo.reduce((s, e) => s + (e.exenta ? 0 : (e.iva !== null && e.iva !== undefined ? e.iva : ivaDe(e.neto || 0))), 0);
  const total = neto + iva;
  const todasExentas = grupo.every(e => e.exenta);
  const filas = grupo.map(e => {
    const partes = (e.glosa || "").split(" // ").map(x => x.trim()).filter(Boolean);
    const ep = epSufijo(e);
    if (partes.length <= 1)
      return `<tr><td ${PV_TD}>${esc(partes[0] || "(sin glosa)")}${esc(ep)}</td><td ${PV_TDN}>${nf(e.neto)}</td></tr>`;
    return partes.map((g, i) =>
      `<tr><td ${PV_TD}>${esc(g)}</td><td ${PV_TDN}>${i === partes.length - 1 ? nf(e.neto) : ""}</td></tr>`).join("");
  }).join("");
  const ref = grupo.find(e => e.ir)?.ir || "";
  const datos = [["Vendor #", grupo[0].vendor || ""], ["Purchase Order #", grupo[0].oc || ""],
    ["Project Code #", grupo[0].proy || ""], ["Reference #", ref]]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td ${PV_TD}>${k} ${esc(v)}</td><td ${PV_TD}></td></tr>`).join("");
  return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 12pt">
    <tr><th ${PV_TH}>DESCRIPCIÓN ( GLOSA FACTURA )</th><th ${PV_TH}>VALOR [CLP]</th></tr>
    ${filas}
    ${datos}
    <tr><td ${PV_TDB}>MONTO NETO</td><td ${PV_TDNB}>${nf(neto)}</td></tr>
    <tr><td ${PV_TD}>${todasExentas ? "IVA — factura exenta" : "19% IVA"}</td><td ${PV_TDN}>${todasExentas ? "" : nf(iva)}</td></tr>
    <tr><td ${PV_TDB}>TOTAL</td><td ${PV_TDNB}>${nf(total)}</td></tr>
  </table>${todasExentas ? `<p ${PV_P} style="margin-top:-4pt">Documento a emitir: <b>factura exenta</b> (no afecta a IVA).</p>` : ""}`;
}
function correoProveedorHtml(lista, vencIso) {
  const bloques = agrupaPorOc(lista);
  const eps = [...new Set(lista.map(e => e.ep).filter(Boolean))].join(", ");
  const venc = vencIso ? isoToCl(vencIso) : "___/___/______";
  return `<div>
<p ${PV_P}>Estimados;</p>
<p ${PV_P}>Junto con saludar, adjunto cuadro ${eps ? "de " + esc(eps) : "de estado de pago"} para facturar según el detalle:</p>
<p ${PV_P}>Factura a 30 días, con vencimiento para el ${esc(venc)}</p>
${bloques.map(bloqueCuadro).join("")}
<p ${PV_P} style="margin-top:14pt">Saludos,<br>
${esc(db.meta.firma || "")}<br>
${esc(db.meta.cargo || "")}${db.meta.fono ? "<br>T " + esc(db.meta.fono) : ""}<br>
cognita.com</p>
</div>`;
}
function correoProveedorTexto(lista, vencIso) {
  const eps = [...new Set(lista.map(e => e.ep).filter(Boolean))].join(", ");
  const L = ["Estimados;", "",
    `Junto con saludar, adjunto cuadro ${eps ? "de " + eps : "de estado de pago"} para facturar según el detalle:`, "",
    `Factura a 30 días, con vencimiento para el ${vencIso ? isoToCl(vencIso) : "___/___/______"}`, ""];
  agrupaPorOc(lista).forEach(g => {
    const neto = g.reduce((s, e) => s + (e.neto || 0), 0);
    const iva = g.reduce((s, e) => s + (e.exenta ? 0 : (e.iva !== null && e.iva !== undefined ? e.iva : ivaDe(e.neto || 0))), 0);
    const exe = g.every(e => e.exenta);
    L.push("DESCRIPCIÓN ( GLOSA FACTURA )\tVALOR [CLP]");
    g.forEach(e => {
      const partes = (e.glosa || "").split(" // ").map(x => x.trim()).filter(Boolean);
      if (partes.length <= 1) L.push(`${partes[0] || ""}${epSufijo(e)}\t${nf(e.neto)}`);
      else partes.forEach((x, i) => L.push(`${x}\t${i === partes.length - 1 ? nf(e.neto) : ""}`));
    });
    if (g[0].vendor) L.push(`Vendor # ${g[0].vendor}`);
    if (g[0].oc) L.push(`Purchase Order # ${g[0].oc}`);
    if (g[0].proy) L.push(`Project Code # ${g[0].proy}`);
    const ref = g.find(e => e.ir)?.ir; if (ref) L.push(`Reference # ${ref}`);
    L.push(`MONTO NETO\t${nf(neto)}`,
      exe ? "IVA — factura exenta\t" : `19% IVA\t${nf(iva)}`,
      `TOTAL\t${nf(neto + iva)}`);
    if (exe) L.push("Documento a emitir: factura exenta (no afecta a IVA).");
    L.push("");
  });
  L.push("Saludos,", db.meta.firma || "", db.meta.cargo || "", db.meta.fono ? "T " + db.meta.fono : "", "cognita.com");
  return L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
}
function marcarEnviados(lista) {
  const hoy = db.meta.fecha || new Date().toISOString().slice(0, 10);
  lista.forEach(e => { e.enviado = hoy; });
  setDirty(); render();
}
</script>
