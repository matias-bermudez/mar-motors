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
    km: r.km ?? 0,
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
    'color', 'puertas', 'descripcion', 'fotos', 'estado', 'publicado'];
  for (const k of copiar) if (a[k] !== undefined) f[k] = a[k];
  if (a.caja !== undefined) f.transmision = a.caja;
  // Una carrocería que esta web no conoce (cargada desde otro lado) no cambia el `tipo` que ya tenía.
  if (a.carroceria in TIPO) f.tipo = TIPO[a.carroceria];
  return f;
}
