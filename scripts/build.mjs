// Arma la web publicada en _site/ (lo corre GitHub Actions, ver .github/workflows/deploy.yml).
//
// Los autos salen de la base compartida de la Plataforma Automotoras (Supabase), solo los de Mar Motors
// (`concesionaria` en config.js). La web pública NO consulta Supabase: acá se leen los autos, se bajan
// las fotos al sitio (con caché en .cache/fotos/) y se escribe todo estático:
// - una página por auto (autos/<slug>/) con título, descripción, foto y datos estructurados
// - el inicio con los autos ya escritos, canonical, robots y datos estructurados de la automotora
// - assets/js/autos.js: los mismos autos para el navegador (filtros, galería, permuta)
// - sitemap.xml, robots.txt y estado.json (hash de los autos y del negocio: el cron no republica si no cambió nada)
// Los datos del negocio (WhatsApp, teléfonos, dirección, horarios, zonas, redes) salen de config.js, pisados por
// la fila de la tabla `negocios` que edita el dueño desde el panel: quedan escritos en el HTML y en el
// assets/js/config.js que usa el navegador (formularios y mensajes de WhatsApp).
//
// Uso (sin dependencias, Node 20+):
//   node scripts/build.mjs                   → para publicar
//   node scripts/build.mjs --local           → para probar: python3 -m http.server 8803 -d _site
//   SOLO_SI_CAMBIO=1 node scripts/build.mjs  → no hace nada si los autos no cambiaron desde la última publicación

import { appendFileSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../assets/js/config.js';
import { deFila, rutaChica, aplicarNegocio } from '../assets/js/modelo.js';
import {
  LINKS, MENSAJES, esc, nombre, ordenar, carCard, fichaHTML, seoAuto, rutaAuto, urlAuto, nombreCarroceria, fmtKm, fmtPrecio,
  waUrl, telUrl, horarioResumen, horariosHTML, barrio,
} from '../assets/js/ui.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = `${ROOT}_site/`;
const CACHE_FOTOS = `${ROOT}.cache/fotos/`;
const SITIO = new URL(CONFIG.sitioUrl);
const abs = (ruta) => new URL(ruta, SITIO).href;
// Carpeta de la web en el servidor (para <base> del 404 y de las fichas). --local: servida en la raíz.
const BASE = process.argv.includes('--local') ? '/' : SITIO.pathname;

// En el HTML armado los links a autos van con la dirección pública.
LINKS.raiz = SITIO;

// ── Datos ────────────────────────────────────────────────────────
function consultar(tabla, filtros) {
  const url = `${CONFIG.supabaseUrl}/rest/v1/${tabla}?select=*&concesionaria=eq.${encodeURIComponent(CONFIG.concesionaria)}${filtros}`;
  // Las claves sb_publishable_ van solo en apikey; las viejas (anon, JWT) también en Authorization.
  const headers = { apikey: CONFIG.supabaseKey };
  if (!CONFIG.supabaseKey.startsWith('sb_')) headers.Authorization = `Bearer ${CONFIG.supabaseKey}`;
  return fetch(url, { headers });
}

async function leerSupabase() {
  const res = await consultar('autos', '&order=created_at.desc');
  // Si Supabase falla no publicamos una web vacía: el deploy anterior queda online.
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

// Datos del negocio que el dueño edita desde el panel. Si la tabla todavía no existe, no hay fila
// o falla la consulta, se publica con config.js tal cual.
async function leerNegocio() {
  try {
    const res = await consultar('negocios', '');
    if (res.ok) return (await res.json())[0] || null;
    console.warn(`Aviso: no se pudieron leer los datos del negocio (${res.status}), se usa config.js.`);
  } catch (err) {
    console.warn(`Aviso: no se pudieron leer los datos del negocio (${err.message}), se usa config.js.`);
  }
  return null;
}

// Fila → auto de la web. Si a un auto le falta algo, se saltea con un aviso (no rompe la publicación).
// La base ya solo devuelve publicados y no vendidos a la clave pública; el filtro es por las dudas.
function autoDe(r) {
  if (!r.publicado || r.estado === 'vendido') return null;
  const falta = ['slug', 'marca', 'modelo', 'anio'].filter((k) => r[k] === null || r[k] === undefined || r[k] === '');
  if (falta.length || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) {
    console.warn(`Aviso: se saltea el auto ${r.id} (${r.marca} ${r.modelo}), falta o está mal: ${falta.join(', ') || 'slug'}`);
    return null;
  }
  return deFila(r);
}

// Las fotos no cambian nunca (nombre = uuid): se guardan en .cache/fotos/ y solo se bajan las nuevas.
// GitHub Actions conserva esa carpeta entre publicaciones (actions/cache), así no se gasta cupo de Supabase.
// Quedan en img/autos/<slug>/: la grande (1600 px) para la galería y la _m (640 px) para tarjetas.
async function bajarFotos(autos) {
  await mkdir(CACHE_FOTOS, { recursive: true }); // aunque no haya fotos, para que Actions pueda guardar la caché
  const url = (p) => `${CONFIG.supabaseUrl}/storage/v1/object/public/fotos/${p.split('/').map(encodeURIComponent).join('/')}`;
  const bajar = async (p, destino) => {
    const cache = CACHE_FOTOS + p;
    if (!(await existe(cache))) {
      const res = await fetch(url(p));
      if (!res.ok) return false;
      await mkdir(cache.replace(/[^/]+$/, ''), { recursive: true });
      await writeFile(cache, Buffer.from(await res.arrayBuffer()));
    }
    await mkdir(`${OUT}${destino}`.replace(/[^/]+$/, ''), { recursive: true });
    await copyFile(cache, `${OUT}${destino}`);
    return true;
  };
  const tareas = autos.flatMap((a) => a.fotos.map((p) => {
    const f = { p, ok: false };
    (a._fotos ||= []).push(f);
    return async () => {
      if (!/^[\w-]+\/[\w-]+\.jpg$/.test(p)) return console.warn(`Aviso: ruta de foto rara, se saltea: ${p} (${a.slug})`);
      const archivo = `img/autos/${a.slug}/${p.split('/').pop()}`;
      f.ok = await bajar(p, archivo);
      if (!f.ok) return console.warn(`Aviso: no se pudo bajar la foto ${p} de ${a.slug}`);
      f.grande = archivo;
      f.chica = (await bajar(rutaChica(p), rutaChica(archivo))) ? rutaChica(archivo) : archivo;
    };
  }));
  // De a 6 descargas a la vez.
  const cola = tareas.slice();
  await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) await cola.shift()(); }));
  for (const a of autos) {
    const ok = (a._fotos || []).filter((f) => f.ok);
    a.fotos = ok.map((f) => f.grande);
    a.miniaturas = ok.map((f) => f.chica);
    delete a._fotos;
  }
}

