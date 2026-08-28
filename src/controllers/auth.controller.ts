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
  if (!usuario) throw new AppError(401, 'Credenciales inválidas');

  const match = await bcrypt.compare(password, usuario.passwordHash);
  if (!match) throw new AppError(401, 'Credenciales inválidas');

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
      createdAt: true,
      _count: { select: { reservas: true, resenas: true, favoritos: true } },
    },
  });

  if (!usuario) throw new AppError(404, 'Usuario no encontrado');

  res.json({ ok: true, usuario });
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
