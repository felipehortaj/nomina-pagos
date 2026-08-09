<script>
"use strict";
/* =========================================================================
   CALENDARIO — selector de fechas en español, dd/mm/aaaa, sin tipear
   ========================================================================= */
const CAL_DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const CAL_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CAL_DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

let calMes = null, calAnio = null, calSel = "", calCb = null, calOpts = {};

const hoyIso = () => new Date().toISOString().slice(0, 10);
function isoDe(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/* "vie 23/10/2026" — así se lee de un vistazo qué día de la semana es */
function fechaLarga(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return iso;
  return `${CAL_DIA_CORTO[d.getDay()]} ${isoToCl(iso)}`;
}
function abrirCalendario(ancla, iso, cb, opts) {
  calCb = cb; calOpts = opts || {};
  calSel = iso || calOpts.sugerida || hoyIso();
  const base = new Date((calSel || hoyIso()) + "T12:00:00");
  calMes = base.getMonth(); calAnio = base.getFullYear();
  const pop = $("#calPop");
  pop.classList.remove("hide");
  pintarCalendario();
  /* posiciona el calendario junto al campo, sin salirse de la pantalla */
  const r = ancla.getBoundingClientRect();
  const alto = pop.offsetHeight || 320, ancho = pop.offsetWidth || 280;
  let top = r.bottom + window.scrollY + 6;
  if (r.bottom + alto > window.innerHeight && r.top > alto) top = r.top + window.scrollY - alto - 6;
  pop.style.top = top + "px";
  pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - ancho - 12)) + "px";
}
function cerrarCalendario() { $("#calPop").classList.add("hide"); calCb = null; }
function pintarCalendario() {
  const primero = new Date(calAnio, calMes, 1);
  const desplaz = (primero.getDay() + 6) % 7;                 // la semana empieza el lunes
  const dias = new Date(calAnio, calMes + 1, 0).getDate();
  const hoy = hoyIso();
  let celdas = "";
  for (let i = 0; i < desplaz; i++) celdas += `<div class="cal-d vacio"></div>`;
  for (let d = 1; d <= dias; d++) {
    const iso = isoDe(calAnio, calMes, d);
    const dow = new Date(calAnio, calMes, d).getDay();
    const clases = ["cal-d"];
    if (iso === calSel) clases.push("sel");
    if (iso === hoy) clases.push("hoy");
    if (dow === 5) clases.push("vie");
    if (dow === 0 || dow === 6) clases.push("finde");
    celdas += `<div class="${clases.join(" ")}" data-caldia="${iso}" title="${fechaLarga(iso)}">${d}</div>`;
  }
  $("#calCuerpo").innerHTML = celdas;
  $("#calTitulo").textContent = `${CAL_MESES[calMes]} ${calAnio}`;
  $("#calDias").innerHTML = CAL_DIAS.map(x => `<div class="cal-h">${x}</div>`).join("");
  $("#calPie").innerHTML = (calOpts.atajos || [
    { t: "Hoy", iso: hoyIso() },
    { t: "Viernes de esta semana", iso: proximoViernes(hoyIso()) },
    { t: "Viernes siguiente", iso: proximoViernes(sumaDias(proximoViernes(hoyIso()), 1)) }
  ]).map(a => `<button class="btn sm ghost" data-calatajo="${a.iso}">${esc(a.t)}</button>`).join("");
}
function elegirFecha(iso) {
  const cb = calCb;
  cerrarCalendario();
  if (cb) cb(iso);
}
/* botón-campo que muestra la fecha y abre el calendario */
function pintarCampoFecha(sel, iso, etiquetaVacia) {
  const el = $(sel);
  if (!el) return;
  el.textContent = iso ? fechaLarga(iso) : (etiquetaVacia || "elegir fecha…");
  el.dataset.iso = iso || "";
}
</script>
