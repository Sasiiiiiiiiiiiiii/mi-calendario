# 📖 Historia de Mi Calendario

Cómo fue creciendo la app, desde el primer día. Lo técnico de cada cosa está en el
[README](README.md) y en los commits; aquí va el porqué y el orden en que pasó.

## Versiones

Cada etapa tiene su número de versión, marcada en Git con una etiqueta (`git tag`) y
publicada en GitHub en *Releases*. Mientras la app estaba a medias se usó `0.x`; la
`1.0` es cuando ya hace lo que se quería desde el principio: competir con amigos.

| Versión | Fecha | Qué trajo |
|---|---|---|
| **v0.1** | 21 oct 2026 | Primera versión: hábitos, puntos, rachas, cumpleaños y notas |
| **v0.2** | 23 oct 2026 | Arreglos, estadísticas del mes, datos protegidos y publicada en internet |
| **v0.3** | 3 nov 2026 | El huerto pixel art: paisaje con la hora, estaciones, latas y las gatas |
| **v0.4** | 3 nov 2026 | Entrar con el email y sincronizar entre aparatos |
| **v0.5** | 5 nov 2026 | Amigos por código o enlace de invitación |
| **v0.5.1** | 13 nov 2026 | Aviso cuando el enlace del correo ya no vale |
| **v1.0** | 19 nov 2026 | Ranking semanal con amigos, a prueba de trampas |

Para ver cómo era la app en una versión: `git checkout v0.3` (y `git checkout main`
para volver).

---

## v0.1 · El principio: una app de hábitos (21 de octubre de 2026)

La idea era tener **un calendario para apuntar los hábitos del día**: entrenar,
tomar creatina y estudiar. Se hizo como una **PWA**, es decir, una página web que se
puede instalar en el móvil o en el ordenador como si fuera una app y que funciona
sin internet.

Desde el primer día se decidió:

- **Nada de frameworks ni herramientas raras**: HTML, CSS y JavaScript a pelo, para
  que sea fácil de entender y de tocar.
- **Los datos se guardan en el navegador** (`localStorage`), sin servidor.
- **Puntos y rachas** para motivarse: 10 puntos por hábito (máximo 50 al día) y
  premios extra al llegar a 3, 7 y 30 días seguidos. Los puntos no se guardan, se
  calculan siempre a partir de lo marcado.
- **Cumpleaños** que se repiten cada año y **notas** para cada día.
- **Exportar e importar** una copia de los datos.

Commit: `0cf1909`.

## v0.2 · Arreglos y lo básico bien hecho (23 de octubre)

Repasando la app salieron varios fallos y se arreglaron:

- El "hoy" no cambiaba si la app seguía abierta pasada la medianoche.
- Emojis de varios caracteres (como 🏋️) se cortaban.
- Se podían crear hábitos con un nombre hecho solo de espacios.
- Los cumpleaños del 29 de febrero desaparecían en los años normales (ahora salen el 28).

Y se añadió:

- **Proteger los datos**: se pide al navegador que no los borre, y si hace más de
  14 días de la última copia, la app avisa.
- **Editar y borrar hábitos y cumpleaños.**
- **Estadísticas del mes** por hábito: porcentaje de días, racha actual y mejor racha.
- **Solo se pueden marcar hoy y ayer**, para no hacer trampas.

Ese día se subió a **GitHub** y se publicó con **GitHub Pages**, así ya se podía abrir
desde el móvil. Al probarla en un móvil de verdad, el panel se salía de la
pantalla, y también se arregló.

Commits: `7cb9b72`, `ed5d9ea`, `a8b5fbe`.

## v0.3 · Un aspecto propio: el huerto pixel art (2 y 3 de noviembre)

La app funcionaba, pero se veía muy normal. Primero se le dio un **aspecto pixel art**
(marcos de píxel, botones que se hunden, letra pixelada), pero se parecía demasiado a
otras cosas. Así que se buscó un **estilo propio: un huerto de hábitos**. Cada día
tiene su franja de tierra y en ella crece algo según los hábitos que hayas cumplido.

Poco a poco se le fue dando vida:

