import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth } from '../middleware/auth';
import * as ctrl from '../controllers/auth.controller';
import { loginApple, loginGoogle, definirPassword } from '../controllers/social.controller';

const router = Router();

router.post('/registro', asyncHandler(ctrl.registro));
router.post('/login', asyncHandler(ctrl.login));

// Login social
router.post('/apple', asyncHandler(loginApple));
router.post('/google', asyncHandler(loginGoogle));
router.post('/definir-password', auth, asyncHandler(definirPassword));
router.get('/perfil', auth, asyncHandler(ctrl.perfil));
router.patch('/perfil', auth, asyncHandler(ctrl.actualizarPerfil));
router.post('/cambiar-password', auth, asyncHandler(ctrl.cambiarPassword));
router.delete('/cuenta', auth, asyncHandler(ctrl.eliminarCuenta));

export default router;
