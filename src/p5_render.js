<script>
"use strict";
/* =========================================================================
   RENDER
   ========================================================================= */
let soloProblemas = false;

function render() {
  db.fac.forEach(f => { if (f.tipo === "CAPEX" && !f.eeppId) aplicarCalce(f); });
  renderBarraNomina(); renderPeso(); renderTiles(); if (typeof renderLib === "function") renderLib(); renderEepp(); renderFac(); renderNomina(); renderCorreo(); renderHist(); renderCat(); renderOcCat();
  if (typeof renderOcPdf === "function" && ocPdfLista.length) renderOcPdf();
  const porEnviar = db.eepp.filter(e => !e.enviado && !e.facId).length;
  const conAlerta = db.fac.reduce((s, f) => s + (nivel(controles(f)) === "ok" ? 0 : 1), 0);
  pill("#pillEepp", db.eepp.filter(e => !e.facId).length, porEnviar > 0);
  pill("#pillFac", db.fac.length, conAlerta > 0);
  pill("#pillNom", db.fac.length, false);
  pill("#pillHist", db.nominas.length, false);
  renderNav();
}
function pill(sel, n, alerta) {
  const el = $(sel);
  if (!el) return;
  el.textContent = nf(n);
  el.classList.toggle("alerta", !!alerta && n > 0);
}
/* estado de cada paso en la navegación: hecho / en curso / pendiente */
function estadoPasos() {
  const conAlerta = db.fac.reduce((s, f) => s + (nivel(controles(f)) === "ok" ? 0 : 1), 0);
  const porEnviar = db.eepp.filter(e => !e.enviado && !e.facId).length;
  const esperando = db.eepp.filter(e => e.enviado && !e.facId).length;
  const n = nominaActiva();
  return {
    conAlerta, porEnviar, esperando,
    p1: { hecho: !porEnviar, cnt: db.eepp.filter(e => !e.facId).length },
    p2: { hecho: db.fac.length > 0 && !conAlerta, cnt: db.fac.length },
    p3: { hecho: db.fac.length > 0 && !conAlerta && n.estado !== "abierta", cnt: db.fac.length },
    p4: { hecho: n.estado === "enviada", cnt: 0 }
  };
}
function renderNav() {
  const e = estadoPasos();
  [["1", e.p1], ["2", e.p2], ["3", e.p3], ["4", e.p4]].forEach(([k, st]) => {
    const b = document.querySelector(`nav.tabs button[data-paso="${k}"]`);
    if (b) b.classList.toggle("paso-ok", !!st.hecho);
  });
}
/* Los avisos se muestran como una línea; el detalle se abre solo si se pide.
   Así un panel con 30 observaciones no grita 30 líneas rojas. */
function alertBox(el, items) {
  if (!items.length) { el.innerHTML = ""; return; }
  const grupo = (lista, nivel, titulo) => lista.length ? `
    <details class="avisos ${nivel}"${lista.length <= 2 ? " open" : ""}>
      <summary><span class="pt"></span>${lista.length} ${lista.length > 1 ? titulo[1] : titulo[0]}</summary>
      <ul>${lista.map(i => `<li>${esc(i.t)}</li>`).join("")}</ul>
    </details>` : "";
  el.innerHTML = grupo(items.filter(i => i.n === "crit"), "crit", ["punto por resolver", "puntos por resolver"])
    + grupo(items.filter(i => i.n === "warn"), "warn", ["punto para revisar", "puntos para revisar"]);
}

function botonDoc(f) {
  if (f && f.pdf) return ` <button class="btn sm ghost" data-verpdf="${f.id}" title="Ver el documento original (${esc(f.archivo || "PDF")})">📄</button>`;
  return ` <span class="muted small" title="No se guardó el documento original">·</span>`;
}
function renderPeso() {
  const el = $("#pesoBase");
  if (!el) return;
  let pdfs = 0, bytes = 0;
  todasLasFacturas().forEach(({ f }) => { if (f.pdf) { pdfs++; bytes += pesoB64(f.pdf); } });
  let ocPdfs = 0;
  db.cat.oc.forEach(o => { if (o.pdf) { ocPdfs++; bytes += pesoB64(o.pdf); } });
  el.textContent = pdfs || ocPdfs ? `${pdfs} factura(s) y ${ocPdfs} OC con PDF · ${pesoLegible(bytes)}` : "";
  el.title = "Peso de los documentos originales guardados en la base";
  const t = $("#topBaseTxt");
  if (t) {
    const nF = todasLasFacturas().length;
    t.innerHTML = db.nominas.length || nF || db.cat.oc.length
      ? `<b>${nf(db.nominas.length)}</b> nómina(s) · <b>${nf(nF)}</b> factura(s) · <b>${nf(db.cat.oc.length)}</b> OC en la biblioteca`
      : `Base nueva · todavía no hay nada cargado`;
  }
}

