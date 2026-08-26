import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { prisma } from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';

export interface JwtPayload {
  userId: string;
  rol: string;
}

// Extiende Request para incluir usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const generateToken = (payload: JwtPayload): string =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export const auth = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Token no proporcionado');
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Verificar que el usuario sigue existiendo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: { id: true, rol: true },
    });

    if (!usuario) throw new AppError(401, 'Usuario no encontrado');

    req.user = { userId: usuario.id, rol: usuario.rol };
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'Token inválido o expirado');
  }
};

// Middleware para roles específicos
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'No autenticado');
    if (!roles.includes(req.user.rol)) {
      throw new AppError(403, 'No tenés permisos para esta acción');
    }
    next();
  };
};
