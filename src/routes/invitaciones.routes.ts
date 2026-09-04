import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth } from '../middleware/auth';
import * as ctrl from '../controllers/invitaciones.controller';

const router = Router();

// ─── Públicas (el invitado no necesita cuenta) ───
router.get('/p/:codigo', asyncHandler(ctrl.verInvitacionPublica));
router.get('/p/:codigo/:token', asyncHandler(ctrl.verInvitacionPublica));
router.post('/responder/:token', asyncHandler(ctrl.responderInvitacion));

// ─── Del organizador ───
router.get('/reserva/:reservaId', auth, asyncHandler(ctrl.miInvitacion));
router.post('/reserva/:reservaId', auth, asyncHandler(ctrl.crearInvitacion));
router.patch('/:invitacionId', auth, asyncHandler(ctrl.actualizarInvitacion));
router.delete('/:invitacionId', auth, asyncHandler(ctrl.eliminarInvitacion));

// ─── Invitados ───
router.post('/:invitacionId/invitados', auth, asyncHandler(ctrl.agregarInvitados));
router.delete('/invitados/:invitadoId', auth, asyncHandler(ctrl.eliminarInvitado));
router.post('/invitados/:invitadoId/enviado', auth, asyncHandler(ctrl.marcarEnviado));

export default router;
