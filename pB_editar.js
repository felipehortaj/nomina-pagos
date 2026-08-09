<script>
"use strict";
/* =========================================================================
   EDICIÓN — estados de pago y líneas de factura
   ========================================================================= */
let epEditandoId = null;

/* ---------------- estado de pago: cargar en el formulario ---------------- */
function editarEepp(id) {
  const e = db.eepp.find(x => x.id === id);
  if (!e) return;
  epEditandoId = id;
  const oc = e.oc || "";
  $("#ocFicha").classList.remove("hide");
  $("#ocVacio").classList.add("hide");
  $("#ocResultados").classList.add("hide");
  $("#ocBuscar").value = oc;
  $("#epOc").value = oc;
  $("#epProy").value = e.proy || "";
  $("#epSede").value = e.sede || "";
  $("#epIr").value = e.ir || "";
  $("#epGlosa").value = e.glosa || "";
  $("#epEp").value = e.ep || "";
  const p = e.rut ? provPorRut(e.rut) : provPorCod(e.vendor);
  $("#epProv").value = p ? p.rut : "";
  $("#epVendor").value = e.vendor || (p ? p.cod : "");
  const ficha = ocFicha(oc);
  $("#epBase").value = e.base ? nf(e.base) : (ficha.monto === null ? "" : nf(ficha.monto));
  const base = toNum($("#epBase").value);
  $("#epPct").value = e.pct ? String(+(e.pct * 100).toFixed(4))
    : (base && e.neto ? String(+(e.neto / base * 100).toFixed(4)) : "");
  $("#epNeto").value = nf(e.neto);
  $("#epIvaCond").value = e.exenta ? "exenta" : "afecta";
  epRecalcular("neto");
  if (oc) pintarFichaOc(oc);
  /* banner y botón en modo edición */
  $("#epEditBanner").classList.remove("hide");
  const f = e.facId ? db.fac.find(x => x.id === e.facId) : null;
  $("#epEditTxt").innerHTML = `${esc(e.ep || "EP")} de la OC <b>${esc(oc || "—")}</b>`
    + (f ? ` · ya tiene la factura ${esc((f.exenta ? "FAEX " : "FAE ") + (f.doc || ""))} asociada: cambiar el monto aquí no modifica la factura recibida.` : "");
  $("#btnEpAdd").textContent = "Guardar cambios";
  $("#btnEpAdd").classList.add("primary");
  render();
  $("#epGlosa").scrollIntoView({ behavior: "smooth", block: "center" });
}
function salirEdicionEepp(limpiar) {
  epEditandoId = null;
  $("#epEditBanner").classList.add("hide");
  $("#btnEpAdd").textContent = "Agregar y preparar correo";
  if (limpiar) epLimpiar();
  render();
}

