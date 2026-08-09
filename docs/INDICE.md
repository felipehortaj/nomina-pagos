# Qué comprueba cada prueba

Todas abren la app en Chromium sin ventana, cargan archivos reales de `tests/fixtures/` y
verifican el resultado. Pasan solo si la app no emite ningún error de JavaScript.

| Prueba | Escenario |
|---|---|
| `prueba01` | Arranque: librerías de PDF y Excel disponibles, carga masiva del Generador_EEPP y recorrido completo hasta el correo. |
| `prueba02` | **Validación end to end**: facturas de una semana real, IR pegados desde Netsuite, nómina y correo a finanzas comparados contra la nómina manual. |
| `prueba03` | Alta individual desde una OC nueva, agrupación por proveedor y generación del correo al proveedor. |
| `prueba04` | Planilla Excel conectada: reconocimiento de columnas, títulos en fila 4, porcentajes en texto, paso al formulario. |
| `prueba05` | Facturas **exentas de IVA**: cuando el cuadro no trae IVA, total = neto y el documento se pide como FAEX. |
| `prueba06` | Importación del export de órdenes de compra de Netsuite. |
| `prueba07` | Búsqueda de OC, ficha con monto liberado y saldo, y persistencia de la OC en la base. |
| `prueba08` | Lectura de órdenes de compra en PDF: OC, proveedor, project code, sede, monto y glosa. |
| `prueba09` | Correo a finanzas: formato exacto de las dos tablas y del resumen por sociedad. |
| `prueba10` | Exportación a Excel y a CSV. |
| `prueba11` | Asignación de referencias IR por OC y por monto, incluido el reparto cuando hay empate. |
| `prueba12` | PDF ilegibles: diagnóstico en español y rescate de la OC desde el nombre del archivo. |
| `prueba13` | Números chilenos y de Netsuite (punto y coma de miles) sobre una OC real. |
| `prueba14` | Correo al proveedor generado desde una OC real, con vendor, OC, project code e IR. |
| `prueba15` | Nóminas por fecha: cierre del viernes, apertura de la siguiente y **control de duplicados entre nóminas**. |
| `prueba16` | Migración de una base guardada con el modelo antiguo. |
| `prueba17` | Edición de un estado de pago ya registrado, sin borrarlo y volver a crearlo. |
| `prueba18` | PDF originales guardados en la base, medidor de peso y liberación de espacio. |
| `prueba19` | Apertura del documento original desde la nómina y desde el historial. |
| `prueba20` | Visor de documentos propio: páginas, zoom y descarga. |
| `prueba21` | Biblioteca con 620 órdenes de compra: filtros por colegio, búsqueda y creación de estados de pago en lote. |
| `prueba22` | Calendario en español, atajos de vencimiento y traslado de facturas a otra nómina. |
