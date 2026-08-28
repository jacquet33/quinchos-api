import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { crearReservaSchema, actualizarEstadoSchema } from '../validators/schemas';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;

const reservaIncludes = {
  quincho: { select: { id: true, nombre: true, direccion: true, ciudad: true, tipo: true, precioDia: true, precioHora: true, imagenes: { take: 1, orderBy: { orden: 'asc' as const } } } },
  usuario: { select: { id: true, nombre: true, email: true, telefono: true, avatar: true } },
};

// ─── Crear reserva (verificando disponibilidad) ───
export const crearReserva = async (req: Request, res: Response) => {
  const data = crearReservaSchema.parse(req.body);

  const quincho = await prisma.quincho.findUnique({ where: { id: data.quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (!quincho.disponible) throw new AppError(400, 'Espacio no disponible');
  if (data.cantidadPersonas > quincho.capacidadMax) throw new AppError(400, `Máximo ${quincho.capacidadMax} personas`);
  if (data.cantidadPersonas < quincho.capacidadMin) throw new AppError(400, `Mínimo ${quincho.capacidadMin} personas`);

  const fechaReserva = new Date(data.fecha);

  // Verificar bloqueo
  const bloqueada = await prisma.bloqueoFecha.findUnique({
    where: { quinchoId_fecha: { quinchoId: data.quinchoId, fecha: fechaReserva } },
  });
  if (bloqueada) throw new AppError(400, 'Esta fecha está bloqueada por el propietario');

  // Verificar agenda del día
  const diaSemana = fechaReserva.getDay();
  const agendaDia = await prisma.agendaDia.findUnique({
    where: { quinchoId_diaSemana: { quinchoId: data.quinchoId, diaSemana } },
  });
  if (agendaDia && !agendaDia.habilitado) {
    throw new AppError(400, 'Este día no está habilitado para reservas');
  }

  // Verificar conflicto
  const conflicto = await prisma.reserva.findFirst({
    where: { quinchoId: data.quinchoId, fecha: fechaReserva, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
  });
  if (conflicto) throw new AppError(409, 'Ya existe una reserva para esa fecha');

  // Calcular precio (puede tener precio especial por día de semana)
  const precio = agendaDia?.precioEspecial || quincho.precioDia;

  const reserva = await prisma.reserva.create({
    data: {
      fecha: fechaReserva,
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
      cantidadPersonas: data.cantidadPersonas,
      precioTotal: precio,
      notas: data.notas || null,
      usuarioId: req.user!.userId,
      quinchoId: data.quinchoId,
    },
    include: reservaIncludes,
  });

  res.status(201).json({ ok: true, data: reserva });
};

// ─── Mis reservas (usuario) ───
export const misReservas = async (req: Request, res: Response) => {
  const estado = req.query.estado as string;
  const where: any = { usuarioId: req.user!.userId };
  if (estado) where.estado = estado;

  const reservas = await prisma.reserva.findMany({ where, include: reservaIncludes, orderBy: { fecha: 'desc' } });
  res.json({ ok: true, data: reservas });
};

// ─── Reservas recibidas (propietario) ───
export const reservasDeMisQuinchos = async (req: Request, res: Response) => {
  const estado = req.query.estado as string;
  const quinchoId = req.query.quinchoId as string;

  const where: any = { quincho: { propietarioId: req.user!.userId } };
  if (estado) where.estado = estado;
  if (quinchoId) where.quinchoId = quinchoId;

  const reservas = await prisma.reserva.findMany({ where, include: reservaIncludes, orderBy: { fecha: 'desc' } });
  res.json({ ok: true, data: reservas });
};

// ─── Detalle de reserva ───
export const obtenerReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: reservaIncludes });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  const quincho = await prisma.quincho.findUnique({ where: { id: reserva.quinchoId }, select: { propietarioId: true } });
  if (reserva.usuarioId !== req.user!.userId && quincho?.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'Sin permisos');
  }
  res.json({ ok: true, data: reserva });
};

// ─── Confirmar reserva (propietario) ───
export const confirmarReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: { quincho: { select: { propietarioId: true } } } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');
  if (reserva.estado !== 'PENDIENTE') throw new AppError(400, 'Solo se pueden confirmar reservas pendientes');

  const actualizada = await prisma.reserva.update({ where: { id: pid(req) }, data: { estado: 'CONFIRMADA' }, include: reservaIncludes });
  res.json({ ok: true, data: actualizada });
};

// ─── Rechazar reserva (propietario) ───
export const rechazarReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: { quincho: { select: { propietarioId: true } } } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');
  if (reserva.estado !== 'PENDIENTE') throw new AppError(400, 'Solo se pueden rechazar reservas pendientes');

  const motivo = req.body.motivo || null;
  const actualizada = await prisma.reserva.update({
    where: { id: pid(req) },
    data: { estado: 'RECHAZADA', motivoCancelacion: motivo },
    include: reservaIncludes,
  });
  res.json({ ok: true, data: actualizada });
};

// ─── Completar reserva (propietario) ───
export const completarReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) }, include: { quincho: { select: { propietarioId: true } } } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');
  if (reserva.estado !== 'CONFIRMADA') throw new AppError(400, 'Solo se pueden completar reservas confirmadas');

  const actualizada = await prisma.reserva.update({ where: { id: pid(req) }, data: { estado: 'COMPLETADA' }, include: reservaIncludes });
  res.json({ ok: true, data: actualizada });
};

// ─── Cancelar (usuario cancela su propia) ───
export const cancelarReserva = async (req: Request, res: Response) => {
  const reserva = await prisma.reserva.findUnique({ where: { id: pid(req) } });
  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.usuarioId !== req.user!.userId) throw new AppError(403, 'Solo podés cancelar tus propias reservas');
  if (reserva.estado === 'CANCELADA' || reserva.estado === 'RECHAZADA') throw new AppError(400, 'Ya está cancelada');
  if (reserva.estado === 'COMPLETADA') throw new AppError(400, 'No se puede cancelar una completada');

  const motivo = req.body.motivo || null;
  const cancelada = await prisma.reserva.update({
    where: { id: pid(req) },
    data: { estado: 'CANCELADA', motivoCancelacion: motivo },
    include: reservaIncludes,
  });
  res.json({ ok: true, data: cancelada });
};

// ─── Reservas de un quincho por fecha (propietario) ───
export const reservasPorFecha = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const { desde, hasta } = req.query;

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') throw new AppError(403, 'Sin permisos');

  const where: any = { quinchoId };
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde as string);
    if (hasta) where.fecha.lte = new Date(hasta as string);
  }

  const reservas = await prisma.reserva.findMany({ where, include: reservaIncludes, orderBy: { fecha: 'asc' } });
  res.json({ ok: true, data: reservas });
};
