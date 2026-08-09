# Diseño de la interfaz

## Principio rector: liviano

Pedido explícito del usuario: la app maneja mucha información y el peso visual distrae.
Reglas que no hay que romper:

- **Un solo peso fuerte (600)**, reservado a títulos y cifras clave. El resto en 400; el 500
  solo para énfasis puntual. Nada de negritas decorativas.
- **Tipografía chica**: base 13 px, tablas 12 px, títulos de página 17 px, etiquetas 10–11 px.
- **Sin sombras** salvo en capas flotantes (modal, calendario, aviso flotante). Las tarjetas
  llevan un borde de 1 px y nada más.
- **Color solo cuando significa algo.** Las etiquetas de estado son un punto de color más el
  texto, sin relleno ni borde. Un solo azul de acento, y solo en el botón principal.
- **Nunca dos elementos para lo mismo**: no repetir en un aviso lo que ya dice la lista de
  pendientes; el total no se pinta de rojo, se marca en su línea secundaria.
- **Menos filas en pantalla**: el detalle por sociedad muestra solo colegios con monto (el
  correo sí los lleva todos, con $0, como en el formato original).

## Ayuda bajo demanda (`data-ayuda`)

Todo lo explicativo está **oculto por defecto** y aparece con el botón `?` de la cabecera:
`.d` (descripción de tarjetas), `.hint` (ayuda de campo), `.page-h p` (bajada de la pantalla),
`.pasos`, `.tbl-leyenda`, la descripción de cada pendiente y `.solo-ayuda`.
Al escribir markup nuevo, la explicación va en uno de esos ganchos, nunca suelta.

Los avisos de control se muestran plegados: una línea («3 puntos por resolver · ver detalle»)
que se abre solo si se pide (`details.avisos`, generado en `alertBox()`).

## Arquitectura de información

Navegación lateral fija, en tres bloques:

- Panel
- **Semana** → 1 Estados de pago · 2 Facturas · 3 Nómina · 4 Correo a finanzas
  (círculo numerado que pasa a ✓ cuando el paso está resuelto; conteo al costado, rojo si hay
  pendientes)
- **Datos** → Órdenes de compra · Historial · Sedes y proveedores

**Barra de contexto fija**: la nómina en curso (fecha, estado, total), su selector, «+ Nueva»
y un aviso de qué implica (por ejemplo, si el viernes de esa nómina ya pasó).

**Panel** = qué hacer ahora: stepper de 4 pasos, 4 indicadores clicables, lista de
**Pendientes** (cada uno con el botón que lleva al lugar exacto) y las nóminas registradas.

**Paso 1** tiene un selector de origen de datos: *desde una OC* (por defecto), *carga masiva*
(Excel/correo) o *planilla conectada*. La tabla de estados de pago registrados, el lote y el
correo al proveedor quedan siempre visibles. `usarOc()` y «→ Formulario» vuelven solos al modo
OC.

## Tablas

Fila de grupos de columnas (Revisión / Clasificación / Documento del proveedor / Montos /
Netsuite), primera columna fija al desplazar en horizontal, cabecera y totales pegados, borde
izquierdo rojo en filas con error, celdas editables con lápiz ✎ al pasar el cursor, contador
de seleccionadas junto a los botones que actúan sobre la selección. Densidad conmutable
Cómoda / Compacta.

Atajos: `Ctrl+S` guardar base, `?` mostrar u ocultar explicaciones, `1`–`4` ir a cada paso.
