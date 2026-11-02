// Adaptador entre la base compartida de la Plataforma Automotoras (tabla `autos`, una fila por auto
// de todas las automotoras) y el modelo de auto que usa esta web. Lo usan el build (scripts/build.mjs)
// y el panel (admin.js), así las vistas no dependen de los nombres de las columnas.
//
//   UI de Mar Motors           columna en la base
//   caja                    ↔  transmision
//   carroceria              ↔  carroceria (y de ahí `tipo`: auto | camioneta | utilitario)
//   precio + moneda         ↔  precio + moneda ('USD' | 'UYU')
//   fotos                   ←  fotos: rutas del bucket (mar-motors/<uuid>.jpg, + _m.jpg de 640 px)
//   lo propio sin columna   ↔  extra (jsonb)
//
// Esquema: ~/Proyectos/plataforma-automotoras/supabase/schema.sql (se cambia solo ahí).
import { CONFIG } from './config.js';

// Id de Mar Motors en la base: toda lectura y escritura se filtra por esto.
export const CONCESIONARIA = CONFIG.concesionaria;

// Carrocerías de Mar Motors → `tipo` de la base.
const TIPO = { sedan: 'auto', hatch: 'auto', suv: 'camioneta', pickup: 'camioneta', utilitario: 'utilitario' };
export const tipoDe = (carroceria) => TIPO[carroceria] || 'auto';

const sinTildes = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// URL del auto (/autos/<slug>/): marca-modelo-año, minúsculas, sin tildes, con guiones.
export const slugDe = (a) => sinTildes(`${a.marca} ${a.modelo} ${a.anio}`)
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Foto chica (640 px) que el panel sube junto a cada foto: <uuid>_m.jpg.
export const rutaChica = (ruta) => ruta.replace(/\.jpg$/, '_m.jpg');

