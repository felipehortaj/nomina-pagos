<script>
"use strict";
/* =========================================================================
   EVENTOS
   ========================================================================= */
/* ---------- navegación ---------- */
function irATab(tab, foco) {
  const b = document.querySelector(`nav.tabs button[data-tab="${tab}"]`);
  if (!b) return;
  $$("nav.tabs button").forEach(x => { x.classList.remove("active"); x.removeAttribute("aria-current"); });
  b.classList.add("active"); b.setAttribute("aria-current", "page");
  $$("section.panel").forEach(p => p.classList.remove("active"));
  $("#tab-" + tab).classList.add("active");
  window.scrollTo({ top: 0 });
  if (foco) setTimeout(() => { const el = $(foco); if (el) { el.focus(); el.select?.(); } }, 60);
}
$$("nav.tabs button").forEach(b => b.addEventListener("click", () => irATab(b.dataset.tab)));

/* atajos del panel: mosaicos, pasos y tareas llevan a donde se resuelve la cosa */
const DESTINOS = {
  inicio: () => irATab("inicio"),
  eepp: () => irATab("eepp"),
  facturas: () => irATab("facturas"),
  nomina: () => irATab("nomina"),
  correo: () => irATab("correo"),
  oc: () => irATab("oc", "#libBuscar"),
  historial: () => irATab("historial"),
  catalogos: () => irATab("catalogos"),
  alertas: () => {
    soloProblemas = true;
    const c = $("#chkSoloProb"); if (c) c.checked = true;
    renderFac(); irATab("facturas");
  },
  buscaroc: () => irATab("eepp", "#ocBuscar"),
  cargarfac: () => { irATab("facturas"); setTimeout(() => $("#fileFac").click(), 80); },
  guardar: () => guardarDb(),
  abrirbase: () => $("#fileDb").click()
};
document.addEventListener("click", e => {
  const el = e.target.closest?.("[data-ir]");
  if (!el || !el.dataset.ir) return;
  const fn = DESTINOS[el.dataset.ir];
  if (fn) { e.preventDefault(); fn(); }
});
/* tema */
$("#btnTheme").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
});
/* densidad de las tablas */
$("#segDens").addEventListener("click", e => {
  const b = e.target.closest("button[data-dens]"); if (!b) return;
  document.documentElement.dataset.density = b.dataset.dens;
  $$("#segDens button").forEach(x => x.classList.toggle("on", x === b));
});
/* ayuda: muestra u oculta todos los textos explicativos de la interfaz */
$("#btnAyuda").addEventListener("click", () => {
  const on = document.documentElement.dataset.ayuda === "1";
  document.documentElement.dataset.ayuda = on ? "0" : "1";
  $("#btnAyuda").classList.toggle("primary", !on);
  toast(on ? "Explicaciones ocultas" : "Explicaciones visibles en cada pantalla");
});
/* botones de acceso rápido de los encabezados */
[["#btnIrEepp", "eepp"], ["#btnIrFac", "cargarfac"], ["#btnIrHist", "historial"],
 ["#btnIrLib", "oc"], ["#btnIrLib2", "oc"], ["#btnIrCorreo", "correo"],
 ["#btnFocoOc", "buscaroc"]].forEach(([sel, dest]) => {
  const el = $(sel); if (el) el.dataset.ir = dest;
});
$("#btnPickFac").addEventListener("click", () => $("#fileFac").click());
/* de dónde salen los datos del estado de pago: OC / carga masiva / planilla */
const MODO_EP_HINT = {
  oc: "Lo habitual: eliges la OC y la app trae todos los datos.",
  masiva: "Para cuando ya tienes el cuadro armado en Excel o en un correo enviado.",
  excel: "La planilla queda conectada: puedes volver a leerla cuando la cambies."
};
function modoEp(m) {
  ["oc", "masiva", "excel"].forEach(k => {
    const el = $("#modo" + k[0].toUpperCase() + k.slice(1));
    if (el) el.classList.toggle("hide", k !== m);
  });
  $$("#segModoEp button").forEach(b => b.classList.toggle("on", b.dataset.modo === m));
  const h = $("#modoEpHint"); if (h) h.textContent = MODO_EP_HINT[m] || "";
  irATab("eepp");
}
$("#segModoEp").addEventListener("click", e => {
  const b = e.target.closest("button[data-modo]"); if (!b) return;
  modoEp(b.dataset.modo);
});
/* el panel: elegir una nómina de la lista */
$("#tblHomeNom").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-nom]");
  if (tr) cambiarNomina(tr.dataset.nom);
});
/* base de datos */
$("#btnSaveDb").addEventListener("click", guardarDb);
$("#btnLoadDb").addEventListener("click", () => $("#fileDb").click());
$("#fileDb").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!o.cat) throw new Error("formato");
    cargaManual = true;                                        // no pisar con lo recuperado del navegador
    const { db: ndb, migradas } = dbDesdeObjeto(o);
    db = ndb;
    aplicarMetaAlFormulario(); render(); setDirty(migradas > 0);
    autoguardarYa();                                           // la base abierta pasa a ser la de este navegador
    toast(`Base cargada: ${db.nominas.length} nómina(s), ${todasLasFacturas().length} facturas`
      + (migradas ? ` · ${migradas} factura(s) del modelo anterior quedaron en la nómina del ${isoToCl(nominaActiva().fecha)}` : ""));
  } catch (err) { toast("No pude leer ese archivo: debe ser un .json guardado por esta app"); }
  e.target.value = "";
});
/* metadatos */
function aplicarMetaAlFormulario() {
  if ($("#nomFecha")) $("#nomFecha").value = db.meta.fecha || "";
  if ($("#nomPeriodo")) $("#nomPeriodo").value = db.meta.periodo || "";
  $("#nomDest").value = db.meta.dest || "";
  $("#nomFirma").value = db.meta.firma || "";
  $("#mailPara").value = db.meta.para || "";
  $("#nomCargo").value = db.meta.cargo || "";
  $("#nomFono").value = db.meta.fono || "";
}
[["#nomDest", "dest"], ["#nomFirma", "firma"], ["#mailPara", "para"], ["#nomCargo", "cargo"], ["#nomFono", "fono"]]
  .forEach(([sel, k]) => $(sel).addEventListener("change", e => { db.meta[k] = e.target.value; setDirty(); render(); }));
$("#mailAsunto").addEventListener("input", e => e.target.dataset.auto = "0");

