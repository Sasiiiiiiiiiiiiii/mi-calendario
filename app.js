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
// LATAS: cada hábito tiene su lata (blanca, rosa o naranja); cada día sale una por hábito hecho
// =====================================================
// S = tapa, B = lata, H = brillo, D = sombra, L = el dibujo de la lata
const LATA = [".SSS.", "HBBBD", "HLBLD", "HLBLD", "HLBLD", "HBBBD", ".SSS."];
const COLORES_LATA = [
  { nombre: "blanca", B: "#f4f4f0", H: "#ffffff", D: "#b8b8b2", L: "#8fa6c2" },
  { nombre: "rosa", B: "#f28bb5", H: "#f9b8d2", D: "#c95f8c", L: "#ffffff" },
  { nombre: "naranja", B: "#f39a2e", H: "#f8c06a", D: "#c46f14", L: "#ffffff" },
];

// Convierte una rejilla de letras en cuadraditos SVG, empezando en (dx, dy)
function pixeles(filas, colores, dx = 0, dy = 0) {
  const rects = [];
  filas.forEach((fila, y) => [...fila].forEach((c, x) => {
    if (c !== ".") rects.push(`<rect x="${x + dx}" y="${y + dy}" width="1" height="1" fill="${colores[c]}"/>`);
  }));
  return rects.join("");
}

// Dibuja una rejilla de letras como SVG de píxeles
function sprite(filas, colores) {
  return `<svg viewBox="0 0 ${filas[0].length} ${filas.length}" shape-rendering="crispEdges" aria-hidden="true">${pixeles(filas, colores)}</svg>`;
}

// Cada hábito guarda su lata en habito.flor (se llama así porque antes eran flores;
// se mantiene el nombre para que los datos guardados sigan valiendo). A los que no
// la tienen (datos antiguos) se les da según su orden.
function asegurarLatas() {
  datos.habitos.forEach((h, i) => {
    if (!Number.isInteger(h.flor)) h.flor = i % COLORES_LATA.length;
  });
}

// Para un hábito nuevo, la lata que menos se usa (la primera si empatan)
function lataLibre() {
  const usos = COLORES_LATA.map((_, n) => datos.habitos.filter(h => h.flor % COLORES_LATA.length === n).length);
  return usos.indexOf(Math.min(...usos));
}
asegurarLatas();

function crearLata(habito) {
  const n = (Number.isInteger(habito.flor) ? habito.flor : 0) % COLORES_LATA.length;
  const lata = document.createElement("span");
  lata.className = "lata";
  lata.title = habito.nombre;
  lata.innerHTML = sprite(LATA, { S: "#b8bcc4", ...COLORES_LATA[n] });
  return lata;
}

// Un trocito de huerto con una lata por cada hábito hecho ese día (o null si no hay ninguno)
function crearHuerto(clave) {
  const hechos = datos.habitos.filter(h => (datos.registros[clave] || []).includes(h.id));
  if (!hechos.length) return null;
  const huerto = document.createElement("span");
  huerto.className = "huerto";
  hechos.forEach(h => huerto.appendChild(crearLata(h)));
  return huerto;
}

// =====================================================
// PAISAJE: la cabecera cambia con la hora del día
// =====================================================
const ANCHO_PAISAJE = 320;
const ALTO_PAISAJE = 48;

// cielo: 4 franjas de arriba a abajo. tinte: color con el que se oscurece el campo
const MOMENTOS = {
  noche: {
    cielo: ["#0b1026", "#111a3a", "#18234b", "#1f2c58"], tinte: ["#0b1026", 0.7],
    pared: "#5e5a52", ventana: "#ffd25a", astro: "#f2ecd0",
  },
  amanecer: {
    cielo: ["#3b3466", "#8a4f7d", "#e07a6a", "#f6b26b"], tinte: ["#3b2a4a", 0.35],
    pared: "#c9b48f", ventana: "#ffd25a", astro: "#ffcf6b",
  },
  dia: {
    cielo: ["#4b9fe0", "#67b4e9", "#8acaef", "#b4e0f4"], tinte: ["#000000", 0],
    pared: "#e3d6b8", ventana: "#4d6f91", astro: "#ffe27a",
  },
  atardecer: {
    cielo: ["#2d2550", "#6b3a6e", "#c8566a", "#f08a4b"], tinte: ["#2d2040", 0.4],
    pared: "#b9a07c", ventana: "#ffd25a", astro: "#ffb35c",
  },
};

