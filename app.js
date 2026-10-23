// =====================================================
// 1. DATOS: qué guardamos y cómo
// =====================================================
const CLAVE_STORAGE = "mi-calendario";

const datosIniciales = {
  habitos: [
    { id: "entrenar", nombre: "Entrenar", emoji: "🏋️", color: "#e74c3c" },
    { id: "creatina", nombre: "Creatina", emoji: "💊", color: "#3498db" },
    { id: "estudiar", nombre: "Estudiar", emoji: "📚", color: "#2ecc71" },
  ],
  registros: {}, // { "2026-10-06": ["entrenar", "creatina"] }
  cumples: [],   // [ { nombre: "Ana", mes: 10, dia: 6 } ]  -> se repiten cada año
  notas: {},     // { "2026-10-06": "texto" }
};

function cargar() {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    return guardado ? JSON.parse(guardado) : structuredClone(datosIniciales);
  } catch {
    return structuredClone(datosIniciales);
  }
}

function guardar() {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos));
}

let datos = cargar();

// =====================================================
// 2. ESTADO: qué mes vemos y qué día está seleccionado
// =====================================================
let hoy = new Date(); // se actualiza si la app sigue abierta al cambiar de día
let mesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
let diaSeleccionado = claveFecha(hoy);

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Convierte un Date en "AAAA-MM-DD" (lo usamos como clave)
function claveFecha(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

function esBisiesto(año) {
  return new Date(año, 1, 29).getMonth() === 1;
}

// Los nacidos el 29 de febrero lo celebran el 28 en los años no bisiestos
function cumplesDelDia(año, mes, dia) {
  const feb28 = mes === 2 && dia === 28 && !esBisiesto(año);
  return datos.cumples.filter(c =>
    (c.mes === mes && c.dia === dia) || (feb28 && c.mes === 2 && c.dia === 29));
}

// Suma (o resta) días a una clave "AAAA-MM-DD"
function sumarDias(clave, n) {
  const [a, m, d] = clave.split("-").map(Number);
  return claveFecha(new Date(a, m - 1, d + n));
}

// Días que hay de una clave a otra (UTC para que el cambio de hora no moleste)
function diasEntre(desde, hasta) {
  const ms = clave => {
    const [a, m, d] = clave.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(hasta) - ms(desde)) / 86400000);
}

// Solo se pueden marcar hábitos de hoy y de ayer (para no hacer trampas)
function esEditable(clave) {
  const claveHoy = claveFecha(hoy);
  return clave === claveHoy || clave === sumarDias(claveHoy, -1);
}

// =====================================================
// 2b. PUNTOS Y RACHAS
// Los puntos no se guardan: se calculan siempre a partir de los registros
// =====================================================
const PUNTOS_HABITO = 10;
const MAX_PUNTOS_DIA = 50;                    // tope de puntos base por día
const BONUS_RACHA = { 3: 15, 7: 40, 30: 150 }; // días seguidos -> puntos extra

function hecho(clave, id) {
  return (datos.registros[clave] || []).includes(id);
}

// Días seguidos que se ha hecho un hábito, contando hacia atrás desde "clave"
function racha(id, clave) {
  let n = 0;
  while (hecho(clave, id)) {
    n++;
    clave = sumarDias(clave, -1);
  }
  return n;
}

// Racha que se ve "ahora": si hoy aún no está hecho, cuenta la que viene de ayer
function rachaActual(id, clave) {
  return hecho(clave, id) ? racha(id, clave) : racha(id, sumarDias(clave, -1));
}

// La racha más larga de toda la historia de un hábito
function mejorRacha(id) {
  const dias = Object.keys(datos.registros).filter(c => hecho(c, id)).sort();
  let mejor = 0, actual = 0, anterior = null;
  dias.forEach(c => {
    actual = anterior && sumarDias(anterior, 1) === c ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    anterior = c;
  });
  return mejor;
}

function puntosDelDia(clave) {
  const hechos = (datos.registros[clave] || [])
    .filter(id => datos.habitos.some(h => h.id === id));
  let puntos = Math.min(hechos.length * PUNTOS_HABITO, MAX_PUNTOS_DIA);
  // Bonus el día exacto en que la racha llega a 3, 7 o 30
  hechos.forEach(id => puntos += BONUS_RACHA[racha(id, clave)] || 0);
  return puntos;
}

// Las claves "AAAA-MM-DD" se pueden comparar como texto
function puntosEntre(desde, hasta) {
  return Object.keys(datos.registros)
    .filter(c => c >= desde && c <= hasta)
    .reduce((total, c) => total + puntosDelDia(c), 0);
}