/* ---------- nómina activa ---------- */
function cambiarNomina(id) {
  if (!nominaPorId(id)) return;
  db.activa = id; histSel = null;
  setDirty(); render();
  const n = nominaActiva();
  toast(`Trabajando en la nómina del ${isoToCl(n.fecha)} · ${n.fac.length} línea(s)`);
}
["Ctx"].forEach(sf => {
  $("#selNom" + sf).addEventListener("change", e => cambiarNomina(e.target.value));
  $("#btnNomNueva" + sf).addEventListener("click", e => {
    const ult = nominasOrdenadas()[0];
    const sug = proximoViernes(ult && ult.fecha ? sumaDias(ult.fecha, 1) : hoyIso());
    abrirCalendario(e.currentTarget, sug, iso => {
      const ya = db.nominas.find(n => n.fecha === iso);
      if (ya) { cambiarNomina(ya.id); toast(`Ya existía la nómina del ${isoToCl(iso)}: quedó seleccionada`); return; }
      const n = nuevaNomina(iso);
      db.nominas.push(n);
      cambiarNomina(n.id);
      toast(`Nómina del ${fechaLarga(iso)} creada`);
    }, { sugerida: sug, atajos: [
      { t: "Viernes de esta semana", iso: proximoViernes(hoyIso()) },
      { t: "Viernes siguiente", iso: sug }
    ] });
  });
});
$("#btnNomViernes").addEventListener("click", () => {
  const n = nominaActiva();
  n.fecha = proximoViernes(n.fecha || db.meta.fecha);
  setDirty(); render();
});
$("#nomPeriodoSel").addEventListener("change", e => { nominaActiva().periodo = e.target.value; setDirty(); render(); });
$("#nomDestSel").addEventListener("change", e => { nominaActiva().dest = e.target.value; setDirty(); render(); });
$("#btnNomEnviada").addEventListener("click", () => {
  const n = nominaActiva();
  if (!n.fac.length) { toast("Esta nómina no tiene facturas"); return; }
  const crit = n.fac.filter(f => nivel(controles(f)) === "crit").length;
  if (crit && !confirm(`Hay ${crit} línea(s) con errores. ¿Marcarla como enviada de todas formas?`)) return;
  n.estado = "enviada";
  n.enviada = new Date().toISOString().slice(0, 10);
  db.eepp = db.eepp.filter(e => !e.facId);
  const sig = proximoViernes(sumaDias(n.fecha, 1));
  if (!db.nominas.some(x => x.fecha === sig)) {
    const nx = nuevaNomina(sig);
    db.nominas.push(nx); db.activa = nx.id;
    toast(`Nómina del ${isoToCl(n.fecha)} marcada como enviada. Abrí la del ${isoToCl(sig)}.`);
  } else toast(`Nómina del ${isoToCl(n.fecha)} marcada como enviada.`);
  setDirty(); render();
});
$("#btnNomReabrir").addEventListener("click", () => {
  const n = nominaActiva();
  n.estado = "abierta"; n.enviada = "";
  setDirty(); render(); toast("Nómina reabierta: puedes seguir agregando facturas");
});
$("#btnNomBorrar").addEventListener("click", () => {
  const n = nominaActiva();
  if (!confirm(`Se elimina la nómina del ${isoToCl(n.fecha)} y sus ${n.fac.length} línea(s). ¿Seguir?`)) return;
  db.nominas = db.nominas.filter(x => x.id !== n.id);
  if (!db.nominas.length) db.nominas.push(nuevaNomina());
  db.activa = nominasOrdenadas()[0].id;
  setDirty(); render();
});
let movIds = [];
$("#btnMoverFac").addEventListener("click", () => {
  movIds = $$("#tblFac tbody tr").filter(tr => $(".ck", tr)?.checked).map(tr => tr.dataset.id);
  if (!movIds.length) { toast("Marca primero las facturas que quieres mover"); return; }
  const otras = nominasOrdenadas().filter(n => n.id !== db.activa);
  $("#movNom").innerHTML = otras.length
    ? otras.map(n => `<option value="${n.id}">${esc(fechaLarga(n.fecha))}${n.estado === "enviada" ? " · enviada" : ""} · ${n.fac.length} línea(s)</option>`).join("")
    : `<option value="">(no hay otras nóminas)</option>`;
  pintarCampoFecha("#movFecha", "", "elegir fecha…");
  $("#movInfo").textContent = `${movIds.length} factura(s) seleccionada(s) · desde la nómina del ${isoToCl(nominaActiva().fecha)}`;
  $("#modalMover").classList.remove("hide");
});
$("#movFecha").addEventListener("click", e => {
  const act = nominaActiva();
  abrirCalendario(e.currentTarget, e.currentTarget.dataset.iso || proximoViernes(sumaDias(act.fecha || hoyIso(), 1)), iso => {
    pintarCampoFecha("#movFecha", iso);
    $("#movNom").value = "";
  }, { atajos: [
    { t: "Viernes siguiente al de esta nómina", iso: proximoViernes(sumaDias(act.fecha || hoyIso(), 1)) },
    { t: "Viernes anterior", iso: proximoViernes(sumaDias(act.fecha || hoyIso(), -13)) },
    { t: "Viernes de esta semana", iso: proximoViernes(hoyIso()) }
  ] });
});
$("#btnMovCancelar").addEventListener("click", () => $("#modalMover").classList.add("hide"));
$("#modalMover").addEventListener("click", e => { if (e.target.id === "modalMover") $("#modalMover").classList.add("hide"); });
$("#btnMovOk").addEventListener("click", () => {
  const iso = $("#movFecha").dataset.iso;
  let destino = null;
  if (iso) {
    destino = db.nominas.find(n => n.fecha === iso);
    if (!destino) { destino = nuevaNomina(iso); db.nominas.push(destino); }
  } else destino = nominaPorId($("#movNom").value);
  if (!destino) { toast("Elige una nómina de destino o una fecha nueva"); return; }
  const act = nominaActiva();
  const mueve = act.fac.filter(f => movIds.includes(f.id));
  act.fac = act.fac.filter(f => !movIds.includes(f.id));
  destino.fac = destino.fac.concat(mueve);
  $("#modalMover").classList.add("hide");
  setDirty(); render();
  toast(`${mueve.length} factura(s) movidas a la nómina del ${isoToCl(destino.fecha)}`);
});

/* ---------- drag & drop genérico ---------- */
function conectarDrop(dropSel, inputSel, handler) {
  const d = $(dropSel), i = $(inputSel);
  d.addEventListener("click", () => i.click());
  i.addEventListener("change", e => { handler(Array.from(e.target.files)); e.target.value = ""; });
  ["dragenter", "dragover"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove("over"); }));
  d.addEventListener("drop", async e => {
    const items = Array.from(e.dataTransfer.items || []);
    let files = Array.from(e.dataTransfer.files || []);
    const entries = items.map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (entries.some(en => en.isDirectory)) files = (await Promise.all(entries.map(leerEntrada))).flat();
    handler(files);
  });
}
function leerEntrada(entry) {
  return new Promise(res => {
    if (entry.isFile) entry.file(f => res([f]), () => res([]));
    else if (entry.isDirectory) {
      const rd = entry.createReader(); const acc = [];
      const paso = () => rd.readEntries(async es => {
        if (!es.length) { res((await Promise.all(acc.map(leerEntrada))).flat()); return; }
        acc.push(...es); paso();
      }, () => res([]));
      paso();
    } else res([]);
  });
}
/* ---------- EEPP: carga masiva ---------- */
conectarDrop("#dropEepp", "#fileEepp", async files => {
  const xl = files.filter(f => /\.(xlsx|xlsm|xls)$/i.test(f.name));
  if (!xl.length) { toast("Suelta uno o varios archivos Excel (.xlsx)"); return; }
  let todos = [];
  for (const f of xl) { try { todos = todos.concat(await eeppDesdeXlsx(f)); } catch (e) { toast("No pude leer " + f.name); } }
  if (!todos.length) { toast("No encontré bloques con Vendor / Purchase Order en esos archivos"); return; }
  agregarEepp(todos);
});
$("#btnParseTxt").addEventListener("click", () => {
  const t = $("#txtEepp").value.trim();
  if (!t) { toast("Pega primero el texto del correo"); return; }
  const b = eeppDesdeTexto(t);
  if (!b.length) { toast("No encontré Vendor # / Purchase Order # en el texto"); return; }
  agregarEepp(b); $("#txtEepp").value = "";
});

/* ---------- calendario ---------- */
$("#calAnt").addEventListener("click", () => { calMes--; if (calMes < 0) { calMes = 11; calAnio--; } pintarCalendario(); });
$("#calSig").addEventListener("click", () => { calMes++; if (calMes > 11) { calMes = 0; calAnio++; } pintarCalendario(); });
$("#calAntA").addEventListener("click", () => { calAnio--; pintarCalendario(); });
$("#calSigA").addEventListener("click", () => { calAnio++; pintarCalendario(); });
$("#calCuerpo").addEventListener("click", e => {
  const d = e.target.closest("[data-caldia]"); if (!d) return;
  elegirFecha(d.dataset.caldia);
});
$("#calPie").addEventListener("click", e => {
  const a = e.target.closest("[data-calatajo]"); if (!a) return;
  elegirFecha(a.dataset.calatajo);
});
document.addEventListener("mousedown", e => {
  if ($("#calPop").classList.contains("hide")) return;
  if (e.target.closest("#calPop") || e.target.closest(".fecha-btn")) return;
  cerrarCalendario();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#calPop").classList.contains("hide")) { cerrarCalendario(); e.stopPropagation(); }
});

