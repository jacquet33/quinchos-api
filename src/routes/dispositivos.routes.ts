import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth } from '../middleware/auth';
import { registrarDispositivo, eliminarDispositivo } from '../utils/notifications';

const router = Router();

// Registrar token FCM del dispositivo
router.post('/registrar', auth, asyncHandler(async (req, res) => {
  const { token, plataforma } = req.body;
  if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });
  await registrarDispositivo(req.user!.userId, token, plataforma || 'ios');
  res.json({ ok: true, message: 'Dispositivo registrado' });
}));

// Eliminar token (logout)
router.delete('/eliminar', auth, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });
  await eliminarDispositivo(token);
  res.json({ ok: true, message: 'Dispositivo eliminado' });
}));

export default router;
