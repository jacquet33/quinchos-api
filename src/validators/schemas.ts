import { z } from 'zod';

// ─── Auth ───

export const registroSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  telefono: z.string().optional(),
  rol: z.enum(['USUARIO', 'PROPIETARIO']).default('USUARIO'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Quinchos ───

export const crearQuinchoSchema = z.object({
  nombre: z.string().min(3),
  descripcion: z.string().min(10),
  direccion: z.string().min(5),
  ciudad: z.string().min(2),
  provincia: z.string().min(2),
  latitud: z.number(),
  longitud: z.number(),
  precioHora: z.number().int().positive(),
  precioDia: z.number().int().positive(),
  capacidadMin: z.number().int().positive(),
  capacidadMax: z.number().int().positive(),
  tipo: z.enum(['QUINCHO', 'SALON', 'QUINTA', 'TERRAZA', 'JARDIN']),
  horarioApertura: z.string(),
  horarioCierre: z.string(),
  imagenes: z.array(z.string().url()).optional(),
  amenidades: z
    .array(
      z.enum([
        'PARRILLA', 'PILETA', 'ESTACIONAMIENTO', 'WIFI',
        'AIRE_ACONDICIONADO', 'COCINA', 'BANO', 'JUEGOS_NINOS',
        'MUSICA', 'VAJILLA', 'MESAS_SILLAS', 'SEGURIDAD', 'TECHADO',
      ])
    )
    .optional(),
});

export const buscarQuinchosSchema = z.object({
  q: z.string().optional(),
  tipo: z.enum(['QUINCHO', 'SALON', 'QUINTA', 'TERRAZA', 'JARDIN', 'todos']).optional(),
  // Filtros de costo por día
  precioMin: z.coerce.number().optional(),
  precioMax: z.coerce.number().optional(),
  // Filtros de costo por hora
  precioHoraMin: z.coerce.number().optional(),
  precioHoraMax: z.coerce.number().optional(),
  // Capacidad
  capacidadMin: z.coerce.number().optional(),
  // Amenidades (comma separated)
  amenidades: z.string().optional(),
  // Proximidad
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radio: z.coerce.number().optional(), // km
  // Orden
  ordenarPor: z.enum(['precio', 'precio_asc', 'precio_desc', 'calificacion', 'reciente', 'distancia']).optional(),
  ciudad: z.string().optional(),
  // Paginación
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// ─── Reservas ───

export const crearReservaSchema = z.object({
  quinchoId: z.string(),
  fecha: z.string().min(1, 'Fecha requerida'),
  horaInicio: z.string().min(1, 'Hora inicio requerida'),
  horaFin: z.string().min(1, 'Hora fin requerida'),
  cantidadPersonas: z.number().int().positive(),
  notas: z.string().optional(),
});

export const actualizarEstadoSchema = z.object({
  estado: z.enum(['CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'RECHAZADA']),
});

// ─── Reseñas ───

export const crearResenaSchema = z.object({
  quinchoId: z.string(),
  calificacion: z.number().int().min(1).max(5),
  comentario: z.string().min(10, 'Mínimo 10 caracteres'),
  reservaId: z.string().optional(),
});

export const responderResenaSchema = z.object({
  respuesta: z.string().min(5),
});
