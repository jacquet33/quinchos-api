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
    // Nombres amigables para los campos
    const nombres: Record<string, string> = {
      nombre: 'el nombre',
      descripcion: 'la descripción',
      direccion: 'la dirección',
      ciudad: 'la ciudad',
      provincia: 'la provincia',
      precioHora: 'el precio por hora',
      precioDia: 'el precio por día',
      capacidadMin: 'la capacidad mínima',
      capacidadMax: 'la capacidad máxima',
      tipo: 'el tipo de espacio',
      fecha: 'la fecha',
      horaInicio: 'la hora de inicio',
      horaFin: 'la hora de fin',
      cantidadPersonas: 'la cantidad de personas',
      email: 'el email',
      password: 'la contraseña',
      calificacion: 'la calificación',
      comentario: 'el comentario',
      horarioApertura: 'el horario de apertura',
      horarioCierre: 'el horario de cierre',
    };

    const primero = err.errors[0];
    const campo = primero?.path?.[0]?.toString() ?? '';
    const amigable = nombres[campo] ?? campo;

    let mensaje: string;
    if (primero?.code === 'invalid_type' && (primero as any).received === 'undefined') {
      mensaje = `Falta ${amigable}`;
    } else if (primero?.code === 'too_small') {
      mensaje = `Revisá ${amigable}: ${primero.message}`;
    } else {
      mensaje = `Revisá ${amigable}`;
    }

    return res.status(400).json({ ok: false, error: mensaje });
  }

  console.error('❌ Error no controlado:', err);
  return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
};
