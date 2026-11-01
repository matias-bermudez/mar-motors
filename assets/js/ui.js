import { CONFIG } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Datos del auto ───────────────────────────────────────────────
export const CARROCERIAS = {
  sedan: { label: 'Sedán', cat: 'Autos' },
  hatch: { label: 'Hatchback', cat: 'Autos' },
  suv: { label: 'SUV', cat: 'Camionetas y SUV' },
  pickup: { label: 'Pick-up', cat: 'Camionetas y SUV' },
  utilitario: { label: 'Utilitario', cat: 'Utilitarios' },
};
export const CATEGORIAS = ['Todos', 'Autos', 'Camionetas y SUV', 'Utilitarios'];
// Si un auto de la base trae una carrocería que esta web no conoce, se ubica por su `tipo`.
const POR_TIPO = { auto: { label: 'Auto', cat: 'Autos' }, camioneta: { label: 'Camioneta', cat: 'Camionetas y SUV' }, utilitario: { label: 'Utilitario', cat: 'Utilitarios' } };
const clase = (a) => CARROCERIAS[a.carroceria] || POR_TIPO[a.tipo];
export const nombreCarroceria = (a) => clase(a)?.label;
export const COMBUSTIBLES = ['Nafta', 'Diésel', 'Híbrido', 'Eléctrico', 'GNC'];
export const CAJAS = ['Manual', 'Automática'];

const num = (n) => Number(n).toLocaleString('es-UY');
export const nombre = (a) => `${a.marca} ${a.modelo}`;
export const categoria = (a) => clase(a)?.cat || 'Autos';
export const fmtKm = (km) => `${num(km || 0)} km`;
export const fmtPrecio = (a) => (a.precio ? `${a.moneda === 'UYU' ? '$' : 'U$S'} ${num(a.precio)}` : 'Consultar');
export const detalle = (a) => [a.combustible, a.caja, a.color].filter(Boolean).join(' · ');

export function etiqueta(a) {
  if (a.estado === 'vendido') return { text: 'Vendido', cls: 'vendido' };
  if (a.estado === 'reservado') return { text: 'Reservado', cls: 'reservado' };
  return { text: clase(a)?.label || 'Auto', cls: '' };
}

// Disponibles primero, después reservados y al final vendidos (cada grupo, el más nuevo primero).
const PESO = { disponible: 0, reservado: 1, vendido: 2 };
export const ordenar = (autos) => [...autos].sort((x, y) => (PESO[x.estado] ?? 0) - (PESO[y.estado] ?? 0));

// ── Links ────────────────────────────────────────────────────────
// Cada auto tiene su página, que arma scripts/build.mjs: autos/<slug>/ (slug = marca-modelo-año, ver modelo.js).
// raiz: en el navegador, la carpeta de la web (sale de dónde está este archivo); el build usa la URL pública.
export const LINKS = { raiz: new URL('../../', import.meta.url) };
export const rutaAuto = (a) => `autos/${a.slug}/`;
export const urlAuto = (a) => new URL(rutaAuto(a), LINKS.raiz).href;
export const urlPermuta = (a) => new URL(`./?auto=${encodeURIComponent(a.slug)}#permuta`, LINKS.raiz).href;
// Foto chica (640 px) para tarjetas y miniaturas; si no hay, la grande.
export const fotoChica = (a, i = 0) => a.miniaturas?.[i] || a.fotos?.[i];
// api.whatsapp.com y no wa.me: la redirección de wa.me rompe los emojis (🚗 → �).
export const waUrl = (text) => `https://api.whatsapp.com/send?phone=${CONFIG.whatsapp.intl}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
export const telUrl = (t) => `tel:+${t.intl}`;

// Abre WhatsApp en otra pestaña (en el celular abre la app). Si el navegador lo bloquea, navega directo.
export function abrirWhatsApp(text) {
  const url = waUrl(text);
  const w = window.open(url, '_blank'); // sin 'noopener': con esa opción window.open siempre devuelve null
  if (w) w.opener = null;
  else location.href = url;
}

// ── Mensajes de WhatsApp ─────────────────────────────────────────
const HOLA = '¡Hola Mar Motors! ';

function fichaTexto(a) {
  return [
    `*${nombre(a)}*`,
    `Año ${a.anio} · ${fmtKm(a.km)} · ${[a.combustible, a.caja].filter(Boolean).join(' · ')}`,
    `Precio: ${fmtPrecio(a)}`,
    `Ref. #${a.id}`,
    '',
    urlAuto(a),
  ].join('\n');
}

