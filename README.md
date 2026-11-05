# 🌱 Mi Calendario

Un calendario de hábitos para el día a día, con aspecto de **huerto en pixel art**: cada hábito que cumples pone una lata en ese día.

👉 **Abrir la app:** https://sasiiiiiiiiiiiiii.github.io/mi-calendario/

Se puede instalar en el móvil o en el ordenador (menú del navegador → *Instalar* / *Añadir a pantalla de inicio*) y funciona sin internet.

## Qué hace

- **Hábitos diarios** con puntos y rachas (por defecto: Entrenar, Creatina y Estudiar). Se pueden añadir, editar y borrar.
- **Una lata por hábito:** blanca, rosa o naranja (a partir del cuarto hábito se repiten). Cada día muestra una lata por cada hábito hecho.
- **Estadísticas del mes** por hábito: % de días, racha actual y mejor racha.
- **Cumpleaños** que se repiten cada año (los del 29 de febrero salen el 28 en los años normales).
- **Notas** para cada día.
- **Paisaje en la cabecera** que cambia con la hora (amanecer, día, atardecer y noche) y con la estación del mes que estás mirando. Por él pasean Nata y Trufa, dos gatas blancas: pasa el ratón o tócalas para ver su nombre.
- **Amigos:** con tu código o un enlace de invitación. Solo ven el nombre que elijas, no tu email ni tus datos.
- **Copias de seguridad:** exportar e importar los datos en un archivo, con un aviso si hace más de 14 días de la última copia.
- Tema oscuro, y tema claro automático si el sistema lo usa.

## Dónde se guardan los datos

Los datos se guardan **en tu navegador** (`localStorage`, clave `mi-calendario`). Si entras con tu email, se sincronizan además con Supabase entre tus aparatos. Sin entrar, si borras los datos del navegador o cambias de dispositivo, se pierden, así que **exporta una copia de vez en cuando**.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página |
| `app.js` | Toda la lógica: datos, calendario, latas, paisaje, copias |
| `nube.js` | Entrar con el email y sincronizar con Supabase |
| `amigos.js` | Nombre, código de invitación y lista de amigos |
| `supabase/esquema.sql` | Tablas, reglas y funciones de la base de datos |
| `style.css` | El tema actual (huerto pixel art) |
| `style-noche.css` | Tema anterior "noche suave", guardado por si se quiere volver |
| `style-original.css` | Primer tema claro, guardado también como copia |
| `sw.js` | Service worker: hace que funcione sin internet |
| `manifest.json` | Datos para instalarla como app |
| `iconos/` | Iconos de la app |

Para probar otro tema, cambia `style.css` por `style-noche.css` o `style-original.css` en el `<link>` de `index.html`.

## Probarla en local

No hace falta instalar nada: es HTML, CSS y JavaScript sin frameworks.

```bash
python3 -m http.server 8000
```

y abre http://localhost:8000 (el service worker necesita servirse desde un servidor, no vale abrir el archivo con doble clic).

## Al cambiar algo

Sube el número de `VERSION` en `sw.js` (por ejemplo `v11` → `v12`) cada vez que cambies archivos, para que las apps ya instaladas descarguen la versión nueva.

## Próximamente

- Ranking semanal con amigos.
