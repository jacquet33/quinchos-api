import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ═══════════════════════════════
// NIVEL DE DEMANDA (público)
// ═══════════════════════════════

export type NivelDemanda = 'alta' | 'media' | 'baja' | 'nueva';

/**
 * Calcula qué tan solicitado está un quincho según las reservas
 * confirmadas de los últimos 60 días.
 */
export async function calcularDemanda(quinchoId: string) {
  const hace60dias = new Date();
  hace60dias.setDate(hace60dias.getDate() - 60);

  const [reservasRecientes, proximas, creadoHace] = await Promise.all([
    prisma.reserva.count({
      where: {
        quinchoId,
        estado: { in: ['CONFIRMADA', 'COMPLETADA'] },
        createdAt: { gte: hace60dias },
      },
    }),
    prisma.reserva.count({
      where: {
        quinchoId,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        fecha: { gte: new Date() },
      },
    }),
    prisma.quincho.findUnique({
      where: { id: quinchoId },
      select: { createdAt: true },
    }),
  ]);

  // Recién publicado: no hay datos suficientes
  const diasPublicado = creadoHace
    ? Math.floor((Date.now() - creadoHace.createdAt.getTime()) / 86400000)
    : 0;

  if (diasPublicado < 14 && reservasRecientes === 0) {
    return {
      nivel: 'nueva' as NivelDemanda,
      etiqueta: 'Nuevo',
      reservasRecientes,
      proximasReservas: proximas,
    };
  }

  let nivel: NivelDemanda;
  let etiqueta: string;

  if (reservasRecientes >= 8) {
    nivel = 'alta';
    etiqueta = 'Muy solicitado';
  } else if (reservasRecientes >= 3) {
    nivel = 'media';
    etiqueta = 'Solicitado';
  } else {
    nivel = 'baja';
    etiqueta = 'Buena disponibilidad';
  }

  return { nivel, etiqueta, reservasRecientes, proximasReservas: proximas };
}

/**
 * Disponibilidad del mes en curso: cuántos días quedan libres
 */
export async function calcularDisponibilidadMes(quinchoId: string) {
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const [ocupadas, bloqueadas, agenda] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        quinchoId,
        fecha: { gte: hoy, lte: finMes },
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
      select: { fecha: true },
    }),
    prisma.bloqueoFecha.findMany({
      where: { quinchoId, fecha: { gte: hoy, lte: finMes } },
      select: { fecha: true },
    }),
    prisma.agendaDia.findMany({ where: { quinchoId } }),
  ]);

  const diasRestantes = finMes.getDate() - hoy.getDate() + 1;
  const diasDeshabilitados = new Set(
    agenda.filter((a) => !a.habilitado).map((a) => a.diaSemana)
  );

  // Contar días hábiles que quedan
  let habiles = 0;
  for (let d = hoy.getDate(); d <= finMes.getDate(); d++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), d);
    if (!diasDeshabilitados.has(fecha.getDay())) habiles++;
  }

  const noDisponibles = ocupadas.length + bloqueadas.length;
  const libres = Math.max(0, habiles - noDisponibles);
  const porcentajeLibre = habiles > 0 ? Math.round((libres / habiles) * 100) : 100;

  let mensaje: string | null = null;
  if (libres === 0) {
    mensaje = 'Sin fechas disponibles este mes';
  } else if (porcentajeLibre <= 25) {
    mensaje = `¡Quedan solo ${libres} fechas este mes!`;
  } else if (porcentajeLibre <= 50) {
    mensaje = `Quedan ${libres} fechas este mes`;
  }

  return { diasLibres: libres, diasHabiles: habiles, porcentajeLibre, mensaje };
}

// ═══════════════════════════════
// ANÁLISIS PARA EL PROPIETARIO
// ═══════════════════════════════

export const analisisDemanda = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const hace90dias = new Date();
  hace90dias.setDate(hace90dias.getDate() - 90);

  const reservas = await prisma.reserva.findMany({
    where: {
      quinchoId,
      estado: { in: ['CONFIRMADA', 'COMPLETADA'] },
      fecha: { gte: hace90dias },
    },
    select: { fecha: true, precioTotal: true },
  });

  // Reservas por día de la semana
  const porDia = Array(7).fill(0);
  const ingresosPorDia = Array(7).fill(0);
  for (const r of reservas) {
    const dia = r.fecha.getDay();
    porDia[dia]++;
    ingresosPorDia[dia] += r.precioTotal;
  }

  const maxReservas = Math.max(...porDia);
  const totalReservas = reservas.length;

  const detallePorDia = DIAS.map((nombre, i) => {
    const cantidad = porDia[i];
    const porcentaje = totalReservas > 0 ? Math.round((cantidad / totalReservas) * 100) : 0;

    let nivel: NivelDemanda;
    if (maxReservas === 0) nivel = 'nueva';
    else if (cantidad >= maxReservas * 0.7) nivel = 'alta';
    else if (cantidad >= maxReservas * 0.3) nivel = 'media';
    else nivel = 'baja';

    return {
      diaSemana: i,
      dia: nombre,
      reservas: cantidad,
      porcentaje,
      ingresos: ingresosPorDia[i],
      nivel,
    };
  });

  // Sugerencias concretas
  const sugerencias: string[] = [];
  const ordenados = [...detallePorDia].sort((a, b) => b.reservas - a.reservas);
  const masPedido = ordenados[0];
  const menosPedido = ordenados.filter((d) => d.reservas > 0).pop();

  if (totalReservas >= 5) {
    if (masPedido && masPedido.reservas > 0) {
      sugerencias.push(
        `Los ${masPedido.dia.toLowerCase()} son tu día más pedido (${masPedido.porcentaje}% de las reservas). Podrías cobrar un poco más ese día.`
      );
    }
    const sinReservas = detallePorDia.filter((d) => d.reservas === 0);
    if (sinReservas.length > 0 && sinReservas.length < 5) {
      const nombres = sinReservas.map((d) => d.dia.toLowerCase()).join(', ');
      sugerencias.push(
        `Los ${nombres} no tuviste reservas. Un precio promocional podría ayudar a llenarlos.`
      );
    }
  } else {
    sugerencias.push('Todavía hay pocas reservas para sacar conclusiones. Seguí publicando fotos y respondiendo rápido.');
  }

  const [demanda, disponibilidad] = await Promise.all([
    calcularDemanda(quinchoId),
    calcularDisponibilidadMes(quinchoId),
  ]);

  res.json({
    ok: true,
    data: {
      quincho: { id: quincho.id, nombre: quincho.nombre },
      demanda,
      disponibilidad,
      totalReservas,
      porDia: detallePorDia,
      sugerencias,
    },
  });
};

// ═══════════════════════════════
// DEMANDA PÚBLICA DE UN QUINCHO
// ═══════════════════════════════

export const demandaPublica = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');

  const [demanda, disponibilidad] = await Promise.all([
    calcularDemanda(quinchoId),
    calcularDisponibilidadMes(quinchoId),
  ]);

  res.json({ ok: true, data: { demanda, disponibilidad } });
};
