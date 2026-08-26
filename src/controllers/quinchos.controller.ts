import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { crearQuinchoSchema, buscarQuinchosSchema } from '../validators/schemas';

// ─── Includes reutilizables ───
const quinchoIncludes = {
  imagenes: { orderBy: { orden: 'asc' as const } },
  amenidades: { select: { amenidad: true } },
  propietario: {
    select: { id: true, nombre: true, avatar: true, verificado: true },
  },
};

// ─── Haversine: distancia en km entre dos coordenadas ───
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════
// BÚSQUEDA con filtros + PROXIMIDAD + COSTOS
// ═══════════════════════════════════════════

export const buscarQuinchos = async (req: Request, res: Response) => {
  const filtros = buscarQuinchosSchema.parse(req.query);
  const { page, limit } = filtros;
  const skip = (page - 1) * limit;

  const where: Prisma.QuinchoWhereInput = { disponible: true };

  // Texto libre
  if (filtros.q) {
    where.OR = [
      { nombre: { contains: filtros.q, mode: 'insensitive' } },
      { ciudad: { contains: filtros.q, mode: 'insensitive' } },
      { descripcion: { contains: filtros.q, mode: 'insensitive' } },
      { direccion: { contains: filtros.q, mode: 'insensitive' } },
    ];
  }

  // Tipo
  if (filtros.tipo && filtros.tipo !== 'todos') {
    where.tipo = filtros.tipo as any;
  }

  // Ciudad
  if (filtros.ciudad) {
    where.ciudad = { contains: filtros.ciudad, mode: 'insensitive' };
  }

  // ─── FILTROS DE COSTO (por hora y por día) ───
  if (filtros.precioMin || filtros.precioMax) {
    where.precioDia = {};
    if (filtros.precioMin) where.precioDia.gte = filtros.precioMin;
    if (filtros.precioMax) where.precioDia.lte = filtros.precioMax;
  }

  if (filtros.precioHoraMin || filtros.precioHoraMax) {
    where.precioHora = {};
    if (filtros.precioHoraMin) where.precioHora.gte = filtros.precioHoraMin;
    if (filtros.precioHoraMax) where.precioHora.lte = filtros.precioHoraMax;
  }

  // Capacidad
  if (filtros.capacidadMin) {
    where.capacidadMax = { gte: filtros.capacidadMin };
  }

  // Amenidades (AND: todas deben estar)
  if (filtros.amenidades) {
    const lista = filtros.amenidades.split(',').filter(Boolean);
    if (lista.length > 0) {
      where.AND = lista.map((amenidad) => ({
        amenidades: { some: { amenidad: amenidad as any } },
      }));
    }
  }

  // Orden
  let orderBy: Prisma.QuinchoOrderByWithRelationInput = { calificacionProm: 'desc' };
  if (filtros.ordenarPor === 'precio_asc') orderBy = { precioDia: 'asc' };
  else if (filtros.ordenarPor === 'precio_desc') orderBy = { precioDia: 'desc' };
  else if (filtros.ordenarPor === 'reciente') orderBy = { createdAt: 'desc' };
  else if (filtros.ordenarPor === 'precio') orderBy = { precioDia: 'asc' };

  // Buscar todos (sin paginar) si necesitamos filtrar por distancia
  const usarProximidad = filtros.lat != null && filtros.lng != null && filtros.radio != null;

  let quinchos;
  let total: number;

  if (usarProximidad) {
    // ─── BÚSQUEDA POR PROXIMIDAD (Haversine) ───
    const allQuinchos = await prisma.quincho.findMany({
      where,
      include: quinchoIncludes,
      orderBy,
    });

    const lat = filtros.lat!;
    const lng = filtros.lng!;
    const radioKm = filtros.radio!;

    const conDistancia = allQuinchos
      .map((q) => ({
        ...q,
        distanciaKm: Math.round(haversineKm(lat, lng, q.latitud, q.longitud) * 10) / 10,
      }))
      .filter((q) => q.distanciaKm <= radioKm);

    // Ordenar por distancia si se pidió proximidad
    if (filtros.ordenarPor === 'distancia' || filtros.ordenarPor === 'calificacion') {
      conDistancia.sort((a, b) =>
        filtros.ordenarPor === 'distancia'
          ? a.distanciaKm - b.distanciaKm
          : b.calificacionProm - a.calificacionProm
      );
    }

    total = conDistancia.length;
    quinchos = conDistancia.slice(skip, skip + limit);
  } else {
    [quinchos, total] = await Promise.all([
      prisma.quincho.findMany({ where, include: quinchoIncludes, orderBy, skip, take: limit }),
      prisma.quincho.count({ where }),
    ]);
  }

  res.json({
    ok: true,
    data: quinchos,
    paginacion: {
      total,
      pagina: page,
      porPagina: limit,
      totalPaginas: Math.ceil(total / limit),
    },
  });
};

