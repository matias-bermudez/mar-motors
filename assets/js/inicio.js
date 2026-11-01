import { CONFIG } from './config.js';
import { listAutos, getAuto } from './db.js';
import {
  $, $$, esc, CATEGORIAS, COMBUSTIBLES, CAJAS, categoria, ordenar, carCard, skeletonCards,
  fillContact, abrirWhatsApp, nombre, fmtPrecio, fmtKm, urlAuto, fotoChica,
} from './ui.js';

fillContact();
$('[data-renovacion]').hidden = !CONFIG.mostrarRenovacion;

// ── Patio: catálogo con filtros ──────────────────────────────────
const PRIMEROS = 9;
const grid = $('[data-autos]');
const filtrosEl = $('[data-filtros]');
const verMas = $('[data-ver-mas]');
let autos = [];
let todos = false;

// El filtro queda en la URL (?tipo=camionetas#autos): se puede compartir y sobrevive al volver atrás.
const EN_URL = { Autos: 'autos', 'Camionetas y SUV': 'camionetas', Utilitarios: 'utilitarios' };
const params = () => new URLSearchParams(location.search);
let filtro = Object.keys(EN_URL).find((c) => EN_URL[c] === params().get('tipo')) || 'Todos';
function cambiarUrl(clave, valor) {
  const u = new URL(location.href);
  if (valor) u.searchParams.set(clave, valor);
  else u.searchParams.delete(clave);
  history.replaceState(null, '', u);
}

function render() {
  const lista = filtro === 'Todos' ? autos : autos.filter((a) => categoria(a) === filtro);
  filtrosEl.innerHTML = CATEGORIAS.map((c) => {
    const n = c === 'Todos' ? autos.length : autos.filter((a) => categoria(a) === c).length;
    return `<button class="filter" type="button" aria-pressed="${c === filtro}" data-cat="${esc(c)}">${esc(c)}<span class="count">${n}</span></button>`;
  }).join('');
  const visibles = todos ? lista : lista.slice(0, PRIMEROS);
  grid.innerHTML = visibles.length
    ? visibles.map(carCard).join('')
    : `<p class="cars-empty">Ahora no tenemos ${filtro === 'Todos' ? 'autos publicados' : esc(filtro.toLowerCase())} en el patio.<br>
       <a data-wa="busco" href="#">Escribinos qué buscás</a> y te avisamos apenas entre uno.</p>`;
  fillContact(grid);
  verMas.hidden = todos || lista.length <= PRIMEROS;
  verMas.textContent = `Ver todos (${lista.length})`;
}

filtrosEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  filtro = b.dataset.cat;
  todos = false;
  cambiarUrl('tipo', EN_URL[filtro]);
  render();
});
verMas.addEventListener('click', () => { todos = true; render(); });

// En la web publicada los autos ya vienen en el HTML (para Google); si no, mostramos el esqueleto.
if (!grid.children.length) grid.innerHTML = skeletonCards(3);
listAutos()
  .then((data) => { autos = ordenar(data); render(); })
  .catch((err) => {
    console.error(err);
    grid.innerHTML = '<p class="cars-empty">No pudimos cargar los autos. Probá recargar la página o <a data-wa="general" href="#">escribinos por WhatsApp</a>.</p>';
    fillContact(grid);
  });

// ── Ficha para vender o permutar ─────────────────────────────────
const form = $('[data-ficha]');
const opts = { combustibles: COMBUSTIBLES, cajas: CAJAS };
$$('select[data-opts]', form).forEach((s) => {
  s.innerHTML = opts[s.dataset.opts].map((o) => `<option>${esc(o)}</option>`).join('');
});

let interes = null; // auto del patio que quiere llevarse (llega con ?auto=<slug> desde la ficha)

const modo = () => form.elements.modo.value;
function aplicarModo() {
  const m = modo();
  $$('[data-solo]', form).forEach((el) => { el.hidden = el.dataset.solo !== m; });
  $('[data-ficha-title]', form).textContent = m === 'vender' ? 'Ficha de venta' : 'Ficha de permuta';
  $('[data-sello]', form).textContent = m === 'vender' ? 'Compra' : 'Permuta';
  $('[data-interes]', form).hidden = !(interes && m === 'permutar');
}
form.addEventListener('change', (e) => { if (e.target.name === 'modo') aplicarModo(); });
$$('[data-modo]').forEach((a) => a.addEventListener('click', () => {
  form.elements.modo.value = a.dataset.modo;
  aplicarModo();
}));

