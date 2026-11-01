// Configuración de la web. Es lo único que hay que tocar para pasar a producción.
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

  // Horarios para Google (datos estructurados). Si cambian, cambiarlos también en index.html.
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

  // Supabase → Project Settings → API. Si quedan vacíos, la web muestra autos de ejemplo.
  supabaseUrl: '',
  supabaseAnonKey: '',
};
