import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { auth } from '../middleware/auth';
import { registrarDispositivo, eliminarDispositivo, notificarUsuario } from '../utils/notifications';

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

// Test: enviarme una notificación de prueba
router.post('/test', auth, asyncHandler(async (req, res) => {
  const { prisma } = await import('../utils/prisma');
  const dispositivos = await prisma.dispositivo.findMany({
    where: { usuarioId: req.user!.userId },
    select: { token: true, plataforma: true },
  });

  if (dispositivos.length === 0) {
    return res.json({
      ok: false,
      error: 'No tenés dispositivos registrados. Abrí la app y aceptá los permisos de notificación.',
    });
  }

  await notificarUsuario(
    req.user!.userId,
    '🔔 Prueba de notificación',
    'Si ves esto, las notificaciones funcionan correctamente',
    { tipo: 'test' }
  );

  res.json({
    ok: true,
    message: `Notificación enviada a ${dispositivos.length} dispositivo(s)`,
    dispositivos: dispositivos.map((d) => ({
      plataforma: d.plataforma,
      token: d.token.substring(0, 12) + '...',
    })),
  });
}));

export default router;