const existe = (f) => stat(f).then(() => true, () => false);

// Para GitHub Actions: `cambio` decide si se publica.
function salida(clave, valor) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

// ── <head> ───────────────────────────────────────────────────────
const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
const robots = (indexable) => (CONFIG.indexar && indexable ? ROBOTS_INDEX : 'noindex, nofollow');
const jsonld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`Falta <meta ${attr}="${key}"> en la plantilla`);
  return html.replace(re, (m, antes, despues) => antes + esc(value) + despues);
}

// Completa el <head> de una página. `canonical` vacío = página que no va a Google.
function seo(html, { canonical, indexable, title, description, ogTitle, ogDescription, ogImage, ogType, datos = [], base }) {
  const tags = [
    `<meta name="robots" content="${robots(indexable)}">`,
    canonical && `<link rel="canonical" href="${esc(canonical)}">`,
    canonical && `<meta property="og:url" content="${esc(canonical)}">`,
    CONFIG.googleVerificacion && `<meta name="google-site-verification" content="${esc(CONFIG.googleVerificacion)}">`,
    ...datos.map(jsonld),
  ].filter(Boolean).join('\n  ');
  html = html.replace(/<!-- SEO:[^>]*-->/, () => tags); // función: un $ en los datos no es un patrón de reemplazo
  if (base) {
    const tag = `<base href="${esc(base)}">`;
    html = /<base href="[^"]*">/.test(html)
      ? html.replace(/<base href="[^"]*">(<!--[^>]*-->)?/, tag)
      : html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  ${tag}`);
  }
  if (title) html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);
  if (description) html = setMeta(html, 'name', 'description', description);
  if (ogTitle) html = setMeta(html, 'property', 'og:title', ogTitle);
  if (ogDescription) html = setMeta(html, 'property', 'og:description', ogDescription);
  if (ogType) html = setMeta(html, 'property', 'og:type', ogType);
  html = setMeta(html, 'property', 'og:image', ogImage || abs('assets/img/og.jpg'));
  if (ogImage) html = html.replace(/\s*<meta property="og:image:(width|height)"[^>]*>/g, '');
  return html;
}

// ── Datos estructurados (schema.org) ─────────────────────────────
const tel = (t) => `+${t.intl}`;

const automotora = () => ({
  '@type': 'AutoDealer',
  '@id': abs('#automotora'),
  name: 'Mar Motors',
  alternateName: 'Automotora Mar Motors',
  description: 'Automotora en Montevideo: venta de autos usados, permuta y financiación.',
  url: SITIO.href,
  logo: abs('assets/img/icon-192.png'),
  image: abs('assets/img/og.jpg'),
  telephone: tel(CONFIG.telefonoFijo),
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    ...(CONFIG.direccion && { streetAddress: CONFIG.direccion }),
    addressLocality: 'Montevideo',
    addressRegion: 'Montevideo',
    addressCountry: 'UY',
  },
  areaServed: CONFIG.zonas.split(',').map((z) => z.trim()).filter(Boolean).map((name) => ({ '@type': 'Place', name })),
  openingHoursSpecification: CONFIG.horarios.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.dias.map((d) => `https://schema.org/${d}`),
    opens: h.abre,
    closes: h.cierra,
  })),
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: tel(CONFIG.whatsapp),
    contactType: 'sales',
    availableLanguage: 'es',
  },
  sameAs: Object.values(CONFIG.redes).map((r) => r.url).filter(Boolean),
});

