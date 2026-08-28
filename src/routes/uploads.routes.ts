import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import { upload, subirImagenes, eliminarImagen, subirAvatar } from '../controllers/uploads.controller';

const router = Router();

// Subir imágenes a un quincho (hasta 10 a la vez)
router.post(
  '/quincho/:id',
  auth,
  requireRole('PROPIETARIO', 'ADMIN'),
  upload.array('imagenes', 10),
  asyncHandler(subirImagenes)
);

// Eliminar imagen
router.delete(
  '/imagen/:imagenId',
  auth,
  requireRole('PROPIETARIO', 'ADMIN'),
  asyncHandler(eliminarImagen)
);

// Subir avatar de usuario
router.post(
  '/avatar',
  auth,
  upload.single('avatar'),
  asyncHandler(subirAvatar)
);

export default router;
