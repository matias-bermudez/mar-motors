import { getAuto, listAutos } from './db.js';
import {
  $, $$, fillContact, nombre, fmtPrecio, categoria, carCard, ordenar, waUrl, msgConsulta, urlAuto, toast,
  fichaHTML, seoAuto, ICON,
} from './ui.js';

fillContact();

const root = $('[data-ficha-auto]');
const id = document.body.dataset.autoId || new URLSearchParams(location.search).get('id');

function noEncontrado(texto) {
  document.title = 'Auto no encontrado · Mar Motors';
  document.head.insertAdjacentHTML('beforeend', '<meta name="robots" content="noindex">');
  root.innerHTML = `
    <div class="not-found">
      <h1 class="h-section">Este auto <span class="red">ya no está</span></h1>
      <p>${texto}</p>
      <div class="btn-row">
        <a class="btn btn-red" href="./#autos">Ver los autos del patio</a>
        <a class="btn btn-outline" data-wa="busco" href="#">Decinos qué buscás</a>
      </div>
    </div>`;
  fillContact(root);
}

function render(a) {
  const fotos = a.fotos || [];
  const seo = seoAuto(a);
  document.title = seo.title;
  $('meta[name="description"]').content = seo.description;
  $('.wa-float').href = waUrl(msgConsulta(a));

  $('.detail-grid', root).outerHTML = fichaHTML(a);

  if (fotos.length) galeria(fotos, nombre(a));
  $('[data-compartir]', root).addEventListener('click', () => compartir(a));
}

function galeria(fotos, alt) {
  const main = $('[data-main]', root);
  const img = $('img', main);
  let i = 0;

  const show = (n, mover = true) => {
    i = (n + fotos.length) % fotos.length;
    img.src = fotos[i];
    img.alt = `${alt}, foto ${i + 1} de ${fotos.length}`;
    const c = $('[data-count]', main);
    if (c) c.textContent = `${i + 1} / ${fotos.length}`;
    $$('[data-thumb]', root).forEach((t) => t.setAttribute('aria-current', String(Number(t.dataset.thumb) === i)));
    if (mover) $(`[data-thumb="${i}"]`, root)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
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
  show(0, false);
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
  const show = (n, mover = true) => {
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
