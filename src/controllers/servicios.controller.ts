import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

const pid = (req: Request, key = 'id'): string => req.params[key] as string;

// Verificar que el usuario es propietario del quincho
async function verificarPropietario(quinchoId: string, userId: string, rol: string) {
  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== userId && rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario de este quincho');
  }
  return quincho;
}

// ═══════════════════════════════
// AMENIDADES (lo que el quincho incluye)
// ═══════════════════════════════

// Listar todas las amenidades disponibles en el sistema
export const catalogoAmenidades = async (_req: Request, res: Response) => {
  const catalogo = [
    {
      categoria: 'Cocina y comida',
      items: [
        { key: 'PARRILLA', label: 'Parrilla', icono: 'flame' },
        { key: 'HORNO_BARRO', label: 'Horno de barro', icono: 'flame.circle' },
        { key: 'ASADOR_CRIOLLO', label: 'Asador criollo', icono: 'flame.fill' },
        { key: 'FOGON', label: 'Fogón', icono: 'fireplace' },
        { key: 'COCINA', label: 'Cocina', icono: 'fork.knife' },
        { key: 'HELADERA', label: 'Heladera', icono: 'refrigerator' },
        { key: 'FREEZER', label: 'Freezer', icono: 'snowflake' },
        { key: 'MICROONDAS', label: 'Microondas', icono: 'microwave' },
        { key: 'VAJILLA', label: 'Vajilla', icono: 'wineglass' },
      ],
    },
    {
      categoria: 'Espacios',
      items: [
        { key: 'PILETA', label: 'Pileta', icono: 'drop.fill' },
        { key: 'PILETA_CLIMATIZADA', label: 'Pileta climatizada', icono: 'drop.circle.fill' },
        { key: 'TECHADO', label: 'Techado', icono: 'house.fill' },
        { key: 'QUINCHO_CERRADO', label: 'Quincho cerrado', icono: 'building.2' },
        { key: 'JARDIN', label: 'Jardín', icono: 'leaf.fill' },
        { key: 'DECK', label: 'Deck', icono: 'square.split.bottomrightquarter' },
      ],
    },
    {
      categoria: 'Para chicos',
      items: [
        { key: 'JUEGOS_NINOS', label: 'Juegos para niños', icono: 'figure.play' },
        { key: 'PELOTERO', label: 'Pelotero', icono: 'circle.grid.3x3.fill' },
        { key: 'HAMACAS', label: 'Hamacas', icono: 'figure.and.child.holdinghands' },
        { key: 'TOBOGAN', label: 'Tobogán', icono: 'arrow.down.right' },
        { key: 'ARENERO', label: 'Arenero', icono: 'square.grid.3x3.fill' },
      ],
    },
    {
      categoria: 'Entretenimiento',
      items: [
        { key: 'MUSICA', label: 'Equipo de música', icono: 'music.note' },
        { key: 'PROYECTOR', label: 'Proyector', icono: 'tv' },
        { key: 'METEGOL', label: 'Metegol', icono: 'sportscourt' },
        { key: 'PING_PONG', label: 'Ping pong', icono: 'figure.table.tennis' },
        { key: 'POOL', label: 'Pool', icono: 'circle.circle' },
        { key: 'CANCHA_FUTBOL', label: 'Cancha de fútbol', icono: 'sportscourt.fill' },
        { key: 'CANCHA_TENIS', label: 'Cancha de tenis', icono: 'figure.tennis' },
      ],
    },
    {
      categoria: 'Servicios',
      items: [
        { key: 'WIFI', label: 'Wi-Fi', icono: 'wifi' },
        { key: 'AIRE_ACONDICIONADO', label: 'Aire acondicionado', icono: 'snowflake' },
        { key: 'CALEFACCION', label: 'Calefacción', icono: 'heater.vertical' },
        { key: 'ESTACIONAMIENTO', label: 'Estacionamiento', icono: 'car.fill' },
        { key: 'SEGURIDAD', label: 'Seguridad', icono: 'shield.checkered' },
        { key: 'ILUMINACION', label: 'Iluminación', icono: 'lightbulb.fill' },
        { key: 'BANO', label: 'Baño', icono: 'toilet' },
        { key: 'DUCHA', label: 'Ducha', icono: 'shower.fill' },
        { key: 'VESTUARIO', label: 'Vestuario', icono: 'door.left.hand.open' },
        { key: 'MESAS_SILLAS', label: 'Mesas y sillas', icono: 'tablecells' },
        { key: 'ACCESIBLE', label: 'Accesible', icono: 'figure.roll' },
        { key: 'APTO_MASCOTAS', label: 'Apto mascotas', icono: 'pawprint.fill' },
      ],
    },
  ];

  res.json({ ok: true, data: catalogo });
};

// Actualizar amenidades de un quincho (reemplaza todas)
export const actualizarAmenidades = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  await verificarPropietario(quinchoId, req.user!.userId, req.user!.rol);

  const { amenidades } = req.body;
  if (!Array.isArray(amenidades)) throw new AppError(400, 'Enviar amenidades: string[]');

  await prisma.quinchoAmenidad.deleteMany({ where: { quinchoId } });

  if (amenidades.length > 0) {
    await prisma.quinchoAmenidad.createMany({
      data: amenidades.map((a: string) => ({ quinchoId, amenidad: a as any })),
      skipDuplicates: true,
    });
  }

  const actualizadas = await prisma.quinchoAmenidad.findMany({
    where: { quinchoId },
    select: { amenidad: true },
  });

  res.json({ ok: true, data: actualizadas.map((a) => a.amenidad) });
};