// =====================================================
// 3. PINTAR EL CALENDARIO
// =====================================================
function pintarCalendario() {
  const contenedor = document.getElementById("calendario");
  contenedor.innerHTML = "";

  const año = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  document.getElementById("titulo-mes").textContent = `${MESES[mes]} ${año}`;

  // getDay() devuelve 0 = domingo. Lo ajustamos para que lunes = 0
  const huecosIniciales = (new Date(año, mes, 1).getDay() + 6) % 7;
  // Día 0 del mes siguiente = último día de este mes
  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  for (let i = 0; i < huecosIniciales; i++) {
    const vacia = document.createElement("div");
    vacia.className = "celda vacia";
    contenedor.appendChild(vacia);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const clave = claveFecha(new Date(año, mes, d));
    const celda = document.createElement("div");
    celda.className = "celda";
    if (clave === claveFecha(hoy)) celda.classList.add("hoy");
    if (clave === diaSeleccionado) celda.classList.add("seleccionado");

    // Número del día (+ tarta si hay cumpleaños)
    const cabecera = document.createElement("div");
    const numero = document.createElement("span");
    numero.className = "numero";
    numero.textContent = d;
    cabecera.appendChild(numero);
    if (cumplesDelDia(año, mes + 1, d).length > 0) cabecera.append(" 🎂");
    const puntosCelda = puntosDelDia(clave);
    if (puntosCelda > 0) {
      const pts = document.createElement("span");
      pts.className = "pts-celda";
      pts.textContent = `+${puntosCelda}`;
      cabecera.appendChild(pts);
    }
    celda.appendChild(cabecera);

    // Un punto de color por cada hábito hecho ese día
    const puntos = document.createElement("div");
    puntos.className = "puntos";
    (datos.registros[clave] || []).forEach(id => {
      const habito = datos.habitos.find(h => h.id === id);
      if (!habito) return;
      const punto = document.createElement("span");
      punto.className = "punto";
      punto.style.background = habito.color;
      punto.title = habito.nombre;
      puntos.appendChild(punto);
    });
    celda.appendChild(puntos);

    celda.addEventListener("click", () => {
      diaSeleccionado = clave;
      pintarTodo();
    });

    contenedor.appendChild(celda);
  }
}

// =====================================================
// 4. PINTAR EL PANEL DEL DÍA
// =====================================================
function pintarPanel() {
  const [a, m, d] = diaSeleccionado.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  document.getElementById("titulo-dia").textContent =
    fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  // Hábitos con checkbox
  const lista = document.getElementById("lista-habitos");
  lista.innerHTML = "";
  const hechos = datos.registros[diaSeleccionado] || [];
  const editable = esEditable(diaSeleccionado);
  datos.habitos.forEach(h => {
    const label = document.createElement("label");
    label.className = "habito";
    if (!editable) label.classList.add("bloqueado");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = hechos.includes(h.id);
    check.disabled = !editable;
    check.style.accentColor = h.color;
    check.addEventListener("change", () => alternarHabito(h.id));
    label.append(check, `${h.emoji} ${h.nombre}`);

    const dias = rachaActual(h.id, diaSeleccionado);
    if (dias > 0) {
      const fuego = document.createElement("span");
      fuego.className = "racha";
      fuego.textContent = `🔥 ${dias}`;
      fuego.title = `${dias} días seguidos`;
      label.appendChild(fuego);
    }
    lista.appendChild(label);
  });
  document.getElementById("aviso-bloqueo").hidden = editable;

  const puntos = puntosDelDia(diaSeleccionado);
  document.getElementById("puntos-dia").textContent = `⭐ ${puntos} puntos`;

  // Cumpleaños de ese día
  const ul = document.getElementById("lista-cumples");
  ul.innerHTML = "";
  cumplesDelDia(a, m, d).forEach(c => {
    const li = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "cumple-nombre";
    nombre.textContent = c.nombre;
    const editar = document.createElement("button");
    editar.textContent = "✏️";
    editar.title = "Editar";
    editar.addEventListener("click", () => editarCumple(li, c));
    const borrar = document.createElement("button");
    borrar.textContent = "✕";
    borrar.title = "Borrar";
    borrar.addEventListener("click", () => {
      datos.cumples = datos.cumples.filter(x => x !== c);
      guardar();
      pintarTodo();
    });
    li.append(nombre, editar, borrar);
    ul.appendChild(li);
  });

  document.getElementById("notas").value = datos.notas[diaSeleccionado] || "";
}