export function msgConsulta(a) {
  if (a.estado === 'vendido') {
    return `${HOLA}Vi en la web este auto que ya se vendió:\n\n${fichaTexto(a)}\n\n¿Tienen algo parecido o me avisan si entra uno?`;
  }
  const pregunta = a.estado === 'reservado' ? '¿Sigue reservado o se puede ver?' : '¿Sigue disponible?';
  return `${HOLA}Me interesa este auto que vi en la web:\n\n${fichaTexto(a)}\n\n${pregunta}`;
}

export const msgFinanciar = (a) => `${HOLA}Quiero financiar este auto que vi en la web:\n\n${fichaTexto(a)}\n\n¿Qué opciones de financiación tengo?`;

export const MENSAJES = {
  general: `${HOLA}Les escribo desde la web.`,
  banco: `${HOLA}Quiero consultar por la financiación por banco (hasta 60 cuotas en pesos).`,
  casa: `${HOLA}Quiero consultar por la financiación de la casa (hasta el 40% del vehículo, solo con cédula).`,
  renovacion: `${HOLA}Ya cumplí un año con mi préstamo en MiAuto y quiero renovar mi auto.`,
  busco: `${HOLA}Estoy buscando un auto y no lo vi en la web. Busco: `,
};

export const ICON = {
  wa: '<svg class="ico" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.4-4A8 8 0 1 1 8.3 19z"/><path d="M9.5 9.5c.3 2 1.8 3.7 4 4.3l1-1.2 1.8.8"/></svg>',
  share: '<svg class="ico" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  prev: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};

// ── Ficha del auto ───────────────────────────────────────────────
// HTML de la ficha. Lo usa el navegador (ficha.js) y scripts/build.mjs para que Google lo vea sin JavaScript.
export function fichaHTML(a) {
  const tag = etiqueta(a);
  const fotos = a.fotos || [];
  const vendido = a.estado === 'vendido';
  const specs = [
    ['Año', a.anio],
    ['Kilómetros', fmtKm(a.km)],
    ['Combustible', a.combustible],
    ['Caja', a.caja],
    ['Motor', a.motor],
    ['Carrocería', nombreCarroceria(a)],
    ['Color', a.color],
    ['Puertas', a.puertas],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return `
    <div class="detail-grid">
      <div class="gallery">
        <div class="gallery-main" data-main>
          ${fotos.length ? `<img src="${esc(fotos[0])}" alt="${esc(`${nombre(a)} ${a.anio}, foto 1 de ${fotos.length}`)}" draggable="false">` : NO_PHOTO}
          ${fotos.length > 1 ? `
            <button class="gallery-nav prev" type="button" data-prev aria-label="Foto anterior">${ICON.prev}</button>
            <button class="gallery-nav next" type="button" data-next aria-label="Foto siguiente">${ICON.next}</button>
            <span class="gallery-count" data-count></span>` : ''}
        </div>
        ${fotos.length > 1 ? `<div class="thumbs" role="group" aria-label="Fotos">${fotos.map((f, i) => `
          <button type="button" data-thumb="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(fotoChica(a, i))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>

      <div class="info">
        <span class="tag tag-inline ${tag.cls}">${esc(tag.text)}</span>
        <h1>${esc(nombre(a))}<small>${esc(a.anio)} · ${esc(fmtKm(a.km))}</small></h1>
        <div class="big-price">${esc(fmtPrecio(a))}<small>${vendido ? 'Vendido' : 'Aceptamos tu usado y financiamos'}</small></div>
        ${vendido ? '<p class="sold-banner">Este auto ya se vendió. Escribinos y te avisamos si entra uno parecido.</p>' : ''}
        ${a.estado === 'reservado' ? '<p class="sold-banner">Este auto está reservado. Consultanos: a veces se libera.</p>' : ''}
        <dl class="specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="btn-col">
          <a class="btn btn-red btn-lg btn-block" href="${esc(waUrl(msgConsulta(a)))}" target="_blank" rel="noopener" data-consultar>
            ${ICON.wa}${vendido ? 'Pedir uno similar' : 'Consultar por WhatsApp'}
          </a>
          ${vendido ? '' : `
          <div class="row2">
            <a class="chip-btn" href="${esc(waUrl(msgFinanciar(a)))}" target="_blank" rel="noopener">Financiarlo</a>
            <a class="chip-btn" href="${esc(urlPermuta(a))}">Permutar mi auto</a>
          </div>`}
          <button class="chip-btn" type="button" data-compartir style="justify-content: center">${ICON.share}Compartir</button>
        </div>
        <span class="ref">Ref. #${esc(a.id)} · El mensaje de WhatsApp ya lleva el link de este auto.</span>
      </div>
    </div>
    ${a.descripcion ? `<div class="desc"><h2>Sobre este auto</h2><p>${esc(a.descripcion)}</p></div>` : ''}`;
}

// Título y descripción para Google y las vistas previas.
export function seoAuto(a) {
  const title = `${nombre(a)} ${a.anio}${a.estado === 'vendido' ? ' (vendido)' : ''} · ${fmtKm(a.km)} | Mar Motors`;
  const precio = a.precio ? `${fmtPrecio(a)}. ` : '';
  const description = `${nombre(a)} ${a.anio} usado en venta en Montevideo: ${[fmtKm(a.km), ...[a.combustible, a.caja, a.color].filter(Boolean).map((x) => x.toLowerCase())].join(', ')}. ${precio}Aceptamos tu usado y financiamos. Consultalo por WhatsApp.`;
  return { title, description };
}

// ── Tarjeta del patio ────────────────────────────────────────────
const ICON_WA = '<svg class="ico" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.4-4A8 8 0 1 1 8.3 19z"></path></svg>';
export const NO_PHOTO = '<span class="no-photo">Foto próximamente</span>';

export function carCard(a) {
  const tag = etiqueta(a);
  const href = esc(urlAuto(a));
  const foto = fotoChica(a);
  const vendido = a.estado === 'vendido';
  return `
    <article class="car${vendido ? ' is-vendido' : ''}">
      <a class="car-photo${foto ? ' has-img' : ''}" href="${href}" tabindex="-1" aria-hidden="true">
        ${foto ? `<img src="${esc(foto)}" alt="${esc(`${nombre(a)} ${a.anio}`)}" loading="lazy" decoding="async">` : NO_PHOTO}
        <span class="tag ${tag.cls}">${esc(tag.text)}</span>
        <span class="marker"><span class="price">${esc(fmtPrecio(a))}</span><span class="meta">${esc(a.anio)} · ${esc(fmtKm(a.km))}</span></span>
      </a>
      <div class="car-body">
        <h3><a href="${href}">${esc(nombre(a))}</a></h3>
        <p>${esc(detalle(a))}</p>
        <div class="car-actions">
          <a class="chip-btn solid" href="${esc(waUrl(msgConsulta(a)))}" target="_blank" rel="noopener">${ICON_WA}${vendido ? 'Pedir similar' : 'Consultar'}</a>
          ${vendido ? `<a class="chip-btn" href="${href}">Ver ficha</a>` : `<a class="chip-btn" href="${esc(waUrl(msgFinanciar(a)))}" target="_blank" rel="noopener">Financiarlo</a>`}
        </div>
      </div>
    </article>`;
}

export const skeletonCards = (n) => Array.from({ length: n }, () => `
  <article class="car skeleton" aria-hidden="true">
    <div class="car-photo"></div>
    <div class="car-body"><span></span><span></span></div>
  </article>`).join('');

// ── Horarios ─────────────────────────────────────────────────────
// Salen de CONFIG.horarios (config.js o «Datos del negocio» del panel). n = getDay() (0 = domingo).
export const DIAS = [
  ['Monday', 'Lun', 'Lunes', 1], ['Tuesday', 'Mar', 'Martes', 2], ['Wednesday', 'Mié', 'Miércoles', 3],
  ['Thursday', 'Jue', 'Jueves', 4], ['Friday', 'Vie', 'Viernes', 5], ['Saturday', 'Sáb', 'Sábado', 6], ['Sunday', 'Dom', 'Domingo', 0],
].map(([schema, corto, largo, n]) => ({ schema, corto, largo, n }));
const hora = (h) => h.replace(/^0(?=\d)/, '');
const rango = (h) => `${hora(h.abre)} – ${hora(h.cierra)}`;

// "Lun a Vie 9:30 – 19:00 · Sáb 10:00 – 14:00 · Dom 9:30 – 13:30" (la franja de arriba y `horario` en la base).
export const horarioResumen = () => CONFIG.horarioTexto || resumirHorarios(CONFIG.horarios);
export function resumirHorarios(horarios) {
  return horarios.map((h) => {
    const i = DIAS.flatMap((d, k) => (h.dias.includes(d.schema) ? [k] : []));
    const seguidos = i.every((x, k) => !k || x === i[k - 1] + 1);
    const dias = i.length > 2 && seguidos
      ? `${DIAS[i[0]].corto} a ${DIAS[i.at(-1)].corto}`
      : i.map((x) => DIAS[x].corto).join(i.length === 2 ? ' y ' : ', ');
    return `${dias} ${rango(h)}`;
  }).join(' · ');
}

// Grilla de «Vení a verlos»: un casillero por día. El domingo abierto va destacado.
export const horariosHTML = () => DIAS.map((d) => {
  const h = CONFIG.horarios.find((x) => x.dias.includes(d.schema));
  const domingo = d.n === 0 && h;
  return `<div data-dia="${d.n}"${domingo ? ' class="sun"' : ''}><span class="day">${d.largo}</span><span class="time">${h ? rango(h) : 'Cerrado'}</span>${domingo ? '<span class="note">¡también abrimos!</span>' : ''}</div>`;
}).join('');

// ── Datos del local en el HTML ───────────────────────────────────
// scripts/build.mjs ya los deja escritos en el HTML (datosDelLocal); esto los completa en lo que se arma
// en el navegador (patio, auto no encontrado) y agrega lo que depende del día (hoy, año) y el mapa.
// [data-wa="clave"] → link de WhatsApp con el mensaje MENSAJES[clave]
// [data-wa-num] → número de WhatsApp que se muestra; [data-tel] → link al fijo; [data-tel-num] → el fijo
// [data-otros] → otros celulares; [data-red="instagram"] → red social; [data-horario], [data-horarios] → horarios
export function fillContact(root = document) {
  $$('[data-wa]', root).forEach((el) => {
    el.href = waUrl(MENSAJES[el.dataset.wa] || MENSAJES.general);
    el.target = '_blank';
    el.rel = 'noopener';
  });
  $$('[data-wa-num]', root).forEach((el) => { el.textContent = CONFIG.whatsapp.display; });
  $$('[data-tel]', root).forEach((el) => { el.href = telUrl(CONFIG.telefonoFijo); });
  $$('[data-tel-num]', root).forEach((el) => { el.textContent = CONFIG.telefonoFijo.display; });
  $$('[data-otros]', root).forEach((el) => {
    el.innerHTML = CONFIG.otrosCelulares.map((t) => `<a href="${telUrl(t)}">${esc(t.display)}</a>`).join('');
    el.closest('.contact-row').hidden = !CONFIG.otrosCelulares.length;
  });
  $$('[data-red]', root).forEach((el) => {
    const red = CONFIG.redes[el.dataset.red];
    el.hidden = !red?.url;
    if (!red?.url) return;
    el.href = red.url;
    const l = $('[data-red-label]', el);
    if (l) l.textContent = red.label;
  });
  $$('[data-horario]', root).forEach((el) => { el.textContent = horarioResumen(); });
  $$('[data-horarios]', root).forEach((el) => { el.innerHTML = horariosHTML(); });
  $$('[data-direccion]', root).forEach((el) => { if (CONFIG.direccion) el.textContent = CONFIG.direccion; });
  $$('[data-barrio]', root).forEach((el) => { if (CONFIG.direccion) el.textContent = barrio(); });
  const map = $('[data-mapa]', root);
  if (map && CONFIG.direccion) {
    const q = encodeURIComponent([CONFIG.direccion, CONFIG.barrio, 'Montevideo, Uruguay'].filter(Boolean).join(', '));
    map.innerHTML = `<iframe title="Mapa: cómo llegar a Mar Motors" src="https://www.google.com/maps?q=${q}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    map.removeAttribute('role');
  }
  // Marca el día de hoy en la grilla de horarios (0 = domingo).
  const hoy = $(`.hours [data-dia="${new Date().getDay()}"]`, root);
  if (hoy) hoy.classList.add('today');
  const y = $('[data-anio]', root);
  if (y) y.textContent = new Date().getFullYear();
}

export const barrio = () => [CONFIG.barrio, 'Montevideo'].filter(Boolean).join(', ');

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