// ═══════════════════════════════════════
// MAPA: todos los quinchos con coordenadas
// ═══════════════════════════════════════

export const quinchosParaMapa = async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string) || null;
  const lng = parseFloat(req.query.lng as string) || null;
  const radio = parseFloat(req.query.radio as string) || 50; // km, default 50

  const quinchos = await prisma.quincho.findMany({
    where: { disponible: true },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      latitud: true,
      longitud: true,
      precioDia: true,
      precioHora: true,
      calificacionProm: true,
      totalResenas: true,
      direccion: true,
      ciudad: true,
      capacidadMax: true,
      imagenes: { take: 1, orderBy: { orden: 'asc' } },
    },
  });

  let resultado;
  if (lat && lng) {
    resultado = quinchos
      .map((q) => ({
        ...q,
        distanciaKm: Math.round(haversineKm(lat, lng, q.latitud, q.longitud) * 10) / 10,
      }))
      .filter((q) => q.distanciaKm <= radio)
      .sort((a, b) => a.distanciaKm - b.distanciaKm);
  } else {
    resultado = quinchos.map((q) => ({ ...q, distanciaKm: null }));
  }

  res.json({
    ok: true,
    total: resultado.length,
    data: resultado,
  });
};

// ═══════════════
// DESTACADOS
// ═══════════════

export const obtenerDestacados = async (_req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({
    where: { disponible: true, calificacionProm: { gte: 4.0 } },
    include: quinchoIncludes,
    orderBy: { calificacionProm: 'desc' },
    take: 10,
  });
  res.json({ ok: true, data: quinchos });
};

// ═══════════════
// DETALLE
// ═══════════════

