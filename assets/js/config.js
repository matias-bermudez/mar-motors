// Configuración de la web. Es lo único que hay que tocar para pasar a producción.
// El WhatsApp, los teléfonos, la dirección, los horarios, las zonas y las redes los puede cambiar el dueño
// desde el panel («Datos del negocio», tabla `negocios`): al publicar, lo que esté cargado ahí pisa lo de acá
// (ver deNegocio en modelo.js). Lo de acá queda para lo que el dueño no cargó.
export const CONFIG = {
  // Número que recibe TODOS los WhatsApp de la web (botones, fichas y formulario).
  // PRUEBA: 091 969 322. Número real del local: { display: '099 322 937', intl: '59899322937' }
  whatsapp: { display: '091 969 322', intl: '59891969322' },

  telefonoFijo: { display: '2303 6119', intl: '59823036119' },
  otrosCelulares: [
    { display: '099 455 516', intl: '59899455516' },
    { display: '091 885 777', intl: '59891885777' },
    { display: '099 937 215', intl: '59899937215' },
  ],

  // Dirección del local. Si queda vacía se muestra el lugar reservado del diseño; con dirección aparece el mapa.
  direccion: '',          // 'Av. Ejemplo 1234'
  barrio: '',             // 'Cerrito'

  redes: {
    instagram: { url: 'https://www.instagram.com/automotoramarmotor/', label: '@automotoramarmotor' },
    facebook: { url: '', label: 'Automotora Mar Motors' }, // vacío = no se muestra
    tiktok: { url: '', label: 'TikTok' },
  },

  // Dónde vende (para Google: areaServed). Separadas por coma.
  zonas: 'Montevideo',

  // Horarios: la franja de arriba, la grilla de «Vení a verlos» y los datos para Google salen de acá.
  horarios: [
    { dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], abre: '09:30', cierra: '19:00' },
    { dias: ['Saturday'], abre: '10:00', cierra: '14:00' },
    { dias: ['Sunday'], abre: '09:30', cierra: '13:30' },
  ],

  // ── SEO ──
  // Dirección pública de la web, con / al final. Se usa en Google, el sitemap y las vistas previas de WhatsApp.
  // Con dominio propio: 'https://www.marmotors.com.uy/' (y el archivo CNAME, ver README).
  sitioUrl: 'https://matias-bermudez.github.io/mar-motors/',
  // false = modo prueba: la web se puede abrir con el link pero Google no la indexa. Al lanzar, poner true.
  indexar: false,
  // Google Search Console → verificación por etiqueta HTML: solo el código del content="…".
  googleVerificacion: '',

  // Bloque "¿Ya cumpliste un año con tu préstamo en MiAuto?"
  mostrarRenovacion: true,

  // Base compartida de la Plataforma Automotoras (~/Proyectos/plataforma-automotoras): un solo Supabase
  // para todas las automotoras. `concesionaria` = id de Mar Motors en la base (filtra autos, fotos y permisos).
  // La clave es la publishable: va en el código, los permisos los pone la base (RLS).
  // La web pública no consulta Supabase: el build lee los autos y baja las fotos. Solo el panel lo usa en vivo.
  supabaseUrl: 'https://dfunhdfvtmsmjdzpnhas.supabase.co',
  supabaseKey: 'sb_publishable_4Q-GxNAtPB894PRurMLwkQ_2NRVIjWg',
  concesionaria: 'mar-motors',
};