/* ---------------- barra de la nómina activa ---------------- */
function etiquetaNomina(n) {
  const tot = (n.fac || []).reduce((s, f) => s + (f.total || 0), 0);
  const est = n.estado === "enviada" ? " · enviada" : n.estado === "cerrada" ? " · cerrada" : "";
  return `${n.fecha ? isoToCl(n.fecha) : "sin fecha"} — ${(n.fac || []).length} línea(s) · ${money(tot)}${est}`;
}
function renderBarraNomina() {
  const act = nominaActiva();
  const ops = nominasOrdenadas().map(n =>
    `<option value="${n.id}"${n.id === act.id ? " selected" : ""}>${esc(etiquetaNomina(n))}</option>`).join("");
  ["Ctx"].forEach(sf => {
    const sel = $("#selNom" + sf);
    if (!sel) return;
    sel.innerHTML = ops;
    const txt = $("#nomEstadoTxt" + sf);
    if (txt) {
      const tag = act.estado === "abierta" ? `<span class="tag warn">abierta</span>`
        : act.estado === "enviada" ? `<span class="tag ok">enviada el ${esc(isoToCl(act.enviada))}</span>`
        : `<span class="tag neutral">cerrada</span>`;
      txt.innerHTML = tag;
    }
  });
  /* aviso de contexto: qué significa la fecha de esta nómina */
  const av = $("#ctxAviso");
  if (av) {
    const hoy = hoyIso(), cierre = act.fecha || "";
    av.innerHTML = act.estado !== "abierta"
      ? `Esta nómina está <b>${esc(act.estado)}</b>: lo que cargues ahora debería ir a una nómina nueva.`
      : cierre && cierre < hoy
        ? `⚠ El viernes de esta nómina (${esc(isoToCl(cierre))}) ya pasó. Si estas facturas son de esta semana, crea la nómina del viernes siguiente.`
        : `Todo lo que cargues en Facturas entra en esta nómina.`;
  }
  if (typeof pintarCampoFecha === "function") pintarCampoFecha("#nomFechaSel", act.fecha, "elegir fecha…");
  const p = $("#nomPeriodoSel");
  if (p) { p.value = act.periodo || ""; p.placeholder = periodoSugerido() + " (automático)"; }
  const d = $("#nomDestSel"); if (d) d.value = act.dest || db.meta.dest || "";
  const r = $("#nomResumenTxt");
  if (r) {
    const cap = db.fac.filter(x => x.tipo === "CAPEX"), man = db.fac.filter(x => x.tipo === "MANT");
    r.textContent = `${cap.length} CAPEX · ${man.length} mantención · total ${nf(db.fac.reduce((s, x) => s + (x.total || 0), 0))}`;
  }
  $("#btnNomEnviada").disabled = act.estado === "enviada";
  $("#btnNomReabrir").disabled = act.estado === "abierta";
}

