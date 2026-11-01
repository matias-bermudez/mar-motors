# Mar Motors

Web de la Automotora Mar Motors (Montevideo): catálogo de autos, ficha de cada auto, consultas por WhatsApp, formulario para vender o permutar y panel para cargar autos.

- **Inicio**: `index.html`: hero, patio con filtros, financiación, vendé/permutá y horarios.
- **Ficha del auto**: cada auto tiene su página, `autos/<slug>/` (slug = marca-modelo-año, ej. `autos/chevrolet-onix-lt-1-4-2019/`).
- **Panel del administrador**: `admin/`

**Web de prueba:** https://matias-bermudez.github.io/mar-motors/ (en modo prueba: no aparece en Google). El diseño original (Claude Design) está en `diseno/`.

## Arquitectura

Sigue las reglas de la **Plataforma Automotoras** (`~/Proyectos/plataforma-automotoras/README.md`; referencia: DN Automóviles).

- **Web estática, sin servidor.** `scripts/build.mjs` (Node, sin dependencias) lee los autos de la base, **baja las fotos al sitio** (`img/autos/<slug>/`, con caché en `.cache/fotos/`) y escribe todo el HTML en `_site/`, más `assets/js/autos.js` con los mismos autos para el navegador (filtros, galería, permuta). **La web pública nunca consulta Supabase**; el 404 es estático.
- **Datos del negocio** (WhatsApp, teléfonos, dirección, horarios, zonas, redes): salen de `assets/js/config.js`, pisados por la fila de la tabla `negocios` que el dueño edita desde el panel. El build los deja escritos en todo el HTML y escribe en `_site/` un `assets/js/config.js` con los valores finales (lo usan los formularios y los mensajes de WhatsApp). Si la tabla o la fila no existen, se publica con `config.js` tal cual.
- **Base compartida** (un Supabase para todas las automotoras): esta web solo lee y escribe filas con `concesionaria = 'mar-motors'`. El esquema se cambia **solo** en `plataforma-automotoras/supabase/schema.sql`; acá no se crean ni alteran tablas.
- **Panel** `/admin/`: página estática con supabase-js (login con email y contraseña). Es lo único que habla con Supabase en vivo.
- **Publicación:** GitHub Actions arma y publica en GitHub Pages al hacer push, cuando se guarda un auto en el panel y cada 15 minutos si cambió algo (ver «Publicar»).

| Archivo | Qué es |
|---|---|
| `assets/js/config.js` | WhatsApp, teléfonos, redes, horarios, zonas, `sitioUrl`, `indexar`, `supabaseUrl`, `supabaseKey`, `concesionaria` (los datos del negocio los puede pisar la tabla `negocios`) |
| `assets/js/modelo.js` | **Adaptador** fila de la base ↔ auto de la web (ver tabla abajo), el slug, y fila de `negocios` → config (`deNegocio`, `telefonoUY`) |
| `assets/js/db.js` | Autos de la web pública: lee `assets/js/autos.js` (lo genera el build) |
| `assets/js/supabase.js` | Datos del panel: login, permisos, autos, fotos (supabase-js 2.45.4 desde jsdelivr) |
| `assets/js/ui.js` | Tarjetas, ficha, links y mensajes de WhatsApp (lo usan el navegador y el build) |
| `assets/js/inicio.js`, `ficha.js`, `admin.js` | Lo interactivo de cada página |
| `index.html`, `auto.html`, `404.html`, `admin/index.html` | Plantillas: el build completa los autos, el SEO y `?v=` en css/js |
| `scripts/build.mjs` | Arma `_site/` |
| `.github/workflows/deploy.yml` | Publicación |

### Campos: base ↔ web