// Colores del campo a pleno día en cada estación (por la noche se oscurecen con el tinte)
// arboles: uno por árbol, en orden; nieve: color de lo que cubre copas y tejado
const ESTACIONES = {
  invierno: {
    lejos: "#9aa8b8", cumbre: "#e6ecf3", cerca: "#7f8f86", hierba: "#f2f4f7",
    arboles: ["#2c4a3c"], flor: null, nieve: "#f2f4f7",
  },
  primavera: {
    lejos: "#7aa88a", cumbre: null, cerca: "#4a8a3e", hierba: "#8fd66a",
    arboles: ["#3c8a3a"], flor: "#ff9fb3", nieve: null,
  },
  verano: {
    lejos: "#6e9c80", cumbre: null, cerca: "#3f7a3a", hierba: "#7cc44a",
    arboles: ["#2f6b2f"], flor: null, nieve: null,
  },
  otono: {
    lejos: "#a08a5e", cumbre: null, cerca: "#6b6a32", hierba: "#b8913a",
    arboles: ["#d9673a", "#e9a23b", "#b4432a"], flor: null, nieve: null,
  },
};

const SOL = ["..XXX..", ".XXXXX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX.."];
const LUNA = ["..XXX..", ".XXX...", "XXX....", "XXX....", "XXX....", ".XXX...", "..XXX.."];
const NUBE = ["...WWW....", ".WWWWWWW..", "WWWWWWWWWW"];
// N = nieve en la punta (en invierno), B = flores en primavera
const ARBOL = ["..N..", ".TBT.", "TTTTT", ".BTT.", "TTTTT", "..R..", "..R.."];
// Alguien paseando a dos gatas blancas: cuerpo fijo + dos posturas de patas (A y B)
const PASEANTE = [".HHH.", ".HSS.", "..SS.", ".CCC.", "CCCCS", ".CCC.", ".PPP."];
const PASEANTE_PIES = [[".P.P.", ".P.P.", ".Z.Z."], ["..PP.", "..PP.", "..ZZ."]];
const GATA = ["W....W.W", ".W..WWEW", ".WWWWWWW"];
const GATA_PATAS = [".W.W.W.W", "..W.W.W."];
const CASA = ["...NNN...", "..AAAAA..", ".AAAAAAA.", "..PPPPP..", "..PVPDP..", "..PPPDP.."];

function momentoDelDia(hora) {
  if (hora >= 6 && hora < 8) return "amanecer";
  if (hora >= 8 && hora < 18) return "dia";
  if (hora >= 18 && hora < 21) return "atardecer";
  return "noche";
}

// Estaciones del hemisferio norte por meses: dic-feb invierno, mar-may primavera...
function estacionDelAño(mes) {
  return ["invierno", "primavera", "verano", "otono"][Math.floor(((mes + 1) % 12) / 3)];
}