// Fila de la base → auto de la web. `fotos` quedan como rutas del bucket: el build las cambia por
// las copias del sitio y el panel por las URLs públicas de Supabase.
export function deFila(r) {
  // 'Sedán' → 'sedan', 'Pick-up' → 'pickup', 'Hatchback' → 'hatch'.
  let carroceria = sinTildes(r.carroceria || '').toLowerCase().replace(/[^a-z]/g, '') || null;
  if (carroceria === 'hatchback') carroceria = 'hatch';
  return {
    id: r.id,
    slug: r.slug,
    marca: r.marca,
    modelo: r.modelo,
    anio: r.anio,
    // extra.sin_km: el dueño no sabe los km (campo vacío en el panel) → "Km a consultar".
    km: r.extra?.sin_km ? null : r.km ?? 0,
    precio: r.precio || null,
    moneda: r.moneda === 'UYU' ? 'UYU' : 'USD',
    carroceria,
    tipo: r.tipo || tipoDe(carroceria),
    combustible: r.combustible,
    caja: r.transmision,
    motor: r.motor || null,
    color: r.color || null,
    puertas: r.puertas || null,
    descripcion: r.descripcion || '',
    fotos: r.fotos || [],
    estado: r.estado || 'disponible',
    publicado: r.publicado !== false,
    extra: r.extra || {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Auto (o parte de él, ej. { estado }) → columnas de la base. Solo se mandan los campos presentes,
// así los cambios rápidos del listado no pisan nada. No toca `extra` ni las columnas que esta web no usa.
export function aFila(a) {
  const f = {};
  const copiar = ['marca', 'modelo', 'anio', 'km', 'precio', 'moneda', 'carroceria', 'combustible', 'motor',
    'color', 'puertas', 'descripcion', 'fotos', 'estado', 'publicado', 'extra'];
  for (const k of copiar) if (a[k] !== undefined) f[k] = a[k];
  if (f.km === null) f.km = 0; // la columna no admite null: "sin km" va en extra.sin_km
  if (a.caja !== undefined) f.transmision = a.caja;
  // Una carrocería que esta web no conoce (cargada desde otro lado) no cambia el `tipo` que ya tenía.
  if (a.carroceria in TIPO) f.tipo = TIPO[a.carroceria];
  return f;
}

// ── Datos del negocio (tabla `negocios`, una fila por automotora) ──
// La edita el dueño desde el panel («Datos del negocio») y al publicar pisa a config.js en toda la web.
//
//   config.js                  columna en la base
//   whatsapp { intl, display } ↔  whatsapp (59899123456) + telefono ("099 123 456")
//   direccion                  ↔  direccion
//   horarios                   ↔  extra.horarios (mismo formato que config.js) + horario (el resumen en texto)
//   zonas                      ↔  zonas
//   redes                      ↔  instagram, tiktok (usuarios, sin @), facebook (link o página)
//   barrio, telefonoFijo, otrosCelulares ↔ extra.barrio, extra.telefono_fijo, extra.otros_celulares
//
// Campo vacío (null) = queda el valor de config.js.

// "099 123 456", "+598 99 123 456" o "2900 1234" → { whatsapp: '59899123456', telefono: '099 123 456' }.
export function telefonoUY(texto) {
  let d = String(texto ?? '').replace(/\D/g, '');
  if (d.startsWith('598')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^[0-9]{8}$/.test(d)) return null;
  const telefono = d.startsWith('9') ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : `${d.slice(0, 4)} ${d.slice(4)}`;
  return { whatsapp: '598' + d, telefono };
}

// Teléfono escrito como en Uruguay → formato de config.js ({ intl, display }).
const telConfig = (texto) => {
  const t = telefonoUY(texto);
  return t && { intl: t.whatsapp, display: t.telefono };
};

const DIAS_SCHEMA = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const horariosValidos = (h) => Array.isArray(h) && h.every((x) => Array.isArray(x?.dias) && x.dias.length
  && x.dias.every((d) => DIAS_SCHEMA.includes(d)) && HORA.test(x.abre) && HORA.test(x.cierra));

// Fila de `negocios` → los valores de config.js que pisa (solo los que tienen valor).
export function deNegocio(n) {
  if (!n) return {};
  const x = n.extra || {};
  const c = {};
  if (n.whatsapp) c.whatsapp = { intl: n.whatsapp, display: n.telefono || telefonoUY(n.whatsapp)?.telefono || n.whatsapp };
  if (n.direccion) c.direccion = n.direccion;
  if (x.barrio) c.barrio = x.barrio;
  if (n.zonas) c.zonas = n.zonas;
  if (horariosValidos(x.horarios) && x.horarios.length) c.horarios = x.horarios;
  else if (n.horario) c.horarioTexto = n.horario; // cargado desde otro lado, sin el detalle por día
  if (telConfig(x.telefono_fijo)) c.telefonoFijo = telConfig(x.telefono_fijo);
  const otros = (Array.isArray(x.otros_celulares) ? x.otros_celulares : []).map(telConfig).filter(Boolean);
  if (otros.length) c.otrosCelulares = otros;
  const usuario = (u) => String(u).trim().replace(/^@/, '');
  const redes = {};
  if (n.instagram) redes.instagram = { url: `https://www.instagram.com/${usuario(n.instagram)}/`, label: `@${usuario(n.instagram)}` };
  if (n.tiktok) redes.tiktok = { url: `https://www.tiktok.com/@${usuario(n.tiktok)}`, label: `@${usuario(n.tiktok)}` };
  if (n.facebook) redes.facebook = { url: /^https?:\/\//.test(n.facebook) ? n.facebook : `https://www.facebook.com/${usuario(n.facebook)}` };
  if (Object.keys(redes).length) c.redes = redes;
  return c;
}

// Pisa la config con los datos del negocio. Las redes se mezclan de a una (el label de Facebook queda el de config.js).
export function aplicarNegocio(config, n) {
  const { redes = {}, ...resto } = deNegocio(n);
  Object.assign(config, resto);
  for (const [k, r] of Object.entries(redes)) config.redes[k] = { ...config.redes[k], ...r };
  return config;
}
