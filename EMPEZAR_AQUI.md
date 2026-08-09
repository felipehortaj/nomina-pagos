# Probar este proyecto con Claude Code — guía paso a paso

Claude Code es la versión de Claude para trabajar sobre código. La diferencia con lo que
usamos hasta ahora: en vez de que yo te entregue el archivo terminado, Claude trabaja
**dentro del proyecto**, ve todos los archivos, hace el cambio, lo compila y corre las 22
pruebas para comprobar que no rompió nada.

No necesitas saber programar. Sí necesitas saber pedir las cosas, y eso ya lo haces.

---

## Camino recomendado: desde el navegador, sin instalar nada

1. Entra a **[claude.ai/code](https://claude.ai/code)** con tu misma cuenta.
2. Sube este proyecto: la carpeta completa (o el `.zip` tal como lo recibiste). Claude Code
   la deja disponible como un proyecto de trabajo.
3. Escribe tu primera instrucción. Claude leerá solo el archivo `CLAUDE.md`, que ya tiene las
   reglas del proyecto y del negocio: IVA 19%, exentas, la nómina identificada por su viernes,
   que no se puede editar `dist/` a mano, y que después de cada cambio hay que compilar y
   probar.
4. Cuando termine, te va a mostrar qué archivos cambió. Descarga `dist/Nomina_Pagos.html` y
   ábrelo con doble clic para verlo funcionando.

Si te pide conectar GitHub, puedes hacerlo (te da historial de versiones y poder volver
atrás), pero para una primera prueba no es indispensable: alcanza con subir la carpeta.

---

## Pruebas concretas para partir

Cópialas tal cual. Están ordenadas de menos a más ambiciosa.

**1. Que se presente el proyecto (calentamiento, no cambia nada)**

> Lee CLAUDE.md y el README. Explícame en español, sin tecnicismos, qué hace esta aplicación,
> cómo está organizada y qué pasa si cambio algo en `src/`. No modifiques nada todavía.

**2. Un cambio pequeño y verificable**

> En la pestaña de la nómina, la columna PERIODO muestra "Jul 2026". Quiero poder cambiar el
> período de una línea puntual haciendo clic en la celda, como ya se puede con las
> observaciones. Compila y corre las pruebas antes de darme el resultado.

**3. Algo que te sirve de verdad esta semana**

> Necesito un botón en la pestaña Nómina que exporte la nómina en el mismo formato del correo
> a finanzas, pero como archivo Excel con las dos tablas en hojas separadas y el resumen por
> sociedad en una tercera. Respeta el diseño liviano de `docs/diseno.md`. Compila, corre las
> pruebas y agrega una prueba nueva que verifique que el archivo se genera con las tres hojas.

**4. Ponerlo a prueba de verdad (esto es lo que más valor tiene)**

> Revisa `src/pA_ocpdf.js` y `src/p3_core.js` buscando casos en que la lectura de una orden de
> compra en PDF podría tomar un monto equivocado. Para cada riesgo que encuentres, escribe una
> prueba que lo demuestre, arréglalo y vuelve a correr todas las pruebas.

---

## Qué esperar

- **Te va a pedir permiso** antes de modificar archivos o ejecutar comandos. Responder que sí
  es lo normal. Si algo no te gusta, dile «no» y explícale qué preferías.
- **Las pruebas tardan** unos minutos: abren un navegador de verdad 22 veces. Es tiempo bien
  gastado: es la red de seguridad que evita que un cambio rompa el cálculo del IVA o el
  control de duplicados.
- **Si algo sale mal**, pídele que lo revierta: «deja los archivos como estaban antes de este
  cambio». Con GitHub conectado esto es más limpio todavía.
- Si en algún momento se pierde el hilo o empieza a dar vueltas, escribe `/clear` y vuelve a
  plantear la tarea en una frase.

---

## Si prefieres tenerlo instalado en tu computador

Requiere un poco más de trabajo la primera vez, y permisos para instalar programas (en un
equipo corporativo puede que necesites a TI):

1. Instala **Node.js** desde [nodejs.org](https://nodejs.org) (versión LTS). Hace falta para
   compilar el proyecto y correr las pruebas.
2. Abre **PowerShell** e instala Claude Code:
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
   (alternativa: `winget install Anthropic.ClaudeCode`)
3. Cierra y vuelve a abrir PowerShell. Descomprime este proyecto, entra a la carpeta y ejecuta:
   ```powershell
   npm install
   claude
   ```
4. La primera vez te va a pedir iniciar sesión con tu cuenta de Claude.

Dentro de la sesión, `/help` lista los comandos y `/init` genera el archivo de instrucciones
del proyecto (acá ya está hecho: es `CLAUDE.md`).

---

## Lo que no cambia

La aplicación sigue siendo un solo archivo HTML que se abre con doble clic, sin servidor y sin
instalar nada, y las facturas se leen dentro de tu computador. Claude Code es solo la forma de
modificarla; el resultado que usas semana a semana es el mismo `Nomina_Pagos.html`.
