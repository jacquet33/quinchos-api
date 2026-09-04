import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://quinchos.art3d-studio.com.ar').replace(/\/$/, '');

const codigoCorto = () => crypto.randomBytes(5).toString('hex');
const tokenInvitado = () => crypto.randomBytes(12).toString('hex');

// ═══════════════════════════════════════
// CREAR / EDITAR INVITACIÓN
// ═══════════════════════════════════════

export const crearInvitacion = async (req: Request, res: Response) => {
  const reservaId = pid(req, 'reservaId');
  const { titulo, mensaje, estilo, dressCode, notas, mostrarMapa } = req.body;

  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { invitacion: true },
  });

  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.usuarioId !== req.user!.userId) {
    throw new AppError(403, 'Esta reserva no es tuya');
  }
  if (reserva.estado === 'CANCELADA' || reserva.estado === 'RECHAZADA') {
    throw new AppError(400, 'No podés invitar a un evento cancelado');
  }
  if (reserva.invitacion) {
    throw new AppError(409, 'Esta reserva ya tiene una invitación');
  }
  if (!titulo || titulo.trim().length < 3) {
    throw new AppError(400, 'Poné un título para la invitación');
  }

  const invitacion = await prisma.invitacion.create({
    data: {
      reservaId,
      codigo: codigoCorto(),
      titulo: titulo.trim(),
      mensaje: (mensaje ?? '').trim(),
      estilo: (estilo ?? 'ELEGANTE') as any,
      dressCode: dressCode?.trim() || null,
      notas: notas?.trim() || null,
      mostrarMapa: mostrarMapa ?? true,
    },
  });

  res.status(201).json({
    ok: true,
    data: { ...invitacion, url: `${PUBLIC_URL}/i/${invitacion.codigo}` },
  });
};

export const actualizarInvitacion = async (req: Request, res: Response) => {
  const invitacionId = pid(req, 'invitacionId');
  const invitacion = await buscarPropia(invitacionId, req.user!.userId);

  const { titulo, mensaje, estilo, dressCode, notas, mostrarMapa, activa } = req.body;

  const actualizada = await prisma.invitacion.update({
    where: { id: invitacion.id },
    data: {
      ...(titulo !== undefined && { titulo: titulo.trim() }),
      ...(mensaje !== undefined && { mensaje: mensaje.trim() }),
      ...(estilo !== undefined && { estilo: estilo as any }),
      ...(dressCode !== undefined && { dressCode: dressCode?.trim() || null }),
      ...(notas !== undefined && { notas: notas?.trim() || null }),
      ...(mostrarMapa !== undefined && { mostrarMapa }),
      ...(activa !== undefined && { activa }),
    },
  });

  res.json({ ok: true, data: { ...actualizada, url: `${PUBLIC_URL}/i/${actualizada.codigo}` } });
};

export const eliminarInvitacion = async (req: Request, res: Response) => {
  const invitacionId = pid(req, 'invitacionId');
  await buscarPropia(invitacionId, req.user!.userId);
  await prisma.invitacion.delete({ where: { id: invitacionId } });
  res.json({ ok: true, message: 'Invitación eliminada' });
};

// ═══════════════════════════════════════
// VER MI INVITACIÓN Y SUS INVITADOS
// ═══════════════════════════════════════

