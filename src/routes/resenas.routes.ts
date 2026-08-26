import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/resenas.controller';

const router = Router();

router.post('/', auth, asyncHandler(ctrl.crearResena));
router.get('/quincho/:quinchoId', asyncHandler(ctrl.obtenerResenas));
router.patch(
  '/:id/responder',
  auth,
  requireRole('PROPIETARIO', 'ADMIN'),
  asyncHandler(ctrl.responderResena)
);
router.delete('/:id', auth, asyncHandler(ctrl.eliminarResena));

export default router;
