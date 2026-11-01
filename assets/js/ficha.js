import { getAuto, listAutos } from './db.js';
import {
  $, $$, esc, fillContact, etiqueta, nombre, fmtPrecio, fmtKm, detalle, categoria, carCard, ordenar,
  waUrl, msgConsulta, msgFinanciar, urlAuto, urlPermuta, toast, CARROCERIAS, NO_PHOTO,
} from './ui.js';

fillContact();

const root = $('[data-ficha-auto]');
const id = new URLSearchParams(location.search).get('id');

const ICON = {
  wa: '<svg class="ico" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.4-4A8 8 0 1 1 8.3 19z"/><path d="M9.5 9.5c.3 2 1.8 3.7 4 4.3l1-1.2 1.8.8"/></svg>',
  share: '<svg class="ico" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  prev: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};

function noEncontrado(texto) {
  document.title = 'Auto no encontrado · Mar Motors';
  root.innerHTML = `
    <div class="not-found">
      <h1 class="h-section">Este auto <span class="red">ya no está</span></h1>
      <p>${texto}</p>
      <div class="btn-row">
        <a class="btn btn-red" href="index.html#autos">Ver los autos del patio</a>
        <a class="btn btn-outline" data-wa="busco" href="#">Decinos qué buscás</a>
      </div>
    </div>`;
  fillContact(root);
}

function render(a) {
  const tag = etiqueta(a);
  const fotos = a.fotos || [];
  const vendido = a.estado === 'vendido';
  document.title = `${nombre(a)} ${a.anio} · Mar Motors`;
  $('meta[name="description"]').content = `${nombre(a)} ${a.anio}, ${fmtKm(a.km)}, ${fmtPrecio(a)}. ${detalle(a)}. Consultalo por WhatsApp en Mar Motors.`;
  $('.wa-float').href = waUrl(msgConsulta(a));

  const specs = [
    ['Año', a.anio],
    ['Kilómetros', fmtKm(a.km)],
    ['Combustible', a.combustible],
    ['Caja', a.caja],
    ['Motor', a.motor],
    ['Carrocería', CARROCERIAS[a.carroceria]?.label],
    ['Color', a.color],
    ['Puertas', a.puertas],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  $('.detail-grid', root).outerHTML = `
    <div class="detail-grid">
      <div class="gallery">
        <div class="gallery-main" data-main>
          ${fotos.length ? '' : NO_PHOTO}
          ${fotos.length > 1 ? `
            <button class="gallery-nav prev" type="button" data-prev aria-label="Foto anterior">${ICON.prev}</button>
            <button class="gallery-nav next" type="button" data-next aria-label="Foto siguiente">${ICON.next}</button>
            <span class="gallery-count" data-count></span>` : ''}
        </div>
        ${fotos.length > 1 ? `<div class="thumbs" role="group" aria-label="Fotos">${fotos.map((f, i) => `
          <button type="button" data-thumb="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
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

  if (fotos.length) galeria(fotos, nombre(a));
  $('[data-compartir]', root).addEventListener('click', () => compartir(a));
}

function galeria(fotos, alt) {
  const main = $('[data-main]', root);
  const img = document.createElement('img');
  img.decoding = 'async';
  img.draggable = false;
  main.prepend(img);
  let i = 0;

  const show = (n) => {
    i = (n + fotos.length) % fotos.length;
    img.src = fotos[i];
    img.alt = `${alt}, foto ${i + 1} de ${fotos.length}`;
    const c = $('[data-count]', main);
    if (c) c.textContent = `${i + 1} / ${fotos.length}`;
    $$('[data-thumb]', root).forEach((t) => t.setAttribute('aria-current', String(Number(t.dataset.thumb) === i)));
    $(`[data-thumb="${i}"]`, root)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    // Precarga la siguiente para que pasar fotos sea instantáneo.
    if (fotos.length > 1) new Image().src = fotos[(i + 1) % fotos.length];
  };

  $('[data-prev]', main)?.addEventListener('click', () => show(i - 1));
  $('[data-next]', main)?.addEventListener('click', () => show(i + 1));
  $$('[data-thumb]', root).forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.thumb))));
  img.addEventListener('click', () => lightbox(fotos, i, alt, show));
  swipe(main, (d) => show(i + d));
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.lightbox') || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
  show(0);
}

function swipe(el, cb) {
  let x0 = null;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  el.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) cb(dx < 0 ? 1 : -1);
  });
}

function lightbox(fotos, start, alt, sync) {
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Fotos en grande');
  box.innerHTML = `
    <img alt="">
    <button class="close" type="button" aria-label="Cerrar">×</button>
    ${fotos.length > 1 ? `<button class="gallery-nav prev" type="button" aria-label="Foto anterior">${ICON.prev}</button>
    <button class="gallery-nav next" type="button" aria-label="Foto siguiente">${ICON.next}</button>` : ''}`;
  const img = $('img', box);
  const show = (n) => {
    i = (n + fotos.length) % fotos.length;
    img.src = fotos[i];
    img.alt = `${alt}, foto ${i + 1} de ${fotos.length}`;
  };
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); sync(i); document.body.style.overflow = ''; };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  };
  $('.close', box).addEventListener('click', close);
  $('.prev', box)?.addEventListener('click', () => show(i - 1));
  $('.next', box)?.addEventListener('click', () => show(i + 1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  swipe(box, (d) => show(i + d));
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.append(box);
  show(start);
  $('.close', box).focus();
}

async function compartir(a) {
  const url = urlAuto(a);
  const data = { title: `${nombre(a)} ${a.anio} · Mar Motors`, text: `${nombre(a)} ${a.anio} · ${fmtPrecio(a)}`, url };
  if (navigator.share) {
    try { await navigator.share(data); } catch { /* cancelado */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado');
  } catch {
    prompt('Copiá el link del auto:', url);
  }
}

async function otros(a) {
  try {
    const todos = ordenar(await listAutos()).filter((x) => x.id !== a.id && x.estado !== 'vendido');
    const mismos = todos.filter((x) => categoria(x) === categoria(a));
    const lista = [...mismos, ...todos.filter((x) => !mismos.includes(x))].slice(0, 3);
    if (!lista.length) return;
    $('[data-otros-grid]').innerHTML = lista.map(carCard).join('');
    $('[data-otros-autos]').hidden = false;
  } catch (err) { console.error(err); }
}

if (!id) {
  noEncontrado('El link no tiene el número del auto.');
} else {
  getAuto(id)
    .then((a) => {
      if (!a) return noEncontrado('Puede que se haya vendido o que lo hayamos sacado de la web. Mirá los que tenemos hoy o escribinos y te ayudamos a encontrar uno.');
      render(a);
      otros(a);
    })
    .catch((err) => {
      console.error(err);
      noEncontrado('No pudimos cargar el auto. Probá recargar la página.');
    });
}
