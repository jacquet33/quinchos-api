import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { crearQuinchoSchema, buscarQuinchosSchema } from '../validators/schemas';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;

const quinchoIncludes = {
  imagenes: { orderBy: { orden: 'asc' as const } },
  amenidades: { select: { amenidad: true } },
  propietario: { select: { id: true, nombre: true, avatar: true, verificado: true } },
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── BÚSQUEDA con filtros + PROXIMIDAD + COSTOS ───
export const buscarQuinchos = async (req: Request, res: Response) => {
  const filtros = buscarQuinchosSchema.parse(req.query);
  const { page, limit } = filtros;
  const skip = (page - 1) * limit;
  const where: Prisma.QuinchoWhereInput = { disponible: true };

  if (filtros.q) {
    where.OR = [
      { nombre: { contains: filtros.q, mode: 'insensitive' } },
      { ciudad: { contains: filtros.q, mode: 'insensitive' } },
      { descripcion: { contains: filtros.q, mode: 'insensitive' } },
      { direccion: { contains: filtros.q, mode: 'insensitive' } },
    ];
  }
  if (filtros.tipo && filtros.tipo !== 'todos') where.tipo = filtros.tipo as any;
  if (filtros.ciudad) where.ciudad = { contains: filtros.ciudad, mode: 'insensitive' };
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
  if (filtros.capacidadMin) where.capacidadMax = { gte: filtros.capacidadMin };
  if (filtros.amenidades) {
    const lista = filtros.amenidades.split(',').filter(Boolean);
    if (lista.length > 0) where.AND = lista.map((a) => ({ amenidades: { some: { amenidad: a as any } } }));
  }

  let orderBy: Prisma.QuinchoOrderByWithRelationInput = { calificacionProm: 'desc' };
  if (filtros.ordenarPor === 'precio_asc' || filtros.ordenarPor === 'precio') orderBy = { precioDia: 'asc' };
  else if (filtros.ordenarPor === 'precio_desc') orderBy = { precioDia: 'desc' };
  else if (filtros.ordenarPor === 'reciente') orderBy = { createdAt: 'desc' };

  const usarProximidad = filtros.lat != null && filtros.lng != null && filtros.radio != null;

  if (usarProximidad) {
    const all = await prisma.quincho.findMany({ where, include: quinchoIncludes, orderBy });
    const conDist = all
      .map((q) => ({ ...q, distanciaKm: Math.round(haversineKm(filtros.lat!, filtros.lng!, q.latitud, q.longitud) * 10) / 10 }))
      .filter((q) => q.distanciaKm <= filtros.radio!);
    if (filtros.ordenarPor === 'distancia') conDist.sort((a, b) => a.distanciaKm - b.distanciaKm);
    const total = conDist.length;
    res.json({ ok: true, data: conDist.slice(skip, skip + limit), paginacion: { total, pagina: page, porPagina: limit, totalPaginas: Math.ceil(total / limit) } });
  } else {
    const [quinchos, total] = await Promise.all([
      prisma.quincho.findMany({ where, include: quinchoIncludes, orderBy, skip, take: limit }),
      prisma.quincho.count({ where }),
    ]);
    res.json({ ok: true, data: quinchos, paginacion: { total, pagina: page, porPagina: limit, totalPaginas: Math.ceil(total / limit) } });
  }
};

// ─── MAPA ───
export const quinchosParaMapa = async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string) || null;
  const lng = parseFloat(req.query.lng as string) || null;
  const radio = parseFloat(req.query.radio as string) || 50;
  const quinchos = await prisma.quincho.findMany({
    where: { disponible: true },
    select: { id: true, nombre: true, tipo: true, latitud: true, longitud: true, precioDia: true, precioHora: true, calificacionProm: true, totalResenas: true, direccion: true, ciudad: true, capacidadMax: true, imagenes: { take: 1, orderBy: { orden: 'asc' } } },
  });
  let resultado;
  if (lat && lng) {
    resultado = quinchos.map((q) => ({ ...q, distanciaKm: Math.round(haversineKm(lat, lng, q.latitud, q.longitud) * 10) / 10 })).filter((q) => q.distanciaKm <= radio).sort((a, b) => a.distanciaKm - b.distanciaKm);
  } else {
    resultado = quinchos.map((q) => ({ ...q, distanciaKm: null }));
  }
  res.json({ ok: true, total: resultado.length, data: resultado });
};

// ─── DESTACADOS ───
export const obtenerDestacados = async (_req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({ where: { disponible: true, calificacionProm: { gte: 4.0 } }, include: quinchoIncludes, orderBy: { calificacionProm: 'desc' }, take: 10 });
  res.json({ ok: true, data: quinchos });
};

