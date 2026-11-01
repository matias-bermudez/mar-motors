// Datos del panel (/admin/): la base compartida de la Plataforma Automotoras, en vivo con supabase-js.
// Solo lo usa el panel: la web pública lee assets/js/autos.js, que arma scripts/build.mjs.
// La base tiene los autos de todas las automotoras: todo se filtra por CONCESIONARIA.
// Las filas se convierten al modelo de la web (y al revés) con modelo.js.
import { CONFIG } from './config.js';
import { CONCESIONARIA, deFila, aFila, slugDe, rutaChica } from './modelo.js';

export const configured = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey && CONFIG.concesionaria);
const BUCKET = 'fotos';

let client;
function db() {
  client ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
    .then(({ createClient }) => createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey));
  return client;
}

// ── Sesión ───────────────────────────────────────────────────────
export async function session() {
  const sb = await db();
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function login(email, password) {
  const sb = await db();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  const sb = await db();
  await sb.auth.signOut();
}

// ¿El usuario puede editar Mar Motors? (tabla admins: su email con 'mar-motors' o '*')
export async function puedeEditar() {
  const sb = await db();
  const { data, error } = await sb.rpc('puede_editar', { c: CONCESIONARIA });
  if (error) { console.error(error); return false; }
  return data === true;
}

// ── Autos ────────────────────────────────────────────────────────
// Todos los de Mar Motors, incluidos ocultos y vendidos (la base solo se los muestra a sus admins).
export async function listTodos() {
  const sb = await db();
  const { data, error } = await sb.from('autos').select('*')
    .eq('concesionaria', CONCESIONARIA).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(deFila);
}

// Guarda un auto: nuevo (actual = null), editado, o solo algunos campos (cambios rápidos del listado).
// El slug es la URL (/autos/<slug>/): marca-modelo-año. Se mantiene mientras no cambien esos datos;
// si cambian, se actualiza. Si ya hay otro auto de Mar Motors con ese slug, se le agrega -2, -3…
export async function guardarAuto(actual, cambios) {
  const sb = await db();
  const fila = aFila(cambios);
  if (actual && !['marca', 'modelo', 'anio'].some((k) => k in cambios)) {
    return deFila(await unica(sb.from('autos').update(fila).eq('id', actual.id).eq('concesionaria', CONCESIONARIA)));
  }
  const base = slugDe({ ...actual, ...cambios });
  const mismo = actual && (actual.slug === base || new RegExp(`^${base}-\\d+$`).test(actual.slug));
  for (let n = 1; n < 50; n++) {
    const slug = mismo ? actual.slug : n === 1 ? base : `${base}-${n}`;
    try {
      return deFila(await unica(actual
        ? sb.from('autos').update({ ...fila, slug }).eq('id', actual.id).eq('concesionaria', CONCESIONARIA)
        : sb.from('autos').insert({ ...fila, slug, concesionaria: CONCESIONARIA })));
    } catch (err) {
      if (err.code !== '23505' || mismo) throw err; // 23505 = ese slug ya existe
    }
  }
  throw new Error('No se encontró una dirección libre para este auto.');
}

async function unica(q) {
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function borrarAuto(auto) {
  const sb = await db();
  const { error } = await sb.from('autos').delete().eq('id', auto.id).eq('concesionaria', CONCESIONARIA);
  if (error) throw error;
  await borrarFotos(auto.fotos);
}

// ── Fotos ────────────────────────────────────────────────────────
// En el bucket `fotos`: mar-motors/<uuid>.jpg (1600 px) y mar-motors/<uuid>_m.jpg (640 px, tarjetas).
// En la base se guarda solo la ruta de la grande; el build las baja al sitio.
export const urlFoto = (ruta, chica = false) =>
  `${CONFIG.supabaseUrl}/storage/v1/object/public/${BUCKET}/${(chica ? rutaChica(ruta) : ruta).split('/').map(encodeURIComponent).join('/')}`;

// Achica la foto del celular (3–10 MB) en el navegador y sube las dos medidas. Devuelve la ruta.
export async function subirFoto(file) {
  const sb = await db();
  const img = await decodificar(file);
  let grande, chica;
  try {
    [grande, chica] = await Promise.all([achicar(img, 1600, 0.82), achicar(img, 640, 0.78)]);
  } finally {
    img.close?.();
  }
  const ruta = `${CONCESIONARIA}/${crypto.randomUUID()}.jpg`;
  const subidas = [];
  try {
    for (const [r, blob] of [[ruta, grande], [rutaChica(ruta), chica]]) {
      const { error } = await sb.storage.from(BUCKET).upload(r, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      subidas.push(r);
    }
  } catch (err) {
    if (subidas.length) await sb.storage.from(BUCKET).remove(subidas);
    throw err;
  }
  return ruta;
}

// Borra las fotos (las dos medidas).
export async function borrarFotos(rutas) {
  if (!rutas?.length) return;
  const sb = await db();
  const { error } = await sb.storage.from(BUCKET).remove(rutas.flatMap((r) => [r, rutaChica(r)]));
  if (error) console.error(error);
}

async function achicar(img, max, calidad) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('formato de imagen no soportado');
  return blob;
}

// createImageBitmap con orientación no anda en todos los Safari: si falla, se usa un <img>
// (los navegadores ya lo giran según la foto).
async function decodificar(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
