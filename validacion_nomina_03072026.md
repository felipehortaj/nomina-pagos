# Validación de la nómina del 03/07/2026 — app vs. nómina manual

Se procesaron las **71 facturas** de la semana y se comparó línea por línea contra la nómina
que se envió a finanzas.

## Resultado global

| | App | Nómina manual |
|---|---|---|
| Líneas CAPEX | 20 | 20 |
| Líneas mantención | 51 | 51 |
| Total CAPEX | 575.149.161 | 575.149.160 |
| Total mantención | 51.429.722 | 51.624.039 |
| **Total** | **626.578.883** | **626.773.199** |

La diferencia de 194.316 se explica por completo: 194.317 de la factura de Delta Activos
(PDF escaneado, sin texto) menos 1 peso de GRUPONEXO. Todos los montos por sociedad calzan,
salvo CMA (le falta Delta) y VLC (+1 peso, que es el valor correcto según la factura).

## Diferencias detectadas — cada una es un hallazgo real

1. **X&M: N° de documento invertido entre los ítems 15 y 16.** El folio 254 corresponde a la
   OC POVLC-002820 por 89.420.367 neto, y el 255 a POVLC-002819 por 10.074.838. En la nómina
   manual quedaron cruzados.
2. **Ítem 18 — POVLC-002822 (Instalaciones Power Electric):** figura como *FAE 213*, pero el
   folio real es **21**. El 213 corresponde a ALFA UNO (ítem 19).
3. **Ítem 11 — POCMA-002670 (NVL):** el campo DOC. N° quedó vacío. El folio real es **108998**.
4. **Ítem 13 — GRUPONEXO FAEX 456:** la factura dice **1.195.253**; se registró 1.195.252.
5. **Ítem 17 — JRC FAE 124:** fecha de emisión **02/07/2026**; se anotó 03/07/2026.
6. **Mantención ítem 62 — M&J FAE 615:** la factura imprime **POCMA-002323**; la nómina dice
   POCMA-002333. Hay que confirmar cuál es la correcta.
7. **Delta Activos FAE 7931:** PDF sin capa de texto («Print to PDF»), ningún lector
   automático puede procesarlo. Queda marcado para ingreso manual.

## Defectos de origen que la app detecta y corrige

- **ELECTROPOWER** corta la OC: imprime `POCUR-00257` y `POABS(Nat)00230` en vez de los 6
  dígitos. Se completa desde el catálogo.
- **ELEMONT** (23 facturas) e **IOTIND** (4) no imprimen la OC. Se resuelve por RUT del
  colegio más el catálogo de OC aprendido de las nóminas anteriores.
- **ADAPTOR** parte la OC en dos líneas (`POTEM-` / `003369`); se reconstruye.
- Los nombres de archivo no son confiables: *FAE 22847 ELECTROPOWER.pdf* contiene en realidad
  el folio 25847. El folio siempre se lee dentro del PDF.

## Lo que sigue siendo manual

El **REFERENCE (IR)** no aparece en ninguna factura: viene de Netsuite. La app tiene una caja
donde se pega el listado de recepciones y las calza por OC y monto (59 de 71 en la prueba).
Cuando una OC tiene varias recepciones del mismo monto en la semana — el caso de ELEMONT — la
asignación no se puede deducir y queda señalada como «asignado por reparto: verifica».

## Reglas que quedaron incorporadas

- **Sede** por RUT de la sociedad receptora, contrastada con el prefijo de la OC.
- **IVA** siempre 19% del neto redondeado, y total = neto + IVA. Si la factura imprime algo
  distinto, se avisa y se usa el cálculo.
- **Exentas** (FAEX): el monto exento pasa a neto, IVA en 0.
- **Duplicados** por RUT + folio, dentro de la nómina en curso y contra todo el historial.

## Tabla de sociedades

| Sede | RUT sociedad | Prefijo OC |
|---|---|---|
| ABS | 78.404.000-3 | POABS(Nat) |
| CDE | 96.980.350-K | POCDE |
| CDV | 99.558.380-1 | POCDV |
| CHI | 76.899.160-K | POCHI |
| CMA | 76.435.756-6 | POCMA |
| CUR | 76.895.340-6 | POCUR |
| HUE | 96.858.860-5 | POHUE |
| MNU | 76.760.480-7 | PO0 (sin prefijo de sede) |
| PEN | 96.863.530-1 | POPEN |
| PTM | 96.987.460-1 | POMON |
| TEM | 96.891.540-1 | POTEM |
| TGS | 78.715.670-3 | POTGS |
| VLC | 96.946.770-4 | POVLC |