| Web (Mar Motors) | Base (`autos`) |
|---|---|
| `caja` | `transmision` |
| `carroceria` (hatch, sedan, suv, pickup, utilitario) | `carroceria` igual; además `tipo`: utilitario → `utilitario`, suv/pickup → `camioneta`, el resto → `auto` |
| `precio` + `moneda` | `precio` (entero, vacío = «Consultar») + `moneda` (`USD` → «U$S 14.500», `UYU` → «$ 450.000») |
| `fotos` | `fotos`: rutas del bucket `fotos`, `mar-motors/<uuid>.jpg` (1600 px) + `mar-motors/<uuid>_m.jpg` (640 px) |
| `id` (se muestra como «Ref. #id») y `slug` | `id` y `slug` |
| marca, modelo, anio, km, combustible, motor, color, puertas, descripcion, estado, publicado | mismas columnas |
| lo propio que no tenga columna | `extra` (jsonb; hoy no hace falta) |

Las columnas que Mar Motors no usa (`destacado`, `etiqueta`, `acepta_permuta`, `equipamiento`…) quedan con su valor por defecto y el panel no las pisa. Mar Motors no tiene datos privados (matrícula, notas): `autos_privado` no se usa.

### Datos del negocio: config ↔ `negocios`

| `config.js` | Base (`negocios`, una fila con `concesionaria = 'mar-motors'`) |
|---|---|
| `whatsapp: { intl, display }` | `whatsapp` (`59899123456`) + `telefono` (`099 123 456`) |
| `direccion` | `direccion` |
| `horarios` (por día; la franja de arriba, la grilla y Google) | `extra.horarios` (mismo formato) + `horario` (el resumen en texto, lo usan las otras webs) |
| `zonas` (Google: `areaServed`) | `zonas` |
| `redes.instagram`, `redes.tiktok`, `redes.facebook` | `instagram`, `tiktok` (usuarios, sin @), `facebook` (link o página) |
| `barrio`, `telefonoFijo`, `otrosCelulares` | `extra.barrio`, `extra.telefono_fijo`, `extra.otros_celulares` |

Campo vacío (`null`) = queda el valor de `config.js`. El adaptador es `deNegocio` en `modelo.js`.

## Probarla en tu compu

```bash
node scripts/build.mjs --local && python3 -m http.server 8803 -d _site
```

Abrí http://localhost:8803 (el 8765 y el 8791 los usan otros proyectos). Lee los autos reales de la base; `--local` solo cambia la carpeta base para servirla en la raíz.

## WhatsApp

Todos los botones, fichas y formularios mandan al número que cargó el dueño en el panel («Datos del negocio»); si no cargó ninguno, al de `assets/js/config.js`:

```js
whatsapp: { display: '091 969 322', intl: '59891969322' },   // prueba
```

Ningún número está escrito en las plantillas ni en el JS: todo sale de la config (`data-wa`, `data-wa-num`, `data-tel`, `data-tel-num`, `data-otros`, `data-horario`, `data-horarios`, `data-red`; los completa el build y, en lo que se arma en el navegador, `fillContact` de `ui.js`).

Qué mensaje llega en cada caso:

- **Consultar un auto** (tarjeta o ficha): marca, modelo, año, km, precio, `Ref. #id` y el **link de la publicación** (`autos/<slug>/`), así no hay dudas de qué auto es.
- **Financiarlo**: lo mismo, pidiendo opciones de financiación.
- **Vender / permutar mi auto**: la ficha completa (auto, año, km, combustible, caja, precio pretendido o qué busca, si financia la diferencia, nombre y celular), y al final avisa que a continuación manda las fotos. La web le pide a la persona que adjunte las fotos en ese mismo chat (el público no sube nada a la base y la web no guarda consultas).
- Si entra a permutar desde la ficha de un auto (`./?auto=<slug>#permuta`), el mensaje también incluye el auto que le interesa y su link.

Los links usan `api.whatsapp.com/send` y no `wa.me`, porque la redirección de `wa.me` rompe los emojis del mensaje.

## Base de datos

Ya está conectada a la base compartida (`supabaseUrl`, `supabaseKey` y `concesionaria: 'mar-motors'` en `config.js`). La clave es la *publishable*: va en el código, los permisos los pone la base (RLS): el público solo lee autos publicados y no vendidos; escribir requiere estar logueado en `admin/` con un email habilitado para `mar-motors`.

**Usuario del dueño** (una vez, lo hace Matías): Supabase → Authentication → Users → *Add user* (*Auto Confirm User*) y en el SQL Editor:

```sql
insert into public.admins (email, concesionaria) values ('el-email-del-dueño@ejemplo.com', 'mar-motors');
```

## Panel (`/admin`)

- Al entrar se chequea `puede_editar('mar-motors')`: si el usuario no está habilitado, se cierra la sesión y se avisa.
- Cargar, editar y borrar autos: marca, modelo y versión, año, km, carrocería, combustible, caja, motor, color, puertas, descripción. Km y precio se escriben como en Uruguay («64.000», «U$S 14.500»): se toman solo los dígitos.
- Precio en U$S o pesos (vacío = «Consultar»), estado (disponible / reservado / vendido) y publicado u oculto.
- La dirección del auto (`autos/<slug>/`) se arma sola con marca-modelo-año (con `-2`, `-3` si ya hay otro igual) y se actualiza si cambian esos datos.
- Fotos: desde la galería (varias a la vez) o, en el celular, con **«Sacar foto»** (`capture="environment"`: abre la cámara trasera; el botón solo aparece en pantallas táctiles, `@media (pointer: coarse)`). Se achican en el navegador (1600 px, JPEG 0.82, y una de 640 px para las tarjetas), se ordenan con flechas y la primera es la portada. Al quitar una foto o borrar el auto se borran las dos medidas del bucket.
- Desde el listado: cambiar estado, publicar/ocultar, ver la ficha y copiar el link para compartir. Un auto recién guardado dice «Actualizando la web…» hasta que sale publicado (un par de minutos).
- **Datos del negocio** (botón junto a «+ Cargar auto»): WhatsApp, teléfono fijo, otros celulares, dirección, barrio, zonas, horarios por día y redes. Hace upsert de la fila de `negocios` (`onConflict: concesionaria`) y la base republica la web. Los números se escriben como en Uruguay («095 407 252») y se guardan `whatsapp = 59895407252`, `telefono = 095 407 252` (`telefonoUY` en `modelo.js`, igual que DN). Se abre con lo que publica la web hoy.
- Los autos ocultos solo los ve el admin (sirve para dejarlos listos antes de publicarlos). **Los vendidos salen de la web**: su link cae en la página 404.

## Otros datos del local

Teléfono fijo, otros celulares, dirección y barrio (con dirección aparece el mapa de Google), horarios, zonas y redes: los cambia el dueño desde el panel («Datos del negocio»); los valores de `assets/js/config.js` quedan para lo que no cargó. El bloque de renovación MiAuto (`mostrarRenovacion`) y lo demás de `config.js` se cambian ahí y se publican con un push a `main`.

## Publicar (GitHub Pages)

`.github/workflows/deploy.yml` corre `scripts/build.mjs` y publica `_site/` en GitHub Pages (Settings → Pages → Source: **GitHub Actions**):

- en cada push a `main`;
- **al guardar un auto en el panel**: la base dispara `workflow_dispatch` de `deploy.yml` (trigger `publicar_web`), si Mar Motors tiene `repo` cargado en la tabla `concesionarias` y el repo está en el token de GitHub (ver «Pendiente»);
- **al guardar los datos del negocio** en el panel (mismo trigger, sobre la tabla `negocios`);
- cada 15 minutos, de respaldo: solo publica si cambiaron los autos o los datos del negocio (compara un hash con `estado.json` de la web publicada). Ese paso también re-habilita el workflow, porque GitHub apaga los programados a los 60 días sin commits.

Las fotos ya bajadas quedan en la caché de Actions (`.cache/fotos`): solo se bajan las nuevas. Los css/js llevan `?v=<hash>` para que el navegador no mezcle versiones (Pages cachea 10 minutos). Para publicar a mano: Actions → «Publicar» → *Run workflow*.

**Pendiente (lo hace Matías, una vez)** para que se publique al guardar:

1. En la base: `update public.concesionarias set repo = 'matias-bermudez/mar-motors' where id = 'mar-motors';` (y lo mismo en la sección «Automotoras registradas» de `plataforma-automotoras/supabase/schema.sql`).
2. GitHub → Settings → Developer settings → Fine-grained tokens → `dn-automoviles-publicar` → Edit → Repository access: sumar `mar-motors`.

Mientras tanto, lo que se guarda en el panel aparece en la web en el próximo chequeo de 15 minutos.

### Dominio propio

Con un dominio (por ejemplo `marmotors.com.uy`): poné `sitioUrl: 'https://www.marmotors.com.uy/'` en `config.js` (el build genera el `CNAME`), configurá el DNS como indica GitHub (Settings → Pages → Custom domain) y activá *Enforce HTTPS*. La dirección de github.io pasa a redirigir al dominio. Actualizá también `sitio` de `mar-motors` en la tabla `concesionarias`. (Según la plataforma, al lanzar con dominio propio la web se muda a Cloudflare Pages: no depende de nada propio de GitHub Pages.)

## SEO

La web está preparada para aparecer en búsquedas como «automotora Montevideo», «autos usados Montevideo», «Mar Motors» o el modelo de un auto («Onix 2019 usado Montevideo»):

- **Una página por auto**, con dirección legible (`autos/chevrolet-onix-lt-1-4-2019/`), título, descripción, canonical y foto propios y el contenido ya escrito en el HTML: Google lo lee sin ejecutar JavaScript.
- **Inicio** con los autos ya escritos en el HTML y textos pensados para las búsquedas locales.
- **Datos estructurados** (schema.org): `AutoDealer` con teléfono, horarios, zona y redes; cada auto como `Car` + `Offer` (con la moneda real, `USD` o `UYU`, y disponibilidad) + `BreadcrumbList`.
- `sitemap.xml`, `canonical` en cada página, Open Graph (foto del auto en la vista previa de WhatsApp y Facebook).
- Los autos vendidos no se publican (su link da 404). La 404 y el panel no van a Google.
- El filtro del patio queda en la URL (`?tipo=camionetas#autos`).
- Rápida: fuentes servidas desde el sitio (con precarga), fotos servidas desde el sitio (640 px en tarjetas) y con carga diferida.

### Modo prueba → lanzamiento

Mientras `indexar: false` (en `config.js`), todas las páginas llevan `noindex`: se pueden abrir con el link, pero Google no las muestra. GitHub Pages no tiene un modo privado en cuentas gratis, así que la web es pública para quien tenga el link.

Al lanzar:

1. `indexar: true` y los datos reales (WhatsApp, dirección) en `config.js`. Mejor si ya está el dominio propio.
2. [Google Search Console](https://search.google.com/search-console): agregar la propiedad, verificar con la etiqueta HTML (el código va en `googleVerificacion`), enviar `sitemap.xml` y pedir la indexación del inicio.
3. **[Perfil de Empresa de Google](https://business.google.com)** (la ficha de Google Maps): es lo que más pesa en las búsquedas locales. Mismo nombre, dirección y teléfono que la web, horarios, fotos del local y el link a la web.
4. Poner el link de la web en la bio de Instagram y en Facebook.