/* ---------------- panel de control ---------------- */
function tileHtml(o) {
  return `<div class="tile click ${o.n ? "n-" + o.n : ""}" data-ir="${o.ir || ""}" title="${esc(o.tip || "")}">
    <div class="k">${esc(o.k)}</div>
    <div class="v ${o.chico ? "chico" : ""}">${o.v}</div>
    <div class="s">${o.s}</div></div>`;
}
function renderTiles() {
  const cap = db.fac.filter(f => f.tipo === "CAPEX"), man = db.fac.filter(f => f.tipo === "MANT");
  const tot = a => a.reduce((s, f) => s + (f.total || 0), 0);
  const pend = db.eepp.filter(e => !e.facId);
  const e = estadoPasos(), act = nominaActiva();
  const probs = e.conAlerta;

  /* --- KPI: cuatro números, cada uno con su acción --- */
  $("#homeTiles").innerHTML = [
    tileHtml({
      k: "Total de esta nómina", v: money(tot(db.fac)), n: "acc", ir: "nomina",
      s: `${nf(db.fac.length)} líneas · ${nf(cap.length)} CAPEX · ${nf(man.length)} mantención`,
      tip: "IVA incluido. Ir a la nómina"
    }),
    tileHtml({
      k: "Cuadros por enviar", v: nf(e.porEnviar), chico: true, n: e.porEnviar ? "warn" : "ok", ir: "eepp",
      s: e.porEnviar ? `El proveedor no puede facturar hasta que salga el correo` : `Todos los cuadros salieron`,
      tip: "Ir a los estados de pago"
    }),
    tileHtml({
      k: "Esperando factura", v: nf(pend.filter(x => x.enviado).length), chico: true, n: "acc", ir: "eepp",
      s: `${money(pend.reduce((s, x) => s + (x.total || 0), 0))} comprometido con proveedores`,
      tip: "Cuadros enviados cuya factura todavía no llega"
    }),
    tileHtml({
      k: "Líneas con alerta", v: nf(probs), chico: true, n: probs ? "crit" : "ok", ir: "alertas",
      s: probs ? `Revísalas antes de enviar a finanzas` : `Todo cuadrado: IVA, sedes y duplicados`,
      tip: "Ver solo las facturas con alerta"
    })
  ].join("");

  /* --- stepper del proceso --- */
  const pasos = [
    { k: "1", ir: "eepp", lb: "Estados de pago", st: e.p1,
      dt: e.porEnviar ? `${nf(e.porEnviar)} cuadro(s) por enviar al proveedor`
        : e.esperando ? `${nf(e.esperando)} esperando que llegue la factura`
        : db.eepp.length ? "Todos facturados" : "Sin estados de pago esta semana" },
    { k: "2", ir: "facturas", lb: "Facturas recibidas", st: e.p2,
      dt: !db.fac.length ? "Todavía no cargas facturas"
        : probs ? `${nf(probs)} línea(s) con alerta por revisar` : `${nf(db.fac.length)} facturas leídas y cuadradas` },
    { k: "3", ir: "nomina", lb: "Armar la nómina", st: e.p3,
      dt: db.fac.length ? `${money(tot(db.fac))} en ${nf(db.fac.length)} líneas` : "Se llena con las facturas del paso 2" },
    { k: "4", ir: "correo", lb: "Correo a finanzas", st: e.p4,
      dt: act.estado === "enviada" ? `Enviada el ${isoToCl(act.enviada)}`
        : !db.fac.length ? "Se arma cuando la nómina tenga facturas"
        : probs ? "Resuelve las alertas antes de enviar" : "Listo para copiar y enviar" }
  ];
  const pasoActual = pasos.find(p => !p.st.hecho) || pasos[3];
  $("#homeStepper").innerHTML = pasos.map(p => `
    <div class="st ${p.st.hecho ? "hecho" : ""} ${p === pasoActual && !p.st.hecho ? "act" : ""}" data-ir="${p.ir}">
      <div class="top"><span class="n"><span>${p.k}</span></span><span class="lb">${esc(p.lb)}</span>
        ${p.st.cnt ? `<span class="cnt">${nf(p.st.cnt)}</span>` : ""}</div>
      <div class="dt">${esc(p.dt)}</div>
    </div>`).join("");

  /* --- título con la nómina en curso --- */
  const sal = $("#homeSaludo");
  if (sal) sal.innerHTML = act.fecha
    ? `Nómina del ${esc(fechaLarga(act.fecha))}`
    : `Nómina sin fecha asignada`;

  /* --- lista de tareas --- */
  renderTareas(e, pend, act);

  /* --- tiles de la pestaña Nómina --- */
  $("#nomTiles").innerHTML = `
    <div class="tile n-acc"><div class="k">Development + Enhancement CAPEX</div><div class="v">${money(tot(cap))}</div><div class="s">${nf(cap.length)} líneas · neto ${nf(cap.reduce((s, f) => s + (f.neto || 0), 0))}</div></div>
    <div class="tile"><div class="k">Maitenance</div><div class="v">${money(tot(man))}</div><div class="s">${nf(man.length)} líneas · neto ${nf(man.reduce((s, f) => s + (f.neto || 0), 0))}</div></div>
    <div class="tile ${probs ? "n-crit" : "n-ok"}"><div class="k">Total a contabilizar</div><div class="v">${money(tot(db.fac))}</div><div class="s">${nf(db.fac.length)} líneas · ${probs ? nf(probs) + " con alerta" : "sin alertas"}</div></div>
    <div class="tile"><div class="k">Estado</div><div class="v chico">${act.estado === "enviada" ? "Enviada" : act.estado === "cerrada" ? "Cerrada" : "Abierta"}</div><div class="s">${act.estado === "enviada" ? "el " + esc(isoToCl(act.enviada)) : "período " + esc(act.periodo || periodoSugerido() || "—")}</div></div>`;

  /* en el panel no repetimos los avisos: ya están en la lista de pendientes */
  alertBox($("#homeAlerts"), []);

  const tb = $("#tblHomeNom tbody");
  if (tb) tb.innerHTML = nominasOrdenadas().slice(0, 12).map(n => {
    const t = (n.fac || []).reduce((s, f) => s + (f.total || 0), 0);
    const est = n.estado === "enviada" ? `<span class="tag ok">enviada</span>`
      : n.estado === "abierta" ? `<span class="tag warn">abierta</span>` : `<span class="tag neutral">cerrada</span>`;
    return `<tr data-nom="${n.id}" class="${n.id === act.id ? "sel" : ""}" title="Trabajar en esta nómina"><td class="mono">${esc(fechaLarga(n.fecha))}</td>
      <td>${est}</td><td class="num">${(n.fac || []).length}</td><td class="num">${money(t)}</td></tr>`;
  }).join("") || `<tr><td colspan="4" class="muted" style="padding:14px">Todavía no hay nóminas registradas.</td></tr>`;
}

