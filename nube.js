// =====================================================
// 7. NUBE: entrar con el email y sincronizar con Supabase
// =====================================================
// Los datos siguen guardándose en el navegador (la app funciona sin internet);
// la nube es una copia más que se mantiene al día entre aparatos.
// La clave es pública a propósito: va dentro de la app y la protección está en
// las reglas de la base de datos (supabase/esquema.sql), que solo dejan a cada
// persona ver y cambiar su propia fila.
const SUPABASE_URL = "https://jyoozarwiefwznmnbqbe.supabase.co";
const SUPABASE_CLAVE = "sb_publishable_kXvZLPEUIvgyhwkOaqA-ZQ_NZydrnlm";

// Qué sabe este navegador de la nube:
// usuario = de quién es lo sincronizado, version = hora (del servidor) de lo último
// que se bajó o subió, pendiente = hay cambios aquí que la nube aún no tiene
const CLAVE_NUBE = "mi-calendario-nube";

// Si venimos del enlace del correo (se mira antes de que Supabase limpie la dirección)
const veniaDelCorreo = location.hash.includes("access_token");

const nube = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_CLAVE, {
    // "implicit": el enlace del correo vale aunque se abra en otro navegador
    auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true },
  })
  : null;

let sesion = null;
let estadoNube = leerEstadoNube();
let sincronizando = false;
let repetirSincronizacion = false;
let cambiosLocales = 0;  // sube con cada cambio, para saber si hubo alguno mientras se subía
let errorNube = "";
let esperaSubida;

function leerEstadoNube() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_NUBE)) || {};
  } catch {
    return {};
  }
}

function guardarEstadoNube(cambios) {
  estadoNube = { ...estadoNube, ...cambios };
  try {
    localStorage.setItem(CLAVE_NUBE, JSON.stringify(estadoNube));
  } catch { /* sin almacenamiento: se volverá a sincronizar entero la próxima vez */ }
}

// La llama guardar() (app.js) cada vez que cambia algo
function avisarNube() {
  cambiosLocales++;
  guardarEstadoNube({ pendiente: true });
  if (!sesion) return;
  pintarNube();
  clearTimeout(esperaSubida);
  esperaSubida = setTimeout(sincronizar, 1500);
}

// Junta los datos de aquí con los de la nube sin perder nada de ninguno de los dos.
// Se usa la primera vez que este aparato entra, y si los dos han cambiado a la vez.
function mezclarDatos(aqui, alla) {
  const habitos = [...alla.habitos];
  aqui.habitos.forEach(h => {
    const i = habitos.findIndex(o => o.id === h.id);
    if (i === -1) habitos.push(h); else habitos[i] = { ...habitos[i], ...h };
  });

  const registros = { ...alla.registros };
  Object.entries(aqui.registros || {}).forEach(([dia, hechos]) => {
    registros[dia] = [...new Set([...(registros[dia] || []), ...hechos])];
  });

  const claveCumple = c => `${c.nombre}|${c.mes}|${c.dia}`;
  const cumples = [...(alla.cumples || [])];
  (aqui.cumples || []).forEach(c => {
    if (!cumples.some(o => claveCumple(o) === claveCumple(c))) cumples.push(c);
  });

  // Si una nota es distinta en cada sitio, se quedan las dos
  const notas = { ...alla.notas };
  Object.entries(aqui.notas || {}).forEach(([dia, texto]) => {
    const otra = notas[dia] || "";
    if (!otra.trim() || otra.includes(texto)) notas[dia] = otra.trim() ? otra : texto;
    else if (!texto.includes(otra)) notas[dia] = `${texto}\n\n${otra}`;
    else notas[dia] = texto;
  });

  return { ...alla, ...aqui, habitos, registros, cumples, notas };
}

// Pone en la app unos datos que vienen de la nube (sin volver a avisar a la nube)
function aplicarDatos(nuevos) {
  datos = { ...structuredClone(datosIniciales), ...nuevos };
  asegurarLatas();
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos));
  pintarTodo();
}

// Sube los datos. "version" es la que creemos que tiene la nube ahora: si otro aparato
// ha subido algo entretanto, no se pisa, y se vuelve a empezar para mezclar.
async function subirDatos(version) {
  const cambiosAntes = cambiosLocales;
  const copia = structuredClone(datos);
  let respuesta;
  if (version === null) {
    respuesta = await nube.from("calendarios").insert({ datos: copia }).select("actualizado");
  } else {
    respuesta = await nube.from("calendarios").update({ datos: copia })
      .eq("user_id", sesion.user.id).eq("actualizado", version).select("actualizado");
  }
  const { data, error } = respuesta;
  // 23505 = ya existe la fila (la ha creado otro aparato a la vez)
  if (error && error.code !== "23505") throw error;
  if (error || data.length === 0) {
    repetirSincronizacion = true;
    return;
  }
  guardarEstadoNube({ version: data[0].actualizado, pendiente: cambiosLocales !== cambiosAntes });
}