// Cambia la fila del cumpleaños por un formulario: nombre, día y mes
function editarCumple(li, c) {
  li.innerHTML = "";
  li.classList.add("editando");
  const form = document.createElement("form");
  form.className = "form-fila form-cumple-editar";

  const nombre = document.createElement("input");
  nombre.value = c.nombre;
  nombre.required = true;
  nombre.setAttribute("aria-label", "Nombre");

  const dia = document.createElement("input");
  dia.type = "number";
  dia.min = 1;
  dia.max = 31;
  dia.value = c.dia;
  dia.required = true;
  dia.className = "input-dia";
  dia.setAttribute("aria-label", "Día");
  dia.addEventListener("input", () => dia.setCustomValidity(""));

  const mes = document.createElement("select");
  mes.setAttribute("aria-label", "Mes");
  MESES.forEach((nombreMes, i) => mes.add(new Option(nombreMes, i + 1, false, i + 1 === c.mes)));
  mes.addEventListener("change", () => dia.setCustomValidity(""));

  const ok = document.createElement("button");
  ok.type = "submit";
  ok.textContent = "✓";
  ok.title = "Guardar";
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.textContent = "✕";
  cancelar.title = "Cancelar";
  cancelar.addEventListener("click", pintarPanel);

  form.addEventListener("submit", e => {
    e.preventDefault();
    const n = nombre.value.trim();
    const dd = Number(dia.value);
    const mm = Number(mes.value);
    if (!n) return;
    // 2024 es bisiesto: así se acepta el 29 de febrero
    if (new Date(2024, mm - 1, dd).getMonth() !== mm - 1) {
      dia.setCustomValidity("Ese día no existe en ese mes");
      dia.reportValidity();
      return;
    }
    Object.assign(c, { nombre: n, mes: mm, dia: dd });
    guardar();
    // Si ha cambiado la fecha, saltamos a ese día para seguir viéndolo
    const año = Number(diaSeleccionado.slice(0, 4));
    const diaReal = mm === 2 && dd === 29 && !esBisiesto(año) ? 28 : dd;
    diaSeleccionado = claveFecha(new Date(año, mm - 1, diaReal));
    mesVisible = new Date(año, mm - 1, 1);
    pintarTodo();
  });

  form.append(nombre, dia, mes, ok, cancelar);
  li.appendChild(form);
  nombre.focus();
}

// =====================================================
// 4b. PINTAR EL MARCADOR (semana, mes, año y total)
// =====================================================
function pintarMarcador() {
  const claveHoy = claveFecha(hoy);
  const lunes = sumarDias(claveHoy, -((hoy.getDay() + 6) % 7));
  const [a, m] = claveHoy.split("-");
  document.getElementById("pts-semana").textContent = puntosEntre(lunes, sumarDias(lunes, 6));
  document.getElementById("pts-mes").textContent = puntosEntre(`${a}-${m}-01`, `${a}-${m}-31`);
  document.getElementById("pts-anio").textContent = puntosEntre(`${a}-01-01`, `${a}-12-31`);
  document.getElementById("pts-total").textContent = puntosEntre("0000-00-00", "9999-99-99");
}

// =====================================================
// 4c. PINTAR LAS ESTADÍSTICAS (del mes que estamos viendo)
// =====================================================
function pintarEstadisticas() {
  const año = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  document.getElementById("titulo-stats").textContent = `${MESES[mes]} ${año}`;

  // Solo cuentan los días que ya han llegado (hasta hoy incluido)
  const claveHoy = claveFecha(hoy);
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  let contados = 0;
  while (contados < diasEnMes && claveFecha(new Date(año, mes, contados + 1)) <= claveHoy) contados++;

  const lista = document.getElementById("lista-stats");
  lista.innerHTML = "";
  datos.habitos.forEach(h => {
    let hechos = 0;
    for (let d = 1; d <= contados; d++) {
      if (hecho(claveFecha(new Date(año, mes, d)), h.id)) hechos++;
    }
    const pct = contados ? Math.round(hechos / contados * 100) : 0;

    const tarjeta = document.createElement("div");
    tarjeta.className = "stat-habito";

    const cabecera = document.createElement("div");
    cabecera.className = "stat-cabecera";
    const nombre = document.createElement("span");
    nombre.textContent = `${h.emoji} ${h.nombre}`;
    const porcentaje = document.createElement("span");
    porcentaje.className = "stat-pct";
    porcentaje.textContent = contados ? `${pct}%` : "—";
    cabecera.append(nombre, porcentaje);

    const barra = document.createElement("div");
    barra.className = "barra";
    const relleno = document.createElement("div");
    relleno.style.width = `${pct}%`;
    relleno.style.background = h.color;
    barra.appendChild(relleno);

    const detalle = document.createElement("p");
    detalle.className = "stat-detalle";
    detalle.textContent =
      `${hechos} de ${contados} días · 🔥 racha ${rachaActual(h.id, claveHoy)} · 🏆 mejor ${mejorRacha(h.id)}`;

    tarjeta.append(cabecera, barra, detalle);
    lista.appendChild(tarjeta);
  });
}