/* ---------------- qué hay que hacer ahora ---------------- */
function tareaHtml(t) {
  return `<div class="tarea">
    <span class="pt ${t.n}"></span>
    <span class="tx"><b>${t.b}</b><span>${t.d}</span></span>
    ${t.ir ? `<button class="btn ${t.pri ? "primary" : ""} sm" data-ir="${t.ir}">${esc(t.cta)}</button>` : ""}
  </div>`;
}
function renderTareas(e, pend, act) {
  const cont = $("#homeTareas");
  if (!cont) return;
  const t = [];
  if (!db.eepp.length && !db.fac.length && !db.cat.oc.length) {
    t.push({ n: "info", b: "¿Ya tienes una base de semanas anteriores?", ir: "abrirbase", cta: "Abrir base…",
      d: "Abre el archivo .json que guardaste la última vez: recupera el historial, la biblioteca de OC y los proveedores." });
    t.push({ n: "info", b: "Si empiezas de cero, carga tus órdenes de compra", pri: true, ir: "oc", cta: "Ir a la biblioteca",
      d: "Arrastra los PDF de las OC o el export de Netsuite. Con eso la app arma los estados de pago casi sin tipear." });
  }
  if (e.porEnviar) {
    t.push({ n: "crit", b: `${nf(e.porEnviar)} cuadro(s) de estado de pago sin enviar`, pri: true, ir: "eepp", cta: "Generar los correos",
      d: "Mientras el proveedor no reciba el cuadro con vendor, OC, project code e IR, no puede emitir la factura." });
  }
  if (e.conAlerta) {
    t.push({ n: "crit", b: `${nf(e.conAlerta)} factura(s) con alertas de control`, pri: !e.porEnviar, ir: "alertas", cta: "Revisar",
      d: "Pueden ser IVA que no cuadra, sede sin identificar, documento repetido o falta el IR de Netsuite." });
  }
  if (e.esperando) {
    t.push({ n: "warn", b: `${nf(e.esperando)} factura(s) pendientes de proveedores`, ir: "eepp", cta: "Ver detalle",
      d: `${money(pend.filter(x => x.enviado).reduce((s, x) => s + (x.total || 0), 0))} ya comprometido. Si no llegan antes del viernes, pasan a la nómina siguiente.` });
  }
  const sinIr = db.fac.filter(f => !f.ir).length;
  if (sinIr) {
    t.push({ n: "warn", b: `${nf(sinIr)} factura(s) sin número de referencia (IR)`, ir: "facturas", cta: "Pegar los IR",
      d: "El IR no viene impreso en la factura: se pega desde el listado de recepciones de Netsuite." });
  }
  if (db.fac.length && !e.conAlerta && act.estado === "abierta") {
    t.push({ n: "ok", b: "La nómina está lista para enviar a finanzas", pri: true, ir: "correo", cta: "Ver el correo",
      d: `${nf(db.fac.length)} líneas por ${money(db.fac.reduce((s, f) => s + (f.total || 0), 0))}. Copia el correo y luego márcala como enviada.` });
  }
  if (act.estado === "enviada") {
    t.push({ n: "ok", b: `Nómina del ${isoToCl(act.fecha)} ya enviada`, ir: "nomina", cta: "Ver nómina",
      d: "Para seguir cargando facturas, cambia arriba a la nómina del viernes siguiente." });
  }
  if (typeof dirty !== "undefined" && dirty) {
    t.push({ n: "warn", b: "Hay cambios sin guardar", ir: "guardar", cta: "Guardar base",
      d: "La app no guarda sola: descarga el archivo .json para no perder el trabajo de hoy." });
  }
  cont.innerHTML = t.length ? t.map(tareaHtml).join("")
    : `<div class="vacio"><span class="ic">✓</span><b>No hay nada pendiente</b>
       Cuando envíes cuadros a proveedores o cargues facturas, las tareas aparecen acá.</div>`;
}

