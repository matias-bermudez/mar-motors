# Mar Motors

Web de la Automotora Mar Motors (Montevideo): catálogo de autos, ficha de cada auto, consultas por WhatsApp, formulario para vender o permutar y panel para cargar autos.

- **Inicio**: `index.html`: hero, patio con filtros, financiación, vendé/permutá y horarios.
- **Ficha del auto**: `auto.html?id=…`: fotos, datos y botón de WhatsApp.
- **Panel del administrador**: `admin/`

Es una web estática (HTML + CSS + JS, sin build). El backend es [Supabase](https://supabase.com): base de datos, fotos y login del administrador, todo dentro del plan gratis. El diseño original (Claude Design) está en `diseno/`.

## Probarla en tu compu

```bash
python3 -m http.server 8000
```

Abrí http://localhost:8000. Sin Supabase configurado la web muestra 7 autos de ejemplo, y los botones y el formulario ya abren WhatsApp.

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

## Publicar

Cualquier hosting estático sirve, apuntando a la raíz del repo y sin comando de build:

- **Netlify** o **Vercel**: importar el repo y publicar `/`. Funciona con repo privado.
- **GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `(root)`. En cuentas gratis el repo tiene que ser público.