// =====================================================
// 4d. PINTAR LA LISTA PARA EDITAR HÁBITOS
// =====================================================
function pintarGestionHabitos() {
  const contenedor = document.getElementById("gestion-habitos");
  contenedor.innerHTML = "";
  datos.habitos.forEach(h => {
    const fila = document.createElement("div");
    fila.className = "form-fila";

    const emoji = document.createElement("input");
    emoji.className = "input-emoji";
    emoji.value = h.emoji;
    emoji.setAttribute("aria-label", "Emoji");
    emoji.addEventListener("change", () => {
      h.emoji = primerEmoji(emoji.value) || h.emoji;
      emoji.value = h.emoji;
      cambiarHabito();
    });

    const nombre = document.createElement("input");
    nombre.value = h.nombre;
    nombre.setAttribute("aria-label", "Nombre");
    nombre.addEventListener("change", () => {
      h.nombre = nombre.value.trim() || h.nombre;
      nombre.value = h.nombre;
      cambiarHabito();
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = h.color;
    color.setAttribute("aria-label", "Color");
    color.addEventListener("input", () => {
      h.color = color.value;
      cambiarHabito();
    });

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "btn-secundario";
    borrar.textContent = "🗑️";
    borrar.title = "Borrar hábito";
    borrar.addEventListener("click", () => borrarHabito(h));

    fila.append(emoji, nombre, color, borrar);
    contenedor.appendChild(fila);
  });
}

function pintarTodo() {
  pintarAvisoCopia();
  pintarMarcador();
  pintarCalendario();
  pintarPanel();
  pintarEstadisticas();
  pintarGestionHabitos();
}

// =====================================================
// 5. ACCIONES
// =====================================================
function alternarHabito(id) {
  if (!esEditable(diaSeleccionado)) return;
  const hechos = datos.registros[diaSeleccionado] || [];
  datos.registros[diaSeleccionado] = hechos.includes(id)
    ? hechos.filter(x => x !== id)
    : [...hechos, id];
  guardar();
  pintarTodo();
}

// Al editar un hábito repintamos todo menos su propia lista, para no perder el foco
function cambiarHabito() {
  guardar();
  pintarCalendario();
  pintarPanel();
  pintarEstadisticas();
}

function borrarHabito(h) {
  if (!confirm(`¿Borrar "${h.nombre}"? También se borrarán sus días marcados y sus puntos.`)) return;
  datos.habitos = datos.habitos.filter(x => x !== h);
  for (const clave in datos.registros) {
    datos.registros[clave] = datos.registros[clave].filter(id => id !== h.id);
    if (datos.registros[clave].length === 0) delete datos.registros[clave];
  }
  guardar();
  pintarTodo();
}

document.getElementById("btn-anterior").addEventListener("click", () => {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1);
  pintarCalendario();
  pintarEstadisticas();
});

document.getElementById("btn-siguiente").addEventListener("click", () => {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1);
  pintarCalendario();
  pintarEstadisticas();
});

document.getElementById("btn-hoy").addEventListener("click", () => {
  mesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  diaSeleccionado = claveFecha(hoy);
  pintarTodo();
});

document.getElementById("form-cumple").addEventListener("submit", e => {
  e.preventDefault(); // evita que el formulario recargue la página
  const input = document.getElementById("input-cumple");
  const nombre = input.value.trim();
  if (!nombre) return; // no aceptar nombres hechos solo de espacios
  const [, m, d] = diaSeleccionado.split("-").map(Number);
  datos.cumples.push({ nombre, mes: m, dia: d });
  input.value = "";
  guardar();
  pintarTodo();
});

// Las notas se guardan mientras escribes (sin repintar, para no perder el foco)
document.getElementById("notas").addEventListener("input", e => {
  datos.notas[diaSeleccionado] = e.target.value;
  guardar();
});

document.getElementById("form-habito").addEventListener("submit", e => {
  e.preventDefault();
  const nombre = document.getElementById("habito-nombre").value.trim();
  if (!nombre) return;
  datos.habitos.push({
    id: "h" + Date.now(),
    nombre,
    emoji: primerEmoji(document.getElementById("habito-emoji").value) || "✅",
    color: document.getElementById("habito-color").value,
  });
  e.target.reset();
  guardar();
  pintarTodo();
});

