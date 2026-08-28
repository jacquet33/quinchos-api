import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/dashboard.controller';

const router = Router();

// Todo requiere propietario o admin
router.get('/', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.dashboardPropietario));
router.get('/clientes', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.misClientes));
router.get('/clientes/:clienteId', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.detalleCliente));
router.get('/quincho/:quinchoId', auth, requireRole('PROPIETARIO', 'ADMIN'), asyncHandler(ctrl.estadisticasQuincho));

export default router;
