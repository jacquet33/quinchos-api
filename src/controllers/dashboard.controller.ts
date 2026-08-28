import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

// ═══════════════════════════════
// DASHBOARD DEL PROPIETARIO
// ═══════════════════════════════

export const dashboardPropietario = async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Mis quinchos
  const quinchos = await prisma.quincho.findMany({
    where: { propietarioId: userId },
    select: { id: true, nombre: true, tipo: true, calificacionProm: true, totalResenas: true, disponible: true, precioDia: true },
  });

  const quinchoIds = quinchos.map((q) => q.id);

  // Reservas
  const [reservasPendientes, reservasConfirmadas, reservasCompletadas, reservasCanceladas] = await Promise.all([
    prisma.reserva.count({ where: { quinchoId: { in: quinchoIds }, estado: 'PENDIENTE' } }),
    prisma.reserva.count({ where: { quinchoId: { in: quinchoIds }, estado: 'CONFIRMADA' } }),
    prisma.reserva.count({ where: { quinchoId: { in: quinchoIds }, estado: 'COMPLETADA' } }),
    prisma.reserva.count({ where: { quinchoId: { in: quinchoIds }, estado: 'CANCELADA' } }),
  ]);

  // Ingresos (reservas confirmadas + completadas)
  const ingresos = await prisma.reserva.aggregate({
    where: { quinchoId: { in: quinchoIds }, estado: { in: ['CONFIRMADA', 'COMPLETADA'] } },
    _sum: { precioTotal: true },
  });

  // Ingresos este mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const ingresosMes = await prisma.reserva.aggregate({
    where: {
      quinchoId: { in: quinchoIds },
      estado: { in: ['CONFIRMADA', 'COMPLETADA'] },
      createdAt: { gte: inicioMes },
    },
    _sum: { precioTotal: true },
  });

  // Total clientes únicos
  const clientesUnicos = await prisma.reserva.findMany({
    where: { quinchoId: { in: quinchoIds } },
    select: { usuarioId: true },
    distinct: ['usuarioId'],
  });

  // Próximas reservas (5)
  const proximasReservas = await prisma.reserva.findMany({
    where: {
      quinchoId: { in: quinchoIds },
      fecha: { gte: new Date() },
      estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
    },
    include: {
      usuario: { select: { id: true, nombre: true, email: true, telefono: true } },
      quincho: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'asc' },
    take: 5,
  });

  // Reseñas recientes (5)
  const resenasRecientes = await prisma.resena.findMany({
    where: { quinchoId: { in: quinchoIds } },
    include: {
      usuario: { select: { nombre: true } },
      quincho: { select: { nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  res.json({
    ok: true,
    data: {
      resumen: {
        totalQuinchos: quinchos.length,
        quinchos,
        reservas: {
          pendientes: reservasPendientes,
          confirmadas: reservasConfirmadas,
          completadas: reservasCompletadas,
          canceladas: reservasCanceladas,
          total: reservasPendientes + reservasConfirmadas + reservasCompletadas + reservasCanceladas,
        },
        ingresos: {
          total: ingresos._sum.precioTotal || 0,
          esteMes: ingresosMes._sum.precioTotal || 0,
        },
        clientesUnicos: clientesUnicos.length,
      },
      proximasReservas,
      resenasRecientes,
    },
  });
};

// ═══════════════════════════════
// GESTIÓN DE CLIENTES
// ═══════════════════════════════

// Ver todos los clientes que reservaron en mis quinchos
export const misClientes = async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const quinchoIds = (
    await prisma.quincho.findMany({
      where: { propietarioId: userId },
      select: { id: true },
    })
  ).map((q) => q.id);

  const clientes = await prisma.reserva.findMany({
    where: { quinchoId: { in: quinchoIds } },
    select: {
      usuario: {
        select: { id: true, nombre: true, email: true, telefono: true, avatar: true, createdAt: true },
      },
      quincho: { select: { nombre: true } },
      fecha: true,
      estado: true,
      precioTotal: true,
    },
    orderBy: { fecha: 'desc' },
  });

  // Agrupar por cliente
  const clientesMap = new Map<string, any>();
  for (const c of clientes) {
    const uid = c.usuario.id;
    if (!clientesMap.has(uid)) {
      clientesMap.set(uid, {
        ...c.usuario,
        totalReservas: 0,
        totalGastado: 0,
        ultimaReserva: null,
        quinchos: new Set<string>(),
      });
    }
    const cliente = clientesMap.get(uid)!;
    cliente.totalReservas++;
    if (c.estado === 'CONFIRMADA' || c.estado === 'COMPLETADA') {
      cliente.totalGastado += c.precioTotal;
    }
    if (!cliente.ultimaReserva || c.fecha > cliente.ultimaReserva) {
      cliente.ultimaReserva = c.fecha;
    }
    cliente.quinchos.add(c.quincho.nombre);
  }

  const result = Array.from(clientesMap.values())
    .map((c) => ({ ...c, quinchos: Array.from(c.quinchos) }))
    .sort((a, b) => b.totalReservas - a.totalReservas);

  res.json({ ok: true, total: result.length, data: result });
};

// Ver detalle de un cliente específico
export const detalleCliente = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const clienteId = req.params.clienteId as string;

  const quinchoIds = (
    await prisma.quincho.findMany({
      where: { propietarioId: userId },
      select: { id: true },
    })
  ).map((q) => q.id);

  const cliente = await prisma.usuario.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, email: true, telefono: true, avatar: true, createdAt: true },
  });

  if (!cliente) throw new AppError(404, 'Cliente no encontrado');

  const reservas = await prisma.reserva.findMany({
    where: { usuarioId: clienteId, quinchoId: { in: quinchoIds } },
    include: { quincho: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
  });

  const resenas = await prisma.resena.findMany({
    where: { usuarioId: clienteId, quinchoId: { in: quinchoIds } },
    include: { quincho: { select: { nombre: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalGastado = reservas
    .filter((r) => r.estado === 'CONFIRMADA' || r.estado === 'COMPLETADA')
    .reduce((sum, r) => sum + r.precioTotal, 0);

  res.json({
    ok: true,
    data: {
      cliente,
      estadisticas: {
        totalReservas: reservas.length,
        totalGastado,
        totalResenas: resenas.length,
      },
      reservas,
      resenas,
    },
  });
};

// ═══════════════════════════════
// ESTADÍSTICAS POR QUINCHO
// ═══════════════════════════════

export const estadisticasQuincho = async (req: Request, res: Response) => {
  const quinchoId = req.params.quinchoId as string;

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const [totalReservas, reservasPorEstado, ingresos, resenasStats] = await Promise.all([
    prisma.reserva.count({ where: { quinchoId } }),
    prisma.reserva.groupBy({
      by: ['estado'],
      where: { quinchoId },
      _count: true,
    }),
    prisma.reserva.aggregate({
      where: { quinchoId, estado: { in: ['CONFIRMADA', 'COMPLETADA'] } },
      _sum: { precioTotal: true },
    }),
    prisma.resena.aggregate({
      where: { quinchoId },
      _avg: { calificacion: true },
      _count: true,
    }),
  ]);

  // Reservas por mes (últimos 6 meses)
  const haceSeismeses = new Date();
  haceSeismeses.setMonth(haceSeismeses.getMonth() - 6);
  const reservasMensuales = await prisma.reserva.findMany({
    where: { quinchoId, createdAt: { gte: haceSeismeses } },
    select: { createdAt: true, precioTotal: true, estado: true },
  });

  const porMes: Record<string, { reservas: number; ingresos: number }> = {};
  for (const r of reservasMensuales) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { reservas: 0, ingresos: 0 };
    porMes[key].reservas++;
    if (r.estado === 'CONFIRMADA' || r.estado === 'COMPLETADA') {
      porMes[key].ingresos += r.precioTotal;
    }
  }

  res.json({
    ok: true,
    data: {
      quincho: { id: quincho.id, nombre: quincho.nombre },
      totalReservas,
      reservasPorEstado: Object.fromEntries(reservasPorEstado.map((r) => [r.estado, r._count])),
      ingresosTotales: ingresos._sum.precioTotal || 0,
      calificacionPromedio: resenasStats._avg.calificacion || 0,
      totalResenas: resenasStats._count,
      porMes,
    },
  });
};
