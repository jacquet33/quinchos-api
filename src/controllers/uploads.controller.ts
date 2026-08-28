import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

// ─── Configuración de almacenamiento ───
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Crear directorio si no existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(UPLOAD_DIR, 'quinchos'))) {
  fs.mkdirSync(path.join(UPLOAD_DIR, 'quinchos'), { recursive: true });
}

// ─── Multer storage ───
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(UPLOAD_DIR, 'quinchos'));
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no permitido. Usá JPG, PNG o WebP'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
});

// ─── Subir imágenes a un quincho ───
export const subirImagenes = async (req: Request, res: Response) => {
  const quinchoId = req.params.id as string;

  const quincho = await prisma.quincho.findUnique({ where: { id: quinchoId } });
  if (!quincho) throw new AppError(404, 'Quincho no encontrado');
  if (quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError(400, 'No se enviaron imágenes');
  }

  // Obtener el orden máximo actual
  const maxOrden = await prisma.quinchoImagen.findFirst({
    where: { quinchoId },
    orderBy: { orden: 'desc' },
  });
  const startOrden = (maxOrden?.orden ?? -1) + 1;

  // Construir la URL base
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Guardar en la base de datos
  const imagenes = await Promise.all(
    files.map((file, i) =>
      prisma.quinchoImagen.create({
        data: {
          quinchoId,
          url: `${baseUrl}/uploads/quinchos/${file.filename}`,
          orden: startOrden + i,
        },
      })
    )
  );

  res.status(201).json({
    ok: true,
    data: imagenes,
    total: imagenes.length,
  });
};

// ─── Eliminar imagen ───
export const eliminarImagen = async (req: Request, res: Response) => {
  const imagenId = req.params.imagenId as string;

  const imagen = await prisma.quinchoImagen.findUnique({
    where: { id: imagenId },
    include: { quincho: { select: { propietarioId: true } } },
  });

  if (!imagen) throw new AppError(404, 'Imagen no encontrada');
  if (imagen.quincho.propietarioId !== req.user!.userId && req.user!.rol !== 'ADMIN') {
    throw new AppError(403, 'No sos el propietario');
  }

  // Extraer nombre del archivo de la URL
  const filename = imagen.url.split('/').pop();
  if (filename) {
    const filePath = path.join(UPLOAD_DIR, 'quinchos', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await prisma.quinchoImagen.delete({ where: { id: imagenId } });

  res.json({ ok: true, message: 'Imagen eliminada' });
};

// ─── Subir avatar de usuario ───
export const subirAvatar = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError(400, 'No se envió imagen');

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const avatarUrl = `${baseUrl}/uploads/quinchos/${file.filename}`;

  await prisma.usuario.update({
    where: { id: req.user!.userId },
    data: { avatar: avatarUrl },
  });

  res.json({ ok: true, url: avatarUrl });
};