async function cargarInteres() {
  const ref = params().get('auto');
  if (!ref) return;
  try {
    interes = await getAuto(ref);
  } catch (err) { console.error(err); }
  if (!interes) return;
  $('[data-interes-nombre]', form).textContent = nombre(interes);
  $('[data-interes-meta]', form).textContent = `${interes.anio} · ${fmtKm(interes.km)} · ${fmtPrecio(interes)}`;
  const img = $('[data-interes-foto]', form);
  if (fotoChica(interes)) { img.src = fotoChica(interes); img.hidden = false; }
  form.elements.modo.value = 'permutar';
  aplicarModo();
}
$('[data-interes-quitar]', form).addEventListener('click', () => {
  interes = null;
  aplicarModo();
  cambiarUrl('auto');
});

const soloDigitos = (s) => String(s).replace(/\D/g, '');
const miles = (s) => Number(soloDigitos(s)).toLocaleString('es-UY');

// Formatea los km y el precio mientras se escriben: 95000 → 95.000
['km', 'precio'].forEach((n) => form.elements[n].addEventListener('input', (e) => {
  const d = soloDigitos(e.target.value);
  e.target.value = d ? miles(d) : '';
}));
form.elements.anio.addEventListener('input', (e) => { e.target.value = soloDigitos(e.target.value).slice(0, 4); });

function validar() {
  const f = form.elements;
  const anioMax = new Date().getFullYear() + 1;
  const cel = soloDigitos(f.celular.value);
  const errores = {
    modelo: f.modelo.value.trim().length < 2 && 'Contanos qué auto es.',
    anio: !(Number(f.anio.value) >= 1950 && Number(f.anio.value) <= anioMax) && `Poné un año entre 1950 y ${anioMax}.`,
    km: !soloDigitos(f.km.value) && 'Poné los kilómetros aproximados.',
    nombre: f.nombre.value.trim().length < 2 && 'Poné tu nombre.',
    celular: (cel.length < 8 || cel.length > 15) && 'Poné un celular válido, ej.: 099 123 456.',
  };
  let primero = null;
  for (const [campo, msg] of Object.entries(errores)) {
    const input = f[campo];
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    $(`[data-err="${campo}"]`, form).textContent = msg || '';
    if (msg && !primero) primero = input;
  }
  primero?.focus();
  return !primero;
}

function mensaje() {
  const f = form.elements;
  const vender = modo() === 'vender';
  const v = (x) => x.value.trim();
  const l = [
    `¡Hola Mar Motors! Quiero *${vender ? 'vender' : 'permutar'} mi auto*. Estos son los datos:`,
    '',
    `🚗 *${vender ? '' : 'Mi auto: '}${v(f.modelo)}*`,
    `• Año: ${v(f.anio)}`,
    `• Kilómetros: ${v(f.km)}`,
    `• ${f.combustible.value} · ${f.caja.value}`,
  ];
  if (vender && v(f.precio)) l.push(`• Pretendo: U$S ${v(f.precio)}`);
  if (v(f.detalles)) l.push(`• Detalles: ${v(f.detalles)}`);
  if (!vender) {
    l.push('');
    if (interes) l.push(`🔁 Me interesa: *${nombre(interes)}* (${interes.anio}) · ${fmtPrecio(interes)} · Ref. #${interes.id}`, urlAuto(interes));
    if (v(f.busco)) l.push(`🔎 Busco: ${v(f.busco)}`);
    if (f.financia.value) l.push(`💵 ¿Financio la diferencia? ${f.financia.value}`);
  }
  l.push(
    '',
    `👤 ${v(f.nombre)} · ${v(f.celular)}`,
    '',
    '📸 Ahora les mando las fotos del auto (frente, atrás, laterales, interior y tablero con los km).',
  );
  return l.join('\n').replace(/\n{3,}/g, '\n\n');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (validar()) abrirWhatsApp(mensaje());
});
form.addEventListener('input', (e) => {
  if (e.target.getAttribute('aria-invalid') === 'true') {
    e.target.setAttribute('aria-invalid', 'false');
    const err = $(`[data-err="${e.target.name}"]`, form);
    if (err) err.textContent = '';
  }
});

aplicarModo();
cargarInteres();