/* ---------------- factura: editor completo ---------------- */
let facEditandoId = null;
function facPorId(id) {
  const hit = todasLasFacturas().find(({ f }) => f.id === id);
  return hit || null;
}
function abrirEditorFac(id) {
  const hit = facPorId(id);
  if (!hit) { toast("No encontré esa factura"); return; }
  facEditandoId = id;
  $("#modalFac").classList.remove("hide");
  renderModalFac();
}
function renderModalFac() {
  const hit = facPorId(facEditandoId);
  if (!hit) { cerrarEditorFac(); return; }
  const { f, nom } = hit;
  $("#modalFacTitulo").textContent = `Editar factura ${(f.exenta ? "FAEX " : "FAE ") + (f.doc || "sin número")}`;
  $("#modalFacInfo").textContent = `${f.archivo || "ingreso manual"} · nómina del ${isoToCl(nom.fecha)}`;
  $("#mfTipo").value = f.tipo || "MANT";
  $("#mfSede").innerHTML = ["", ...db.cat.soc.map(s => s.sede)].map(s => `<option${s === f.sede ? " selected" : ""}>${s}</option>`).join("");
  $("#mfProy").value = f.proy || "";
  $("#mfOc").value = f.oc || "";
  $("#mfIr").value = f.ir || "";
  $("#mfRut").value = f.rut || "";
  $("#mfProv").innerHTML = `<option value="">— sin proveedor —</option>` + db.cat.prov
    .slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
    .map(p => `<option value="${esc(p.rut)}"${fmtRut(p.rut) === fmtRut(f.rut) ? " selected" : ""}>${esc((p.cod ? p.cod + " " : "") + (p.nombre || p.rut))}</option>`).join("");
  $("#mfFecha").value = f.fecha || "";
  $("#mfDoc").value = f.doc || "";
  $("#mfExenta").value = f.exenta ? "1" : "";
  $("#mfNeto").value = nf(f.neto);
  $("#mfIva").value = nf(f.iva);
  $("#mfTotal").value = nf(f.total);
  $("#mfObs").value = f.obs || "";
  $("#mfNom").innerHTML = nominasOrdenadas().map(n =>
    `<option value="${n.id}"${n.id === nom.id ? " selected" : ""}>${esc(isoToCl(n.fecha))}${n.estado === "enviada" ? " (enviada)" : ""}</option>`).join("");
  alertBox($("#modalFacAlertas"), controles(f));
  /* documento original */
  const hay = !!f.pdf;
  $("#btnMfVerPdf").disabled = !hay;
  $("#btnMfDescargar").disabled = !hay;
  $("#mfPdfInfo").textContent = hay
    ? `${f.archivo || "documento.pdf"} · ${pesoLegible(pesoB64(f.pdf))}`
    : "Esta línea no tiene guardado el documento original (se cargó a mano, o los PDF estaban desactivados al cargarla).";
}
function cerrarEditorFac() {
  facEditandoId = null;
  $("#modalFac").classList.add("hide");
}
function guardarEditorFac() {
  const hit = facPorId(facEditandoId);
  if (!hit) { cerrarEditorFac(); return; }
  const { f, nom } = hit;
  const rutSel = $("#mfProv").value.trim();
  f.tipo = $("#mfTipo").value;
  f.sede = $("#mfSede").value;
  f.proy = $("#mfProy").value.trim();
  f.oc = $("#mfOc").value.replace(/\s/g, "").trim();
  f.ir = $("#mfIr").value.trim().toUpperCase();
  f.rut = fmtRut(rutSel || $("#mfRut").value.trim());
  f.fecha = $("#mfFecha").value.trim();
  f.doc = $("#mfDoc").value.trim();
  f.exenta = $("#mfExenta").value === "1";
  f.neto = toNum($("#mfNeto").value);
  f.iva = toNum($("#mfIva").value);
  f.total = toNum($("#mfTotal").value);
  f.obs = $("#mfObs").value.trim();
  if (f.neto !== null && (f.iva === null || f.total === null)) cuadraMontos(f);
  /* cambio de nómina */
  const destinoId = $("#mfNom").value;
  if (destinoId !== nom.id) {
    const destino = nominaPorId(destinoId);
    if (destino) {
      nom.fac = nom.fac.filter(x => x.id !== f.id);
      destino.fac.push(f);
      toast(`Factura movida a la nómina del ${isoToCl(destino.fecha)}`);
    }
  }
  if (f.rut && f.sede && f.oc)
    aprenderOc(f.rut, f.sede, f.oc, f.tipo === "MANT" ? f.proy : "", clToIso(f.fecha) || nom.fecha, f.tipo === "CAPEX" ? f.proy : "");
  const cs = controles(f);
  cerrarEditorFac();
  setDirty(); render();
  toast(nivel(cs) === "ok" ? "Factura actualizada: sin alertas"
    : `Factura actualizada · ${cs.length} punto(s) por revisar en la columna Control`);
}
function eliminarFacturaEditada() {
  const hit = facPorId(facEditandoId);
  if (!hit) return;
  const { f, nom } = hit;
  if (!confirm(`Eliminar la factura ${(f.doc || "sin número")} de la nómina del ${isoToCl(nom.fecha)}?`)) return;
  nom.fac = nom.fac.filter(x => x.id !== f.id);
  db.eepp.forEach(e => { if (e.facId === f.id) e.facId = null; });
  cerrarEditorFac();
  setDirty(); render();
  toast("Factura eliminada");
}
</script>
<script>
"use strict";
/* =========================================================================
   DOCUMENTOS ORIGINALES — ver, previsualizar y descargar
   ========================================================================= */
