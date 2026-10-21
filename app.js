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
const hoy = new Date();
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

function cumplesDelDia(mes, dia) {
  return datos.cumples.filter(c => c.mes === mes && c.dia === dia);
}

// Suma (o resta) días a una clave "AAAA-MM-DD"
function sumarDias(clave, n) {
  const [a, m, d] = clave.split("-").map(Number);
  return claveFecha(new Date(a, m - 1, d + n));
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
    if (cumplesDelDia(mes + 1, d).length > 0) cabecera.append(" 🎂");
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

    // Racha: si aún no está hecho ese día, cuenta la que viene de ayer
    const dias = hecho(diaSeleccionado, h.id)
      ? racha(h.id, diaSeleccionado)
      : racha(h.id, sumarDias(diaSeleccionado, -1));
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
  cumplesDelDia(m, d).forEach(c => {
    const li = document.createElement("li");
    li.textContent = c.nombre;
    const borrar = document.createElement("button");
    borrar.textContent = "✕";
    borrar.title = "Borrar";
    borrar.addEventListener("click", () => {
      datos.cumples = datos.cumples.filter(x => x !== c);
      guardar();
      pintarTodo();
    });
    li.appendChild(borrar);
    ul.appendChild(li);
  });

  document.getElementById("notas").value = datos.notas[diaSeleccionado] || "";
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

function pintarTodo() {
  pintarMarcador();
  pintarCalendario();
  pintarPanel();
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

document.getElementById("btn-anterior").addEventListener("click", () => {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1);
  pintarCalendario();
});

document.getElementById("btn-siguiente").addEventListener("click", () => {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1);
  pintarCalendario();
});

document.getElementById("btn-hoy").addEventListener("click", () => {
  mesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  diaSeleccionado = claveFecha(hoy);
  pintarTodo();
});

document.getElementById("form-cumple").addEventListener("submit", e => {
  e.preventDefault(); // evita que el formulario recargue la página
  const input = document.getElementById("input-cumple");
  const [, m, d] = diaSeleccionado.split("-").map(Number);
  datos.cumples.push({ nombre: input.value.trim(), mes: m, dia: d });
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
  datos.habitos.push({
    id: "h" + Date.now(),
    nombre: document.getElementById("habito-nombre").value.trim(),
    emoji: document.getElementById("habito-emoji").value || "✅",
    color: document.getElementById("habito-color").value,
  });
  e.target.reset();
  guardar();
  pintarTodo();
});

// Copia de seguridad: descarga todos los datos en un .json
document.getElementById("btn-exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `mi-calendario-${claveFecha(hoy)}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
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

// Arranque
pintarTodo();

// PWA: registra el service worker (no funciona abriendo el archivo con file://)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}