// Agregar una amenidad
export const agregarAmenidad = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  await verificarPropietario(quinchoId, req.user!.userId, req.user!.rol);

  const { amenidad } = req.body;
  if (!amenidad) throw new AppError(400, 'Enviar amenidad');

  try {
    await prisma.quinchoAmenidad.create({ data: { quinchoId, amenidad: amenidad as any } });
  } catch {
    throw new AppError(409, 'Esta amenidad ya está agregada');
  }

  res.json({ ok: true, message: 'Amenidad agregada' });
};

// Quitar una amenidad
export const quitarAmenidad = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const amenidad = pid(req, 'amenidad');
  await verificarPropietario(quinchoId, req.user!.userId, req.user!.rol);

  await prisma.quinchoAmenidad.deleteMany({
    where: { quinchoId, amenidad: amenidad as any },
  });

  res.json({ ok: true, message: 'Amenidad quitada' });
};

// ═══════════════════════════════
// SERVICIOS EXTRA (opcionales con costo)
// ═══════════════════════════════

// Listar servicios de un quincho (público)
export const listarServicios = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  const servicios = await prisma.servicioExtra.findMany({
    where: { quinchoId, disponible: true },
    orderBy: { precio: 'asc' },
  });
  res.json({ ok: true, data: servicios });
};

// Listar todos incluyendo no disponibles (propietario)
export const listarServiciosPropietario = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  await verificarPropietario(quinchoId, req.user!.userId, req.user!.rol);

  const servicios = await prisma.servicioExtra.findMany({
    where: { quinchoId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ ok: true, data: servicios });
};

// Crear servicio extra
export const crearServicio = async (req: Request, res: Response) => {
  const quinchoId = pid(req, 'quinchoId');
  await verificarPropietario(quinchoId, req.user!.userId, req.user!.rol);

  const { nombre, descripcion, precio, icono } = req.body;
  if (!nombre || nombre.trim().length < 2) throw new AppError(400, 'El nombre es requerido');

  const servicio = await prisma.servicioExtra.create({
    data: {
      quinchoId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      precio: parseInt(precio) || 0,
      icono: icono || null,
    },
  });

  res.status(201).json({ ok: true, data: servicio });
};

// Actualizar servicio
export const actualizarServicio = async (req: Request, res: Response) => {
  const servicioId = pid(req, 'servicioId');

  const servicio = await prisma.servicioExtra.findUnique({
    where: { id: servicioId },
    include: { quincho: { select: { propietarioId: true } } },
  });
  if (!servicio) throw new AppError(404, 'Servicio no encontrado');
  if (servicio.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const { nombre, descripcion, precio, icono, disponible } = req.body;

  const actualizado = await prisma.servicioExtra.update({
    where: { id: servicioId },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(precio !== undefined && { precio: parseInt(precio) || 0 }),
      ...(icono !== undefined && { icono }),
      ...(disponible !== undefined && { disponible }),
    },
  });

  res.json({ ok: true, data: actualizado });
};

// Eliminar servicio
export const eliminarServicio = async (req: Request, res: Response) => {
  const servicioId = pid(req, 'servicioId');

  const servicio = await prisma.servicioExtra.findUnique({
    where: { id: servicioId },
    include: { quincho: { select: { propietarioId: true } } },
  });
  if (!servicio) throw new AppError(404, 'Servicio no encontrado');
  if (servicio.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  await prisma.servicioExtra.delete({ where: { id: servicioId } });
  res.json({ ok: true, message: 'Servicio eliminado' });
};

// Sugerencias de servicios comunes
export const sugerenciasServicios = async (_req: Request, res: Response) => {
  const sugerencias = [
    { nombre: 'Pelotero inflable', icono: 'circle.grid.3x3.fill', precioSugerido: 25000 },
    { nombre: 'Metegol', icono: 'sportscourt', precioSugerido: 8000 },
    { nombre: 'Mesa de ping pong', icono: 'figure.table.tennis', precioSugerido: 10000 },
    { nombre: 'Equipo de sonido DJ', icono: 'hifispeaker.2.fill', precioSugerido: 30000 },
    { nombre: 'Proyector y pantalla', icono: 'tv', precioSugerido: 15000 },
    { nombre: 'Servicio de mozo', icono: 'person.fill', precioSugerido: 40000 },
    { nombre: 'Parrillero', icono: 'flame.fill', precioSugerido: 35000 },
    { nombre: 'Leña y carbón', icono: 'flame', precioSugerido: 12000 },
    { nombre: 'Vajilla completa', icono: 'wineglass.fill', precioSugerido: 15000 },
    { nombre: 'Mantelería', icono: 'square.grid.2x2', precioSugerido: 8000 },
    { nombre: 'Limpieza post evento', icono: 'sparkles', precioSugerido: 20000 },
    { nombre: 'Seguridad', icono: 'shield.checkered', precioSugerido: 30000 },
    { nombre: 'Calefacción exterior', icono: 'heater.vertical', precioSugerido: 18000 },
    { nombre: 'Carpa / gazebo', icono: 'tent.fill', precioSugerido: 22000 },
    { nombre: 'Iluminación decorativa', icono: 'lightbulb.fill', precioSugerido: 15000 },
  ];

  res.json({ ok: true, data: sugerencias });
};