export const obtenerQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({
    where: { id: req.params.id },
    include: {
      ...quinchoIncludes,
      resenas: {
        include: { usuario: { select: { id: true, nombre: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');

  // Agregar quinchos cercanos
  const cercanos = await prisma.quincho.findMany({
    where: { id: { not: quincho.id }, disponible: true },
    include: { imagenes: { take: 1, orderBy: { orden: 'asc' } } },
  });

  const quinchosNearby = cercanos
    .map((q) => ({
      id: q.id,
      nombre: q.nombre,
      tipo: q.tipo,
      precioDia: q.precioDia,
      calificacionProm: q.calificacionProm,
      imagen: q.imagenes[0]?.url ?? null,
      distanciaKm: Math.round(haversineKm(quincho.latitud, quincho.longitud, q.latitud, q.longitud) * 10) / 10,
    }))
    .filter((q) => q.distanciaKm <= 30)
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, 5);

  res.json({ ok: true, data: { ...quincho, quinchosNearby } });
};

// ═══════════════════════════════════
// ABM COMPLETO (Alta/Baja/Modificación)
// ═══════════════════════════════════

// ─── ALTA: Crear quincho ───
export const crearQuincho = async (req: Request, res: Response) => {
  const data = crearQuinchoSchema.parse(req.body);

  const quincho = await prisma.quincho.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      direccion: data.direccion,
      ciudad: data.ciudad,
      provincia: data.provincia,
      latitud: data.latitud,
      longitud: data.longitud,
      precioHora: data.precioHora,
      precioDia: data.precioDia,
      capacidadMin: data.capacidadMin,
      capacidadMax: data.capacidadMax,
      tipo: data.tipo,
      horarioApertura: data.horarioApertura,
      horarioCierre: data.horarioCierre,
      propietarioId: req.user!.userId,
      imagenes: data.imagenes
        ? { create: data.imagenes.map((url, i) => ({ url, orden: i })) }
        : undefined,
      amenidades: data.amenidades
        ? { create: data.amenidades.map((a) => ({ amenidad: a })) }
        : undefined,
    },
    include: quinchoIncludes,
  });

  res.status(201).json({ ok: true, data: quincho });
};

// ─── MODIFICACIÓN: Actualizar quincho ───
export const actualizarQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({ where: { id: req.params.id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario de este quincho');
  }

  const { imagenes, amenidades, ...campos } = req.body;

  // Actualizar campos básicos
  const actualizado = await prisma.quincho.update({
    where: { id: req.params.id },
    data: campos,
    include: quinchoIncludes,
  });

  // Si vienen imágenes, reemplazar todas
  if (imagenes && Array.isArray(imagenes)) {
    await prisma.quinchoImagen.deleteMany({ where: { quinchoId: req.params.id } });
    await prisma.quinchoImagen.createMany({
      data: imagenes.map((url: string, i: number) => ({
        quinchoId: req.params.id,
        url,
        orden: i,
      })),
    });
  }

  // Si vienen amenidades, reemplazar todas
  if (amenidades && Array.isArray(amenidades)) {
    await prisma.quinchoAmenidad.deleteMany({ where: { quinchoId: req.params.id } });
    await prisma.quinchoAmenidad.createMany({
      data: amenidades.map((a: string) => ({
        quinchoId: req.params.id,
        amenidad: a as any,
      })),
    });
  }

  // Retornar actualizado con includes
  const result = await prisma.quincho.findUnique({
    where: { id: req.params.id },
    include: quinchoIncludes,
  });

  res.json({ ok: true, data: result });
};

// ─── BAJA: Eliminar quincho ───
export const eliminarQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({
    where: { id: req.params.id },
    include: { reservas: { where: { estado: { in: ['PENDIENTE', 'CONFIRMADA'] } } } },
  });

  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario de este quincho');
  }

  // No permitir eliminar si tiene reservas activas
  if (quincho.reservas.length > 0) {
    throw new AppError(400, `No se puede eliminar: hay ${quincho.reservas.length} reserva(s) activa(s). Cancelalas primero.`);
  }

  // Soft delete (marcar como no disponible) o hard delete
  if (req.query.hard === 'true') {
    await prisma.quincho.delete({ where: { id: req.params.id } });
    res.json({ ok: true, message: 'Quincho eliminado permanentemente' });
  } else {
    await prisma.quincho.update({
      where: { id: req.params.id },
      data: { disponible: false },
    });
    res.json({ ok: true, message: 'Quincho desactivado' });
  }
};

// ─── Agregar imágenes a un quincho ───
export const agregarImagenes = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({ where: { id: req.params.id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) throw new AppError(400, 'Enviar urls: string[]');

  const maxOrden = await prisma.quinchoImagen.findFirst({
    where: { quinchoId: req.params.id },
    orderBy: { orden: 'desc' },
  });

  const startOrden = (maxOrden?.orden ?? -1) + 1;

  await prisma.quinchoImagen.createMany({
    data: urls.map((url: string, i: number) => ({
      quinchoId: req.params.id,
      url,
      orden: startOrden + i,
    })),
  });

  const imagenes = await prisma.quinchoImagen.findMany({
    where: { quinchoId: req.params.id },
    orderBy: { orden: 'asc' },
  });

  res.json({ ok: true, data: imagenes });
};

// ─── Eliminar imagen ───
export const eliminarImagen = async (req: Request, res: Response) => {
  const imagen = await prisma.quinchoImagen.findUnique({
    where: { id: req.params.imagenId },
    include: { quincho: { select: { propietarioId: true } } },
  });

  if (!imagen) throw new AppError(404, 'Imagen no encontrada');
  if (imagen.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  await prisma.quinchoImagen.delete({ where: { id: req.params.imagenId } });
  res.json({ ok: true, message: 'Imagen eliminada' });
};

// ─── Mis quinchos (propietario) ───
export const misQuinchos = async (req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({
    where: { propietarioId: req.user!.userId },
    include: {
      ...quinchoIncludes,
      _count: { select: { reservas: true, resenas: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, data: quinchos });
};

// ─── Reactivar quincho ───
export const reactivarQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({ where: { id: req.params.id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  await prisma.quincho.update({ where: { id: req.params.id }, data: { disponible: true } });
  res.json({ ok: true, message: 'Quincho reactivado' });
};

// ═══════════════
// FAVORITOS
// ═══════════════

export const toggleFavorito = async (req: Request, res: Response) => {
  const { quinchoId } = req.params;
  const userId = req.user!.userId;

  const existe = await prisma.favorito.findUnique({
    where: { usuarioId_quinchoId: { usuarioId: userId, quinchoId } },
  });

  if (existe) {
    await prisma.favorito.delete({ where: { id: existe.id } });
    res.json({ ok: true, favorito: false });
  } else {
    await prisma.favorito.create({ data: { usuarioId: userId, quinchoId } });
    res.json({ ok: true, favorito: true });
  }
};

export const misFavoritos = async (req: Request, res: Response) => {
  const favoritos = await prisma.favorito.findMany({
    where: { usuarioId: req.user!.userId },
    include: { quincho: { include: quinchoIncludes } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, data: favoritos.map((f) => f.quincho) });
};
