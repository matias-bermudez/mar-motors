// Arma la web publicada en _site/ (lo corre GitHub Actions, ver .github/workflows/deploy.yml).
//
// Además de copiar los archivos, genera lo que Google y WhatsApp necesitan ver sin ejecutar JavaScript:
// - una página por auto (autos/12-chevrolet-onix-lt-1-4-2019/) con título, descripción, foto y datos estructurados
// - los autos ya escritos en el inicio, canonical, robots y datos estructurados de la automotora
// - sitemap.xml y robots.txt
//
// Uso: node scripts/build.mjs   (sin dependencias, Node 20+)

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../assets/js/config.js';
import { DEMO_AUTOS } from '../assets/js/demo.js';
import {
  LINKS, esc, nombre, ordenar, carCard, fichaHTML, seoAuto, rutaAuto, urlAuto, CARROCERIAS, fmtKm,
} from '../assets/js/ui.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = `${ROOT}_site/`;
const SITIO = new URL(CONFIG.sitioUrl);
const abs = (ruta) => new URL(ruta, SITIO).href;

// En la web publicada los links a autos son las páginas estáticas, con la dirección pública.
LINKS.raiz = SITIO;
LINKS.estatico = true;

// ── Datos ────────────────────────────────────────────────────────
async function traerAutos() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    console.log('Supabase sin configurar: se publican los autos de ejemplo.');
    return DEMO_AUTOS;
  }
  const url = `${CONFIG.supabaseUrl}/rest/v1/autos?select=*&publicado=eq.true&order=created_at.desc`;
  const res = await fetch(url, { headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}` } });
  // Si Supabase falla no publicamos una web vacía: el deploy anterior queda online.
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── <head> ───────────────────────────────────────────────────────
const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
const robots = (indexable) => (CONFIG.indexar && indexable ? ROBOTS_INDEX : 'noindex, nofollow');
const jsonld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`Falta <meta ${attr}="${key}"> en la plantilla`);
  return html.replace(re, `$1${esc(value)}$2`);
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
  html = html
    .replace('<html lang="es-UY">', '<html lang="es-UY" data-estatico>')
    .replace(/<!-- SEO:[^>]*-->/, tags);
  if (base) html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <base href="${esc(base)}">`);
  if (title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
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
  areaServed: { '@type': 'City', name: 'Montevideo' },
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
  vendido: 'https://schema.org/SoldOut',
};

function datosAuto(a, url, descripcion) {
  const auto = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${nombre(a)} ${a.anio}`,
    url,
    description: a.descripcion || descripcion,
    image: a.fotos?.length ? a.fotos : [abs('assets/img/og.jpg')],
    brand: { '@type': 'Brand', name: a.marca },
    model: a.modelo,
    vehicleModelDate: String(a.anio),
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: a.km, unitCode: 'KMT' },
    fuelType: a.combustible,
    vehicleTransmission: a.caja,
    bodyType: CARROCERIAS[a.carroceria]?.label,
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
      seller: { '@type': 'AutoDealer', name: 'Mar Motors', url: SITIO.href, telephone: tel(CONFIG.telefonoFijo) },
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
const escribir = async (f, html) => {
  await mkdir(`${OUT}${f}`.replace(/[^/]+$/, ''), { recursive: true });
  await writeFile(`${OUT}${f}`, html);
};

function inicio(html, autos) {
  const lista = ordenar(autos);
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
  return html.replace(vacio, `<div class="cars" data-autos aria-live="polite">${lista.slice(0, 9).map(carCard).join('')}</div>`);
}

function paginaAuto(plantilla, a) {
  const url = urlAuto(a);
  const { title, description } = seoAuto(a);
  let html = seo(plantilla, {
    canonical: url,
    // Los vendidos siguen abriendo (por si alguien tiene el link) pero no van a Google.
    indexable: a.estado !== 'vendido',
    base: SITIO.pathname,
    title,
    description,
    ogTitle: `${nombre(a)} ${a.anio} · ${a.precio ? `${a.moneda === 'UYU' ? '$' : 'U$S'} ${Number(a.precio).toLocaleString('es-UY')}` : 'Consultar precio'}`,
    ogDescription: `${fmtKm(a.km)} · ${[a.combustible, a.caja].filter(Boolean).join(' · ')}. Mar Motors, Montevideo.`,
    ogImage: a.fotos?.[0],
    ogType: 'product',
    datos: datosAuto(a, url, description),
  });
  html = html.replace('<body>', `<body data-auto-id="${esc(a.id)}">`);
  const vacio = /<div class="detail-grid" aria-busy="true">[\s\S]*?<div class="info"><\/div>\s*<\/div>/;
  if (!vacio.test(html)) throw new Error('No encontré la ficha vacía en auto.html');
  return html.replace(vacio, () => fichaHTML(a));
}

function sitemap(autos) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = (a) => (a.updated_at || a.created_at || hoy).slice(0, 10);
  const urls = [
    { loc: SITIO.href, lastmod: autos.map(fecha).sort().at(-1) || hoy },
    ...autos.filter((a) => a.estado !== 'vendido').map((a) => ({ loc: urlAuto(a), lastmod: fecha(a) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

// ── Armado ───────────────────────────────────────────────────────
const autos = await traerAutos();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of ['assets', 'admin', '.nojekyll']) await cp(`${ROOT}${f}`, `${OUT}${f}`, { recursive: true });
// Con dominio propio en sitioUrl, GitHub Pages necesita el archivo CNAME.
if (!SITIO.hostname.endsWith('.github.io')) await writeFile(`${OUT}CNAME`, `${SITIO.hostname}\n`);

await escribir('index.html', inicio(await leer('index.html'), autos));

const plantilla = await leer('auto.html');
for (const a of autos) await escribir(`${rutaAuto(a)}index.html`, paginaAuto(plantilla, a));
// auto.html?id=… queda como respaldo (autos recién cargados, vista previa de ocultos) y no va a Google.
await escribir('auto.html', seo(plantilla, { indexable: false }));

await escribir('404.html', seo(await leer('404.html'), { indexable: false, base: SITIO.pathname }));
await escribir('admin/index.html', (await leer('admin/index.html')).replace('<html lang="es-UY">', '<html lang="es-UY" data-estatico>'));

await escribir('sitemap.xml', sitemap(autos));
await escribir('robots.txt', `User-agent: *\nAllow: /\n${CONFIG.indexar ? `\nSitemap: ${abs('sitemap.xml')}\n` : ''}`);

console.log(`Listo: ${autos.length} autos → ${OUT} (${CONFIG.indexar ? 'indexable' : 'modo prueba: noindex'})`);