// Mezcla dos colores "#rrggbb": t = 0 es el primero, t = 1 el segundo
function mezclar(color, hacia, t) {
  const a = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const b = [1, 3, 5].map(i => parseInt(hacia.slice(i, i + 2), 16));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Altura de las colinas en cada columna: dos ondas mezcladas, redondeadas a píxeles
function alturaColina(x, base, amplitud, fase) {
  return Math.round(base - amplitud * (Math.sin(x / 23 + fase) * 0.6 + Math.sin(x / 9 + fase * 2) * 0.4));
}

// Números "aleatorios" pero siempre iguales, para que las estrellas no salten de sitio
function azar(semilla) {
  let n = semilla;
  return () => (n = (n * 16807) % 2147483647) / 2147483647;
}

// Cosas que caen (copos o hojas): cada una con su velocidad y su retraso
function particulas(clase, cantidad, colores, semilla) {
  const r = azar(semilla);
  const partes = [];
  for (let i = 0; i < cantidad; i++) {
    const x = Math.floor(r() * ANCHO_PAISAJE);
    const segundos = (clase === "copo" ? 7 : 10) + r() * 6;
    partes.push(`<rect class="${clase}" style="animation-duration:${segundos.toFixed(1)}s;animation-delay:-${(r() * segundos).toFixed(1)}s" x="${x}" y="-2" width="1" height="1" fill="${colores[i % colores.length]}"/>`);
  }
  return partes.join("");
}

// Una correa de píxeles en línea recta desde la mano hasta el cuello de la gata
function correa(x0, y0, x1, y1, color) {
  const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const rects = [];
  for (let i = 1; i < pasos; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / pasos);
    const y = Math.round(y0 + (y1 - y0) * i / pasos);
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`);
  }
  return rects.join("");
}

// El paseo cruza el paisaje de izquierda a derecha andando por el borde de la tierra
function paseo(campo) {
  const suelo = ALTO_PAISAJE - 5; // fila de los pies
  const persona = { H: campo("#3b2a20"), S: campo("#f1c39b"), C: campo("#3d6fa8"), P: campo("#3b3a4a"), Z: campo("#2a2018") };
  const gata = { W: campo("#f6f4ee"), E: campo("#3a3a3a") };
  const gatas = [9, 19];
  const mano = [4, suelo - 5];
  const fijo = [
    ...gatas.map(x => correa(mano[0], mano[1], x + 4, suelo - 3, campo("#c0392b"))),
    pixeles(PASEANTE, persona, 0, suelo - 9),
    ...gatas.map(x => pixeles(GATA, gata, x, suelo - 3)),
  ].join("");
  const postura = n => pixeles(PASEANTE_PIES[n], persona, 0, suelo - 2) +
    gatas.map(x => pixeles([GATA_PATAS[n]], gata, x, suelo)).join("");
  // Una zona invisible encima de cada gata para que al pasar el ratón salga su nombre
  const nombres = ["Nata", "Trufa"].map((nombre, i) =>
    `<rect class="gata" x="${gatas[i]}" y="${suelo - 3}" width="8" height="4" fill="#000" fill-opacity="0"><title>${nombre}</title></rect>`).join("");
  return `<g transform="translate(-30 0)"><g class="paseo" style="animation-delay:-${(Date.now() / 1000 % 70).toFixed(1)}s">${fijo}<g class="paso-a">${postura(0)}</g><g class="paso-b">${postura(1)}</g>${nombres}</g></g>`;
}

// Una forma en escalera: en cada columna x va desde alturas[x] hasta "fondo"
function escalones(alturas, fondo, color) {
  const d = alturas.map((y, x) => `V${y}H${x + 1}`).join("");
  return `<path d="M0 ${fondo}${d}V${fondo}Z" fill="${color}"/>`;
}

// Una franja que sigue la escalera: el borde de arriba es alturas[x] y tiene "grosor" píxeles
function franja(alturas, grosor, color) {
  const arriba = alturas.map((y, x) => `V${y}H${x + 1}`).join("");
  const abajo = alturas.map((y, x) => `V${y + grosor}H${x}`).reverse().join("");
  return `<path d="M0 ${alturas[0]}${arriba}${abajo}Z" fill="${color}"/>`;
}

function pintarPaisaje() {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const nombre = momentoDelDia(ahora.getHours());
  // La estación es la del mes que se está mirando; la hora del cielo, la de ahora
  const estacion = estacionDelAño(mesVisible.getMonth());
  const m = MOMENTOS[nombre];
  const e = ESTACIONES[estacion];
  const campo = color => mezclar(color, m.tinte[0], m.tinte[1]);
  const partes = [];

  // Cielo por franjas, con una fila de píxeles alternos entre franja y franja
  const altoFranja = 9;
  m.cielo.forEach((color, i) => {
    partes.push(`<rect x="0" y="${i * altoFranja}" width="${ANCHO_PAISAJE}" height="${i === 3 ? ALTO_PAISAJE : altoFranja}" fill="${color}"/>`);
    if (i > 0) {
      for (let x = 0; x < ANCHO_PAISAJE; x += 2) {
        partes.push(`<rect x="${x}" y="${i * altoFranja}" width="1" height="1" fill="${m.cielo[i - 1]}"/>`);
      }
    }
  });

  // Estrellas de noche
  if (nombre === "noche") {
    const r = azar(7);
    for (let i = 0; i < 40; i++) {
      const brilla = i % 4 === 0 ? ' class="estrella"' : "";
      partes.push(`<rect${brilla} x="${Math.floor(r() * ANCHO_PAISAJE)}" y="${Math.floor(r() * 28)}" width="1" height="1" fill="${i % 3 ? "#cfd8ff" : "#ffffff"}"/>`);
    }
  }

  // El sol va de izquierda a derecha entre las 6 y las 21; la luna, entre las 21 y las 6.
  // En pantallas estrechas solo se ve el centro del paisaje, así que el camino se acorta.
  const contenedor = document.getElementById("paisaje");
  const visible = Math.min(ANCHO_PAISAJE,
    ALTO_PAISAJE * contenedor.clientWidth / Math.max(contenedor.clientHeight, 1));
  const margen = (ANCHO_PAISAJE - visible) / 2;
  const deDia = nombre !== "noche";
  const recorrido = deDia ? (hora - 6) / 15 : ((hora + 24 - 21) % 24) / 9;
  const ax = Math.round(margen + 8 + recorrido * (visible - 23));
  // En pantallas anchas se corta la parte de arriba del cielo: "arriba" es la primera
  // fila que se ve, y el sol, la luna y las nubes no suben de ahí para no quedar cortados
  const arriba = Math.ceil(ALTO_PAISAJE - Math.min(ALTO_PAISAJE,
    ANCHO_PAISAJE * contenedor.clientHeight / Math.max(contenedor.clientWidth, 1)));
  const ay = Math.max(Math.round(26 - Math.sin(recorrido * Math.PI) * 15), arriba + 1);
  partes.push(pixeles(deDia ? SOL : LUNA, { X: m.astro }, ax, ay));

  // Nubes de día, que se mueven despacio (bajadas si el borde de arriba las cortaría)
  if (nombre === "dia") {
    [[0, 10, 90, 1], [1, 16, 140, 4], [2, 7, 110, 2]].forEach(([i, alto, segundos, bajo]) => {
      const y = Math.max(alto, arriba + bajo);
      partes.push(`<g class="nube" style="animation-duration:${segundos}s;animation-delay:-${i * 40}s">${pixeles(NUBE, { W: "#ffffff" }, -12, y)}</g>`);
    });
  }

  // Colinas: las de lejos (con nieve en la cumbre en invierno) y las de cerca
  // Cada colina es una sola pieza: con una columna por píxel, a algunos zooms
  // quedaban rendijas finísimas entre columnas por las que se veía el cielo
  const lejos = [...Array(ANCHO_PAISAJE)].map((_, x) => alturaColina(x, 32, 6, 1));
  const cerca = [...Array(ANCHO_PAISAJE)].map((_, x) => alturaColina(x, 40, 3, 4));
  partes.push(escalones(lejos, ALTO_PAISAJE, campo(e.lejos)));
  if (e.cumbre) partes.push(escalones(lejos.map(y => Math.min(y, 31)), 31, campo(e.cumbre)));
  partes.push(escalones(cerca, ALTO_PAISAJE, campo(e.cerca)));
  partes.push(franja(cerca, e.nieve ? 2 : 1, campo(e.hierba)));
  const flores = azar(11);
  for (let x = 0; x < ANCHO_PAISAJE; x++) {
    // Florecitas en primavera
    if (e.flor && flores() < 0.12) {
      const color = flores() < 0.5 ? e.flor : "#f6cf57";
      partes.push(`<rect x="${x}" y="${cerca[x] - 1}" width="1" height="1" fill="${campo(color)}"/>`);
    }
  }

  // Árboles y una casita (su ventana se enciende de noche)
  [40, 47, 186, 230, 236, 296].forEach((x, i) => {
    const hojas = campo(e.arboles[i % e.arboles.length]);
    partes.push(pixeles(ARBOL, {
      T: hojas,
      N: e.nieve ? campo(e.nieve) : hojas,
      B: e.flor ? campo(e.flor) : hojas,
      R: campo("#4a3322"),
    }, x, alturaColina(x + 2, 40, 3, 4) - 6));
  });
  partes.push(pixeles(CASA, {
    A: campo("#b4532a"), N: campo(e.nieve || "#b4532a"), P: campo(m.pared), V: m.ventana, D: campo("#5b3e2b"),
  }, 262, alturaColina(266, 40, 3, 4) - 5));

  partes.push(paseo(campo));

  // Copos en invierno, hojas en otoño, luciérnagas las noches de verano
  if (estacion === "invierno") partes.push(particulas("copo", 45, ["#ffffff", "#dfe8f5"], 3));
  if (estacion === "otono") partes.push(particulas("hoja", 14, ["#d9673a", "#e9a23b", "#b4432a"], 5));
  if (estacion === "verano" && nombre === "noche") {
    const r = azar(13);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * ANCHO_PAISAJE);
      partes.push(`<rect class="luciernaga" style="animation-delay:-${(r() * 4).toFixed(1)}s" x="${x}" y="${alturaColina(x, 40, 3, 4) - 2 - Math.floor(r() * 6)}" width="1" height="1" fill="#e8ff7a"/>`);
    }
  }

  // La tierra de abajo, igual que la de cada día del calendario
  partes.push(`<rect x="0" y="${ALTO_PAISAJE - 4}" width="${ANCHO_PAISAJE}" height="4" fill="#5b3e2b"/>`);
  partes.push(`<rect x="0" y="${ALTO_PAISAJE - 4}" width="${ANCHO_PAISAJE}" height="1" fill="#3f2a1d"/>`);

  contenedor.dataset.momento = nombre;
  contenedor.dataset.estacion = estacion;
  contenedor.innerHTML = `<svg viewBox="0 0 ${ANCHO_PAISAJE} ${ALTO_PAISAJE}" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges">${partes.join("")}</svg>`;
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

  // Si al cambiar de mes cambia la estación, se repinta el paisaje
  const paisaje = document.getElementById("paisaje");
  if (paisaje.dataset.estacion && paisaje.dataset.estacion !== estacionDelAño(mes)) pintarPaisaje();

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

    // Una lata por cada hábito hecho ese día
    const huerto = crearHuerto(clave);
    if (huerto) celda.appendChild(huerto);

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
    check.style.setProperty("--color", h.color);
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
  const lineaPuntos = document.getElementById("puntos-dia");
  lineaPuntos.textContent = `⭐ ${puntos} puntos`;
  const huertoDia = crearHuerto(diaSeleccionado);
  if (huertoDia) lineaPuntos.prepend(huertoDia);

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
    nombre.className = "stat-nombre-habito";
    nombre.append(crearLata(h), `${h.emoji} ${h.nombre}`);
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
    flor: lataLibre(),
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
    asegurarLatas();
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

// Al tocar una gata (en el móvil no hay ratón) sale un bocadillo con su nombre
document.querySelector("header").addEventListener("click", e => {
  const gata = e.target.closest("rect.gata");
  if (!gata) return;
  const cabecera = e.currentTarget;
  cabecera.querySelector(".bocadillo")?.remove();
  const bocadillo = document.createElement("span");
  bocadillo.className = "bocadillo";
  bocadillo.textContent = gata.querySelector("title").textContent;
  const caja = cabecera.getBoundingClientRect();
  const sitio = gata.getBoundingClientRect();
  bocadillo.style.left = `${sitio.left + sitio.width / 2 - caja.left}px`;
  bocadillo.style.top = `${sitio.top - caja.top}px`;
  cabecera.appendChild(bocadillo);
  setTimeout(() => bocadillo.remove(), 2000);
});

// Arranque
pintarTodo();
pintarPaisaje();
setInterval(pintarPaisaje, 5 * 60 * 1000);
let esperaPaisaje;
window.addEventListener("resize", () => {
  clearTimeout(esperaPaisaje);
  esperaPaisaje = setTimeout(pintarPaisaje, 200);
});
protegerDatos();

// PWA: registra el service worker (no funciona abriendo el archivo con file://)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}