/* fecha de la nómina */
$("#nomFechaSel").addEventListener("click", e => {
  const n = nominaActiva();
  abrirCalendario(e.currentTarget, n.fecha, iso => {
    const otra = db.nominas.find(x => x.id !== n.id && x.fecha === iso);
    if (otra) { toast(`Ya existe una nómina del ${isoToCl(iso)}`); return; }
    n.fecha = iso; setDirty(); render();
    toast(`Nómina fechada el ${fechaLarga(iso)}`);
  });
});
/* vencimiento del cuadro al proveedor */
$("#epVenc").addEventListener("click", e => {
  abrirCalendario(e.currentTarget, e.currentTarget.dataset.iso, iso => {
    pintarCampoFecha("#epVenc", iso);
    pintarCorreoProveedor();
  }, { atajos: [
    { t: "30 días desde hoy", iso: sumaDias(hoyIso(), 30) },
    { t: "45 días", iso: sumaDias(hoyIso(), 45) },
    { t: "60 días", iso: sumaDias(hoyIso(), 60) }
  ] });
});
/* fecha al importar una nómina anterior */
$("#histFecha").addEventListener("click", e => {
  abrirCalendario(e.currentTarget, e.currentTarget.dataset.iso, iso => pintarCampoFecha("#histFecha", iso));
});

/* ---------- biblioteca de OC ---------- */
let libTimer = null;
$("#libBuscar").addEventListener("input", e => {
  clearTimeout(libTimer);
  libTimer = setTimeout(() => { libQ = e.target.value; libTope = 60; renderLib(); }, 120);
});
$("#libProv").addEventListener("change", e => { libProv = e.target.value; libTope = 60; renderLib(); });
$("#libEstado").addEventListener("change", e => { libEstado = e.target.value; libTope = 60; renderLib(); });
$("#libOrden").addEventListener("change", e => { libOrden = e.target.value; renderLib(); });
$("#btnLibMas").addEventListener("click", () => { libTope += 60; renderLib(); });
$("#libSedes").addEventListener("click", e => {
  const c = e.target.closest("[data-libsede]"); if (!c) return;
  libSede = c.dataset.libsede; libTope = 60; renderLib();
});
/* la selección no re-dibuja la tabla: solo marca la fila y actualiza la barra */
$("#tblLib").addEventListener("change", e => {
  const ck = e.target.closest("[data-libck]"); if (!ck) return;
  const k = ocKey(ck.dataset.libck);
  if (ck.checked) libSel.add(k); else libSel.delete(k);
  ck.closest("tr")?.classList.toggle("sel", ck.checked);
  refrescarBarraLote();
});
$("#chkAllLib").addEventListener("change", e => {
  $$("#tblLib tbody [data-libck]").forEach(ck => {
    ck.checked = e.target.checked;
    const k = ocKey(ck.dataset.libck);
    if (e.target.checked) libSel.add(k); else libSel.delete(k);
    ck.closest("tr")?.classList.toggle("sel", e.target.checked);
  });
  refrescarBarraLote();
});
$("#btnLibNada").addEventListener("click", () => {
  libSel.clear();
  $$("#tblLib tbody [data-libck]").forEach(ck => { ck.checked = false; ck.closest("tr")?.classList.remove("sel"); });
  $("#chkAllLib").checked = false;
  refrescarBarraLote();
});
/* clic en la fila (fuera de los botones) también selecciona */
$("#tblLib").addEventListener("click", e => {
  if (e.target.closest("button, input, a")) return;
  const tr = e.target.closest("tr[data-librow]"); if (!tr) return;
  const ck = $(".ckl", tr); if (!ck) return;
  ck.checked = !ck.checked;
  ck.dispatchEvent(new Event("change", { bubbles: true }));
});
$("#btnLibLote").addEventListener("click", () => {
  if (!libSel.size) { toast("Marca primero las órdenes"); return; }
  const pctTxt = String($("#libPct").value).replace(",", ".").trim();
  let pct = pctTxt === "" ? null : Number(pctTxt);
  if (pct !== null && !isNaN(pct) && pct > 1) pct = pct / 100;
  const ocs = db.cat.oc.filter(o => libSel.has(ocKey(o.oc))).map(o => o.oc);
  irAEepp();
  abrirLote(ocs, pct);
});
document.addEventListener("click", e => {
  const ep = e.target.closest?.("[data-libep]");
  if (ep) { irAEepp(); if (epEditandoId) salirEdicionEepp(true); usarOc(ep.dataset.libep); return; }
  const pdf = e.target.closest?.("[data-libpdf]");
  if (pdf) {
    const reg = db.cat.oc.find(o => ocKey(o.oc) === ocKey(pdf.dataset.libpdf));
    if (reg) verDocumento(reg.pdf, reg.archivo || "orden_de_compra.pdf",
      `OC ${reg.oc} · ${provPorRut(reg.rut)?.nombre || ""} · ${pesoLegible(pesoB64(reg.pdf))}`);
    return;
  }
  const del = e.target.closest?.("[data-lotedel]");
  if (del) { lote.splice(+del.dataset.lotedel, 1); renderLote(); }
});
$("#btnLibPdf").addEventListener("click", () => $("#fileLibPdf").click());
$("#fileLibPdf").addEventListener("change", async e => {
  const fs = Array.from(e.target.files); e.target.value = "";
  if (!fs.length) return;
  const ok = await ocLeerPdfs(fs);
  if (ok) { irAEepp(); $("#ocPdfPanel").scrollIntoView({ behavior: "smooth", block: "start" }); }
});
$("#btnLibXls").addEventListener("click", () => $("#fileLibXls").click());
$("#fileLibXls").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (f) { try { await ocImportarArchivo(f); renderLib(); } catch (err) { toast("No pude leer ese archivo"); } }
});

/* ---------- lote de estados de pago ---------- */
$("#btnLoteCrear").addEventListener("click", crearLote);
$("#btnLoteCerrar").addEventListener("click", () => { lote = []; $("#cardLote").classList.add("hide"); });
$("#tblLote").addEventListener("blur", e => {
  const td = e.target.closest?.("td.edit"); if (!td) return;
  const i = +td.closest("tr").dataset.lote;
  const l = lote[i]; if (!l) return;
  const campo = td.dataset.f;
  if (campo === "pct") { const v = String(td.textContent).replace(",", ".").trim(); const n = v === "" ? null : Number(v); l.pct = n === null || isNaN(n) ? null : (n > 1 ? n / 100 : n); }
  else if (campo === "neto") l.neto = toNum(td.textContent);
  else l[campo] = td.textContent.trim();
  recalcLote(i, campo);
  renderLote();
}, true);
$("#tblLote").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.closest?.("td.edit")) { e.preventDefault(); e.target.blur(); }
});
$("#tblLote").addEventListener("change", e => {
  const sel = e.target.closest?.("select[data-f]"); if (!sel) return;
  const i = +sel.closest("tr").dataset.lote;
  if (lote[i]) { lote[i].exenta = sel.value === "1"; renderLote(); }
});
$("#btnOcPdfLote").addEventListener("click", () => {
  const g = ocPdfGuardar(ocPdfLista);
  ocPdfLista = []; renderOcPdf();
  if (!g.length) { toast("Ninguna OC quedó guardada"); return; }
  abrirLote(g, null);
});

