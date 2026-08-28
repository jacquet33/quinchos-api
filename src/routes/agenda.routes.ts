import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/agenda.controller';

const router = Router();

// Públicas
router.get('/:quinchoId/disponibilidad', asyncHandler(ctrl.verificarDisponibilidad));
router.get('/:quinchoId/agenda', asyncHandler(ctrl.obtenerAgenda));

// Propietario
router.put('/:quinchoId/agenda', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.configurarAgenda));
router.patch('/:quinchoId/agenda/:dia', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.actualizarDia));

// Bloqueos
router.get('/:quinchoId/bloqueos', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.obtenerBloqueos));
router.post('/:quinchoId/bloqueos', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.bloquearFechas));
router.delete('/:quinchoId/bloqueos/:fecha', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.desbloquearFecha));

export default router;
