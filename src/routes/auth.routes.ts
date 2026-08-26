import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth } from '../middleware/auth';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/registro', asyncHandler(ctrl.registro));
router.post('/login', asyncHandler(ctrl.login));
router.get('/perfil', auth, asyncHandler(ctrl.perfil));
router.patch('/perfil', auth, asyncHandler(ctrl.actualizarPerfil));

export default router;