/* ---------- EEPP: conexión a Excel ---------- */
$("#btnXlConectar").addEventListener("click", async () => {
  if (window.showOpenFilePicker) {
    try {
      const [h] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Planillas", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xlsm"], "application/vnd.ms-excel": [".xls"], "text/csv": [".csv"] } }]
      });
      xlHandle = h;
      await xlCargarArchivo(await h.getFile());
      return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  xlHandle = null;
  $("#fileXl").click();
});
$("#fileXl").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  xlHandle = null;
  try { await xlCargarArchivo(f); } catch (err) { toast("No pude leer esa planilla"); }
  e.target.value = "";
});
$("#btnXlRecargar").addEventListener("click", async () => {
  if (!xlHandle) { toast("Este navegador no mantiene el archivo conectado: vuelve a elegirlo"); return; }
  try {
    const guarda = { ...xlMapa }, hoja = $("#xlHoja").value, hdr = +$("#xlFilaHdr").value;
    await xlCargarArchivo(await xlHandle.getFile());
    if ([...$("#xlHoja").options].some(o => o.value === hoja)) $("#xlHoja").value = hoja;
    $("#xlFilaHdr").value = hdr; xlMapa = guarda; xlRender();
    toast("Planilla actualizada");
  } catch (err) { toast("No pude releer el archivo: vuelve a conectarlo"); }
});
$("#xlHoja").addEventListener("change", () => {
  $("#xlFilaHdr").value = xlDetectarFilaTitulos(xlLibro, $("#xlHoja").value);
  xlMapa = {}; xlRender();
});
$("#xlFilaHdr").addEventListener("change", () => { xlMapa = {}; xlRender(); });
$("#xlMap").addEventListener("change", e => {
  const s = e.target.closest("select[data-xlmap]"); if (!s) return;
  const i = +s.value;
  if (i < 0) delete xlMapa[s.dataset.xlmap]; else xlMapa[s.dataset.xlmap] = i;
  xlGuardarMapa(xlHdr, xlMapa); xlRender();
});
$("#btnXlBloques").addEventListener("click", async () => {
  if (!xlLibro) return;
  const ws = xlLibro.Sheets[$("#xlHoja").value];
  if (ws && ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.r = 0; r.s.c = 0; ws["!ref"] = XLSX.utils.encode_range(r); }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const b = eeppDesdeFilas(rows);
  if (!b.length) { toast("Esa hoja no tiene el formato de bloques con Vendor / Purchase Order"); return; }
  agregarEepp(b);
});
$("#xlModo").addEventListener("change", () => {
  const oc = $("#xlModo").value === "oc";
  $("#btnXlTodas").textContent = oc ? "Importar al catálogo de OC" : "Agregar todas las filas";
  $("#btnXlBloques").classList.toggle("hide", oc);
});
$("#btnXlTodas").addEventListener("click", () => {
  if ($("#xlModo").value === "oc") { importarOcDesdeXl(); return; }
  const utiles = xlFilasUtiles();
  if (!utiles.length) { toast("No hay filas para agregar"); return; }
  const nuevos = utiles.map(x => eeppDesdeFilaXl(x.d));
  const sinNeto = nuevos.filter(e => e.neto === null).length;
  if (sinNeto && !confirm(`${sinNeto} de ${nuevos.length} filas no tienen neto a facturar. ¿Agregarlas igual?`)) return;
  nuevos.forEach(e => {
    db.eepp.push(e);
    if (e.rut && e.sede && e.oc) aprenderOc(e.rut, e.sede, e.oc, "", db.meta.fecha, e.proy);
  });
  xlGuardarMapa(xlHdr, xlMapa);
  setDirty(); render();
  toast(`${nuevos.length} estado(s) de pago agregados desde ${xlNombre}`);
});
function xlAlFormulario(i) {
  const d = xlFilaAEepp(xlFilas[i] || []);
  const p = d.rut ? provPorRut(d.rut) : provPorCod(d.vendor);
  $("#epProv").value = p ? p.rut : "";
  $("#epVendor").value = d.vendor || (p ? p.cod : "");
  $("#epOc").value = d.oc || "";
  $("#epProy").value = d.proy || "";
  $("#epSede").value = d.sede || "";
  $("#epIr").value = d.ir || "";
  $("#epGlosa").value = d.glosa || "";
  $("#epEp").value = d.ep || "";
  $("#epBase").value = d.base === null ? "" : nf(d.base);
  $("#epPct").value = d.pct === null ? "" : String(+(d.pct * 100).toFixed(4));
  $("#epNeto").value = d.neto === null ? "" : nf(d.neto);
  $("#epIvaCond").value = d.exenta ? "exenta" : "afecta";
  $("#ocFicha").classList.remove("hide"); $("#ocVacio").classList.add("hide");
  if (d.oc) { $("#ocBuscar").value = d.oc; pintarFichaOc(d.oc); }
  epRecalcular();
  xlGuardarMapa(xlHdr, xlMapa);
  $$("#tblXl tbody tr").forEach(tr => tr.classList.toggle("sel", tr.dataset.xlrow === String(i)));
  $("#epGlosa").scrollIntoView({ behavior: "smooth", block: "center" });
  if (!d.glosa || d.neto === null) toast("Fila cargada: completa lo que falte antes de agregar");
}
document.addEventListener("click", e => {
  const bf = e.target.closest?.("[data-xlform]");
  if (bf) { xlAlFormulario(+bf.dataset.xlform); if (typeof modoEp === "function") modoEp("oc"); return; }
  const ba = e.target.closest?.("[data-xladd]");
  if (!ba) return;
  const d = xlFilaAEepp(xlFilas[+ba.dataset.xladd] || []);
  if (d.neto === null) { toast("Esa fila no tiene neto a facturar: pásala al formulario y complétalo"); xlAlFormulario(+ba.dataset.xladd); return; }
  const el = eeppDesdeFilaXl(d);
  db.eepp.push(el);
  if (el.rut && el.sede && el.oc) aprenderOc(el.rut, el.sede, el.oc, "", db.meta.fecha, el.proy);
  xlGuardarMapa(xlHdr, xlMapa);
  setDirty(); render();
  abrirCorreoProveedor([el]);
});
document.addEventListener("dblclick", e => {
  const tr = e.target.closest?.("#tblXl tbody tr[data-xlrow]");
  if (tr) xlAlFormulario(+tr.dataset.xlrow);
});

