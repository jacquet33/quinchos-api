import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ ok: false, error: err.message });
  }

  if (err instanceof ZodError) {
    const detalles = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({ ok: false, error: `Datos inválidos: ${detalles}` });
  }

  console.error('❌ Error no controlado:', err);
  return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
};
