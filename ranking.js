// =====================================================
// 9. RANKING SEMANAL: mis puntos y los de mis amigos (lunes a domingo)
// =====================================================
// Los puntos los calcula la base de datos (ranking_semanal en supabase/esquema.sql)
// y solo cuenta lo que se marcó a tiempo (hoy o ayer), así nadie puede inflarlos.
// De los demás solo llega su nombre y sus puntos.

let usuarioRanking = null;

const campoRanking = id => document.getElementById(id);

function avisarRanking(texto) {
  campoRanking("estado-ranking").textContent = texto;
}

function pintarRanking(filas) {
  const lista = campoRanking("lista-ranking");
  lista.replaceChildren(...filas.map((fila, i) => {
    const li = document.createElement("li");
    if (fila.soy_yo) li.className = "soy-yo";
    const puesto = document.createElement("span");
    puesto.className = "ranking-puesto";
    // Empatados con el de arriba comparten puesto
    const n = filas.findIndex(o => o.puntos === fila.puntos) + 1;
    puesto.textContent = n === 1 && fila.puntos > 0 ? "👑" : `${n}.`;
    const nombre = document.createElement("span");
    nombre.className = "cumple-nombre";
    nombre.textContent = fila.soy_yo ? `${fila.nombre} (tú)` : fila.nombre;  // siempre como texto
    const puntos = document.createElement("span");
    puntos.className = "ranking-puntos";
    puntos.textContent = `⭐ ${fila.puntos}`;
    li.append(puesto, nombre, puntos);
    return li;
  }));
}

async function cargarRanking() {
  if (!usuarioRanking) {
    pintarRanking([]);
    return avisarRanking("Entra con tu email en ☁️ Sincronizar para ver el ranking.");
  }
  if (!navigator.onLine) return avisarRanking("📴 Sin conexión: el ranking se verá al volver.");
  const { data: filas, error } = await nube.rpc("ranking_semanal");
  if (error) return avisarRanking("⚠️ No se ha podido cargar el ranking. Comprueba tu conexión.");
  pintarRanking(filas);
  if (!filas.length) avisarRanking("Pon tu nombre en 👥 Amigos para entrar en el ranking.");
  else if (filas.length === 1) avisarRanking("Añade amigos en 👥 Amigos para competir con ellos.");
  else avisarRanking("");
}

const rankingAbierto = () => campoRanking("seccion-ranking").open;

campoRanking("seccion-ranking").addEventListener("toggle", () => {
  if (rankingAbierto()) cargarRanking();
});

// Lo marcado llega a la base de datos al sincronizar: entonces se recalcula
document.addEventListener("nube-sincronizada", () => {
  if (rankingAbierto()) cargarRanking();
});

if (nube) {
  nube.auth.onAuthStateChange((evento, sesionNueva) => {
    const nuevo = sesionNueva?.user.id || null;
    if (nuevo === usuarioRanking) return;
    usuarioRanking = nuevo;
    // Fuera del aviso, para no llamar a Supabase desde dentro de su propio evento
    if (rankingAbierto()) setTimeout(cargarRanking, 0);
  });
}
avisarRanking("Entra con tu email en ☁️ Sincronizar para ver el ranking.");
