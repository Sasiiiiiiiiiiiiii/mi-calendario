// =====================================================
// 8. AMIGOS: añadirse por código o enlace de invitación
// =====================================================
// La base de datos (supabase/esquema.sql) guarda solo el nombre y el código; los
// amigos nunca ven el email ni los datos del calendario.

// Si alguien abre un enlace de invitación se guarda aquí hasta que lo acepte: entrar
// con el correo recarga la página y el enlace se perdería.
const CLAVE_INVITACION = "mi-calendario-invitacion";

const MENSAJES_AMIGOS = {
  codigo_no_valido: "⚠️ Ese código no es de nadie. Revisa que esté bien escrito.",
  codigo_propio: "⚠️ Ese código es el tuyo.",
  sin_nombre: "⚠️ Pon antes tu nombre.",
};

let usuarioAmigos = null;
let perfil = null;

const campoAmigos = id => document.getElementById(id);

function avisarAmigos(texto) {
  campoAmigos("estado-amigos").textContent = texto;
}

function textoError(error) {
  return MENSAJES_AMIGOS[error.message] || "⚠️ No se ha podido hacer. Comprueba tu conexión.";
}

function leerInvitacion() {
  try {
    return localStorage.getItem(CLAVE_INVITACION) || "";
  } catch {
    return "";
  }
}

function guardarInvitacion(codigo) {
  try {
    if (codigo) localStorage.setItem(CLAVE_INVITACION, codigo);
    else localStorage.removeItem(CLAVE_INVITACION);
  } catch { /* sin almacenamiento: la invitación solo dura hasta recargar */ }
}

// Coge el código del enlace y lo quita de la dirección
function recogerInvitacion() {
  const url = new URL(location.href);
  const codigo = url.searchParams.get("amigo");
  if (!codigo) return;
  guardarInvitacion(codigo.trim().toUpperCase());
  url.searchParams.delete("amigo");
  history.replaceState(null, "", url);
}

function pintarAmigos(amigos = []) {
  const dentro = Boolean(usuarioAmigos);
  const invitacion = leerInvitacion();
  campoAmigos("amigos-fuera").hidden = dentro;
  campoAmigos("form-nombre").hidden = !dentro;
  campoAmigos("amigos-dentro").hidden = !perfil;
  campoAmigos("seccion-amigos").open ||= Boolean(invitacion);

  if (invitacion && !perfil) {
    avisarAmigos(dentro
      ? "👋 Te han invitado. Pon tu nombre para aceptar."
      : "👋 Te han invitado. Entra con tu email para aceptar.");
  }
  if (!perfil) return;

  campoAmigos("input-nombre").value = perfil.nombre;
  campoAmigos("mi-codigo").textContent = perfil.codigo;
  if (invitacion) campoAmigos("input-amigo").value = invitacion;

  const lista = campoAmigos("lista-amigos");
  lista.replaceChildren(...amigos.map(amigo => {
    const fila = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "cumple-nombre";
    nombre.textContent = amigo.nombre;  // lo escribe otra persona: siempre como texto
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.textContent = "✕";
    quitar.setAttribute("aria-label", `Quitar a ${amigo.nombre}`);
    quitar.addEventListener("click", () => quitarAmigo(amigo));
    fila.append(nombre, quitar);
    return fila;
  }));
  if (!amigos.length) avisarAmigos(invitacion
    ? "👋 Te han invitado. Pulsa Añadir para aceptar."
    : "Aún no tienes amigos añadidos.");
}

async function cargarAmigos() {
  if (!usuarioAmigos) return;
  const { data: filas, error } = await nube.rpc("mi_perfil");
  if (error) return avisarAmigos(textoError(error));
  perfil = filas[0] || null;
  if (!perfil) return pintarAmigos();

  const { data: amigos, error: errorAmigos } = await nube.rpc("mis_amigos");
  if (errorAmigos) return avisarAmigos(textoError(errorAmigos));
  avisarAmigos("");
  pintarAmigos(amigos);
}

async function quitarAmigo(amigo) {
  if (!confirm(`¿Quitar a ${amigo.nombre} de tus amigos?`)) return;
  const { error } = await nube.rpc("quitar_amigo", { amigo: amigo.id });
  if (error) return avisarAmigos(textoError(error));
  await cargarAmigos();
}

campoAmigos("form-nombre").addEventListener("submit", async e => {
  e.preventDefault();
  const nuevo = campoAmigos("input-nombre").value.trim();
  if (!nuevo) return;
  const { error } = await nube.rpc("guardar_nombre", { nuevo });
  if (error) return avisarAmigos(textoError(error));
  await cargarAmigos();
  avisarAmigos("✅ Nombre guardado.");
});

campoAmigos("form-amigo").addEventListener("submit", async e => {
  e.preventDefault();
  const codigo = campoAmigos("input-amigo").value.replace(/\s/g, "");
  const { data: nombre, error } = await nube.rpc("agregar_amigo", { codigo_amigo: codigo });
  // Una invitación que no vale se olvida, para que no vuelva a salir cada vez
  if (!error || error.message in MENSAJES_AMIGOS) guardarInvitacion("");
  if (error) return avisarAmigos(textoError(error));
  campoAmigos("input-amigo").value = "";
  await cargarAmigos();
  avisarAmigos(`✅ ${nombre} y tú ya sois amigos.`);
});

campoAmigos("btn-invitar").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}?amigo=${perfil.codigo}`;
  const text = `Vamos a competir en Mi Calendario. Mi código es ${perfil.codigo}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Mi Calendario", text, url });
    } catch { /* ha cerrado la ventana de compartir */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    avisarAmigos("📋 Invitación copiada. Pégala donde quieras.");
  } catch {
    avisarAmigos(`Enlace para invitar: ${url}`);
  }
});

// Al abrir la sección se actualiza, por si alguien te ha añadido desde otro sitio
campoAmigos("seccion-amigos").addEventListener("toggle", e => {
  if (e.target.open) cargarAmigos();
});

recogerInvitacion();
pintarAmigos();

if (nube) {
  nube.auth.onAuthStateChange((evento, nuevaSesion) => {
    const nuevo = nuevaSesion?.user.id || null;
    if (nuevo === usuarioAmigos) return;
    usuarioAmigos = nuevo;
    perfil = null;
    avisarAmigos("");
    pintarAmigos();
    // Fuera del aviso, para no llamar a Supabase desde dentro de su propio evento
    if (nuevo) setTimeout(cargarAmigos, 0);
  });
}