function guardarPdfs() { const c = $("#chkGuardarPdf"); return !c || c.checked; }

/* ---------------- visor propio, dibujado con pdf.js ----------------
   Chrome bloquea abrir blob: en otra pestaña cuando la página es un archivo
   local, así que el PDF se dibuja en un canvas dentro de la misma app.      */
let docPdf = null, docPag = 1, docZoom = 1.25, docNombre = "", docB64 = "";

async function verDocumento(b64, nombre, subtitulo) {
  if (!b64) { toast("Esta línea no tiene el documento original guardado"); return; }
  if (typeof pdfjsLib === "undefined") { toast("No está cargado el lector de PDF"); return; }
  docB64 = b64; docNombre = nombre || "documento.pdf"; docPag = 1;
  $("#docTitulo").textContent = docNombre;
  $("#docInfo").textContent = subtitulo || "";
  $("#modalDoc").classList.remove("hide");
  try {
    const bytes = new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));
    docPdf = await pdfjsLib.getDocument({
      data: bytes, cMapUrl: PDFJS_BASE + "cmaps/", cMapPacked: true,
      standardFontDataUrl: PDFJS_BASE + "standard_fonts/", useSystemFonts: true, isEvalSupported: false
    }).promise;
    await pintarPaginaDoc();
  } catch (e) {
    $("#docInfo").textContent = "No pude mostrar el documento: " + pdfMotivo(e) + ". Usa «Descargar» para abrirlo con tu lector de PDF.";
    docPdf = null;
    $("#docPag").textContent = "";
  }
}
async function pintarPaginaDoc() {
  if (!docPdf) return;
  docPag = Math.min(Math.max(1, docPag), docPdf.numPages);
  const page = await docPdf.getPage(docPag);
  const vp = page.getViewport({ scale: docZoom });
  const cv = $("#docCanvas");
  const ratio = window.devicePixelRatio || 1;
  cv.width = Math.floor(vp.width * ratio);
  cv.height = Math.floor(vp.height * ratio);
  cv.style.width = Math.floor(vp.width) + "px";
  const ctx = cv.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, vp.width, vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  $("#docPag").textContent = `pág. ${docPag} de ${docPdf.numPages}`;
  $("#docAnt").disabled = docPag <= 1;
  $("#docSig").disabled = docPag >= docPdf.numPages;
}
function cerrarVisorDoc() {
  $("#modalDoc").classList.add("hide");
  docPdf = null; docB64 = "";
  const cv = $("#docCanvas");
  cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
}
function verDocumentoFactura(id) {
  const hit = facPorId(id);
  if (!hit) return;
  const { f, nom } = hit;
  if (!f.pdf) { toast("Esta línea no tiene el documento original guardado"); abrirEditorFac(id); return; }
  verDocumento(f.pdf, f.archivo || "factura.pdf",
    `${(f.exenta ? "FAEX " : "FAE ") + (f.doc || "")} · ${proveedorTxt(f.rut) || f.rut || ""} · ${f.oc || ""} · nómina del ${isoToCl(nom.fecha)} · ${pesoLegible(pesoB64(f.pdf))}`);
}
function descargarDocumento(b64, nombre) {
  if (!b64) return;
  bajar(b64ABlob(b64), nombre || "documento.pdf");
}
/* quita los PDF de las nóminas ya enviadas para achicar la base */
function purgarPdfs(soloEnviadas) {
  let n = 0, bytes = 0;
  db.nominas.forEach(nom => {
    if (soloEnviadas && nom.estado === "abierta") return;
    (nom.fac || []).forEach(f => { if (f.pdf) { bytes += pesoB64(f.pdf); delete f.pdf; delete f.pdfPeso; n++; } });
  });
  setDirty(); render();
  toast(n ? `${n} documento(s) eliminados de la base · ${pesoLegible(bytes)} liberados` : "No había documentos que liberar");
}
</script>
