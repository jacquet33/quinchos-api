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

// ─── Buscar quinchos con filtros ───
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
    ];
  }

  if (filtros.tipo && filtros.tipo !== 'todos') {
    where.tipo = filtros.tipo as any;
  }

  if (filtros.ciudad) {
    where.ciudad = { contains: filtros.ciudad, mode: 'insensitive' };
  }

  if (filtros.precioMin || filtros.precioMax) {
    where.precioDia = {};
    if (filtros.precioMin) where.precioDia.gte = filtros.precioMin;
    if (filtros.precioMax) where.precioDia.lte = filtros.precioMax;
  }

  if (filtros.capacidadMin) {
    where.capacidadMax = { gte: filtros.capacidadMin };
  }

  if (filtros.amenidades) {
    const lista = filtros.amenidades.split(',');
    where.amenidades = {
      some: { amenidad: { in: lista as any } },
    };
  }

  let orderBy: Prisma.QuinchoOrderByWithRelationInput = { calificacionProm: 'desc' };
  if (filtros.ordenarPor === 'precio') orderBy = { precioDia: 'asc' };
  else if (filtros.ordenarPor === 'reciente') orderBy = { createdAt: 'desc' };

  const [quinchos, total] = await Promise.all([
    prisma.quincho.findMany({
      where,
      include: quinchoIncludes,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.quincho.count({ where }),
  ]);

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

// ─── Destacados ───
export const obtenerDestacados = async (_req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({
    where: { disponible: true, calificacionProm: { gte: 4.0 } },
    include: quinchoIncludes,
    orderBy: { calificacionProm: 'desc' },
    take: 10,
  });

  res.json({ ok: true, data: quinchos });
};

// ─── Detalle de un quincho ───
export const obtenerQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({
    where: { id: req.params.id },
    include: {
      ...quinchoIncludes,
      resenas: {
        include: {
          usuario: { select: { id: true, nombre: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!quincho) throw new AppError(404, 'Quincho no encontrado');

  res.json({ ok: true, data: quincho });
};

// ─── Crear quincho (propietario) ───
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

// ─── Actualizar quincho (propietario) ───
export const actualizarQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({ where: { id: req.params.id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario de este quincho');
  }

  const actualizado = await prisma.quincho.update({
    where: { id: req.params.id },
    data: req.body,
    include: quinchoIncludes,
  });

  res.json({ ok: true, data: actualizado });
};

// ─── Eliminar quincho ───
export const eliminarQuincho = async (req: Request, res: Response) => {
  const quincho = await prisma.quincho.findUnique({ where: { id: req.params.id } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario de este quincho');
  }

  await prisma.quincho.delete({ where: { id: req.params.id } });

  res.json({ ok: true, message: 'Quincho eliminado' });
};

// ─── Mis quinchos (propietario) ───
export const misQuinchos = async (req: Request, res: Response) => {
  const quinchos = await prisma.quincho.findMany({
    where: { propietarioId: req.user!.userId },
    include: quinchoIncludes,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ ok: true, data: quinchos });
};

// ─── Favoritos ───
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
    include: {
      quincho: { include: quinchoIncludes },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ ok: true, data: favoritos.map((f) => f.quincho) });
};
