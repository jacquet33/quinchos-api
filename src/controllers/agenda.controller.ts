import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ═══════════════════════════════
// AGENDA SEMANAL
// ═══════════════════════════════

// Obtener agenda de un quincho
export const obtenerAgenda = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const agenda = await prisma.agendaDia.findMany({
    where: { quinchoId },
    orderBy: { diaSemana: 'asc' },
  });

  // Si no tiene agenda, devolver defaults
  if (agenda.length === 0) {
    const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
    if (!quincho) throw new AppError(404, 'Quincho no encontrado');
    const defaults = DIAS.map((_, i) => ({
      diaSemana: i,
      diaNombre: DIAS[i],
      habilitado: i >= 1 && i <= 6, // lunes a sábado
      horaApertura: quincho.horarioApertura,
      horaCierre: quincho.horarioCierre,
      precioEspecial: null,
    }));
    return res.json({ ok: true, data: defaults });
  }

  const data = agenda.map((a) => ({
    ...a,
    diaNombre: DIAS[a.diaSemana],
  }));

  res.json({ ok: true, data });
};

// Configurar agenda completa (7 días)
export const configurarAgenda = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const { dias } = req.body;
  if (!dias || !Array.isArray(dias)) throw new AppError(400, 'Enviar dias: array de 7 objetos');

  // Borrar agenda actual y crear nueva
  await prisma.agendaDia.deleteMany({ where: { quinchoId } });

  const agenda = await Promise.all(
    dias.map((d: any) =>
      prisma.agendaDia.create({
        data: {
          quinchoId,
          diaSemana: d.diaSemana,
          habilitado: d.habilitado ?? true,
          horaApertura: d.horaApertura || quincho.horarioApertura,
          horaCierre: d.horaCierre || quincho.horarioCierre,
          precioEspecial: d.precioEspecial || null,
        },
      })
    )
  );

  res.json({ ok: true, data: agenda.map((a) => ({ ...a, diaNombre: DIAS[a.diaSemana] })) });
};

// Actualizar un día específico
export const actualizarDia = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const diaSemana = parseInt(pid(req, 'dia'));

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const dia = await prisma.agendaDia.upsert({
    where: { quinchoId_diaSemana: { quinchoId, diaSemana } },
    update: req.body,
    create: {
      quinchoId,
      diaSemana,
      habilitado: req.body.habilitado ?? true,
      horaApertura: req.body.horaApertura || quincho.horarioApertura,
      horaCierre: req.body.horaCierre || quincho.horarioCierre,
      precioEspecial: req.body.precioEspecial || null,
    },
  });

  res.json({ ok: true, data: { ...dia, diaNombre: DIAS[dia.diaSemana] } });
};

// ═══════════════════════════════
// BLOQUEOS DE FECHAS
// ═══════════════════════════════

// Listar bloqueos
export const obtenerBloqueos = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const bloqueos = await prisma.bloqueoFecha.findMany({
    where: { quinchoId, fecha: { gte: new Date() } },
    orderBy: { fecha: 'asc' },
  });
  res.json({ ok: true, data: bloqueos });
};

// Bloquear fecha(s)
export const bloquearFechas = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const { fechas, motivo } = req.body;
  if (!fechas || !Array.isArray(fechas)) throw new AppError(400, 'Enviar fechas: string[]');

  const resultados = [];
  for (const f of fechas) {
    try {
      const bloqueo = await prisma.bloqueoFecha.create({
        data: { quinchoId, fecha: new Date(f), motivo: motivo || null },
      });
      resultados.push(bloqueo);
    } catch {
      // Ya bloqueada, ignorar
    }
  }

  res.json({ ok: true, data: resultados, bloqueadas: resultados.length });
};

// Desbloquear fecha
export const desbloquearFecha = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const fecha = pid(req, 'fecha');

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  await prisma.bloqueoFecha.deleteMany({
    where: { quinchoId, fecha: new Date(fecha) },
  });

  res.json({ ok: true, message: 'Fecha desbloqueada' });
};

// ═══════════════════════════════
// DISPONIBILIDAD (consulta pública)
// ═══════════════════════════════

export const verificarDisponibilidad = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const { mes, anio } = req.query;

  const year = parseInt(anio as string) || new Date().getFullYear();
  const month = parseInt(mes as string) || new Date().getMonth() + 1;

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');

  // Agenda semanal
  const agenda = await prisma.agendaDia.findMany({ where: { quinchoId } });

  // Bloqueos del mes
  const inicioMes = new Date(year, month - 1, 1);
  const finMes = new Date(year, month, 0);
  const bloqueos = await prisma.bloqueoFecha.findMany({
    where: { quinchoId, fecha: { gte: inicioMes, lte: finMes } },
  });
  const fechasBloqueadas = new Set(bloqueos.map((b) => b.fecha.toISOString().split('T')[0]));

  // Reservas del mes
  const reservas = await prisma.reserva.findMany({
    where: {
      quinchoId,
      fecha: { gte: inicioMes, lte: finMes },
      estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
    },
  });
  const fechasReservadas = new Set(reservas.map((r) => r.fecha.toISOString().split('T')[0]));

  // Generar calendario del mes
  const diasMes = finMes.getDate();
  const calendario = [];

  for (let dia = 1; dia <= diasMes; dia++) {
    const fecha = new Date(year, month - 1, dia);
    const fechaStr = fecha.toISOString().split('T')[0];
    const diaSemana = fecha.getDay();
    const agendaDia = agenda.find((a) => a.diaSemana === diaSemana);

    let estado: string;
    if (fechasBloqueadas.has(fechaStr)) {
      estado = 'bloqueado';
    } else if (fechasReservadas.has(fechaStr)) {
      estado = 'reservado';
    } else if (agendaDia && !agendaDia.habilitado) {
      estado = 'no_disponible';
    } else if (fecha < new Date()) {
      estado = 'pasado';
    } else {
      estado = 'disponible';
    }

    calendario.push({
      fecha: fechaStr,
      dia,
      diaSemana,
      diaNombre: DIAS[diaSemana],
      estado,
      horario: agendaDia
        ? { apertura: agendaDia.horaApertura, cierre: agendaDia.horaCierre }
        : { apertura: quincho.horarioApertura, cierre: quincho.horarioCierre },
      precio: agendaDia?.precioEspecial || quincho.precioDia,
    });
  }

  res.json({ ok: true, mes: month, anio: year, quincho: quincho.nombre, data: calendario });
};
