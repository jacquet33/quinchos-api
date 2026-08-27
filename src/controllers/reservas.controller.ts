import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { crearReservaSchema, actualizarEstadoSchema } from '../validators/schemas';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;

const reservaIncludes = {
  quincho: { select: { id: true, nombre: true, direccion: true, ciudad: true, tipo: true, precioDia: true, imagenes: { take: 1, orderBy: { orden: 'asc' as const } } } },
  usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
};

export const crearReserva = async (req: Request, res: Response) => {
  const data = crearReservaSchema.parse(req.body);
  const quincho = await prisma.quincho.findUnique({ where: { id: data.quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (!quincho.disponible) throw new AppError(400, 'Este espacio no está disponible');
  if (data.cantidadPersonas > quincho.capacidadMax) throw new AppError(400, `Capacidad máxima: ${quincho.capacidadMax}`);
  if (data.cantidadPersonas < quincho.capacidadMin) throw new AppError(400, `Capacidad mínima: ${quincho.capacidadMin}`);
  const conflicto = await prisma.reserva.findFirst({ where: { quinchoId: data.quinchoId, fecha: new Date(data.fecha), estado: { in: ['PENDIENTE', 'CONFIRMADA'] } } });
  if (conflicto) throw new AppError(409, 'Ya existe una reserva para esa fecha');
  const reserva = await prisma.reserva.create({
    data: { fecha: new Date(data.fecha), horaInicio: data.horaInicio, horaFin: data.horaFin, cantidadPersonas: data.cantidadPersonas, precioTotal: quincho.precioDia, notas: data.notas || null, usuarioId: req.user!.userId, quinchoId: data.quinchoId },
    include: reservaIncludes,
  });
  res.status(201).json({ ok: true, data: reserva });
};

export const misReservas = async (req: Request, res: Response) => {
  const reservas = await prisma.reserva.findMany({ where: { usuarioId: req.user!.userId }, include: reservaIncludes, orderBy: { fecha: 'desc' } });
  res.json({ ok: true, data: reservas });
};

export const reservasDeMisQuinchos = async (req: Request, res: Response) => {
  const reservas = await prisma.reserva.findMany({ where: { quincho: { propietarioId: req.user!.userId } }, include: reservaIncludes, orderBy: { fecha: 'desc' } });
  res.json({ ok: true, data: reservas });
};

export const obtenerReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: reservaIncludes });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  const quincho = await prisma.quincho.findUnique({ where: { id: reserva.quinchoId }, select: { propietarioId: true } });
  if (reserva.usuarioId !== req.user!.userId && quincho?.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');
  res.json({ ok: true, data: reserva });
};

export const actualizarEstado = async (req: Request, res: Response) => {
  const { estado } = actualizarEstadoSchema.parse(req.body);
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: { quincho: { select: { propietarioId: true } } } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');
  const actualizada = await prisma.reserva.update({ where: { id: pid(req) }, data: { estado }, include: reservaIncludes });
  res.json({ ok: true, data: actualizada });
};

export const cancelarReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.usuarioId !== req.user!.userId) throw new AppError(403, 'Solo podés cancelar tus propias reservas');
  if (reserva.estado === 'CANCELADA') throw new AppError(400, 'Ya está cancelada');
  if (reserva.estado === 'COMPLETADA') throw new AppError(400, 'No se puede cancelar una completada');
  const cancelada = await prisma.reserva.update({ where: { id: pid(req) }, data: { estado: 'CANCELADA' }, include: reservaIncludes });
  res.json({ ok: true, data: cancelada });
};
