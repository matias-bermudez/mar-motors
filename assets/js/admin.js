// Panel del dueño (/admin/): login, lista, alta/edición/baja y fotos de los autos de Mar Motors
// en la base compartida (ver supabase.js). Los permisos los pone la base: solo los emails de la tabla
// admins con 'mar-motors' (o '*') pueden escribir. Cada cambio publica la web solo (unos 2 minutos).
import {
  configured, session, login, logout, puedeEditar, listTodos, guardarAuto, borrarAuto, subirFoto, borrarFotos, urlFoto,
} from './supabase.js';
import {
  $, $$, esc, CARROCERIAS, COMBUSTIBLES, CAJAS, LINKS, nombre, fmtKm, fmtPrecio, urlAuto, toast,
} from './ui.js';

const vistas = $$('[data-vista]');
const mostrar = (v) => vistas.forEach((el) => { el.hidden = el.dataset.vista !== v; });

let autos = [];
let editando = null;   // auto que se está editando (null = nuevo)
let fotos = [];        // [{ ruta }] ya subidas (ruta en el bucket) o [{ file, preview }] nuevas
let sucio = false;     // cambios sin guardar en el editor

// ── Arranque y login ─────────────────────────────────────────────
async function iniciar() {
  if (!configured) return mostrar('setup');
  try {
    if (await session()) return entrar();
  } catch (err) { console.error(err); }
  mostrar('login');
}

// Solo entra quien puede editar Mar Motors; si no, se cierra la sesión y se avisa.
async function entrar() {
  if (!(await puedeEditar())) {
    await logout();
    mostrar('login');
    $('[data-login-error]').textContent = 'Este usuario no tiene permiso para editar Mar Motors. Hay que agregarlo en la tabla admins de la base (ver README).';
    return;
  }
  $('[data-salir]').hidden = false;
  mostrar('lista');
  await cargar();
}

$('[data-login]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const err = $('[data-login-error]');
  const btn = $('button', f);
  err.textContent = '';
  btn.disabled = true;
  try {
    await login(f.email.value.trim(), f.password.value);
    f.reset();
    await entrar();
  } catch (ex) {
    err.textContent = /invalid/i.test(ex.message) ? 'Email o contraseña incorrectos.' : `No se pudo entrar: ${ex.message}`;
  } finally {
    btn.disabled = false;
  }
});

$('[data-salir]').addEventListener('click', async () => {
  if (sucio && !confirm('Tenés cambios sin guardar. ¿Salir igual?')) return;
  sucio = false;
  await logout();
  $('[data-salir]').hidden = true;
  mostrar('login');
});

// ── Listado ──────────────────────────────────────────────────────
const lista = $('[data-lista]');
const buscar = $('[data-buscar]');
const filtroEstado = $('[data-filtro-estado]');