- **Paisaje en la cabecera que cambia con la hora**: amanecer, día, atardecer y noche,
  con el sol y la luna moviéndose, estrellas que parpadean y una casita que enciende
  la luz de noche.
- **Estaciones** según el mes que estás mirando: nieve en invierno, flores en
  primavera, luciérnagas en verano y hojas cayendo en otoño.
- **Una flor distinta por hábito**, que luego se cambió por **latas pixel: blanca,
  rosa y naranja**. Cada hábito guarda la suya para que no cambie al borrar otro.
- **Nata y Trufa**, dos gatas blancas, pasean con su dueño por el paisaje. Al pasar
  el ratón o tocarlas, sale su nombre.
- **Icono nuevo**: tres latas sobre la tierra.
- Pequeños arreglos visuales: una raya azul entre las colinas con algunos zooms, y
  nubes, sol y luna que salían cortados arriba en pantallas muy anchas.
- Se escribió el **README**.

Los temas anteriores se guardaron (`style-noche.css` y `style-original.css`) por si
algún día se quiere volver.

Commits: de `8bfda25` a `03fd891`.

## La gran idea: competir con amigos (desde el 23 de octubre)

La idea fue **un ranking semanal de puntos con amigos**. Para eso los datos ya no
podían vivir solo en el navegador, así que se planeó en cuatro pasos:

1. Entrar con el email y guardar los datos en la nube.
2. Añadir amigos.
3. El ranking semanal.
4. Reglas contra las trampas.

Se eligió **Supabase** en vez de Firebase porque su plan gratis permite que la propia
base de datos calcule los puntos, y Firebase lo cobra.

### v0.4 · Paso 1: entrar con el email y sincronizar (3 al 5 de noviembre)

- Se entra con un **enlace o un código que llega al correo**, sin contraseñas.
- Los datos **siguen en el navegador** (la app funciona sin internet) y la nube es una
  copia que se mantiene al día entre el móvil y el ordenador.
- Si los dos aparatos cambian algo a la vez, **se mezclan sin perder nada**.
- Cada persona solo puede ver y tocar sus propios datos.

El 5 de noviembre se probó de verdad en el PC y en el móvil, y funcionaba.

Commit: `f04babc`.

### v0.5 · Paso 2: amigos (5 de noviembre)

- Cada persona pone un **nombre** y recibe un **código de 8 letras**.
- Se añaden amigos con el código o con un **enlace de invitación** que se comparte.
- Los amigos **nunca ven el email ni los datos del calendario**, solo el nombre.

Commit: `317423b`.

### v0.5.1 · Un tropiezo: los correos (13 de noviembre)

Al intentar probarlo con dos cuentas a la vez salieron tres problemas:

- A las cuentas nuevas, Supabase les manda otra plantilla de correo que solo trae
  enlace, sin código.
- Si el enlace del correo había caducado, la app no decía nada. **Se arregló**: ahora
  avisa de que hay que pedir otro (`d5427c2`).
- **Supabase solo deja mandar unos 2 correos por hora** en todo el proyecto. Con
  amigos de verdad no basta, así que hace falta un servicio de correo propio (Brevo).

### v1.0 · Pasos 3 y 4: el ranking semanal (19 de noviembre)

- Los **puntos los calcula la base de datos**, no el navegador, porque si no
  cualquiera podría inventarse los suyos.
- **Contra las trampas**: la base de datos apunta cada hábito marcado en el momento en
  que llega, y solo si es de hoy o de ayer. Lo que llegue con fecha atrasada se queda
  en tu calendario, pero no puntúa.
- La semana va de **lunes a domingo, con la hora de España**.
- Los amigos solo ven **nombre y puntos**.
- En la app sale la sección **🏆 Ranking semanal**, con 👑 para el primero.

Antes de subirlo se probó con una base de datos de mentira con 7 usuarios (15
comprobaciones) y la app en Firefox y en el móvil (28 comprobaciones).

Commit: `270ad5c`.

---

## Lo que queda

- Poner **Brevo** para mandar los correos de entrar, y así quitar el límite de
  ~2 por hora.
- **Probar el ranking con amigos de verdad.**