export const miInvitacion = async (req: Request, res: Response) => {
  const reservaId = pid(req, 'reservaId');

  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: {
      invitacion: {
        include: { invitados: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });

  if (!reserva) throw new AppError(404, 'Reserva no encontrada');
  if (reserva.usuarioId !== req.user!.userId) throw new AppError(403, 'Esta reserva no es tuya');

  if (!reserva.invitacion) {
    return res.json({ ok: true, data: null });
  }

  const inv = reserva.invitacion;
  const resumen = contarRespuestas(inv.invitados);

  res.json({
    ok: true,
    data: {
      ...inv,
      url: `${PUBLIC_URL}/i/${inv.codigo}`,
      resumen,
      invitados: inv.invitados.map((i) => ({
        ...i,
        url: `${PUBLIC_URL}/i/${inv.codigo}/${i.token}`,
      })),
    },
  });
};

function contarRespuestas(invitados: { estado: string; acompanantes: number }[]) {
  const confirmados = invitados.filter((i) => i.estado === 'CONFIRMADO');
  return {
    total: invitados.length,
    confirmados: confirmados.length,
    rechazados: invitados.filter((i) => i.estado === 'RECHAZADO').length,
    pendientes: invitados.filter((i) => i.estado === 'PENDIENTE').length,
    // cada confirmado cuenta como 1 + sus acompañantes
    personasConfirmadas: confirmados.reduce((suma, i) => suma + 1 + i.acompanantes, 0),
  };
}

// ═══════════════════════════════════════
// INVITADOS
// ═══════════════════════════════════════

export const agregarInvitados = async (req: Request, res: Response) => {
  const invitacionId = pid(req, 'invitacionId');
  await buscarPropia(invitacionId, req.user!.userId);

  const { invitados } = req.body;
  if (!Array.isArray(invitados) || invitados.length === 0) {
    throw new AppError(400, 'Agregá al menos un invitado');
  }

  const creados = [];
  for (const inv of invitados) {
    const nombre = (inv.nombre ?? '').trim();
    if (nombre.length < 2) continue;

    const invitado = await prisma.invitado.create({
      data: {
        invitacionId,
        token: tokenInvitado(),
        nombre,
        email: inv.email?.trim().toLowerCase() || null,
        telefono: inv.telefono?.trim() || null,
      },
    });
    creados.push(invitado);
  }

  const invitacion = await prisma.invitacion.findUnique({ where: { id: invitacionId } });

  res.status(201).json({
    ok: true,
    total: creados.length,
    data: creados.map((i) => ({
      ...i,
      url: `${PUBLIC_URL}/i/${invitacion!.codigo}/${i.token}`,
    })),
  });
};

export const eliminarInvitado = async (req: Request, res: Response) => {
  const invitadoId = pid(req, 'invitadoId');

  const invitado = await prisma.invitado.findUnique({
    where: { id: invitadoId },
    include: { invitacion: { include: { reserva: true } } },
  });

  if (!invitado) throw new AppError(404, 'Invitado no encontrado');
  if (invitado.invitacion.reserva.usuarioId !== req.user!.userId) {
    throw new AppError(403, 'No tenés permiso');
  }

  await prisma.invitado.delete({ where: { id: invitadoId } });
  res.json({ ok: true, message: 'Invitado eliminado' });
};

export const marcarEnviado = async (req: Request, res: Response) => {
  const invitadoId = pid(req, 'invitadoId');

  const invitado = await prisma.invitado.findUnique({
    where: { id: invitadoId },
    include: { invitacion: { include: { reserva: true } } },
  });

  if (!invitado) throw new AppError(404, 'Invitado no encontrado');
  if (invitado.invitacion.reserva.usuarioId !== req.user!.userId) {
    throw new AppError(403, 'No tenés permiso');
  }

  await prisma.invitado.update({
    where: { id: invitadoId },
    data: { enviadoEl: new Date() },
  });

  res.json({ ok: true });
};

// ═══════════════════════════════════════
// VISTA PÚBLICA (sin login)
// ═══════════════════════════════════════

export const verInvitacionPublica = async (req: Request, res: Response) => {
  const codigo = pid(req, 'codigo');
  const token = req.params.token as string | undefined;

  const invitacion = await prisma.invitacion.findUnique({
    where: { codigo },
    include: {
      reserva: {
        include: {
          quincho: {
            select: {
              nombre: true, direccion: true, ciudad: true, provincia: true,
              latitud: true, longitud: true,
              imagenes: { take: 1, orderBy: { orden: 'asc' } },
            },
          },
          usuario: { select: { nombre: true } },
        },
      },
    },
  });

  if (!invitacion || !invitacion.activa) {
    throw new AppError(404, 'Esta invitación no está disponible');
  }

  let invitado = null;
  if (token) {
    const encontrado = await prisma.invitado.findUnique({ where: { token } });
    if (encontrado && encontrado.invitacionId === invitacion.id) {
      invitado = {
        id: encontrado.id,
        nombre: encontrado.nombre,
        estado: encontrado.estado,
        acompanantes: encontrado.acompanantes,
        mensaje: encontrado.mensaje,
      };
    }
  }

  res.json({
    ok: true,
    data: {
      titulo: invitacion.titulo,
      mensaje: invitacion.mensaje,
      estilo: invitacion.estilo,
      dressCode: invitacion.dressCode,
      notas: invitacion.notas,
      mostrarMapa: invitacion.mostrarMapa,
      evento: {
        fecha: invitacion.reserva.fecha,
        horaInicio: invitacion.reserva.horaInicio,
        horaFin: invitacion.reserva.horaFin,
        lugar: invitacion.reserva.quincho.nombre,
        direccion: invitacion.reserva.quincho.direccion,
        ciudad: invitacion.reserva.quincho.ciudad,
        latitud: invitacion.reserva.quincho.latitud,
        longitud: invitacion.reserva.quincho.longitud,
        foto: invitacion.reserva.quincho.imagenes[0]?.url ?? null,
      },
      anfitrion: invitacion.reserva.usuario.nombre,
      invitado,
    },
  });
};

export const responderInvitacion = async (req: Request, res: Response) => {
  const token = pid(req, 'token');
  const { asiste, acompanantes, mensaje } = req.body;

  const invitado = await prisma.invitado.findUnique({
    where: { token },
    include: { invitacion: true },
  });

  if (!invitado) throw new AppError(404, 'Invitación no encontrada');
  if (!invitado.invitacion.activa) throw new AppError(400, 'Esta invitación ya no está activa');

  const actualizado = await prisma.invitado.update({
    where: { token },
    data: {
      estado: asiste ? 'CONFIRMADO' : 'RECHAZADO',
      acompanantes: asiste ? Math.max(0, Math.min(20, Number(acompanantes) || 0)) : 0,
      mensaje: mensaje?.trim() || null,
      respondioEl: new Date(),
    },
  });

  res.json({
    ok: true,
    message: asiste ? '¡Gracias por confirmar!' : 'Gracias por avisarnos',
    data: { estado: actualizado.estado, acompanantes: actualizado.acompanantes },
  });
};

// ═══════════════════════════════════════

async function buscarPropia(invitacionId: string, userId: string) {
  const invitacion = await prisma.invitacion.findUnique({
    where: { id: invitacionId },
    include: { reserva: true },
  });
  if (!invitacion) throw new AppError(404, 'Invitación no encontrada');
  if (invitacion.reserva.usuarioId !== userId) throw new AppError(403, 'No tenés permiso');
  return invitacion;
}