/* ---------- EEPP: buscador de órdenes de compra ---------- */
let ocTimer = null;
$("#ocBuscar").addEventListener("input", e => {
  clearTimeout(ocTimer);
  ocTimer = setTimeout(() => renderOcBusqueda(e.target.value), 120);
});
$("#ocBuscar").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const q = $("#ocBuscar").value.trim();
  const res = ocBuscarEnCatalogo(q);
  if (res.length === 1) { usarOc(res[0].oc); return; }
  const exacta = res.find(o => ocKey(o.oc) === ocKey(q));
  if (exacta) { usarOc(exacta.oc); return; }
  if (/^PO[A-Za-z0-9()\-]{4,}$/.test(q.replace(/\s/g, ""))) { usarOc(q.replace(/\s/g, "")); return; }
  toast(res.length ? "Elige una de la lista" : "Escribe la OC completa (por ejemplo POHUE-002538)");
});
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-ocpick]");
  if (b) { if (epEditandoId) salirEdicionEepp(true); usarOc(b.dataset.ocpick); return; }
  const tr = e.target.closest?.("#tblOcBuscar tbody tr[data-ocsel]");
  if (tr && !e.target.closest("button")) usarOc(tr.dataset.ocsel);
});
$("#btnOcCargar").addEventListener("click", () => $("#fileOcXl").click());
$("#btnOcPdf").addEventListener("click", () => $("#fileOcPdf").click());
$("#fileOcPdf").addEventListener("change", async e => {
  const fs = Array.from(e.target.files);
  e.target.value = "";
  if (fs.length) await ocLeerPdfs(fs);
});
conectarDrop("#dropOcPdf", "#fileOcPdf", async files => {
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  const xl = files.filter(f => /\.(xlsx|xlsm|xls|csv)$/i.test(f.name));
  if (pdfs.length) await ocLeerPdfs(pdfs);
  else if (xl.length) { try { await ocImportarArchivo(xl[0]); } catch (err) { toast("No pude leer ese archivo"); } }
  else toast("Suelta las órdenes de compra en PDF (o el reporte en Excel)");
});
$("#btnOcPdfGuardar").addEventListener("click", () => {
  const g = ocPdfGuardar(ocPdfLista);
  ocPdfLista = []; renderOcPdf();
  if (g.length === 1) usarOc(g[0]);
});
$("#btnOcPdfDescartar").addEventListener("click", () => { ocPdfLista = []; renderOcPdf(); });
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-ocpdfusar]"); if (!b) return;
  const o = ocPdfLista[+b.dataset.ocpdfusar];
  if (!o || !o.oc) { toast("Completa el número de la OC antes de guardar"); return; }
  const g = ocPdfGuardar([o]);
  ocPdfLista = ocPdfLista.filter(x => x !== o); renderOcPdf();
  if (g.length) usarOc(g[0]);
});
$("#fileOcXl").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const ok = await ocImportarArchivo(f);
    if (ok && $("#ocBuscar").value.trim()) renderOcBusqueda($("#ocBuscar").value);
  } catch (err) { toast("No pude leer ese archivo"); }
  e.target.value = "";
});
$("#btnOcNueva").addEventListener("click", () => {
  const f = $("#ocNuevaForm");
  f.classList.toggle("hide");
  if (f.classList.contains("hide")) return;
  const q = $("#ocBuscar").value.trim();
  if (/^PO/i.test(q.replace(/\s/g, ""))) $("#nocOc").value = q.replace(/\s/g, "");
  $("#nocSede").innerHTML = ["", ...db.cat.soc.map(s => s.sede)].map(s => `<option>${s}</option>`).join("");
  $("#nocProv").innerHTML = `<option value="">- elige o escribe uno nuevo -</option>` + db.cat.prov
    .slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
    .map(p => `<option value="${esc(p.rut)}">${esc((p.cod ? p.cod + " " : "") + (p.nombre || p.rut))}</option>`).join("");
  if ($("#nocOc").value) $("#nocSede").value = sedeDeOc($("#nocOc").value) || "";
  $("#nocOc").focus();
});
$("#nocProv").addEventListener("change", e => {
  const p = provPorRut(e.target.value);
  if (!p) return;
  $("#nocProvNom").value = p.nombre || ""; $("#nocRut").value = p.rut || ""; $("#nocVendor").value = p.cod || "";
});
$("#nocOc").addEventListener("blur", () => { if (!$("#nocSede").value) $("#nocSede").value = sedeDeOc($("#nocOc").value) || ""; });
$("#btnNocCancelar").addEventListener("click", () => $("#ocNuevaForm").classList.add("hide"));
$("#btnNocGuardar").addEventListener("click", () => {
  const oc = $("#nocOc").value.replace(/\s/g, "").trim();
  if (!oc) { toast("Falta el número de la orden de compra"); return; }
  const r = ocGuardarEnCatalogo({
    oc, rut: $("#nocRut").value.trim(), vendor: $("#nocVendor").value.trim().toUpperCase(),
    prov: $("#nocProvNom").value.trim(), proy: $("#nocProy").value.trim().toUpperCase(),
    cta: $("#nocCta").value.trim(), sede: $("#nocSede").value,
    monto: toNum($("#nocMonto").value), glosa: $("#nocGlosa").value.trim()
  });
  if (!r) { toast("No pude guardar la OC"); return; }
  ["#nocOc", "#nocProvNom", "#nocRut", "#nocVendor", "#nocProy", "#nocCta", "#nocMonto", "#nocGlosa"].forEach(s => $(s).value = "");
  $("#nocProv").value = ""; $("#nocSede").value = "";
  $("#ocNuevaForm").classList.add("hide");
  setDirty(); render();
  usarOc(r.reg.oc);
  toast(r.nueva ? "Orden de compra creada y lista para usar" : "Orden de compra actualizada");
});
$("#btnOcLimpiar").addEventListener("click", () => {
  if (epEditandoId) salirEdicionEepp(true);
  $("#ocBuscar").value = ""; $("#ocResultados").classList.add("hide");
  $("#ocFicha").classList.add("hide"); $("#ocVacio").classList.remove("hide");
  epLimpiar();
});
$("#btnPctSaldo").addEventListener("click", () => {
  const f = ocFicha($("#epOc").value || $("#ocBuscar").value);
  if (f.saldo === null) { toast("Esa OC no tiene monto en el catálogo"); return; }
  if (f.saldo <= 0) { toast("La OC no tiene saldo disponible"); return; }
  $("#epNeto").value = nf(f.saldo);
  $("#epPct").value = f.monto ? String(+(f.saldo / f.monto * 100).toFixed(4)) : "";
  epRecalcular();
});

/* ---------- EEPP: alta individual ---------- */
function epCampos() {
  return {
    rut: $("#epProv").value, vendor: $("#epVendor").value.trim().toUpperCase(),
    oc: $("#epOc").value.trim(), proy: $("#epProy").value.trim().toUpperCase(),
    sede: $("#epSede").value, ir: $("#epIr").value.trim().toUpperCase(),
    glosa: $("#epGlosa").value.trim(), ep: $("#epEp").value.trim(),
    base: toNum($("#epBase").value), pct: toNum(String($("#epPct").value).replace(",", ".")) === null ? null : Number(String($("#epPct").value).replace(/\./g, "").replace(",", ".")),
    neto: toNum($("#epNeto").value)
  };
}
function epRecalcular(origen) {
  const base = toNum($("#epBase").value);
  const pctTxt = String($("#epPct").value).replace(",", ".").trim();
  const pct = pctTxt === "" ? null : Number(pctTxt);
  if (origen !== "neto" && base !== null && pct !== null && !isNaN(pct))
    $("#epNeto").value = nf(Math.round(base * (pct > 1 ? pct / 100 : pct)));
  if (origen === "neto" && base !== null && base > 0) {
    const n0 = toNum($("#epNeto").value);
    $("#epPct").value = n0 === null ? "" : String(+(n0 / base * 100).toFixed(4));
  }
  const n = toNum($("#epNeto").value);
  const exenta = $("#epIvaCond").value === "exenta";
  let txt = n === null ? ""
    : exenta ? `exenta de IVA · total ${nf(n)}` : `IVA ${nf(ivaDe(n))} · total ${nf(n + ivaDe(n))}`;
  const oc = $("#epOc").value.trim();
  if (n !== null && oc) {
    const f = ocFicha(oc);
    if (f.saldo !== null) {
      const queda = f.saldo - n;
      txt += ` · saldo tras este EP ${nf(queda)}`;
      if (queda < 0) txt += " ⚠ sobregira la OC";
    }
  }
  $("#epCalc").textContent = txt;
  const ocp = $("#epOc").value.trim();
  if (ocp) pintarFichaOc(ocp);
}
["#epBase", "#epPct"].forEach(s => $(s).addEventListener("input", () => epRecalcular()));
$("#epNeto").addEventListener("input", () => epRecalcular("neto"));
$("#epIvaCond").addEventListener("change", () => epRecalcular());
$("#epProv").addEventListener("change", e => {
  const p = provPorRut(e.target.value);
  if (p) { if (p.cod) $("#epVendor").value = p.cod; }
});
$("#epOc").addEventListener("blur", () => {
  const s = sedeDeOc($("#epOc").value.trim());
  if (s && !$("#epSede").value) $("#epSede").value = s;
  const cat = db.cat.oc.find(o => up(o.oc) === up($("#epOc").value.trim()));
  if (cat && cat.proy && !$("#epProy").value) $("#epProy").value = cat.proy;
});
function epLimpiar() {
  ["#epVendor", "#epOc", "#epProy", "#epIr", "#epGlosa", "#epEp", "#epBase", "#epPct", "#epNeto"].forEach(s => $(s).value = "");
  $("#epProv").value = ""; $("#epSede").value = ""; $("#epIvaCond").value = "afecta"; $("#epCalc").textContent = "";
}
$("#btnEpClear").addEventListener("click", () => { if (epEditandoId) salirEdicionEepp(true); else epLimpiar(); });
$("#btnEpAdd").addEventListener("click", () => {
  const c = epCampos();
  const neto = toNum($("#epNeto").value);
  if (!c.oc && !c.proy) { toast("Falta al menos la orden de compra o el project code"); return; }
  if (neto === null || neto <= 0) { toast("Falta el neto a facturar"); return; }
  if (!c.glosa) { toast("Falta la descripción / glosa que va en la factura"); return; }
  const p = c.rut ? provPorRut(c.rut) : provPorCod(c.vendor);
  const base = toNum($("#epBase").value);
  const pctTxt = String($("#epPct").value).replace(",", ".").trim();
  const pctNum = pctTxt === "" ? null : Number(pctTxt);
  const datos = {
    vendor: c.vendor || (p ? p.cod : ""), rut: p ? p.rut : "",
    oc: c.oc, proy: c.proy, ir: c.ir, glosa: c.glosa, ep: c.ep,
    sede: c.sede || sedeDeOc(c.oc) || sedeDeProyecto(c.proy),
    neto, exenta: $("#epIvaCond").value === "exenta",
    base: base === null ? null : base,
    pct: pctNum === null || isNaN(pctNum) ? null : (pctNum > 1 ? pctNum / 100 : pctNum)
  };
  if (epEditandoId) {
    const e = db.eepp.find(x => x.id === epEditandoId);
    if (!e) { salirEdicionEepp(true); return; }
    Object.assign(e, datos);
    cuadraMontos(e);
    if (e.rut && e.sede && e.oc) aprenderOc(e.rut, e.sede, e.oc, "", db.meta.fecha, e.proy);
    const ocUsada = e.oc;
    salirEdicionEepp(false);
    setDirty(); render();
    if (ocUsada) { $("#ocBuscar").value = ocUsada; $("#epOc").value = ocUsada; pintarFichaOc(ocUsada); }
    abrirCorreoProveedor([e]);
    toast("Estado de pago actualizado. El correo al proveedor quedó regenerado abajo.");
    return;
  }
  const e = cuadraMontos(Object.assign({ id: uid() }, datos));
  db.eepp.push(e);
  if (e.rut && e.sede && e.oc) aprenderOc(e.rut, e.sede, e.oc, "", db.meta.fecha, e.proy);
  setDirty(); render();
  const ocUsada = e.oc;
  epLimpiar();
  if (ocUsada) { $("#ocBuscar").value = ocUsada; pintarFichaOc(ocUsada); $("#epOc").value = ocUsada; }
  abrirCorreoProveedor([e]);
  toast("Estado de pago agregado. Revisa el correo al proveedor abajo.");
});
$("#btnEpCancelarEdicion").addEventListener("click", () => salirEdicionEepp(true));
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-epedit]"); if (!b) return;
  editarEepp(b.dataset.epedit);
});
$("#btnDelEepp").addEventListener("click", () => {
  const sel = eeppSeleccionados();
  if (!sel.length) { toast("Marca primero las filas"); return; }
  const ids = sel.map(e => e.id);
  db.eepp = db.eepp.filter(e => !ids.includes(e.id));
  db.fac.forEach(f => { if (ids.includes(f.eeppId)) f.eeppId = null; });
  setDirty(); render();
});
$("#chkAllEepp").addEventListener("change", e => $$("#tblEepp .ck").forEach(c => c.checked = e.target.checked));
$("#btnEpEnviado").addEventListener("click", () => {
  const sel = eeppSeleccionados();
  if (!sel.length) { toast("Marca primero las filas"); return; }
  marcarEnviados(sel);
  toast(`${sel.length} línea(s) marcadas como enviadas al proveedor`);
});