/* ---------------- EEPP ---------------- */
function estadoEepp(e) {
  const f = e.facId ? db.fac.find(x => x.id === e.facId) : null;
  if (f) return { tag: `<span class="tag ok">facturado</span>`, n: "ok" };
  if (e.enviado) return { tag: `<span class="tag warn" title="Enviado el ${esc(isoToCl(e.enviado))}">esperando factura</span>`, n: "warn" };
  return { tag: `<span class="tag neutral">por enviar</span>`, n: "pend" };
}
function renderEepp() {
  const tb = $("#tblEepp tbody");
  tb.innerHTML = db.eepp.map(e => {
    const f = e.facId ? db.fac.find(x => x.id === e.facId) : null;
    const st = estadoEepp(e);
    const p = provDeEepp(e);
    return `<tr data-id="${e.id}" class="${e.id === epEditandoId ? "editando" : ""}">
      <td><input type="checkbox" class="ck"></td>
      <td>${st.tag}</td>
      <td><button class="btn sm" data-epedit="${e.id}" title="Editar este estado de pago en el formulario">✎</button></td>
      <td><button class="btn sm ghost" data-epmail="${e.id}" title="Generar el correo de este cuadro">✉</button></td>
      <td class="edit" data-f="sede" contenteditable>${esc(e.sede || "")}</td>
      <td class="edit mono" data-f="proy" contenteditable>${esc(e.proy || "")}</td>
      <td class="edit mono" data-f="oc" contenteditable>${esc(e.oc || "")}</td>
      <td class="edit mono" data-f="vendor" contenteditable>${esc(e.vendor || "")}</td>
      <td class="small">${esc(p ? p.nombre : "—")}</td>
      <td class="edit mono" data-f="ir" contenteditable>${esc(e.ir || "")}</td>
      <td class="edit" data-f="ep" contenteditable>${esc(e.ep || "")}</td>
      <td class="num edit" data-f="neto" contenteditable>${nf(e.neto)}</td>
      <td><select data-f="exenta"><option value=""${e.exenta ? "" : " selected"}>19%</option><option value="1"${e.exenta ? " selected" : ""}>exenta</option></select></td>
      <td class="num">${nf(e.iva)}</td>
      <td class="num">${nf(e.total)}</td>
      <td class="edit wrap small" data-f="glosa" contenteditable>${esc(e.glosa || "")}</td>
      <td class="small">${f ? esc((f.exenta ? "FAEX " : "FAE ") + (f.doc || f.archivo)) : ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="17" class="muted" style="padding:16px">Sin estados de pago cargados. Usa la carga masiva o el formulario de arriba.</td></tr>`;
  const al = [];
  const porEnviar = db.eepp.filter(e => !e.enviado && !e.facId);
  if (porEnviar.length) al.push({ n: "warn", t: `${porEnviar.length} estado(s) de pago sin enviar al proveedor: marca las líneas y pulsa «Generar correo al proveedor».` });
  const sinSede = db.eepp.filter(e => !e.sede).length;
  if (sinSede) al.push({ n: "warn", t: `${sinSede} sin sede: complétala para que la nómina quede bien agrupada.` });
  const exentas = db.eepp.filter(e => e.exenta).length;
  if (exentas) al.push({ n: "warn", t: `${exentas} línea(s) exentas de IVA (la celda del IVA venía vacía en el cuadro): el total queda igual al neto y se pedirá factura exenta.` });
  const sinVendor = db.eepp.filter(e => !e.vendor && !e.rut).length;
  if (sinVendor) al.push({ n: "warn", t: `${sinVendor} sin código de proveedor (Vendor #): sin eso no puedo saber a quién enviar el cuadro.` });
  alertBox($("#eeppAlerts"), al);
  const rse = $("#eeppResumen");
  if (rse) rse.textContent = db.eepp.length
    ? `${nf(db.eepp.length)} línea(s) · comprometido ${money(db.eepp.filter(x => !x.facId).reduce((s2, x) => s2 + (x.total || 0), 0))}`
    : "";
  /* selector de proveedor del formulario */
  const sel = $("#epProv");
  if (sel && sel.dataset.n !== String(db.cat.prov.length)) {
    sel.innerHTML = `<option value="">— elige del catálogo —</option>` + db.cat.prov
      .slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
      .map(p => `<option value="${esc(p.rut)}">${esc((p.cod ? p.cod + " " : "") + (p.nombre || p.rut))}</option>`).join("");
    sel.dataset.n = String(db.cat.prov.length);
  }
  const selS = $("#epSede");
  if (selS && selS.dataset.n !== String(db.cat.soc.length)) {
    selS.innerHTML = ["", ...db.cat.soc.map(s => s.sede)].map(s => `<option>${s}</option>`).join("");
    selS.dataset.n = String(db.cat.soc.length);
  }
}

/* ---------------- Facturas ---------------- */
function renderFac() {
  const tb = $("#tblFac tbody");
  const lista = soloProblemas ? db.fac.filter(f => nivel(controles(f)) !== "ok") : db.fac;
  tb.innerHTML = lista.map(f => {
    const cs = controles(f), nv = nivel(cs);
    const tip = cs.map(c => c.t).join(" · ");
    const badge = nv === "ok" ? `<span class="tag ok">ok</span>`
      : (() => { const n = cs.filter(c => c.n === nv).length;
          const txt = nv === "crit" ? (n > 1 ? "errores" : "error") : (n > 1 ? "avisos" : "aviso");
          return `<span class="tag ${nv}" title="${esc(tip)}">${n} ${txt}</span>`; })();
    return `<tr data-id="${f.id}" class="${nv === "crit" ? "fila-crit" : nv === "warn" ? "fila-warn" : ""}">
      <td><input type="checkbox" class="ck"></td>
      <td>${badge}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-facedit="${f.id}" title="Editar esta factura">✎</button>${botonDoc(f)}</td>
      <td><select data-f="tipo"><option value="CAPEX"${f.tipo === "CAPEX" ? " selected" : ""}>CAPEX</option><option value="MANT"${f.tipo === "MANT" ? " selected" : ""}>Mantención</option></select></td>
      <td><select data-f="sede">${["", ...db.cat.soc.map(s => s.sede)].map(s => `<option${s === f.sede ? " selected" : ""}>${s}</option>`).join("")}</select></td>
      <td class="edit mono" data-f="proy" contenteditable>${esc(f.proy || "")}</td>
      <td class="edit mono" data-f="oc" contenteditable>${esc(f.oc || "")}</td>
      <td class="edit mono" data-f="rut" contenteditable>${esc(f.rut || "")}</td>
      <td class="small">${esc(proveedorTxt(f.rut) || "—")}</td>
      <td class="edit mono" data-f="fecha" contenteditable>${esc(f.fecha || "")}</td>
      <td class="edit mono" data-f="doc" contenteditable>${esc(f.doc || "")}</td>
      <td class="num edit" data-f="neto" contenteditable>${nf(f.neto)}</td>
      <td><select data-f="exenta"><option value=""${f.exenta ? "" : " selected"}>19%</option><option value="1"${f.exenta ? " selected" : ""}>exenta</option></select></td>
      <td class="num edit" data-f="iva" contenteditable>${nf(f.iva)}</td>
      <td class="num edit" data-f="total" contenteditable>${nf(f.total)}</td>
      <td class="edit mono" data-f="ir" contenteditable>${esc(f.ir || "")}</td>
      <td class="edit wrap small" data-f="obs" contenteditable>${esc(f.obs || "")}</td>
      <td class="small muted" title="${esc(f.archivo || "")}">${esc((f.archivo || "").replace(/\.pdf$/i, "").slice(0, 22))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="18" class="muted" style="padding:16px">Sin facturas cargadas.</td></tr>`;

  const al = [];
  db.fac.forEach(f => controles(f).forEach(c =>
    al.push({ n: c.n, t: `${f.doc ? "Doc " + f.doc : f.archivo || "línea"}${f.sede ? " · " + f.sede : ""}: ${c.t}` })));
  alertBox($("#facAlerts"), al);
  const rs = $("#facResumen");
  if (rs) rs.textContent = db.fac.length
    ? `${nf(lista.length)} de ${nf(db.fac.length)} línea(s) · total ${money(db.fac.reduce((s2, f) => s2 + (f.total || 0), 0))}`
    : "";
  if (typeof contarSeleccion === "function") contarSeleccion();
}

/* ---------------- Nómina ---------------- */
const COLS_CAPEX = ["ÍTEM", "SEDE", "PROYECTO", "OC", "RUT", "PROVEEDOR", "FECHA", "DOC. N°", "PERIODO", "NETO", "IVA", "TOTAL", "CONTABILIZADO", "PAGADO", "REFERENCE", "OBSERVACIONES"];
const COLS_MANT = ["ÍTEM", "SEDE", "CUENTA CONTABLE", "OC", "RUT", "PROVEEDOR", "FECHA", "DOC.", "PERIODO", "NETO", "IVA", "TOTAL", "CONTABILIZADO", "PAGADO", "REFERENCE", "OBSERVACIONES"];

function periodoSugerido() {
  const c = {};
  db.fac.forEach(f => { const p = periodoDe(clToIso(f.fecha)); if (p) c[p] = (c[p] || 0) + 1; });
  const k = Object.keys(c).sort((a, b) => c[b] - c[a]);
  return k[0] || periodoDe(nominaActiva().fecha) || periodoDe(db.meta.fecha);
}
function ordenNomina(a, b) {
  const ia = /^IR(\d+)$/.exec(a.ir || ""), ib = /^IR(\d+)$/.exec(b.ir || "");
  if (ia && ib) return +ia[1] - +ib[1];
  if (ia && !ib) return -1;
  if (!ia && ib) return 1;
  return (clToIso(a.fecha) || "").localeCompare(clToIso(b.fecha) || "") || String(a.doc).localeCompare(String(b.doc));
}
function lineasNomina(tipo) {
  const per = nominaActiva().periodo || periodoSugerido();
  return db.fac.filter(f => f.tipo === tipo).slice().sort(ordenNomina).map((f, i) => ({
    item: i + 1, sede: f.sede || "", proy: f.proy || "", oc: f.oc || "", rut: f.rut || "",
    prov: proveedorTxt(f.rut) || "", fecha: f.fecha || "", doc: f.doc ? docPrefijo(f) + " " + f.doc : "",
    periodo: f.periodo || per, neto: f.neto, iva: f.iva, total: f.total,
    cont: "NO", pag: "NO", ir: f.ir || "", obs: f.obs || "", _f: f
  }));
}
function docPrefijo(f) { return f.exenta ? "FAEX" : "FAE"; }

function renderTablaNomina(sel, cols, filas) {
  const th = `<tr>${cols.map((c, i) => `<th class="${[9, 10, 11].includes(i) ? "num" : ""}">${c}</th>`).join("")}</tr>`;
  const body = filas.map(r => `<tr data-id="${r._f.id}">
    <td class="num" style="white-space:nowrap">${r.item} <button class="btn sm ghost" data-facedit="${r._f.id}" title="Editar esta línea">✎</button>${botonDoc(r._f)}</td><td>${esc(r.sede)}</td><td class="mono">${esc(r.proy)}</td>
    <td class="mono">${esc(r.oc)}</td><td class="mono">${esc(r.rut)}</td><td class="small">${esc(r.prov)}</td>
    <td class="mono">${esc(r.fecha)}</td><td class="mono">${esc(r.doc)}</td><td class="edit" data-f="periodo" contenteditable>${esc(r.periodo)}</td>
    <td class="num">${nf(r.neto)}</td><td class="num">${nf(r.iva)}</td><td class="num">${nf(r.total)}</td>
    <td>${r.cont}</td><td>${r.pag}</td><td class="mono">${esc(r.ir)}</td>
    <td class="edit wrap small" data-f="obs" contenteditable>${esc(r.obs)}</td></tr>`).join("")
    || `<tr><td colspan="16" class="muted" style="padding:14px">Sin líneas.</td></tr>`;
  const sum = k => filas.reduce((s, r) => s + (r[k] || 0), 0);
  const foot = filas.length ? `<tr><td colspan="9">TOTAL (${filas.length} líneas)</td>
    <td class="num">${nf(sum("neto"))}</td><td class="num">${nf(sum("iva"))}</td><td class="num">${nf(sum("total"))}</td>
    <td colspan="4"></td></tr>` : "";
  $(sel + " thead").innerHTML = th;
  $(sel + " tbody").innerHTML = body;
  $(sel + " tfoot").innerHTML = foot;
}
function resumenSociedad() {
  const map = new Map(db.cat.soc.map(s => [s.sede, 0]));
  db.fac.forEach(f => { if (!f.sede) return; map.set(f.sede, (map.get(f.sede) || 0) + (f.total || 0)); });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
function renderNomina() {
  const nom = nominaActiva();
  renderTablaNomina("#tblNomCapex", COLS_CAPEX, lineasNomina("CAPEX"));
  renderTablaNomina("#tblNomMant", COLS_MANT, lineasNomina("MANT"));
  const res = resumenSociedad(), tot = res.reduce((s, [, v]) => s + v, 0);
  $("#tblSoc thead").innerHTML = `<tr><th>Colegio</th><th class="num">Monto</th><th class="num">%</th></tr>`;
  /* en pantalla solo los colegios con monto; el correo sí lleva todos */
  const conMonto = res.filter(([, v]) => v > 0), sinMonto = res.length - conMonto.length;
  $("#tblSoc tbody").innerHTML = conMonto.map(([s, v]) =>
    `<tr><td>${s}</td><td class="num">${money(v)}</td><td class="num muted">${tot ? (v / tot * 100).toFixed(1) : "0.0"}%</td></tr>`).join("")
    + (sinMonto ? `<tr><td colspan="3" class="muted xs">${sinMonto} colegio(s) sin monto esta semana — en el correo van igual, con $0</td></tr>` : "")
    || `<tr><td colspan="3" class="muted">Sin montos todavía.</td></tr>`;
  $("#tblSoc tfoot").innerHTML = `<tr><td>TOTAL</td><td class="num">${money(tot)}</td><td></td></tr>`;
  const max = Math.max(1, ...res.map(([, v]) => v));
  $("#socChart").innerHTML = res.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([s, v]) =>
    `<div class="lbl">${s}</div><div class="track"><div class="fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div><div class="val">${nf(v)}</div>`
  ).join("") || `<div class="muted small" style="grid-column:1/-1">Sin montos todavía.</div>`;
  const al = [];
  if (nom.estado === "enviada") al.push({ n: "warn",
    t: `Esta nómina está marcada como enviada el ${isoToCl(nom.enviada)}. Puedes editarla, pero acuérdate de reenviar el correo si cambias montos.` });
  const sinSede = db.fac.filter(f => !f.sede).length;
  if (sinSede) al.push({ n: "crit", t: `${sinSede} línea(s) sin sede: no entran en el resumen por sociedad.` });
  const crits = db.fac.filter(f => nivel(controles(f)) === "crit").length;
  if (crits) al.push({ n: "crit", t: `${crits} línea(s) con errores pendientes.` });
  if (!crits && db.fac.length) al.push({ n: "ok", t: "Cuadratura correcta: neto + IVA = total en todas las líneas." });
  const el = $("#nomAlerts");
  if (al.length === 1 && al[0].n === "ok") el.innerHTML = `<div class="alert ok">${esc(al[0].t)}</div>`;
  else alertBox(el, al.filter(a => a.n !== "ok"));
}

/* ---------------- Historial y catálogos ---------------- */
let histSel = null, histFiltro = "";
function renderHist() {
  const act = nominaActiva();
  const q = up(histFiltro).trim();
  const coincide = n => {
    if (!q) return true;
    const heno = up([isoToCl(n.fecha), n.fecha, n.periodo || "", n.estado,
      ...(n.fac || []).flatMap(f => [f.oc, f.doc, f.ir, f.sede, f.proy, proveedorTxt(f.rut)])].join(" "));
    return q.split(/\s+/).every(t => heno.includes(t));
  };
  const lista = nominasOrdenadas().filter(coincide);
  $("#tblHist tbody").innerHTML = lista.map(n => {
    const c = (n.fac || []).filter(f => f.tipo === "CAPEX").reduce((s, f) => s + (f.total || 0), 0);
    const m = (n.fac || []).filter(f => f.tipo === "MANT").reduce((s, f) => s + (f.total || 0), 0);
    const est = n.estado === "enviada" ? `<span class="tag ok">enviada</span>`
      : n.estado === "abierta" ? `<span class="tag warn">abierta</span>` : `<span class="tag neutral">cerrada</span>`;
    return `<tr data-nom="${n.id}" class="${n.id === (histSel || act.id) ? "sel" : ""}">
      <td class="mono"><b>${esc(isoToCl(n.fecha))}</b></td><td>${est}</td><td>${esc(n.periodo || periodoDe(n.fecha))}</td>
      <td class="num">${(n.fac || []).length}</td><td class="num">${money(c)}</td>
      <td class="num">${money(m)}</td><td class="num"><b>${money(c + m)}</b></td>
      <td class="mono small muted">${esc(n.enviada ? isoToCl(n.enviada) : "")}</td>
      <td style="white-space:nowrap">
        <button class="btn sm" data-nomver="${n.id}">Ver facturas</button>
        <button class="btn sm ghost" data-nomabrir="${n.id}">Trabajar en ella</button>
        <button class="btn sm ghost" data-nomcorreo="${n.id}">Correo</button>
      </td></tr>`;
  }).join("") || `<tr><td colspan="9" class="muted" style="padding:14px">Ninguna nómina coincide con la búsqueda.</td></tr>`;

  const nomDet = nominaPorId(histSel) || act;
  const filas = histSel ? (nomDet.fac || []).map(f => ({ f, nom: nomDet }))
    : (q ? todasLasFacturas().filter(({ f, nom }) => coincide(nom)) : (nomDet.fac || []).map(f => ({ f, nom: nomDet })));
  $("#histDetTitulo").textContent = histSel
    ? `Facturas de la nómina del ${isoToCl(nomDet.fecha)}`
    : (q ? "Facturas que coinciden con la búsqueda" : `Facturas de la nómina del ${isoToCl(nomDet.fecha)}`);
  $("#histDetInfo").textContent = `${filas.length} línea(s) · total ${nf(filas.reduce((s, x) => s + (x.f.total || 0), 0))}`;
  $("#tblHistDet tbody").innerHTML = filas.map(({ f, nom }) => `<tr>
    <td style="white-space:nowrap">${f.pdf
      ? `<button class="btn sm" data-verpdf="${f.id}">📄 Ver</button>`
      : `<span class="muted small">sin PDF</span>`} <button class="btn sm ghost" data-facedit="${f.id}" title="Editar">✎</button></td>
    <td class="mono">${esc(isoToCl(nom.fecha))}</td>
    <td>${f.tipo === "CAPEX" ? `<span class="tag capex">CAPEX</span>` : `<span class="tag neutral">mant.</span>`}</td>
    <td>${esc(f.sede || "")}</td><td class="mono">${esc(f.proy || "")}</td><td class="mono">${esc(f.oc || "")}</td>
    <td class="small">${esc(proveedorTxt(f.rut) || f.rut || "")}</td>
    <td class="mono">${esc(f.fecha || "")}</td><td class="mono">${esc(f.doc || "")}</td>
    <td class="num">${nf(f.neto)}</td><td class="num">${nf(f.total)}</td><td class="mono">${esc(f.ir || "")}</td>
  </tr>`).join("") || `<tr><td colspan="12" class="muted" style="padding:14px">Sin facturas.</td></tr>`;
}
function renderCat() {
  $("#tblCatSoc tbody").innerHTML = db.cat.soc.map((s, i) => `<tr data-i="${i}">
    <td class="edit mono" data-f="sede" contenteditable>${esc(s.sede)}</td>
    <td class="edit mono" data-f="rut" contenteditable>${esc(s.rut)}</td>
    <td class="edit" data-f="nombre" contenteditable>${esc(s.nombre)}</td>
    <td class="edit mono" data-f="pre" contenteditable>${esc(s.pre)}</td>
    <td><button class="btn sm ghost danger" data-del="soc">×</button></td></tr>`).join("");
  $("#tblCatProv tbody").innerHTML = db.cat.prov.map((p, i) => `<tr data-i="${i}">
    <td class="edit mono" data-f="rut" contenteditable>${esc(p.rut)}</td>
    <td class="edit mono" data-f="cod" contenteditable>${esc(p.cod)}</td>
    <td class="edit" data-f="nombre" contenteditable>${esc(p.nombre)}</td>
    <td class="edit mono" data-f="email" contenteditable>${esc(p.email || "")}</td>
    <td class="edit" data-f="contacto" contenteditable>${esc(p.contacto || "")}</td>
    <td><select data-f="tipo"><option value=""></option><option value="CAPEX"${p.tipo === "CAPEX" ? " selected" : ""}>CAPEX</option><option value="MANT"${p.tipo === "MANT" ? " selected" : ""}>Mantención</option></select></td>
    <td class="edit mono" data-f="cta" contenteditable>${esc(p.cta)}</td>
    <td><button class="btn sm ghost danger" data-del="prov">×</button></td></tr>`).join("");
  $("#tblCatOc tbody").innerHTML = db.cat.oc.map((o, i) => {
    const lib = ocLiberado(o.oc), saldo = o.monto ? o.monto - lib : null;
    return `<tr data-i="${i}">
    <td class="edit mono" data-f="oc" contenteditable>${esc(o.oc)}</td>
    <td class="mono">${esc(o.rut)}</td><td class="small">${esc(provPorRut(o.rut)?.nombre || "")}</td>
    <td class="edit" data-f="sede" contenteditable>${esc(o.sede)}</td>
    <td class="edit mono" data-f="proy" contenteditable>${esc(o.proy || "")}</td>
    <td class="num edit" data-f="monto" contenteditable>${nf(o.monto)}</td>
    <td class="num">${lib ? nf(lib) : ""}</td>
    <td class="num ${saldo !== null && saldo < 0 ? "" : ""}" ${saldo !== null && saldo < 0 ? 'style="color:var(--crit);font-weight:600"' : ""}>${saldo === null ? "" : nf(saldo)}</td>
    <td class="edit mono" data-f="cta" contenteditable>${esc(o.cta || "")}</td>
    <td class="edit wrap small muted" data-f="glosa" contenteditable>${esc(o.glosa || "")}</td>
    <td class="mono small muted">${esc(isoToCl(o.visto))}</td>
    <td style="white-space:nowrap">${o.pdf ? `<button class="btn sm ghost" data-verocpdf="${i}" title="Ver la orden de compra original">📄</button>` : ""}
      <button class="btn sm ghost danger" data-del="oc">×</button></td></tr>`;
  }).join("")
    || `<tr><td colspan="12" class="muted" style="padding:14px">Vacío. Cárgalo con «Conectar un Excel → Órdenes de compra», o se irá llenando con las facturas y las nóminas anteriores.</td></tr>`;
}
</script>