const DISPONIBILIDAD = {
  disponible: 'https://schema.org/InStock',
  reservado: 'https://schema.org/LimitedAvailability',
};

function datosAuto(a, url, descripcion) {
  const auto = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${nombre(a)} ${a.anio}`,
    url,
    description: a.descripcion || descripcion,
    image: a.fotos.length ? a.fotos.map(abs) : [abs('assets/img/og.jpg')],
    brand: { '@type': 'Brand', name: a.marca },
    model: a.modelo,
    vehicleModelDate: String(a.anio),
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: a.km == null ? undefined : { '@type': 'QuantitativeValue', value: a.km, unitCode: 'KMT' },
    fuelType: a.combustible,
    vehicleTransmission: a.caja,
    bodyType: nombreCarroceria(a),
    ...(a.color && { color: a.color }),
    ...(a.puertas && { numberOfDoors: a.puertas }),
    ...(a.motor && { vehicleEngine: { '@type': 'EngineSpecification', name: a.motor } }),
  };
  if (a.precio) {
    auto.offers = {
      '@type': 'Offer',
      price: a.precio,
      priceCurrency: a.moneda === 'UYU' ? 'UYU' : 'USD',
      availability: DISPONIBILIDAD[a.estado] || DISPONIBILIDAD.disponible,
      itemCondition: 'https://schema.org/UsedCondition',
      url,
      seller: { '@type': 'AutoDealer', '@id': abs('#automotora'), name: 'Mar Motors', url: SITIO.href, telephone: tel(CONFIG.telefonoFijo) },
    };
  }
  const migas = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO.href },
      { '@type': 'ListItem', position: 2, name: 'Autos', item: abs('#autos') },
      { '@type': 'ListItem', position: 3, name: `${nombre(a)} ${a.anio}`, item: url },
    ],
  };
  return [auto, migas];
}

// ── Páginas ──────────────────────────────────────────────────────
const leer = (f) => readFile(`${ROOT}${f}`, 'utf8');
const escribir = async (f, contenido) => {
  await mkdir(`${OUT}${f}`.replace(/[^/]+$/, ''), { recursive: true });
  await writeFile(`${OUT}${f}`, contenido);
};

// ?v=<hash> en css y js: GitHub Pages cachea 10 minutos y sin esto el navegador podría mezclar un HTML
// nuevo con un JS viejo. Un solo hash para todo (cambia si cambia cualquier css/js o los autos).
let VERSION = '';
const versionar = (html) => html.replace(/((?:href|src)="[^"]*assets\/(?:css|js)\/[\w.-]+\.(?:css|js))"/g, `$1?v=${VERSION}"`);

async function versionarAssets() {
  const archivos = [];
  for (const dir of ['assets/css/', 'assets/js/']) {
    for (const f of (await readdir(`${OUT}${dir}`)).sort()) archivos.push(`${OUT}${dir}${f}`);
  }
  const h = createHash('sha1');
  for (const f of archivos) h.update(await readFile(f));
  VERSION = h.digest('hex').slice(0, 10);
  // Los import entre módulos también llevan la versión (si no, cargarían la copia vieja).
  for (const f of archivos.filter((x) => x.endsWith('.js'))) {
    const js = await readFile(f, 'utf8');
    await writeFile(f, js.replace(/((?:\bfrom\s*|\bimport\s*\(\s*)(['"])\.\/[\w.-]+\.js)\2/g, `$1?v=${VERSION}$2`));
  }
}

// ── Datos del local en el HTML ───────────────────────────────────
// Lo mismo que fillContact (ui.js), pero al armar: WhatsApp, teléfonos, horarios, dirección y redes quedan
// escritos en el HTML, así Google y quien abra la página sin JavaScript ven los datos de hoy.
const conHref = (tag, url, nueva) => tag.replace(/\shref="[^"]*"/, ` href="${esc(url)}"${nueva ? ' target="_blank" rel="noopener"' : ''}`);
const rellenar = (html, attr, contenido) => html.replace(
  new RegExp(`(<(\\w+)\\b[^>]*\\s${attr}(?=[\\s>])[^>]*>)[^<]*(</\\2>)`, 'g'), (m, abre, tag, cierra) => abre + contenido + cierra);

function datosDelLocal(html) {
  html = html.replace(/(<a\b[^>]*\sdata-red="(\w+)"[^>]*>)([\s\S]*?<\/a>)/g, (m, tag, red, resto) => {
    const r = CONFIG.redes[red];
    if (!r?.url) return tag.replace(/>$/, ' hidden>') + resto;
    return conHref(tag, r.url) + rellenar(resto, 'data-red-label', esc(r.label));
  });
  html = html.replace(/<a\b[^>]*>/g, (tag) => {
    const wa = tag.match(/\sdata-wa="(\w+)"/);
    if (wa) return conHref(tag, waUrl(MENSAJES[wa[1]] || MENSAJES.general), true);
    if (/\sdata-tel(?=[\s>])/.test(tag)) return conHref(tag, telUrl(CONFIG.telefonoFijo));
    return tag;
  });
  html = rellenar(html, 'data-wa-num', esc(CONFIG.whatsapp.display));
  html = rellenar(html, 'data-tel-num', esc(CONFIG.telefonoFijo.display));
  html = rellenar(html, 'data-horario', esc(horarioResumen()));
  html = rellenar(html, 'data-horarios', horariosHTML());
  html = rellenar(html, 'data-otros', CONFIG.otrosCelulares.map((t) => `<a href="${telUrl(t)}">${esc(t.display)}</a>`).join(''));
  if (!CONFIG.otrosCelulares.length) html = html.replace(/<div class="contact-row" data-otros-fila>/, '<div class="contact-row" data-otros-fila hidden>');
  if (CONFIG.direccion) {
    html = rellenar(html, 'data-direccion', esc(CONFIG.direccion));
    html = rellenar(html, 'data-barrio', esc(barrio()));
  }
  return html;
}

function inicio(html, autos) {
  html = seo(html, {
    canonical: SITIO.href,
    indexable: true,
    datos: [
      { '@context': 'https://schema.org', ...automotora() },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Mar Motors', url: SITIO.href, inLanguage: 'es-UY' },
    ],
  });
  const vacio = '<div class="cars" data-autos aria-live="polite"></div>';
  if (!html.includes(vacio)) throw new Error('No encontré la grilla de autos en index.html');
  return html.replace(vacio, () => `<div class="cars" data-autos aria-live="polite">${autos.slice(0, 9).map(carCard).join('')}</div>`);
}

function paginaAuto(plantilla, a) {
  const url = urlAuto(a);
  const { title, description } = seoAuto(a);
  let html = seo(plantilla, {
    canonical: url,
    indexable: true,
    base: BASE,
    title,
    description,
    ogTitle: `${nombre(a)} ${a.anio} · ${a.precio ? fmtPrecio(a) : 'Consultar precio'}`,
    ogDescription: `${fmtKm(a.km)} · ${[a.combustible, a.caja].filter(Boolean).join(' · ')}. Mar Motors, Montevideo.`,
    ogImage: a.fotos[0] && abs(a.fotos[0]),
    ogType: 'product',
    datos: datosAuto(a, url, description),
  });
  html = html.replace('<body>', `<body data-auto="${esc(a.slug)}">`);
  const vacio = /<div class="detail-grid" aria-busy="true">[\s\S]*?<div class="info"><\/div>\s*<\/div>/;
  if (!vacio.test(html)) throw new Error('No encontré la ficha vacía en auto.html');
  return html.replace(vacio, () => fichaHTML(a));
}

function sitemap(autos) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = (a) => (a.updated_at || a.created_at || hoy).slice(0, 10);
  const urls = [
    { loc: SITIO.href, lastmod: autos.map(fecha).sort().at(-1) || hoy },
    ...autos.map((a) => ({ loc: urlAuto(a), lastmod: fecha(a) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

// ── Armado ───────────────────────────────────────────────────────
const negocio = await leerNegocio();
aplicarNegocio(CONFIG, negocio); // antes de armar cualquier cosa: ui.js usa este mismo CONFIG
const filas = await leerSupabase();
const hash = createHash('sha256').update(JSON.stringify({ autos: filas, negocio })).digest('hex').slice(0, 16);

if (process.env.SOLO_SI_CAMBIO) {
  const anterior = await fetch(`${abs('estado.json')}?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (anterior?.hash === hash) {
    console.log('Los autos y los datos del negocio no cambiaron desde la última publicación: no hay nada para publicar.');
    salida('cambio', 'false');
    process.exit(0);
  }
}

// Disponibles primero, después reservados (cada grupo, el más nuevo primero).
const autos = ordenar(filas.map(autoDe).filter(Boolean));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of ['assets', 'admin', '.nojekyll']) await cp(`${ROOT}${f}`, `${OUT}${f}`, { recursive: true });
// Con dominio propio en sitioUrl, GitHub Pages necesita el archivo CNAME.
if (!SITIO.hostname.endsWith('.github.io')) await writeFile(`${OUT}CNAME`, `${SITIO.hostname}\n`);

await bajarFotos(autos);
// El navegador usa la misma config que el build, con los datos del negocio ya aplicados (sin los valores viejos).
await escribir('assets/js/config.js', `// Generado por scripts/build.mjs: assets/js/config.js${negocio ? ' + datos del negocio de la base (panel → Datos del negocio)' : ''}. No editar.\nexport const CONFIG = ${JSON.stringify(CONFIG, null, 1)};\n`);
// El navegador (filtros, galería, permuta) usa estos mismos datos: no consulta Supabase.
await escribir('assets/js/autos.js', `// Generado por scripts/build.mjs desde la base compartida (${CONFIG.concesionaria}). No editar.\nexport const AUTOS = ${JSON.stringify(autos.map(({ extra, ...a }) => a), null, 1)};\n`);
await versionarAssets();

await escribir('index.html', versionar(datosDelLocal(inicio(await leer('index.html'), autos))));

const plantilla = datosDelLocal(await leer('auto.html'));
for (const a of autos) await escribir(`${rutaAuto(a)}index.html`, versionar(paginaAuto(plantilla, a)));

// 404: GitHub Pages lo sirve en cualquier URL que no existe (ej. un auto vendido). Estático, sin JavaScript.
await escribir('404.html', versionar(seo(await leer('404.html'), { indexable: false, base: BASE })));
await escribir('admin/index.html', versionar(await leer('admin/index.html')));

await escribir('sitemap.xml', sitemap(autos));
await escribir('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${SITIO.pathname}admin/\n${CONFIG.indexar ? `\nSitemap: ${abs('sitemap.xml')}\n` : ''}`);
await escribir('estado.json', `${JSON.stringify({ hash, generado: new Date().toISOString(), autos: autos.length })}\n`);
salida('cambio', 'true');

const conFotos = autos.filter((a) => a.fotos.length).length;
console.log(`Listo: ${autos.length} autos (${conFotos} con fotos) de «${CONFIG.concesionaria}» → ${OUT} (${CONFIG.indexar ? 'indexable' : 'modo prueba: noindex'}${BASE === '/' ? ', --local' : ''})`);