/* ---------- EEPP: correo al proveedor ---------- */
let epMailLista = [], epMailGrupos = [], epMailIdx = 0;
function abrirCorreoProveedor(lista) {
  if (!lista.length) { toast("Marca primero las líneas del cuadro"); return; }
  epMailGrupos = agrupaPorProveedor(lista);
  epMailIdx = 0;
  $("#cardEpMail").classList.remove("hide");
  if (!$("#epVenc").dataset.iso) pintarCampoFecha("#epVenc", sumaDias(hoyIso(), 30));
  pintarCorreoProveedor();
  $("#cardEpMail").scrollIntoView({ behavior: "smooth", block: "start" });
}
function pintarCorreoProveedor() {
  epMailLista = epMailGrupos[epMailIdx] || [];
  if (!epMailLista.length) { $("#cardEpMail").classList.add("hide"); return; }
  const venc = $("#epVenc").dataset.iso;
  $("#epMailPreview").innerHTML = correoProveedorHtml(epMailLista, venc);
  const p = provDeEepp(epMailLista[0]);
  $("#epPara").value = p?.email || "";
  const epsArr = [...new Set(epMailLista.map(e => e.ep).filter(Boolean))];
  const eps = epsArr.length === 0 ? "de estado de pago" : epsArr.length <= 2 ? epsArr.join(" y ") : "de estados de pago";
  const ocs = [...new Set(epMailLista.map(e => e.oc).filter(Boolean))];
  const ocTxt = ocs.length === 1 ? " / OC " + ocs[0] : ocs.length > 1 ? ` / ${ocs.length} OC` : "";
  const proys = [...new Set(epMailLista.map(e => e.proy).filter(Boolean))];
  $("#epAsunto").value = `Cuadro ${eps} para facturar — ${proys.length === 1 ? proys[0] : proys.length + " proyectos"}${ocTxt}`.trim();
  $("#epMailInfo").innerHTML = (epMailGrupos.length > 1
    ? `Correo ${epMailIdx + 1} de ${epMailGrupos.length} · <a href="#" id="epNext">siguiente proveedor →</a>`
    : "") + (p?.email ? "" : ` <b>Falta el correo del proveedor</b> (agrégalo en Catálogos)`);
  const nx = $("#epNext");
  if (nx) nx.addEventListener("click", ev => { ev.preventDefault(); epMailIdx = (epMailIdx + 1) % epMailGrupos.length; pintarCorreoProveedor(); });
}

$("#epPara").addEventListener("change", e => {
  const p = provDeEepp(epMailLista[0] || {});
  if (p) { p.email = e.target.value.trim(); setDirty(); }
});
$("#btnEpCorreo").addEventListener("click", () => abrirCorreoProveedor(eeppSeleccionados()));
$("#btnEpCerrar").addEventListener("click", () => $("#cardEpMail").classList.add("hide"));
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-epmail]"); if (!b) return;
  const it = db.eepp.find(x => x.id === b.dataset.epmail);
  if (it) abrirCorreoProveedor([it]);
});
$("#btnEpCopyRich").addEventListener("click", async () => {
  await copiarHtml(correoProveedorHtml(epMailLista, $("#epVenc").dataset.iso), correoProveedorTexto(epMailLista, $("#epVenc").dataset.iso));
  marcarEnviados(epMailLista);
});
$("#btnEpCopyTxt").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(correoProveedorTexto(epMailLista, $("#epVenc").dataset.iso)); toast("Texto copiado"); }
  catch { toast("No pude copiar: selecciona la vista previa y usa Ctrl+C"); }
  marcarEnviados(epMailLista);
});
$("#btnEpMailto").addEventListener("click", () => {
  const cuerpo = correoProveedorTexto(epMailLista, $("#epVenc").dataset.iso);
  location.href = `mailto:${encodeURIComponent($("#epPara").value)}?subject=${encodeURIComponent($("#epAsunto").value)}&body=${encodeURIComponent(cuerpo.slice(0, 1800))}`;
  marcarEnviados(epMailLista);
  toast("Se abre el borrador. Para la tabla usa «Copiar correo (con tabla)».");
});

