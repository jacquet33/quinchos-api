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
router.get('/propietario/recibidas', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.reservasDeMisQuinchos));
router.get('/propietario/quincho/:quinchoId', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.reservasPorFecha));
router.post('/:id/confirmar', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.confirmarReserva));
router.post('/:id/rechazar', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.rechazarReserva));
router.post('/:id/completar', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.completarReserva));

export default router;
