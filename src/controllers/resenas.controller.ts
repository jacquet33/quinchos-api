import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { crearResenaSchema, responderResenaSchema } from '../validators/schemas';

// ─── Crear reseña ───
export const crearResena = async (req: Request, res: Response) => {
  const data = crearResenaSchema.parse(req.body);

  // Verificar quincho
  const quincho = await prisma.quincho.findUnique({ where: { id: data.quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');

  // No puede reseñar su propio quincho
  if (quincho.propietarioId === req.user!.userId) {
    throw new AppError(400, 'No podés reseñar tu propio espacio');
  }

  // Verificar duplicado
  const yaReseno = await prisma.resena.findFirst({
    where: {
      quinchoId: data.quinchoId,
      usuarioId: req.user!.userId,
      ...(data.reservaId ? { reservaId: data.reservaId } : {}),
    },
  });
  if (yaReseno) throw new AppError(409, 'Ya dejaste una reseña para este espacio');

  const resena = await prisma.resena.create({
    data: {
      calificacion: data.calificacion,
      comentario: data.comentario,
      usuarioId: req.user!.userId,
      quinchoId: data.quinchoId,
      reservaId: data.reservaId || null,
    },
    include: {
      usuario: { select: { id: true, nombre: true, avatar: true } },
    },
  });

  // Recalcular promedio del quincho
  const agg = await prisma.resena.aggregate({
    where: { quinchoId: data.quinchoId },
    _avg: { calificacion: true },
    _count: true,
  });

  await prisma.quincho.update({
    where: { id: data.quinchoId },
    data: {
      calificacionProm: agg._avg.calificacion ?? 0,
      totalResenas: agg._count,
    },
  });

  res.status(201).json({ ok: true, data: resena });
};

// ─── Obtener reseñas de un quincho ───
export const obtenerResenas = async (req: Request, res: Response) => {
  const { quinchoId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const [resenas, total] = await Promise.all([
    prisma.resena.findMany({
      where: { quinchoId },
      include: {
        usuario: { select: { id: true, nombre: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.resena.count({ where: { quinchoId } }),
  ]);

  res.json({
    ok: true,
    data: resenas,
    paginacion: {
      total,
      pagina: page,
      porPagina: limit,
      totalPaginas: Math.ceil(total / limit),
    },
  });
};

// ─── Responder reseña (propietario) ───
export const responderResena = async (req: Request, res: Response) => {
  const { respuesta } = responderResenaSchema.parse(req.body);

  const resena = await prisma.resena.findUnique({
    where: { id: req.params.id },
    include: { quincho: { select: { propietarioId: true } } },
  });

  if (!resena) throw new AppError(404, 'Reseña no encontrada');
  if (resena.quincho.propietarioId !== req.user!.userId) {
    throw new AppError(403, 'Solo el propietario puede responder');
  }

  const actualizada = await prisma.resena.update({
    where: { id: req.params.id },
    data: { respuestaPropietario: respuesta },
  });

  res.json({ ok: true, data: actualizada });
};

// ─── Eliminar reseña (solo autor o admin) ───
export const eliminarResena = async (req: Request, res: Response) => {
  const resena = await prisma.resena.findUnique({ where: { id: req.params.id } });
  if (!resena) throw new AppError(404, 'Reseña no encontrada');

  if (resena.usuarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No podés eliminar esta reseña');
  }

  await prisma.resena.delete({ where: { id: req.params.id } });

  // Recalcular promedio
  const agg = await prisma.resena.aggregate({
    where: { quinchoId: resena.quinchoId },
    _avg: { calificacion: true },
    _count: true,
  });

  await prisma.quincho.update({
    where: { id: resena.quinchoId },
    data: {
      calificacionProm: agg._avg.calificacion ?? 0,
      totalResenas: agg._count,
    },
  });

  res.json({ ok: true, message: 'Reseña eliminada' });
};
