import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { generateToken } from '../middleware/auth';
import { registroSchema, loginSchema } from '../validators/schemas';

export const registro = async (req: Request, res: Response) => {
  const data = registroSchema.parse(req.body);

  const existe = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (existe) throw new AppError(409, 'Ya existe una cuenta con ese email');

  const passwordHash = await bcrypt.hash(data.password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      email: data.email,
      passwordHash,
      nombre: data.nombre,
      telefono: data.telefono,
      rol: data.rol,
    },
    select: { id: true, email: true, nombre: true, rol: true, createdAt: true },
  });

  const token = generateToken({ userId: usuario.id, rol: usuario.rol });

  res.status(201).json({ ok: true, token, usuario });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new AppError(401, 'Email o contraseña incorrectos');

  // Cuenta creada con Google o Apple: no tiene contraseña
  if (!usuario.passwordHash) {
    const proveedor = usuario.proveedor === 'GOOGLE' ? 'Google' : 'Apple';
    throw new AppError(400, `Esta cuenta se creó con ${proveedor}. Entrá con ese botón.`);
  }

  const match = await bcrypt.compare(password, usuario.passwordHash);
  if (!match) throw new AppError(401, 'Email o contraseña incorrectos');

  const token = generateToken({ userId: usuario.id, rol: usuario.rol });

  res.json({
    ok: true,
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      avatar: usuario.avatar,
      telefono: usuario.telefono,
      verificado: usuario.verificado,
      createdAt: usuario.createdAt,
    },
  });
};

export const perfil = async (req: Request, res: Response) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      avatar: true,
      rol: true,
      verificado: true,
      proveedor: true,
      passwordHash: true,
      createdAt: true,
      _count: { select: { reservas: true, resenas: true, favoritos: true } },
    },
  });

  if (!usuario) throw new AppError(404, 'Usuario no encontrado');

  const { passwordHash, ...resto } = usuario as any;
  res.json({ ok: true, usuario: { ...resto, tienePassword: passwordHash !== null } });
};

export const actualizarPerfil = async (req: Request, res: Response) => {
  const { nombre, telefono, avatar } = req.body;

  const usuario = await prisma.usuario.update({
    where: { id: req.user!.userId },
    data: {
      ...(nombre && { nombre }),
      ...(telefono && { telefono }),
      ...(avatar && { avatar }),
    },
    select: { id: true, email: true, nombre: true, telefono: true, avatar: true, rol: true },
  });

  res.json({ ok: true, usuario });
};


// ═══════════════════════════════════════
// ELIMINAR CUENTA (obligatorio por Apple)
// ═══════════════════════════════════════

export const eliminarCuenta = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { password } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');

  // Las cuentas con contraseña la piden para confirmar.
  // Las de Google/Apple ya confirmaron escribiendo ELIMINAR en la app.
  if (usuario.passwordHash) {
    if (!password) throw new AppError(400, 'Ingresá tu contraseña para confirmar');
    const match = await bcrypt.compare(password, usuario.passwordHash);
    if (!match) throw new AppError(401, 'La contraseña no es correcta');
  }

  // No dejar borrar si hay reservas activas
  const reservasActivas = await prisma.reserva.count({
    where: {
      OR: [
        { usuarioId: userId, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
        { quincho: { propietarioId: userId }, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
      ],
    },
  });

  if (reservasActivas > 0) {
    throw new AppError(
      400,
      `Tenés ${reservasActivas} reserva(s) activa(s). Cancelalas o esperá a que terminen antes de eliminar la cuenta.`
    );
  }

  // Borrado en cascada manual (respetando el orden de las relaciones)
  await prisma.$transaction(async (tx) => {
    const misQuinchos = await tx.quincho.findMany({
      where: { propietarioId: userId },
      select: { id: true },
    });
    const idsQuinchos = misQuinchos.map((q) => q.id);

    await tx.dispositivo.deleteMany({ where: { usuarioId: userId } });
    await tx.favorito.deleteMany({ where: { usuarioId: userId } });
    await tx.resena.deleteMany({ where: { usuarioId: userId } });

    if (idsQuinchos.length > 0) {
      await tx.reservaServicio.deleteMany({
        where: { reserva: { quinchoId: { in: idsQuinchos } } },
      });
      await tx.resena.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.favorito.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.reserva.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.servicioExtra.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.agendaDia.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.bloqueoFecha.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.quinchoImagen.deleteMany({ where: { quinchoId: { in: idsQuinchos } } });
      await tx.quincho.deleteMany({ where: { id: { in: idsQuinchos } } });
    }

    await tx.reservaServicio.deleteMany({ where: { reserva: { usuarioId: userId } } });
    await tx.reserva.deleteMany({ where: { usuarioId: userId } });
    await tx.usuario.delete({ where: { id: userId } });
  });

  res.json({ ok: true, message: 'Tu cuenta y todos tus datos fueron eliminados' });
};

// ═══════════════════════════════════════
// CAMBIAR CONTRASEÑA
// ═══════════════════════════════════════

export const cambiarPassword = async (req: Request, res: Response) => {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    throw new AppError(400, 'Ingresá tu contraseña actual y la nueva');
  }
  if (passwordNueva.length < 6) {
    throw new AppError(400, 'La contraseña nueva debe tener al menos 6 caracteres');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.userId } });
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');

  if (!usuario.passwordHash) {
    throw new AppError(400, 'Tu cuenta no tiene contraseña. Podés crear una desde Seguridad.');
  }

  const match = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!match) throw new AppError(401, 'La contraseña actual no es correcta');

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await bcrypt.hash(passwordNueva, 10) },
  });

  // Cerrar sesión en todos los dispositivos
  await prisma.dispositivo.deleteMany({ where: { usuarioId: usuario.id } });

  res.json({ ok: true, message: 'Contraseña actualizada' });
};
