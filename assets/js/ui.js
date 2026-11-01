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
export const COMBUSTIBLES = ['Nafta', 'Diésel', 'Híbrido', 'Eléctrico', 'GNC'];
export const CAJAS = ['Manual', 'Automática'];

const num = (n) => Number(n).toLocaleString('es-UY');
export const nombre = (a) => `${a.marca} ${a.modelo}`;
export const categoria = (a) => CARROCERIAS[a.carroceria]?.cat || 'Autos';
export const fmtKm = (km) => `${num(km || 0)} km`;
export const fmtPrecio = (a) => (a.precio ? `${a.moneda === 'UYU' ? '$' : 'U$S'} ${num(a.precio)}` : 'Consultar');
export const detalle = (a) => [a.combustible, a.caja, a.color].filter(Boolean).join(' · ');

export function etiqueta(a) {
  if (a.estado === 'vendido') return { text: 'Vendido', cls: 'vendido' };
  if (a.estado === 'reservado') return { text: 'Reservado', cls: 'reservado' };
  return { text: CARROCERIAS[a.carroceria]?.label || 'Auto', cls: '' };
}

// Disponibles primero, después reservados y al final vendidos (cada grupo, el más nuevo primero).
const PESO = { disponible: 0, reservado: 1, vendido: 2 };
export const ordenar = (autos) => [...autos].sort((x, y) => (PESO[x.estado] ?? 0) - (PESO[y.estado] ?? 0));

// ── Links ────────────────────────────────────────────────────────
const RAIZ = new URL('../../', import.meta.url);
export const urlAuto = (a) => new URL(`auto.html?id=${encodeURIComponent(a.id)}`, RAIZ).href;
export const urlPermuta = (a) => new URL(`index.html?auto=${encodeURIComponent(a.id)}#permuta`, RAIZ).href;
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

// ── Tarjeta del patio ────────────────────────────────────────────
const ICON_WA = '<svg class="ico" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.4-4A8 8 0 1 1 8.3 19z"></path></svg>';
export const NO_PHOTO = '<span class="no-photo">Foto próximamente</span>';

export function carCard(a) {
  const tag = etiqueta(a);
  const href = esc(urlAuto(a));
  const foto = a.fotos?.[0];
  const vendido = a.estado === 'vendido';
  return `
    <article class="car${vendido ? ' is-vendido' : ''}">
      <a class="car-photo${foto ? ' has-img' : ''}" href="${href}" tabindex="-1" aria-hidden="true">
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" decoding="async">` : NO_PHOTO}
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

// ── Datos del local en el HTML ───────────────────────────────────
// [data-wa="clave"] → link de WhatsApp con el mensaje MENSAJES[clave]
// [data-wa-num] → número que se muestra; [data-tel] → teléfono fijo; [data-otros] → otros celulares
export function fillContact(root = document) {
  $$('[data-wa]', root).forEach((el) => {
    el.href = waUrl(MENSAJES[el.dataset.wa] || MENSAJES.general);
    el.target = '_blank';
    el.rel = 'noopener';
  });
  $$('[data-wa-num]', root).forEach((el) => { el.textContent = CONFIG.whatsapp.display; });
  $$('[data-tel]', root).forEach((el) => {
    el.href = telUrl(CONFIG.telefonoFijo);
    const n = $('[data-tel-num]', el) || el;
    n.textContent = el.dataset.tel ? `${el.dataset.tel} ${CONFIG.telefonoFijo.display}` : CONFIG.telefonoFijo.display;
  });
  $$('[data-otros]', root).forEach((el) => {
    el.innerHTML = CONFIG.otrosCelulares.map((t) => `<a href="${telUrl(t)}">${esc(t.display)}</a>`).join('');
    el.closest('.contact-row').hidden = !CONFIG.otrosCelulares.length;
  });
  $$('[data-red]', root).forEach((el) => {
    const red = CONFIG.redes[el.dataset.red];
    if (!red?.url) { el.hidden = true; return; }
    el.href = red.url;
    const l = $('[data-red-label]', el);
    if (l) l.textContent = red.label;
  });
  $$('[data-direccion]', root).forEach((el) => { if (CONFIG.direccion) el.textContent = CONFIG.direccion; });
  $$('[data-barrio]', root).forEach((el) => { if (CONFIG.direccion) el.textContent = [CONFIG.barrio, 'Montevideo'].filter(Boolean).join(', '); });
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

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