async function sincronizar() {
  if (!nube || !sesion) return pintarNube();
  if (!navigator.onLine) {
    errorNube = "";
    return pintarNube();
  }
  if (sincronizando) {
    repetirSincronizacion = true;
    return;
  }
  sincronizando = true;
  pintarNube();
  try {
    const { data: fila, error } = await nube.from("calendarios")
      .select("datos, actualizado").eq("user_id", sesion.user.id).maybeSingle();
    if (error) throw error;

    const primeraVez = estadoNube.usuario !== sesion.user.id;
    if (primeraVez) guardarEstadoNube({ usuario: sesion.user.id, version: null, pendiente: true });

    if (!fila) {
      await subirDatos(null);
    } else if (primeraVez) {
      // Este aparato entra por primera vez: se juntan sus datos con los de la nube
      aplicarDatos(mezclarDatos(datos, fila.datos));
      await subirDatos(fila.actualizado);
    } else if (fila.actualizado !== estadoNube.version) {
      // Otro aparato ha subido cambios
      if (estadoNube.pendiente) {
        aplicarDatos(mezclarDatos(datos, fila.datos));
        await subirDatos(fila.actualizado);
      } else {
        aplicarDatos(fila.datos);
        guardarEstadoNube({ version: fila.actualizado });
      }
    } else if (estadoNube.pendiente) {
      await subirDatos(fila.actualizado);
    }
    errorNube = "";
  } catch (e) {
    errorNube = "No se pudo sincronizar. Se reintentará más tarde.";
    console.warn("Nube:", e);
  }
  sincronizando = false;
  if (repetirSincronizacion) {
    repetirSincronizacion = false;
    return sincronizar();
  }
  pintarNube();
}

// ----- Lo que se ve en el panel -----
function pintarNube() {
  const dentro = Boolean(sesion);
  document.getElementById("nube-fuera").hidden = dentro;
  document.getElementById("nube-dentro").hidden = !dentro;
  const estado = document.getElementById("estado-nube");
  if (!nube) {
    estado.textContent = "La sincronización no está disponible ahora mismo.";
    return;
  }
  if (!dentro) return;
  document.getElementById("nube-usuario").textContent = `Conectado como ${sesion.user.email}`;
  if (errorNube) estado.textContent = `⚠️ ${errorNube}`;
  else if (sincronizando) estado.textContent = "⏳ Sincronizando…";
  else if (!navigator.onLine) estado.textContent = "📴 Sin conexión: los cambios se subirán al volver.";
  else if (estadoNube.pendiente) estado.textContent = "⏳ Hay cambios por subir.";
  else estado.textContent = "✅ Todo guardado en la nube.";
}

let emailPendiente = "";

document.getElementById("form-email").addEventListener("submit", async e => {
  e.preventDefault();
  if (!nube) return;
  const email = document.getElementById("input-email").value.trim();
  const boton = e.target.querySelector("button");
  const estado = document.getElementById("estado-nube");
  boton.disabled = true;
  estado.textContent = "Enviando…";
  const { error } = await nube.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  boton.disabled = false;
  if (error) {
    estado.textContent = error.status === 429
      ? "⚠️ Has pedido demasiados correos seguidos. Espera un rato y vuelve a probar."
      : `⚠️ No se pudo enviar el correo (${error.message}).`;
    return;
  }
  emailPendiente = email;
  document.getElementById("form-codigo").hidden = false;
  estado.textContent = `📬 Te he enviado un correo a ${email}. Abre el enlace, o escribe aquí el código si viene uno.`;
});

document.getElementById("form-codigo").addEventListener("submit", async e => {
  e.preventDefault();
  const token = document.getElementById("input-codigo").value.replace(/\s/g, "");
  const estado = document.getElementById("estado-nube");
  const { error } = await nube.auth.verifyOtp({ email: emailPendiente, token, type: "email" });
  if (error) estado.textContent = "⚠️ Ese código no vale o ha caducado. Pide otro correo.";
  // si va bien, onAuthStateChange se encarga del resto
});

document.getElementById("btn-sincronizar").addEventListener("click", sincronizar);

document.getElementById("btn-salir").addEventListener("click", async () => {
  if (!confirm("¿Salir? Tus datos se quedan en este aparato, pero dejarán de sincronizarse.")) return;
  await nube.auth.signOut();
  guardarEstadoNube({ usuario: null, version: null });
  document.getElementById("estado-nube").textContent = "Has salido. Tus datos siguen aquí.";
});

// ----- Arranque -----
if (nube) {
  nube.auth.onAuthStateChange((evento, nuevaSesion) => {
    const antes = sesion?.user.id;
    sesion = nuevaSesion;
    pintarNube();
    // Al entrar (o al recuperar la sesión guardada) se sincroniza; fuera del aviso
    // para no llamar a Supabase desde dentro de su propio evento
    if (sesion && sesion.user.id !== antes) setTimeout(sincronizar, 0);
    if (sesion && veniaDelCorreo) document.getElementById("seccion-nube").open = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sincronizar();
  });
  window.addEventListener("online", sincronizar);
  window.addEventListener("offline", pintarNube);
  setInterval(() => { if (!document.hidden) sincronizar(); }, 2 * 60 * 1000);
}
pintarNube();