async function cargar() {
  lista.innerHTML = '<p class="adm-empty">Cargando…</p>';
  try {
    [autos] = await Promise.all([listTodos(), leerPublicacion()]);
    renderLista();
  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p class="adm-empty">No se pudieron cargar los autos: ${esc(err.message)}</p>`;
  }
}

// Cuándo se armó la web publicada (estado.json lo escribe scripts/build.mjs). Un auto guardado después
// todavía no se ve en la web: se marca y se vuelve a mirar cada 20 segundos hasta que aparezca.
let publicadoEn = null;
let revision;
async function leerPublicacion() {
  try {
    const r = await fetch(new URL(`estado.json?t=${Date.now()}`, LINKS.raiz), { cache: 'no-store' });
    publicadoEn = r.ok ? new Date((await r.json()).generado) : null;
  } catch {
    publicadoEn = null;
  }
}
const pendiente = (a) => publicadoEn && new Date(a.updated_at) > publicadoEn;
function revisarPublicacion() {
  clearTimeout(revision);
  if (!autos.some(pendiente)) return;
  revision = setTimeout(async () => { await leerPublicacion(); renderLista(); }, 20000);
}

// En la web pública están los publicados que no se vendieron (los demás caen en la página 404).
const enLaWeb = (a) => a.publicado && a.estado !== 'vendido';

function renderLista() {
  revisarPublicacion();
  const q = buscar.value.trim().toLowerCase().replace(/^#/, '');
  const fe = filtroEstado.value;
  const visibles = autos.filter((a) => {
    if (fe === 'oculto' ? a.publicado : fe && a.estado !== fe) return false;
    return !q || `${a.marca} ${a.modelo} ${a.anio} ${a.id}`.toLowerCase().includes(q);
  });
  $('[data-total]').textContent = autos.length ? `(${autos.length})` : '';
  if (!autos.length) {
    lista.innerHTML = '<p class="adm-empty">Todavía no cargaste ningún auto.<br>Tocá <b>+ Cargar auto</b> para publicar el primero.</p>';
    return;
  }
  if (!visibles.length) {
    lista.innerHTML = '<p class="adm-empty">Ningún auto coincide con la búsqueda.</p>';
    return;
  }
  lista.innerHTML = visibles.map((a) => `
    <article class="adm-row${a.publicado ? '' : ' oculto'}" data-id="${a.id}">
      <div class="adm-thumb">${a.fotos[0] ? `<img src="${esc(urlFoto(a.fotos[0], true))}" alt="" loading="lazy">` : 'Sin fotos'}</div>
      <div class="adm-row-info">
        <b>${esc(nombre(a))}</b>
        <span>${esc(a.anio)} · ${esc(fmtKm(a.km))} · <span class="price">${esc(fmtPrecio(a))}</span></span>
        <span>Ref. #${a.id} · ${a.fotos.length} foto${a.fotos.length === 1 ? '' : 's'}${a.publicado ? '' : ' · <b style="font-size: inherit">Oculto</b>'}${pendiente(a) ? ' · <b style="font-size: inherit">Actualizando la web…</b>' : ''}</span>
      </div>
      <div class="adm-row-ctrl">
        <select data-accion="estado" data-estado="${esc(a.estado)}" aria-label="Estado de ${esc(nombre(a))}">
          ${['disponible', 'reservado', 'vendido'].map((s) => `<option value="${s}"${s === a.estado ? ' selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
        <label><input type="checkbox" data-accion="publicado"${a.publicado ? ' checked' : ''}>Publicado</label>
        <button class="adm-mini primary" type="button" data-accion="editar">Editar</button>
        ${enLaWeb(a) ? `<a class="adm-mini" href="${esc(urlAuto(a))}" target="_blank" rel="noopener">Ver</a>
        <button class="adm-mini" type="button" data-accion="copiar" title="Copiar el link para compartir">Link</button>` : ''}
        <button class="adm-mini danger" type="button" data-accion="borrar">Borrar</button>
      </div>
    </article>`).join('');
}

buscar.addEventListener('input', renderLista);
filtroEstado.addEventListener('change', renderLista);

const autoDe = (el) => autos.find((a) => String(a.id) === el.closest('[data-id]').dataset.id);

async function cambiar(a, cambios, el) {
  el.disabled = true;
  try {
    Object.assign(a, await guardarAuto(a, cambios));
    toast('Guardado. En un par de minutos se ve en la web.');
  } catch (err) {
    console.error(err);
    alert(`No se pudo guardar: ${err.message}`);
  }
  el.disabled = false;
  renderLista();
}

lista.addEventListener('change', (e) => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const a = autoDe(el);
  if (el.dataset.accion === 'estado') cambiar(a, { estado: el.value }, el);
  if (el.dataset.accion === 'publicado') cambiar(a, { publicado: el.checked }, el);
});

lista.addEventListener('click', async (e) => {
  const el = e.target.closest('button[data-accion]');
  if (!el) return;
  const a = autoDe(el);
  if (el.dataset.accion === 'editar') abrirEditor(a);
  if (el.dataset.accion === 'copiar') {
    try { await navigator.clipboard.writeText(urlAuto(a)); toast('Link copiado'); } catch { prompt('Link del auto:', urlAuto(a)); }
  }
  if (el.dataset.accion === 'borrar') {
    if (!confirm(`¿Borrar ${nombre(a)} (Ref. #${a.id})?\nSe borran también sus fotos. Si solo se vendió, mejor marcalo como «Vendido».`)) return;
    el.disabled = true;
    try {
      await borrarAuto(a);
      autos = autos.filter((x) => x !== a);
      renderLista();
      toast('Auto borrado');
    } catch (err) {
      console.error(err);
      alert(`No se pudo borrar: ${err.message}`);
      el.disabled = false;
    }
  }
});

$('[data-nuevo]').addEventListener('click', () => abrirEditor(null));

// ── Editor ───────────────────────────────────────────────────────
const form = $('[data-editor]');
const opciones = {
  carrocerias: Object.entries(CARROCERIAS).map(([v, c]) => [v, c.label]),
  combustibles: COMBUSTIBLES.map((c) => [c, c]),
  cajas: CAJAS.map((c) => [c, c]),
};
$$('select[data-opts]', form).forEach((s) => {
  s.innerHTML = opciones[s.dataset.opts].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
});

const CAMPOS = ['marca', 'modelo', 'anio', 'km', 'carroceria', 'combustible', 'caja', 'motor', 'color', 'puertas', 'precio', 'moneda', 'estado', 'descripcion'];
// Km y precio se escriben como en Uruguay ("64.000", "U$S 14.500"): se toman solo los dígitos.
const MONTOS = ['km', 'precio'];
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const miles = (n) => Number(n).toLocaleString('es-UY');

// Si el auto trae un valor que no está en la lista (cargado desde otro lado), se agrega para no perderlo.
function ponerValor(el, v) {
  if (el.tagName === 'SELECT' && v !== '' && ![...el.options].some((o) => o.value === String(v))) {
    el.add(new Option(String(v), String(v)));
  }
  el.value = v;
}

function abrirEditor(a) {
  editando = a;
  form.reset();
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $('[data-editor-error]').textContent = '';
  $('[data-progreso]').textContent = '';
  $('[data-editor-titulo]').textContent = a ? `Editar ${nombre(a)} · Ref. #${a.id}` : 'Cargar auto';
  if (a) {
    CAMPOS.forEach((c) => {
      const v = a[c] ?? '';
      ponerValor(form.elements[c], MONTOS.includes(c) && v ? miles(v) : v);
    });
    form.elements.publicado.checked = a.publicado;
  } else {
    form.elements.anio.value = '';
    form.elements.publicado.checked = true;
  }
  fotos.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
  fotos = (a?.fotos || []).map((ruta) => ({ ruta }));
  renderFotos();
  sucio = false;
  mostrar('editor');
  scrollTo({ top: 0 });
}

async function cerrarEditor() {
  if (sucio && !confirm('Tenés cambios sin guardar. ¿Descartarlos?')) return;
  sucio = false;
  fotos.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
  fotos = [];
  mostrar('lista');
}
$$('[data-volver]').forEach((b) => b.addEventListener('click', cerrarEditor));
form.addEventListener('input', (e) => {
  sucio = true;
  if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid');
  if (!$('[aria-invalid="true"]', form)) $('[data-editor-error]').textContent = '';
});
addEventListener('beforeunload', (e) => { if (sucio) e.preventDefault(); });

// Fotos: agregar, ordenar, quitar
const fotosEl = $('[data-fotos]');
function renderFotos() {
  fotosEl.innerHTML = fotos.map((f, i) => `
    <div class="adm-photo">
      <img src="${esc(f.ruta ? urlFoto(f.ruta, true) : f.preview)}" alt="Foto ${i + 1}">
      ${i === 0 ? '<span class="cover">Portada</span>' : ''}
      ${f.file ? '<span class="new">Nueva</span>' : ''}
      <div class="tools">
        <button type="button" data-mover="-1" data-i="${i}" aria-label="Mover foto ${i + 1} a la izquierda"${i === 0 ? ' disabled' : ''}>◀</button>
        <button type="button" data-portada data-i="${i}" aria-label="Usar foto ${i + 1} de portada" title="Portada"${i === 0 ? ' disabled' : ''}>★</button>
        <button type="button" data-mover="1" data-i="${i}" aria-label="Mover foto ${i + 1} a la derecha"${i === fotos.length - 1 ? ' disabled' : ''}>▶</button>
        <button type="button" class="del" data-quitar data-i="${i}" aria-label="Quitar foto ${i + 1}">✕</button>
      </div>
    </div>`).join('');
}

fotosEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (b.dataset.mover) {
    const j = i + Number(b.dataset.mover);
    [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
  } else if (b.hasAttribute('data-portada')) {
    fotos.unshift(...fotos.splice(i, 1));
  } else if (b.hasAttribute('data-quitar')) {
    const [f] = fotos.splice(i, 1);
    if (f.preview) URL.revokeObjectURL(f.preview);
  }
  sucio = true;
  renderFotos();
});

