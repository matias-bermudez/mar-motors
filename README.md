# Mar Motors

Web de la Automotora Mar Motors (Montevideo): catálogo de autos, ficha de cada auto, consultas por WhatsApp, formulario para vender o permutar y panel para cargar autos.

- **Inicio**: `index.html`: hero, patio con filtros, financiación, vendé/permutá y horarios.
- **Ficha del auto**: en la web publicada cada auto tiene su página (`autos/12-chevrolet-onix-lt-1-4-2019/`); probando en la compu es `auto.html?id=12`.
- **Panel del administrador**: `admin/`

Es una web estática (HTML + CSS + JS). El backend es [Supabase](https://supabase.com): base de datos, fotos y login del administrador, todo dentro del plan gratis. Al publicar, `scripts/build.mjs` arma las páginas de los autos y lo que necesita Google (ver «SEO»). El diseño original (Claude Design) está en `diseno/`.

**Web de prueba:** https://matias-bermudez.github.io/mar-motors/ (en modo prueba: no aparece en Google).

## Probarla en tu compu

```bash
python3 -m http.server 8000
```

Abrí http://localhost:8000. Sin Supabase configurado la web muestra 7 autos de ejemplo, y los botones y el formulario ya abren WhatsApp.

Para ver la versión publicada (con las páginas de cada auto): `node scripts/build.mjs` y servir la carpeta `_site/`.

## WhatsApp

Todos los botones, fichas y formularios mandan al número de `assets/js/config.js`:

```js
whatsapp: { display: '091 969 322', intl: '59891969322' },   // prueba
// whatsapp: { display: '099 322 937', intl: '59899322937' }, // número real del local
```

Qué mensaje llega en cada caso:

- **Consultar un auto** (tarjeta o ficha): marca, modelo, año, km, precio, `Ref. #id` y el **link de la publicación**, así no hay dudas de qué auto es.
- **Financiarlo**: lo mismo, pidiendo opciones de financiación.
- **Vender / permutar mi auto**: la ficha completa (auto, año, km, combustible, caja, precio pretendido o qué busca, si financia la diferencia, nombre y celular), y al final avisa que a continuación manda las fotos. La web le pide a la persona que adjunte las fotos en ese mismo chat.
- Si entra a permutar desde la ficha de un auto, el mensaje también incluye el auto que le interesa y su link.

Los links usan `api.whatsapp.com/send` y no `wa.me`, porque la redirección de `wa.me` rompe los emojis del mensaje.

## Conectar Supabase (una vez, ~5 minutos)

1. Creá un proyecto en https://supabase.com (plan Free, región São Paulo).
2. **SQL Editor** → pegá todo `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user**: email y contraseña del administrador (marcá *Auto Confirm User*). Después, en el SQL Editor:
   ```sql
   insert into public.admins (email) values ('el-email-del-admin@ejemplo.com');
   ```
   Solo los emails de la tabla `admins` pueden cargar, editar o borrar autos.
4. **Authentication → Sign In / Providers**: desactivá *Allow new users to sign up*.
5. **Project Settings → API**: copiá la *Project URL* y la clave *anon public* en `assets/js/config.js` (`supabaseUrl` y `supabaseAnonKey`).

La clave *anon* puede quedar en el código: los permisos (RLS) hacen que la web solo pueda leer autos publicados. Escribir requiere estar logueado en `admin/` con un email de la tabla `admins`.

## Panel (`/admin`)

- Cargar, editar y borrar autos: marca, modelo y versión, año, km, carrocería, combustible, caja, motor, color, puertas, descripción.
- Precio en U$S o pesos (vacío = «Consultar»), estado (disponible / reservado / vendido) y publicado u oculto.
- Fotos: se achican en el navegador antes de subir (~300 KB c/u), se ordenan con flechas y la primera es la portada.
- Desde el listado: cambiar estado, publicar/ocultar, ver la ficha y copiar el link para compartir.
- Los autos ocultos solo los ve el admin (sirve para dejarlos listos antes de publicarlos). Los vendidos quedan en la web marcados como «Vendido» hasta que los ocultes o borres.

## Otros datos del local

En `assets/js/config.js`: teléfono fijo, otros celulares, dirección y barrio (con dirección aparece el mapa de Google), redes sociales y el bloque de renovación MiAuto (`mostrarRenovacion`).

## Publicar (GitHub Pages)

Cada push a `main` dispara `.github/workflows/deploy.yml`, que corre `scripts/build.mjs` y publica `_site/` en GitHub Pages. También corre **cada hora**, así los autos que se cargan en el panel tienen su página propia (para Google y para la vista previa de WhatsApp) sin tocar el código. Un auto recién cargado igual se puede abrir y compartir enseguida: hasta que se genera su página, el link lo lleva a la ficha dinámica.

- Settings → Pages → Source: **GitHub Actions** (ya configurado).
- Para publicar a mano: pestaña Actions → «Publicar» → *Run workflow*.
- GitHub pausa los workflows programados si el repo pasa 60 días sin actividad: si pasa, se reactiva desde la pestaña Actions.

**Opcional: actualizar al instante.** Para que cada cambio del panel se publique en ~1 minuto en vez de esperar a la hora:

1. GitHub → Settings → Developer settings → *Fine-grained tokens*: token solo para este repo, permiso **Contents: Read and write**.
2. Supabase → Database → Webhooks → *Create*: tabla `autos`, eventos insert/update/delete, *HTTP Request* `POST https://api.github.com/repos/matias-bermudez/mar-motors/dispatches`, headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json` y body `{"event_type":"autos"}`.

### Dominio propio

Con un dominio (por ejemplo `marmotors.com.uy`): poné `sitioUrl: 'https://www.marmotors.com.uy/'` en `config.js` (el build genera el `CNAME`), configurá el DNS como indica GitHub (Settings → Pages → Custom domain) y activá *Enforce HTTPS*. La dirección de github.io pasa a redirigir al dominio.

## SEO

La web está preparada para aparecer en búsquedas como «automotora Montevideo», «autos usados Montevideo», «Mar Motors» o el modelo de un auto («Onix 2019 usado Montevideo»):

- **Una página por auto**, con dirección legible (`autos/12-chevrolet-onix-lt-1-4-2019/`), título y descripción propios y el contenido ya escrito en el HTML: Google lo lee sin ejecutar JavaScript.
- **Inicio** con los autos ya escritos en el HTML y textos pensados para las búsquedas locales.
- **Datos estructurados** (schema.org): `AutoDealer` con teléfono, horarios, zona y redes; cada auto como `Car` con precio, km, año, combustible, caja y disponibilidad, más las migas de pan.
- `sitemap.xml`, `canonical` en cada página, Open Graph (foto del auto en la vista previa de WhatsApp y Facebook).
- Los autos vendidos, la ficha dinámica `auto.html` y la página 404 no van a Google. El panel tampoco.
- Rápida: fuentes servidas desde el sitio (con precarga) y fotos achicadas y con carga diferida.

### Modo prueba → lanzamiento

Mientras `indexar: false` (en `config.js`), todas las páginas llevan `noindex`: se pueden abrir con el link, pero Google no las muestra. GitHub Pages no tiene un modo privado en cuentas gratis, así que la web es pública para quien tenga el link.

Al lanzar:

1. `indexar: true` y los datos reales (WhatsApp, dirección) en `config.js`. Mejor si ya está el dominio propio.
2. [Google Search Console](https://search.google.com/search-console): agregar la propiedad, verificar con la etiqueta HTML (el código va en `googleVerificacion`), enviar `sitemap.xml` y pedir la indexación del inicio.
3. **[Perfil de Empresa de Google](https://business.google.com)** (la ficha de Google Maps): es lo que más pesa en las búsquedas locales. Mismo nombre, dirección y teléfono que la web, horarios, fotos del local y el link a la web.
4. Poner el link de la web en la bio de Instagram y en Facebook.
