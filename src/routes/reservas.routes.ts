import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/reservas.controller';

const router = Router();

// Usuario
router.post('/', auth, asyncHandler(ctrl.crearReserva));
router.get('/mis-reservas', auth, asyncHandler(ctrl.misReservas));
router.get('/:id', auth, asyncHandler(ctrl.obtenerReserva));
router.post('/:id/cancelar', auth, asyncHandler(ctrl.cancelarReserva));

// Propietario
router.get(
  '/propietario/recibidas',
  auth,
  requireRole('PROPIETARIO', 'ADMIN'),
  asyncHandler(ctrl.reservasDeMisQuinchos)
);
router.patch(
  '/:id/estado',
  auth,
  requireRole('PROPIETARIO', 'ADMIN'),
  asyncHandler(ctrl.actualizarEstado)
);

export default router;
