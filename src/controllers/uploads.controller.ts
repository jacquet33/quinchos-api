import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

// ─── Configuración de almacenamiento ───
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

/// URL pública del servidor. Detrás de Traefik, req.protocol devuelve
/// "http" aunque el usuario entre por HTTPS, y iOS bloquea imágenes por HTTP.
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://quinchos.art3d-studio.com.ar').replace(/\/$/, '');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Crear directorio si no existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(UPLOAD_DIR, 'quinchos'))) {
  fs.mkdirSync(path.join(UPLOAD_DIR, 'quinchos'), { recursive: true });
}

// Guardamos en memoria para poder redimensionar antes de escribir a disco
const storage = multer.memoryStorage();

/// Procesa una imagen: la achica, la optimiza y genera una miniatura.
/// Devuelve el nombre base del archivo.
async function procesarImagen(buffer: Buffer): Promise<string> {
  const nombre = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const dir = path.join(UPLOAD_DIR, 'quinchos');

  // Versión grande: máximo 1600px de ancho, calidad 82
  await sharp(buffer)
    .rotate() // respeta la orientación EXIF de la cámara
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(path.join(dir, `${nombre}.jpg`));

  // Miniatura: 400px, para listados y cards
  await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 72, progressive: true, mozjpeg: true })
    .toFile(path.join(dir, `${nombre}_thumb.jpg`));

  return nombre;
}

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

  // Procesar y guardar
  const imagenes = [];
  for (let i = 0; i < files.length; i++) {
    const nombre = await procesarImagen(files[i].buffer);
    const imagen = await prisma.quinchoImagen.create({
      data: {
        quinchoId,
        url: `${PUBLIC_URL}/uploads/quinchos/${nombre}.jpg`,
        orden: startOrden + i,
      },
    });
    imagenes.push(imagen);
  }

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
    const base = filename.replace(/\.jpg$/, '');
    for (const archivo of [`${base}.jpg`, `${base}_thumb.jpg`]) {
      const filePath = path.join(UPLOAD_DIR, 'quinchos', archivo);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  await prisma.quinchoImagen.delete({ where: { id: imagenId } });

  res.json({ ok: true, message: 'Imagen eliminada' });
};

// ─── Subir avatar de usuario ───
export const subirAvatar = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError(400, 'No se envió imagen');

  const nombre = await procesarImagen(file.buffer);
  const avatarUrl = `${PUBLIC_URL}/uploads/quinchos/${nombre}.jpg`;

  await prisma.usuario.update({
    where: { id: req.user!.userId },
    data: { avatar: avatarUrl },
  });

  res.json({ ok: true, url: avatarUrl });
};
