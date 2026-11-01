import { CONFIG } from './config.js';
import { DEMO_AUTOS } from './demo.js';

export const configured = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const BUCKET = 'fotos';

let client;
export function db() {
  if (!configured) return Promise.resolve(null);
  client ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
    .then(({ createClient }) => createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey));
  return client;
}

// Autos para la web: publicados, los vendidos al final y los más nuevos primero.
export async function listAutos() {
  if (!configured) return DEMO_AUTOS;
  const sb = await db();
  const { data, error } = await sb.from('autos').select('*').eq('publicado', true).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAuto(id) {
  if (!/^\d+$/.test(String(id))) return null;
  if (!configured) return DEMO_AUTOS.find((a) => String(a.id) === String(id)) || null;
  const sb = await db();
  const { data, error } = await sb.from('autos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ── Panel ────────────────────────────────────────────────────────
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

// ¿El usuario logueado está en la tabla admins? (si no, RLS no lo deja guardar)
export async function esAdmin() {
  const sb = await db();
  const { data, error } = await sb.rpc('es_admin');
  if (error) { console.error(error); return false; }
  return data === true;
}

export async function logout() {
  const sb = await db();
  await sb.auth.signOut();
}

// Todos los autos, incluidos los ocultos (RLS solo los muestra si sos admin).
export async function listTodos() {
  const sb = await db();
  const { data, error } = await sb.from('autos').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function guardarAuto(id, row) {
  const sb = await db();
  const q = id ? sb.from('autos').update(row).eq('id', id) : sb.from('autos').insert(row);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function borrarAuto(auto) {
  const sb = await db();
  const { error } = await sb.from('autos').delete().eq('id', auto.id);
  if (error) throw error;
  await borrarFotos(auto.fotos || []);
}

// Achica las fotos del celular (5–10 MB) a ~300 KB antes de subirlas.
async function comprimir(file, max = 1600, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

// Sube una foto al bucket y devuelve su URL pública.
export async function subirFoto(file) {
  const sb = await db();
  const blob = await comprimir(file);
  const path = `autos/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function borrarFotos(urls) {
  if (!urls.length) return;
  const sb = await db();
  const marker = `/object/public/${BUCKET}/`;
  const paths = urls.map((u) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) {
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) console.error(error);
  }
}