/* ---------- Facturas ---------- */
conectarDrop("#dropFac", "#fileFac", procesarPdfs);
async function procesarPdfs(files) {
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  if (!pdfs.length) { toast("Suelta archivos PDF"); return; }
  const nomAct = nominaActiva();
  if (nomAct.estado !== "abierta" &&
      !confirm(`La nómina del ${isoToCl(nomAct.fecha)} ya está ${nomAct.estado}. ¿Cargar estas facturas ahí de todas formas?`)) return;
  const prog = $("#pdfProg"), txt = $("#pdfProgTxt");
  prog.classList.remove("hide"); prog.max = pdfs.length; prog.value = 0;
  let ok = 0, errores = 0;
  for (let i = 0; i < pdfs.length; i++) {
    const file = pdfs[i];
    txt.textContent = `${i + 1} de ${pdfs.length} — ${file.name}`;
    try {
      const { texto: t, b64 } = await pdfLeer(file);
      const f = leerFactura(t, file.name);
      if (guardarPdfs()) { f.pdf = b64; f.pdfPeso = pesoB64(b64); }
      const rep = db.fac.find(x => x.rut && f.rut && fmtRut(x.rut) === fmtRut(f.rut) && String(x.doc) === String(f.doc) && f.doc);
      if (rep) { f.obs = "Posible duplicado de " + (rep.archivo || ""); }
      db.fac.push(f);
      aplicarCalce(f);
      if (f.rut && f.sede && f.oc) aprenderOc(f.rut, f.sede, f.oc, f.tipo === "MANT" ? f.proy : "", clToIso(f.fecha) || db.meta.fecha, f.tipo === "CAPEX" ? f.proy : "");
      ok++;
    } catch (e) { errores++; console.warn(file.name, e); }
    prog.value = i + 1;
    if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
  }
  prog.classList.add("hide"); txt.textContent = "";
  setDirty(); render();
  const conAviso = db.fac.filter(f => nivel(controles(f)) !== "ok").length;
  toast(`${ok} factura(s) leídas${errores ? `, ${errores} con error` : ""}${conAviso ? ` · ${conAviso} con alertas` : ""}`);
}
$("#btnAddFac").addEventListener("click", () => {
  const f = { id: uid(), archivo: "manual", tipo: "MANT", sede: "", proy: "68500", oc: "", rut: "", fecha: isoToCl(new Date().toISOString().slice(0, 10)), doc: "", neto: null, iva: null, total: null, ir: "", obs: "", avisos: [] };
  db.fac.push(f); setDirty(); render();
});
$("#btnDelFac").addEventListener("click", () => {
  const ids = $$("#tblFac tbody tr").filter(tr => $(".ck", tr)?.checked).map(tr => tr.dataset.id);
  if (!ids.length) { toast("Marca primero las filas"); return; }
  db.eepp.forEach(e => { if (ids.includes(e.facId)) e.facId = null; });
  db.fac = db.fac.filter(f => !ids.includes(f.id));
  setDirty(); render();
});
$("#chkAllFac").addEventListener("change", e => $$("#tblFac .ck").forEach(c => c.checked = e.target.checked));
$("#btnIr").addEventListener("click", () => {
  const t = $("#txtIr").value.trim();
  if (!t) { toast("Pega primero el listado de Netsuite"); return; }
  const r = asignarIr(t);
  $("#irMsg").textContent = r.msg;
  setDirty(); render(); toast(r.msg);
});
$("#chkSoloProb").addEventListener("change", e => { soloProblemas = e.target.checked; renderFac(); });
/* contador de seleccionadas: los botones de abajo actúan sobre lo marcado */
function contarSeleccion() {
  const nF = $$("#tblFac tbody tr").filter(tr => $(".ck", tr)?.checked).length;
  const tF = $("#facSelTxt");
  if (tF) { tF.textContent = nF ? `${nF} factura(s) seleccionada(s)` : "Ninguna seleccionada"; tF.classList.toggle("sec", nF > 0); }
  const nE = $$("#tblEepp tbody tr").filter(tr => $(".ck", tr)?.checked).length;
  const tE = $("#epSelTxt");
  if (tE) { tE.textContent = nE ? `${nE} línea(s) seleccionada(s)` : "Ninguna línea seleccionada"; tE.classList.toggle("sec", nE > 0); }
}
["#tblFac", "#tblEepp"].forEach(sel => $(sel).addEventListener("change", e => {
  if (e.target.classList?.contains("ck") || e.target.id?.startsWith("chkAll")) contarSeleccion();
}));

/* ---------- editor de factura ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-facedit]"); if (!b) return;
  abrirEditorFac(b.dataset.facedit);
});
$("#btnMfGuardar").addEventListener("click", guardarEditorFac);
$("#btnMfVerPdf").addEventListener("click", () => verDocumentoFactura(facEditandoId));
$("#docCerrar").addEventListener("click", cerrarVisorDoc);
$("#docAnt").addEventListener("click", () => { docPag--; pintarPaginaDoc(); });
$("#docSig").addEventListener("click", () => { docPag++; pintarPaginaDoc(); });
$("#docMas").addEventListener("click", () => { docZoom = Math.min(3, docZoom + 0.25); pintarPaginaDoc(); });
$("#docMenos").addEventListener("click", () => { docZoom = Math.max(0.5, docZoom - 0.25); pintarPaginaDoc(); });
$("#docDescargar").addEventListener("click", () => descargarDocumento(docB64, docNombre));
$("#modalDoc").addEventListener("click", e => { if (e.target.id === "modalDoc") cerrarVisorDoc(); });
$("#btnMfDescargar").addEventListener("click", () => {
  const hit = facPorId(facEditandoId);
  if (hit) descargarDocumento(hit.f.pdf, hit.f.archivo);
});
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-verpdf]");
  if (b) { verDocumentoFactura(b.dataset.verpdf); return; }
  const o = e.target.closest?.("[data-verocpdf]");
  if (o) {
    const reg = db.cat.oc[+o.dataset.verocpdf];
    if (reg) verDocumento(reg.pdf, reg.archivo || "orden_de_compra.pdf", `OC ${reg.oc} · ${provPorRut(reg.rut)?.nombre || ""} · ${pesoLegible(pesoB64(reg.pdf))}`);
  }
});
$("#chkGuardarPdf").addEventListener("change", e => {
  toast(e.target.checked
    ? "Los PDF que cargues quedarán guardados en la base"
    : "Los PDF nuevos no se guardarán: la base pesa menos, pero no podrás ver el documento original");
});
$("#btnPurgarPdf").addEventListener("click", () => {
  const soloEnv = confirm("¿Quitar los PDF solo de las nóminas ya enviadas o cerradas?\n\nAceptar = solo enviadas y cerradas\nCancelar = revisar todas (incluida la abierta)");
  if (!soloEnv && !confirm("Se quitarán TODOS los documentos originales guardados, incluida la nómina en curso. ¿Seguir?")) return;
  purgarPdfs(soloEnv);
});
$("#btnMfCancelar").addEventListener("click", cerrarEditorFac);
$("#btnMfEliminar").addEventListener("click", eliminarFacturaEditada);
$("#btnMfRecalc").addEventListener("click", () => {
  const n = toNum($("#mfNeto").value);
  if (n === null) { toast("Escribe primero el neto"); return; }
  const exenta = $("#mfExenta").value === "1";
  const iva = exenta ? 0 : ivaDe(n);
  $("#mfIva").value = nf(iva);
  $("#mfTotal").value = nf(n + iva);
});
$("#mfExenta").addEventListener("change", () => $("#btnMfRecalc").click());
$("#mfProv").addEventListener("change", e => {
  const p = provPorRut(e.target.value);
  if (p) $("#mfRut").value = p.rut;
});
$("#modalFac").addEventListener("click", e => { if (e.target.id === "modalFac") cerrarEditorFac(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#modalDoc").classList.contains("hide")) { cerrarVisorDoc(); return; }
  if (e.key === "Escape" && !$("#modalFac").classList.contains("hide")) cerrarEditorFac();
  if (!$("#modalDoc").classList.contains("hide")) {
    if (e.key === "ArrowRight" || e.key === "PageDown") { docPag++; pintarPaginaDoc(); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { docPag--; pintarPaginaDoc(); }
  }
});

/* ---------- edición en tablas ---------- */
const CAMPOS_NUM = ["neto", "iva", "total", "monto"];
function editar(obj, campo, valorTxt, opts = {}) {
  if (CAMPOS_NUM.includes(campo)) {
    obj[campo] = toNum(valorTxt);
    if (opts.recalc) {
      if (campo === "neto") cuadraMontos(obj);
      if (campo === "iva") obj.total = (obj.neto || 0) + (obj.iva || 0);
      if (campo === "total" && obj.neto === null) { obj.neto = Math.round(obj.total / 1.19); obj.iva = obj.total - obj.neto; }
    }
  } else if (campo === "rut") obj[campo] = fmtRut(valorTxt);
  else obj[campo] = String(valorTxt).trim();
}
function conectarEdicion(tablaSel, buscar, opts = {}) {
  const tabla = $(tablaSel);
  tabla.addEventListener("blur", e => {
    const td = e.target.closest?.("td.edit"); if (!td || !tabla.contains(td)) return;
    const obj = buscar(td.closest("tr")); if (!obj) return;
    editar(obj, td.dataset.f, td.textContent, opts);
    setDirty(); render();
  }, true);
  tabla.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.closest?.("td.edit")) { e.preventDefault(); e.target.blur(); }
  });
  tabla.addEventListener("change", e => {
    const sel = e.target.closest?.("select"); if (!sel || !sel.dataset.f) return;
    const obj = buscar(sel.closest("tr")); if (!obj) return;
    obj[sel.dataset.f] = sel.value;
    if (sel.dataset.f === "exenta") { obj.exenta = sel.value === "1"; cuadraMontos(obj); }
    if (sel.dataset.f === "tipo") {
      if (obj.tipo === "MANT" && !/^\d{5}$/.test(String(obj.proy || ""))) obj.proy = provPorRut(obj.rut)?.cta || "68500";
      if (obj.tipo === "CAPEX" && /^\d{5}$/.test(String(obj.proy || ""))) obj.proy = "";
    }
    setDirty(); render();
  });
}
conectarEdicion("#tblEepp", tr => db.eepp.find(e => e.id === tr.dataset.id), { recalc: true });
conectarEdicion("#tblFac", tr => db.fac.find(f => f.id === tr.dataset.id), { recalc: true });
conectarEdicion("#tblNomCapex", tr => db.fac.find(f => f.id === tr.dataset.id));
conectarEdicion("#tblNomMant", tr => db.fac.find(f => f.id === tr.dataset.id));
conectarEdicion("#tblCatSoc", tr => db.cat.soc[+tr.dataset.i]);
conectarEdicion("#tblCatProv", tr => db.cat.prov[+tr.dataset.i]);
conectarEdicion("#tblCatOc", tr => db.cat.oc[+tr.dataset.i]);
conectarEdicion("#tblOcPdf", tr => ocPdfLista[+tr.dataset.ocpdf]);