// ─── DETALLE ───
export const obtenerQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({
    where: { id: pid(req) },
    include: { ...quinchoIncludes, resenas: { include: { usuario: { select: { id: true, nombre: true, avatar: true } } }, orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  const cercanos = await prisma.quincho.findMany({ where: { id: { not: quincho.id }, disponible: true }, include: { imagenes: { take: 1, orderBy: { orden: 'asc' } } } });
  const quinchosNearby = cercanos.map((q) => ({ id: q.id, nombre: q.nombre, tipo: q.tipo, precioDia: q.precioDia, calificacionProm: q.calificacionProm, imagen: q.imagenes[0]?.url ?? null, distanciaKm: Math.round(haversineKm(quincho.latitud, quincho.longitud, q.latitud, q.longitud) * 10) / 10 })).filter((q) => q.distanciaKm <= 30).sort((a, b) => a.distanciaKm - b.distanciaKm).slice(0, 5);
  res.json({ ok: true, data: { ...quincho, quinchosNearby } });
};

// ─── ALTA ───
export const crearQuincho = async (req: Request, res: Response) => {
  const data = crearQuinchoSchema.parse(req.body);
  const quincho = await prisma.quincho.create({
    data: {
      nombre: data.nombre, descripcion: data.descripcion, direccion: data.direccion, ciudad: data.ciudad, provincia: data.provincia,
      latitud: data.latitud, longitud: data.longitud, precioHora: data.precioHora, precioDia: data.precioDia,
      capacidadMin: data.capacidadMin, capacidadMax: data.capacidadMax, tipo: data.tipo,
      horarioApertura: data.horarioApertura, horarioCierre: data.horarioCierre, propietarioId: req.user!.userId,
      imagenes: data.imagenes ? { create: data.imagenes.map((url, i) => ({ url, orden: i })) } : undefined,
      amenidades: data.amenidades ? { create: data.amenidades.map((a) => ({ amenidad: a })) } : undefined,
    },
    include: quinchoIncludes,
  });
  res.status(201).json({ ok: true, data: quincho });
};

// ─── MODIFICACIÓN ───
export const actualizarQuincho = async (req: Request, res: Response) => {
  const id = pid(req);
  const quincho = await prisma.quincho.findUnique({ where: { id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'No sos el propietario');

  const { imagenes, amenidades, ...campos } = req.body;
  await prisma.quincho.update({ where: { id }, data: campos });

  if (imagenes && Array.isArray(imagenes)) {
    await prisma.quinchoImagen.deleteMany({ where: { quinchoId: id } });
    await prisma.quinchoImagen.createMany({ data: imagenes.map((url: string, i: number) => ({ quinchoId: id, url, orden: i })) });
  }
  if (amenidades && Array.isArray(amenidades)) {
    await prisma.quinchoAmenidad.deleteMany({ where: { quinchoId: id } });
    await prisma.quinchoAmenidad.createMany({ data: amenidades.map((a: string) => ({ quinchoId: id, amenidad: a as any })) });
  }
  const result = await prisma.quincho.findUnique({ where: { id }, include: quinchoIncludes });
  res.json({ ok: true, data: result });
};

// ─── BAJA ───
export const eliminarQuincho = async (req: Request, res: Response) => {
  const id = pid(req);
  const quincho = await prisma.quincho.findUnique({ where: { id }, include: { reservas: { where: { estado: { in: ['PENDIENTE', 'CONFIRMADA'] } } } } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'No sos el propietario');
  if (quincho.reservas.length > 0) throw new AppError(400, `No se puede eliminar: hay ${quincho.reservas.length} reserva(s) activa(s)`);

  if (req.query.hard === 'true') {
    await prisma.quincho.delete({ where: { id } });
    res.json({ ok: true, message: 'Quincho eliminado permanentemente' });
  } else {
    await prisma.quincho.update({ where: { id }, data: { disponible: false } });
    res.json({ ok: true, message: 'Quincho desactivado' });
  }
};

// ─── IMÁGENES ───
export const agregarImagenes = async (req: Request, res: Response) => {
  const id = pid(req);
  const quincho = await prisma.quincho.findUnique({ where: { id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'No sos el propietario');
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) throw new AppError(400, 'Enviar urls: string[]');
  const maxOrden = await prisma.quinchoImagen.findFirst({ where: { quinchoId: id }, orderBy: { orden: 'desc' } });
  const startOrden = (maxOrden?.orden ?? -1) + 1;
  await prisma.quinchoImagen.createMany({ data: urls.map((url: string, i: number) => ({ quinchoId: id, url, orden: startOrden + i })) });
  const imagenes = await prisma.quinchoImagen.findMany({ where: { quinchoId: id }, orderBy: { orden: 'asc' } });
  res.json({ ok: true, data: imagenes });
};

export const eliminarImagen = async (req: Request, res: Response) => {
  const imagenId = pid(req, 'imagenId');
  const imagen = await prisma.quinchoImagen.findUnique({ where: { id: imagenId }, include: { quincho: { select: { propietarioId: true } } } });
  if (!imagen) throw new AppError(404, 'Imagen no encontrada');
  if (imagen.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'No sos el propietario');
  await prisma.quinchoImagen.delete({ where: { id: imagenId } });
  res.json({ ok: true, message: 'Imagen eliminada' });
};

// ─── MIS QUINCHOS ───
export const misQuinchos = async (req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({ where: { propietarioId: req.user!.userId }, include: { ...quinchoIncludes, _count: { select: { reservas: true, resenas: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, data: quinchos });
};

// ─── REACTIVAR ───
export const reactivarQuincho = async (req: Request, res: Response) => {
  const id = pid(req);
  const quincho = await prisma.quincho.findUnique({ where: { id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'No sos el propietario');
  await prisma.quincho.update({ where: { id }, data: { disponible: true } });
  res.json({ ok: true, message: 'Quincho reactivado' });
};

// ─── FAVORITOS ───
export const toggleFavorito = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const userId = req.user!.userId;
  const existe = await prisma.favorito.findUnique({ where: { usuarioId_quinchoId: { usuarioId: userId, quinchoId } } });
  if (existe) { await prisma.favorito.delete({ where: { id: existe.id } }); res.json({ ok: true, favorito: false }); }
  else { await prisma.favorito.create({ data: { usuarioId: userId, quinchoId } }); res.json({ ok: true, favorito: true }); }
};

export const misFavoritos = async (req: Request, res: Response) => {
  const favoritos = await prisma.favorito.findMany({ where: { usuarioId: req.user!.userId }, include: { quincho: { include: quinchoIncludes } }, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, data: favoritos.map((f) => f.quincho) });
};
