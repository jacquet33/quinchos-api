import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/quinchos.controller';

const router = Router();

// Públicas
router.get('/', asyncHandler(ctrl.buscarQuinchos));
router.get('/destacados', asyncHandler(ctrl.obtenerDestacados));
router.get('/:id', asyncHandler(ctrl.obtenerQuincho));

// Requieren autenticación
router.post('/:quinchoId/favorito', auth, asyncHandler(ctrl.toggleFavorito));
router.get('/usuario/favoritos', auth, asyncHandler(ctrl.misFavoritos));

// Propietario
router.post('/', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.crearQuincho));
router.get('/usuario/mis-quinchos', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.misQuinchos));
router.patch('/:id', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.actualizarQuincho));
router.delete('/:id', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.eliminarQuincho));

export default router;