/* ---------- catálogos ---------- */
$("#btnAddSoc").addEventListener("click", () => { db.cat.soc.push({ sede: "", rut: "", nombre: "", pre: "" }); setDirty(); render(); });
$("#btnAddProv").addEventListener("click", () => { db.cat.prov.push({ rut: "", cod: "", nombre: "", tipo: "", cta: "" }); setDirty(); render(); });
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-del]"); if (!b) return;
  const i = +b.closest("tr").dataset.i;
  ({ soc: () => db.cat.soc.splice(i, 1), prov: () => db.cat.prov.splice(i, 1), oc: () => db.cat.oc.splice(i, 1) })[b.dataset.del]();
  setDirty(); render();
});

/* ---------- nómina / correo ---------- */
$("#btnXlsx").addEventListener("click", exportarXlsx);
$("#btnCsv").addEventListener("click", exportarCsv);
$("#btnCopyRich").addEventListener("click", copiarRico);
$("#btnCopyTxt").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(correoTexto()); toast("Texto copiado"); }
  catch { toast("No pude copiar: selecciona la vista previa y usa Ctrl+C"); }
});
$("#btnMailto").addEventListener("click", () => {
  const url = `mailto:${encodeURIComponent(db.meta.para || "")}?subject=${encodeURIComponent($("#mailAsunto").value)}&body=${encodeURIComponent(correoTexto().slice(0, 1800))}`;
  location.href = url;
  toast("Se abre el borrador. Para las tablas usa «Copiar correo (con tablas)».");
});

/* ---------- reiniciar ---------- */
$("#btnReset").addEventListener("click", () => {
  if (!confirm("Se borra todo: las facturas, EEPP y nóminas cargadas y también lo guardado en este navegador. ¿Seguir?")) return;
  cargaManual = true;
  idbBorrar();
  db = dbNueva(); aplicarMetaAlFormulario(); setDirty(false); render();
});

/* ---------- historial ---------- */
$("#btnImportHist").addEventListener("click", () => {
  $("#histImport").classList.toggle("hide");
  if (!$("#histFecha").dataset.iso) pintarCampoFecha("#histFecha", proximoViernes(sumaDias(hoyIso(), -7)));
});
$("#btnDoImportHist").addEventListener("click", () => {
  const t = $("#txtHist").value.trim();
  if (!t) { toast("Pega primero las filas"); return; }
  importarNominaTexto(t, $("#histFecha").dataset.iso);
  $("#txtHist").value = ""; $("#histImport").classList.add("hide");
});
let histTimer = null;
$("#histBuscar").addEventListener("input", e => {
  clearTimeout(histTimer);
  histTimer = setTimeout(() => { histFiltro = e.target.value; histSel = null; renderHist(); }, 140);
});
document.addEventListener("click", e => {
  const ver = e.target.closest?.("[data-nomver]");
  if (ver) { histSel = ver.dataset.nomver; renderHist(); return; }
  const abrir = e.target.closest?.("[data-nomabrir]");
  if (abrir) {
    cambiarNomina(abrir.dataset.nomabrir);
    $$("nav.tabs button").forEach(x => x.classList.remove("active"));
    $$("section.panel").forEach(p => p.classList.remove("active"));
    document.querySelector('nav.tabs button[data-tab="nomina"]').classList.add("active");
    $("#tab-nomina").classList.add("active");
    window.scrollTo({ top: 0 });
    return;
  }
  const correo = e.target.closest?.("[data-nomcorreo]");
  if (!correo) return;
  const n = nominaPorId(correo.dataset.nomcorreo);
  if (!n) return;
  const prevActiva = db.activa;
  db.activa = n.id;
  const html = correoHtml();
  db.activa = prevActiva;
  const w = window.open("", "_blank");
  w.document.write(`<meta charset="utf-8"><title>Nómina ${isoToCl(n.fecha)}</title><body style="background:#fff;padding:24px">${html}</body>`);
  w.document.close();
});
const fil = $("#tblHist");
fil.addEventListener("dblclick", e => {
  const tr = e.target.closest("tr[data-nom]");
  if (tr) cambiarNomina(tr.dataset.nom);
});

/* ---------- atajos de teclado ---------- */
document.addEventListener("keydown", e => {
  const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); guardarDb(); return; }
  if (enCampo) return;
  if (e.key === "?") { e.preventDefault(); $("#btnAyuda").click(); return; }
  if (e.key >= "1" && e.key <= "4" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const b = document.querySelector(`nav.tabs button[data-paso="${e.key}"]`);
    if (b) { e.preventDefault(); irATab(b.dataset.tab); }
  }
});

/* ---------- comprobación de librerías ---------- */
(function () {
  const faltaPdf = typeof pdfjsLib === "undefined", faltaXlsx = typeof XLSX === "undefined";
  if (!faltaPdf && !faltaXlsx) return;
  $("#libAlert").classList.remove("hide");
  if (faltaPdf) { $("#dropFac").style.opacity = ".5"; $("#dropFac").style.pointerEvents = "none"; }
  if (faltaXlsx) { $("#dropEepp").style.opacity = ".5"; $("#dropEepp").style.pointerEvents = "none"; $("#btnXlsx").disabled = true; }
})();

/* ---------- arranque ---------- */
db = dbNueva();
aplicarMetaAlFormulario();
render();
setDirty(false);
restaurarDesdeNavegador();          // recupera la base guardada en este navegador, si la hay
</script>
</body>
</html>
