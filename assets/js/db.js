// Autos de la web pública. Salen de assets/js/autos.js, que escribe scripts/build.mjs al publicar
// (leídos de la base compartida y con las fotos ya copiadas al sitio): el navegador nunca consulta Supabase.
// El panel (/admin/) usa supabase.js.
import { AUTOS } from './autos.js';

export const listAutos = async () => AUTOS;

// Por slug (link de la web) o por número de referencia.
export const getAuto = async (ref) => AUTOS.find((a) => a.slug === String(ref) || String(a.id) === String(ref)) || null;
