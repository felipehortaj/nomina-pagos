<script>
"use strict";
/* =========================================================================
   ÓRDENES DE COMPRA EN PDF — lectura y revisión
   ========================================================================= */
let ocPdfLista = [];

/* la OC casi siempre viene en el nombre del archivo: POCHI-002921.pdf */
function ocDesdeNombre(nombre) {
  const s = norm(nombre || "").replace(/\.pdf$/i, "");
  const m = /\bPO\s?([A-Z]{2,3})\s?(\(?[A-Za-z]{2,5}\)?)?\s*-?\s*(\d{4,7})\b/i.exec(s)
        || /\bPO\s?-?\s?(\d{6,7})\b/i.exec(s);
  if (!m) return "";
  if (m.length === 4) return normOc(m[1], m[2], m[3]);
  return "PO" + m[1];
}

const OC_MALAS = /(\bR\.?U\.?T\b|DIRECCI[OÓ]N|COMUNA|CIUDAD|TEL[EÉ]FONO|\bFONO\b|E-?MAIL|www\.|\bFECHA\b|VENCIMIENTO|CONDICIONES|FORMA\s+DE\s+PAGO|MONEDA|CURRENCY|TIMBRE|VERIFIQUE|RESOLUCI[OÓ]N|S\.I\.I|\bSUB\s*-?\s*TOTAL\b|\bTOTAL\b|\bIVA\b|\bTAX\b|\bNETO\b|\bEXENTO\b|\bCANT\b|CANTIDAD|P\.?\s?UNITARIO|PRECIO\s+UNITARIO|\bIMPORTE\b|DESCUENTO|P[AÁ]GINA|\bPAGE\b|APROBAD|SOLICITAD|ENTREGAR\s+A|DESPACHO|BODEGA|ORDEN\s+DE\s+COMPRA|PURCHASE\s+ORDER|\bVENDOR\b|PROJECT\s+CODE|REFERENCE|\bBANCO\b|\bGIRO\b|\bPROVEEDOR\b|\bSUPPLIER\b|NETSUITE|COGNITA|DESCRIPCI[OÓ]N\s*$|DESCRIPTION\s*$)/i;
const OC_DIRECCION = /(\bAV\.?\b|AVENIDA|\bCALLE\b|PASAJE|\bPJE\b|\bCAMINO\b|\bRUTA\b|\bLOTE\b|\bDP\b|\bOF\.?\b|\bLOCAL\b|\bPISO\b|\bKM\b|\d{3,5}\s*,)/i;

const OC_FUERTE = /^(CONSTRUCCI|HABILITACI|AMPLIACI|REMODELACI|MANTENCI|INSTALACI|SUMINISTRO|PROVISI[OÓ]N|OBRAS|SERVICIO|ASESOR|INSPECCI|REVISOR|MOBILIARIO|EQUIPAMIENTO|EQUIPO|HONORARIO|IMPLEMENTACI|MEJORAMIENTO)/i;