function agregarArchivos(files) {
  const imgs = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (imgs.length < files.length) toast('Solo se aceptan fotos JPG, PNG o WebP');
  fotos.push(...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) })));
  if (imgs.length) sucio = true;
  renderFotos();
}
const fileInput = $('[data-file]');
fileInput.addEventListener('change', () => { agregarArchivos(fileInput.files); fileInput.value = ''; });
const drop = $('[data-drop]');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); agregarArchivos(e.dataTransfer.files); });

// Guardar
function leerForm() {
  const f = form.elements;
  const entero = (v) => (v === '' ? null : Math.round(Number(v)));
  const monto = (v) => (digitos(v) ? Number(digitos(v)) : null);
  const texto = (v) => v.trim() || null;
  return {
    marca: f.marca.value.trim(),
    modelo: f.modelo.value.trim(),
    anio: entero(f.anio.value),
    km: monto(f.km.value) ?? 0,
    carroceria: f.carroceria.value,
    combustible: f.combustible.value,
    caja: f.caja.value,
    motor: texto(f.motor.value),
    color: texto(f.color.value),
    puertas: entero(f.puertas.value),
    precio: monto(f.precio.value) || null, // vacío o 0 = «Consultar»
    moneda: f.moneda.value,
    estado: f.estado.value,
    publicado: f.publicado.checked,
    descripcion: texto(f.descripcion.value),
  };
}