// Muchos emojis ocupan varios caracteres (🏋️ son 3), así que cogemos
// el primer "carácter visible" en vez de cortar por longitud
function primerEmoji(texto) {
  texto = texto.trim();
  if (!texto) return "";
  if (window.Intl && Intl.Segmenter) {
    return new Intl.Segmenter().segment(texto)[Symbol.iterator]().next().value.segment;
  }
  return Array.from(texto)[0];
}

// Copia de seguridad: descarga todos los datos en un .json
function exportar() {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `mi-calendario-${claveFecha(hoy)}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  guardarInfoCopia({ ultima: claveFecha(hoy) });
  pintarAvisoCopia();
}

document.getElementById("btn-exportar").addEventListener("click", exportar);
document.getElementById("btn-copia-ahora").addEventListener("click", exportar);
document.getElementById("btn-copia-luego").addEventListener("click", () => {
  guardarInfoCopia({ posponer: sumarDias(claveFecha(hoy), 3) });
  pintarAvisoCopia();
});

// Importar: sustituye los datos actuales por los del archivo
document.getElementById("btn-importar").addEventListener("click", () => {
  document.getElementById("input-importar").click();
});

document.getElementById("input-importar").addEventListener("change", async e => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  try {
    const importados = JSON.parse(await archivo.text());
    if (!Array.isArray(importados.habitos) || typeof importados.registros !== "object") {
      throw new Error("formato incorrecto");
    }
    datos = { ...structuredClone(datosIniciales), ...importados };
    guardar();
    pintarTodo();
    document.getElementById("btn-importar").textContent = "✅ Importado";
  } catch {
    document.getElementById("btn-importar").textContent = "❌ Archivo no válido";
  }
  e.target.value = "";
});

// =====================================================
// 6. PROTEGER LOS DATOS
// =====================================================
// Cuándo se hizo la última copia. Va en otra clave para que no viaje dentro de la copia
const CLAVE_COPIA = "mi-calendario-copia";
const DIAS_AVISO_COPIA = 14;

function leerInfoCopia() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COPIA)) || {};
  } catch {
    return {};
  }
}

function guardarInfoCopia(cambios) {
  localStorage.setItem(CLAVE_COPIA, JSON.stringify({ ...leerInfoCopia(), ...cambios }));
}

function pintarAvisoCopia() {
  const info = leerInfoCopia();
  const claveHoy = claveFecha(hoy);
  // Si nunca has exportado, contamos desde el primer día que marcaste algo
  const desde = info.ultima || Object.keys(datos.registros).sort()[0];
  const dias = desde ? diasEntre(desde, claveHoy) : 0;
  const pospuesto = info.posponer && claveHoy < info.posponer;

  document.getElementById("aviso-copia").hidden = dias < DIAS_AVISO_COPIA || pospuesto;
  document.getElementById("texto-aviso-copia").textContent = info.ultima
    ? `💾 Hace ${dias} días que no haces copia de seguridad`
    : "💾 Aún no has hecho ninguna copia de seguridad";
  document.getElementById("estado-copia").textContent = info.ultima
    ? `Última copia: ${info.ultima.split("-").reverse().join("/")}`
    : "Aún no has hecho ninguna copia.";
}

// Pide al navegador que no borre los datos aunque le falte espacio
// (sin esto, algunos móviles pueden borrarlos si llevas tiempo sin abrir la app)
async function protegerDatos() {
  const estado = document.getElementById("estado-guardado");
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    const protegido = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    estado.textContent = protegido
      ? "🔒 El navegador guardará tus datos de forma permanente."
      : "⚠️ El navegador podría borrar tus datos si le falta espacio: haz copias a menudo.";
  } catch {
    // Si falla no pasa nada: la app sigue funcionando igual
  }
}

// Si la app sigue abierta al pasar la medianoche, "hoy" se queda viejo.
// Lo comprobamos al volver a la app y cada minuto.
function comprobarCambioDeDia() {
  const ahora = new Date();
  if (claveFecha(ahora) === claveFecha(hoy)) return;
  const claveVieja = claveFecha(hoy);
  const mesViejo = hoy.getMonth();
  hoy = ahora;
  // Si estábamos mirando "hoy", pasamos al nuevo hoy
  if (diaSeleccionado === claveVieja) diaSeleccionado = claveFecha(hoy);
  if (mesVisible.getMonth() === mesViejo && hoy.getMonth() !== mesViejo) {
    mesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  pintarTodo();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) comprobarCambioDeDia();
});
setInterval(comprobarCambioDeDia, 60 * 1000);

// Arranque
pintarTodo();
protegerDatos();

// PWA: registra el service worker (no funciona abriendo el archivo con file://)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}
