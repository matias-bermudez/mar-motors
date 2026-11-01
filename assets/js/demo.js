// Autos de ejemplo. Se usan solo mientras Supabase no está configurado.
const base = { estado: 'disponible', publicado: true, moneda: 'USD', fotos: [], descripcion: '' };

export const DEMO_AUTOS = [
  {
    ...base, id: 1, marca: 'Chevrolet', modelo: 'Onix LT 1.4', anio: 2019, km: 68000, precio: 13900,
    carroceria: 'hatch', combustible: 'Nafta', caja: 'Manual', motor: '1.4', color: 'Gris', puertas: 5,
    descripcion: 'Único dueño, service al día en concesionario. Aire, dirección asistida, levantavidrios eléctricos y pantalla con Android Auto / Apple CarPlay.\n\nSe puede ver y probar en el local.',
  },
  { ...base, id: 2, marca: 'Volkswagen', modelo: 'Amarok Highline 2.0 4x4', anio: 2017, km: 112000, precio: 27500, carroceria: 'pickup', combustible: 'Diésel', caja: 'Automática', motor: '2.0', color: 'Blanco', puertas: 4 },
  { ...base, id: 3, marca: 'Toyota', modelo: 'Corolla XEI 2.0', anio: 2018, km: 81000, precio: 19900, carroceria: 'sedan', combustible: 'Nafta', caja: 'Automática', motor: '2.0', color: 'Negro', puertas: 4, estado: 'reservado' },
  { ...base, id: 4, marca: 'Hyundai', modelo: 'Creta 1.6 Premium', anio: 2020, km: 45000, precio: 21500, carroceria: 'suv', combustible: 'Nafta', caja: 'Automática', motor: '1.6', color: 'Rojo', puertas: 5 },
  { ...base, id: 5, marca: 'Fiat', modelo: 'Fiorino 1.4 Furgón', anio: 2016, km: 134000, precio: 9800, carroceria: 'utilitario', combustible: 'Nafta', caja: 'Manual', motor: '1.4', color: 'Blanco', puertas: 3 },
  { ...base, id: 6, marca: 'Suzuki', modelo: 'Swift 1.2 GL', anio: 2021, km: 32000, precio: 15400, carroceria: 'hatch', combustible: 'Nafta', caja: 'Manual', motor: '1.2', color: 'Azul', puertas: 5 },
  { ...base, id: 7, marca: 'Peugeot', modelo: '208 Active 1.6', anio: 2015, km: 99000, precio: 9900, carroceria: 'hatch', combustible: 'Nafta', caja: 'Manual', motor: '1.6', color: 'Plata', puertas: 5, estado: 'vendido' },
];
