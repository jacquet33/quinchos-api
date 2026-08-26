import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/quinchos.controller';

const router = Router();

// ─── Públicas ───
router.get('/', asyncHandler(ctrl.buscarQuinchos));
router.get('/destacados', asyncHandler(ctrl.obtenerDestacados));
router.get('/mapa', asyncHandler(ctrl.quinchosParaMapa));
router.get('/:id', asyncHandler(ctrl.obtenerQuincho));

// ─── Requieren autenticación ───
router.post('/:quinchoId/favorito', auth, asyncHandler(ctrl.toggleFavorito));
router.get('/usuario/favoritos', auth, asyncHandler(ctrl.misFavoritos));

// ─── ABM Propietario ───
router.post('/', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.crearQuincho));
router.get('/usuario/mis-quinchos', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.misQuinchos));
router.put('/:id', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.actualizarQuincho));
router.patch('/:id', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.actualizarQuincho));
router.delete('/:id', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.eliminarQuincho));
router.post('/:id/reactivar', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.reactivarQuincho));

// ─── Imágenes ───
router.post('/:id/imagenes', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.agregarImagenes));
router.delete('/:id/imagenes/:imagenId', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.eliminarImagen));

export default router;