function validar(row) {
  const f = form.elements;
  const max = new Date().getFullYear() + 1;
  const malos = [
    [f.marca, !row.marca],
    [f.modelo, !row.modelo],
    [f.anio, !(row.anio >= 1950 && row.anio <= max)],
    [f.km, !Number.isSafeInteger(row.km) || row.km > 2e6],
    [f.precio, row.precio !== null && !(row.precio <= 2e9)],
  ];
  malos.forEach(([el, mal]) => el.setAttribute('aria-invalid', String(mal)));
  const primero = malos.find(([, mal]) => mal)?.[0];
  if (primero) {
    $('[data-editor-error]').textContent = `Revisá los campos marcados en rojo (el año va de 1950 a ${max}).`;
    primero.focus();
  }
  return !primero;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const row = leerForm();
  const err = $('[data-editor-error]');
  err.textContent = '';
  if (!validar(row)) return;

  const btn = $('[data-guardar]');
  const progreso = $('[data-progreso]');
  btn.disabled = true;
  const nuevas = fotos.filter((f) => f.file);
  const subidas = [];
  try {
    // Cada foto se achica en el navegador (1600 px + una de 640 px para las tarjetas) y se sube.
    for (const [n, f] of nuevas.entries()) {
      progreso.textContent = `Subiendo foto ${n + 1} de ${nuevas.length}…`;
      f.ruta = await subirFoto(f.file);
      subidas.push(f.ruta);
    }
    progreso.textContent = 'Guardando…';
    row.fotos = fotos.map((f) => f.ruta);
    const guardado = await guardarAuto(editando, row);
    // Las fotos que se quitaron se borran del bucket (las dos medidas).
    const quitadas = (editando?.fotos || []).filter((r) => !row.fotos.includes(r));
    await borrarFotos(quitadas);

    if (editando) Object.assign(editando, guardado);
    else autos.unshift(guardado);
    sucio = false;
    toast(editando ? 'Cambios guardados. En un par de minutos se ven en la web.' : 'Auto guardado. En un par de minutos se ve en la web.');
    await cerrarEditor();
    renderLista();
  } catch (ex) {
    console.error(ex);
    // Si falló al guardar, no dejamos fotos huérfanas en el bucket.
    await borrarFotos(subidas).catch(() => {});
    nuevas.forEach((f) => { delete f.ruta; });
    err.textContent = /row-level security/i.test(ex.message)
      ? 'No tenés permiso para guardar: tu email no está en la tabla admins de la base (ver README).'
      : `No se pudo guardar: ${ex.message}`;
  } finally {
    btn.disabled = false;
    progreso.textContent = '';
  }
});

iniciar();