/* quita las columnas numéricas y los códigos que quedan pegados al final de la línea */
function ocCortarColumnas(l) {
  const re = /\s(?:[A-Z]{3,6}\d{5}\b|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b|\b\d{1,3}\s*%)/g;
  let m;
  while ((m = re.exec(l))) {
    const cola = l.slice(m.index);
    if (!/[a-záéíóúñ]{4}/.test(cola)) return l.slice(0, m.index).trim();   // la cola es solo cifras y códigos
  }
  return l;
}
function ocGlosaDePdf(t) {
  /* aquí no se quitan las tildes: la glosa se copia tal cual al correo del proveedor */
  let lineas = String(t).replace(/[\u00a0\u2007\u202f]/g, " ").split("\n")
    .map(l => l.replace(/\s{2,}/g, " ").trim());
  /* limita la búsqueda al bloque de ítems: del encabezado de descripción a los totales */
  const iDesc = lineas.findIndex(l => /(DESCRIPCI[OÓ]N|DESCRIPTION|DETALLE)/i.test(l));
  if (iDesc >= 0) {
    const resto = lineas.slice(iDesc + 1);
    const iTot = resto.findIndex(l => /(MONTO\s*NETO|SUB\s*-?\s*TOTAL|SUBTOTAL|\bTOTAL\b|IVA\s*19|\bTAX\b|MONTO\s*EXENTO)/i.test(l));
    lineas = iTot > 0 ? resto.slice(0, iTot) : resto;
  }
  const RE_CIFRA = /\s\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b/;   // solo cifras de dinero abren un ítem
  const frag = lineas.map(l => {
    const bruto = l.replace(/^\s*\d{1,3}\s*[.)-]?\s+/, "");
    const conCifra = RE_CIFRA.test(bruto);
    let txt = ocCortarColumnas(bruto).replace(/\s{2,}/g, " ").trim();
    if (conCifra) txt = txt.replace(/\s+\d{1,4}$/, "");            // saca la columna de cantidad
    return { txt, conCifra };
  }).filter(f => f.txt.length >= 2 && /[A-Za-z]{3}/.test(f.txt)
      && !OC_MALAS.test(f.txt) && !OC_DIRECCION.test(f.txt));
  /* una línea con columnas de cifras abre un ítem; las que no las traen son continuación */
  const items = [];
  frag.forEach(f => {
    if (f.conCifra || !items.length) items.push(f.txt);
    else items[items.length - 1] += " " + f.txt;
  });
  const limpiar = s => s
    .replace(/([A-Za-zÁÉÍÓÚÑáéíóúñ])-(?=\s)/g, "$1 -")            // "CONSTRUCCIÓN-" -> "CONSTRUCCIÓN -"
    .replace(/\s*\[?\s*PROJECT\s*CODE\s*#?\s*[A-Z0-9]*\s*\]?\s*/i, " ")
    .replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const lista = items.map(limpiar).filter(x => x.length >= 15);
  const conFuerte = lista.filter(x => OC_FUERTE.test(x));
  return (conFuerte.length ? conFuerte : lista).slice(0, 3).join(" // ").slice(0, 400);
}
function xCuentaContable(t) {
  const s = norm(t);
  let m = /cuenta\s*contable\s*:?\s*(\d{5})/i.exec(s);
  if (m) return m[1];
  m = /\b(68\d{3})\b/.exec(s);
  return m ? m[1] : "";
}
function ocDesdePdf(texto, nombreArchivo) {
  const t = quitarCopia(texto);
  const o = { archivo: nombreArchivo, avisos: [] };
  if (!t.trim()) {
    o.oc = ocDesdeNombre(nombreArchivo);
    o.sede = sedeDeOc(o.oc);
    o.monto = null; o.exenta = false;
    o.avisos.push(o.oc
      ? `PDF sin texto (escaneado o generado como imagen). Tomé la OC ${o.oc} del nombre del archivo: completa proveedor, project code y monto a mano.`
      : "PDF sin texto (escaneado o generado como imagen): ingresa la OC a mano.");
    return o;
  }
  const { oc, parcial } = xOc(t);
  o.oc = oc || ocDesdeNombre(nombreArchivo) || "";
  if (!oc && o.oc) o.avisos.push(`La OC ${o.oc} la tomé del nombre del archivo: no la encontré en el texto del PDF`);
  if (!o.oc && parcial) o.avisos.push(`Solo encontré el número ${parcial}: completa el prefijo de la OC`);
  o.proy = xProject(t);
  o.vendor = xVendor(t);
  if (!o.vendor) {                                  // respaldo: código V0xxxxx sin la etiqueta "Vendor"
    const mv = /\bV\s?0\d{4,5}\b/.exec(norm(t));
    if (mv) o.vendor = mv[0].replace(/\s/g, "").toUpperCase();
  }
  if (!o.proy) o.cta = xCuentaContable(t);

  /* RUT: el de la sociedad da la sede; el otro es el del proveedor */
  const ruts = xRuts(t);
  let sede = "", rutProv = "";
  ruts.forEach(r => {
    const s = socPorRut(r);
    if (s && !sede) sede = s.sede;
    else if (!s && !rutProv) rutProv = r;
  });
  o.sede = sede || sedeDeOc(o.oc) || sedeDeProyecto(o.proy);
  o.rut = rutProv;

  /* nombre del proveedor */
  const yaP = o.rut ? provPorRut(o.rut) : provPorCod(o.vendor);
  if (yaP) o.prov = yaP.nombre || "";
  if (!o.prov) {
    const s = norm(t);
    const m = /(?:Proveedor|Vendor|Supplier|Raz[oó]n\s*Social)\s*:?\s*([A-ZÁÉÍÓÚÑ][^\n]{6,70})/i.exec(s);
    if (m) o.prov = m[1].replace(/\s{2,}/g, " ").replace(/\s*(R\.?U\.?T.*|V\s?0?\d{4,6}.*)$/i, "").trim();
    else if (o.rut) {
      const idx = s.indexOf(o.rut.replace(/^0+/, ""));
      const antes = s.slice(Math.max(0, idx - 220), idx).split("\n").map(x => x.replace(/\s{2,}/g, " ").trim())
        .filter(x => /[A-Z]{5}/.test(x) && !/R\.?U\.?T|DIRECC|COMUNA|GIRO|TEL/i.test(x));
      o.prov = (antes[antes.length - 1] || "").slice(0, 70);
    }
  }

  /* montos: para el estado de pago interesa el NETO de la orden */
  const neto = montoTrasEtiqueta(t, [String.raw`MONTO\s*NETO`, String.raw`SUB\s*-?\s*TOTAL`, String.raw`\bSUBTOTAL\b`, String.raw`Subtotal`,
    String.raw`\bNETO\b`, String.raw`\bAFECTO\b`, String.raw`Net\s*Amount`]);
  const ivaLbl = montoTrasEtiqueta(t, [String.raw`Tax\s*Total`, String.raw`Total\s*Impuesto`, String.raw`Monto\s*Impto\.?`,
    String.raw`I\.?\s?V\.?\s?A\.?\s*\(?\s*19`, String.raw`19\s*%\s*IVA`, String.raw`\bIVA\b`,
    String.raw`\bTax\b`, String.raw`Impuesto`]);
  const total = montoTrasEtiqueta(t, [String.raw`MONTO\s*TOTAL`, String.raw`TOTAL\s*(?:DE\s*LA\s*)?ORDEN`,
    String.raw`Total\s*Amount`, String.raw`\bTOTAL\b(?!\s*ES)`]);
  const exento = montoTrasEtiqueta(t, [String.raw`\bEXENTO\b`, String.raw`Monto\s*Exento`, String.raw`NO\s*AFECTO`]);
  const marcaExenta = /NO\s*AFECT[AO]|EXENT[AO]|NOT\s*SUBJECT\s*TO\s*(VAT|TAX)/i.test(norm(t))
    || (ivaLbl !== null && ivaLbl === 0);
  o.exenta = marcaExenta;                       // en una OC no se asume exenta por la falta de la línea de IVA
  if (neto !== null) { o.monto = neto; o.fuente = "monto neto de la orden"; }
  else if (exento !== null && o.exenta) { o.monto = exento; o.fuente = "monto exento de la orden"; }
  else if (total !== null && ivaLbl !== null && ivaLbl > 0) { o.monto = total - ivaLbl; o.fuente = "total menos IVA"; }
  else if (total !== null && o.exenta) { o.monto = total; o.fuente = "total (orden exenta)"; }
  else if (total !== null) {
    o.monto = Math.round(total / 1.19); o.fuente = "total dividido por 1,19";
    o.avisos.push(`La OC solo trae el total (${nf(total)}); el neto se estimó dividiendo por 1,19: verifícalo`);
  }
  else { o.monto = null; o.avisos.push("No pude leer el monto de la orden"); }

  if (/\bUF\b/.test(norm(t)) && o.monto !== null && o.monto < 500000)
    o.avisos.push("La orden parece expresada en UF: revisa el monto en pesos");
  o.fecha = xFecha(t);
  o.glosa = ocGlosaDePdf(t);
  if (!o.oc) o.avisos.push("No encontré el número de la orden de compra");
  if (!o.proy) o.avisos.push("No encontré el project code: si es mantención, indica la cuenta contable");
  if (!o.sede) o.avisos.push("No pude determinar la sede");
  if (!o.rut && !o.vendor) o.avisos.push("No encontré el RUT ni el código del proveedor");
  const ya = db.cat.oc.find(x => ocKey(x.oc) === ocKey(o.oc));
  if (ya && o.oc) o.avisos.push("Esta OC ya está en el catálogo: se actualizará con estos datos");
  return o;
}
async function ocLeerPdfs(files) {
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  if (!pdfs.length) return false;
  if (typeof pdfjsLib === "undefined") { toast("No están cargadas las librerías de lectura de PDF"); return false; }
  const prog = $("#ocPdfProg"), txt = $("#ocPdfProgTxt");
  prog.classList.remove("hide"); prog.max = pdfs.length; prog.value = 0;
  const out = [];
  for (let i = 0; i < pdfs.length; i++) {
    txt.textContent = `${i + 1} de ${pdfs.length} — ${pdfs[i].name}`;
    try {
      const { texto, b64 } = await pdfLeer(pdfs[i]);
      const o = ocDesdePdf(texto, pdfs[i].name);
      if (guardarPdfs()) { o.pdf = b64; o.pdfPeso = pesoB64(b64); }
      if (pdfUltimoError) o.avisos.push(pdfUltimoError);
      out.push(o);
    } catch (e) {
      const ocNom = ocDesdeNombre(pdfs[i].name);
      out.push({
        archivo: pdfs[i].name, oc: ocNom, sede: sedeDeOc(ocNom), monto: null, exenta: false, avisos: [
          `No pude abrir el PDF: ${pdfMotivo(e)}`,
          ocNom ? `Tomé la OC ${ocNom} del nombre del archivo: completa el resto a mano o usa «+ Nueva OC»`
                : "Ingresa la OC a mano con «+ Nueva OC»"
        ]
      });
    }
    prog.value = i + 1;
  }
  prog.classList.add("hide"); txt.textContent = "";
  ocPdfLista = out;
  renderOcPdf();
  const buenas = out.filter(o => o.oc && o.monto !== null).length;
  toast(`${out.length} PDF leído(s) · ${buenas} con OC y monto · revisa antes de guardar`);
  return true;
}
function renderOcPdf() {
  const panel = $("#ocPdfPanel");
  if (!ocPdfLista.length) { panel.classList.add("hide"); return; }
  panel.classList.remove("hide");
  $("#tblOcPdf tbody").innerHTML = ocPdfLista.map((o, i) => {
    const nv = !o.oc || o.monto === null ? "crit" : (o.avisos.length ? "warn" : "ok");
    const tag = nv === "ok" ? `<span class="tag ok">ok</span>`
      : `<span class="tag ${nv}" title="${esc(o.avisos.join(" · "))}">${o.avisos.length} aviso${o.avisos.length === 1 ? "" : "s"}</span>`;
    return `<tr data-ocpdf="${i}">
      <td>${tag}</td>
      <td class="edit mono" data-f="oc" contenteditable>${esc(o.oc || "")}</td>
      <td class="edit mono" data-f="vendor" contenteditable>${esc(o.vendor || "")}</td>
      <td class="edit mono" data-f="rut" contenteditable>${esc(o.rut || "")}</td>
      <td class="edit small" data-f="prov" contenteditable>${esc(o.prov || "")}</td>
      <td class="edit mono" data-f="proy" contenteditable>${esc(o.proy || "")}</td>
      <td class="edit mono" data-f="cta" contenteditable>${esc(o.cta || "")}</td>
      <td><select data-f="sede">${["", ...db.cat.soc.map(s => s.sede)].map(s => `<option${s === o.sede ? " selected" : ""}>${s}</option>`).join("")}</select></td>
      <td class="num edit" data-f="monto" contenteditable>${nf(o.monto)}</td>
      <td>${o.exenta ? `<span class="tag neutral">exenta</span>` : `<span class="tag capex">19%</span>`}</td>
      <td class="wrap small muted" title="${esc(o.fuente || "")}">${esc(o.glosa || "")}</td>
      <td class="small muted">${esc((o.archivo || "").replace(/\.pdf$/i, "").slice(0, 20))}</td>
      <td><button class="btn sm" data-ocpdfusar="${i}">Guardar y usar</button></td>
    </tr>`;
  }).join("");
  const al = [];
  ocPdfLista.forEach(o => o.avisos.forEach(a => al.push({
    n: (!o.oc || o.monto === null) ? "crit" : "warn", t: `${o.oc || o.archivo}: ${a}`
  })));
  alertBox($("#ocPdfAlertas"), al);
}
function ocPdfGuardar(lista) {
  let nuevas = 0, act = 0, malas = 0;
  const guardadas = [];
  lista.forEach(o => {
    if (!o.oc) { malas++; return; }
    const r = ocGuardarEnCatalogo({
      oc: o.oc, rut: o.rut, vendor: o.vendor, prov: o.prov, proy: o.proy, cta: o.cta,
      sede: o.sede, monto: o.monto, glosa: o.glosa, exenta: o.exenta, pdf: o.pdf, archivo: o.archivo
    });
    if (r) { r.nueva ? nuevas++ : act++; guardadas.push(r.reg.oc); }
  });
  setDirty(); render();
  toast(`Catálogo de OC: ${nuevas} nuevas, ${act} actualizadas${malas ? `, ${malas} sin número de OC` : ""}`);
  return guardadas;
}
</script>
