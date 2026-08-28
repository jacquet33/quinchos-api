import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized || getApps().length > 0) { firebaseInitialized = true; return; }
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : undefined;
    initializeApp({ credential: sa ? cert(sa) : undefined });
    firebaseInitialized = true;
    console.log('✅ Firebase inicializado');
  } catch (err) {
    console.warn('⚠️  Firebase no configurado, notificaciones deshabilitadas');
  }
}

export async function registrarDispositivo(usuarioId: string, token: string, plataforma: string = 'ios') {
  await prisma.dispositivo.upsert({ where: { token }, update: { usuarioId, plataforma }, create: { usuarioId, token, plataforma } });
}

export async function eliminarDispositivo(token: string) {
  await prisma.dispositivo.deleteMany({ where: { token } });
}

export async function notificarUsuario(usuarioId: string, titulo: string, cuerpo: string, datos?: Record<string, string>) {
  initFirebase();
  if (!firebaseInitialized) return;

  const dispositivos = await prisma.dispositivo.findMany({ where: { usuarioId }, select: { token: true } });
  if (dispositivos.length === 0) return;

  const tokens = dispositivos.map((d: { token: string }) => d.token);

  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: cuerpo },
      data: datos || {},
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      android: { priority: 'high' as const, notification: { sound: 'default' } },
    });

    response.responses.forEach((resp: { success: boolean; error?: { code: string } }, i: number) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        prisma.dispositivo.deleteMany({ where: { token: tokens[i] } }).catch(() => {});
      }
    });

    console.log(`📱 Notificación enviada a ${response.successCount}/${tokens.length} dispositivos`);
  } catch (err) {
    console.error('❌ Error enviando notificación:', err);
  }
}

export const Notificaciones = {
  nuevaReserva: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(propietarioId, '📅 Nueva reserva', `${clienteNombre} quiere reservar ${quinchoNombre} el ${fecha}`, { tipo: 'nueva_reserva' });
  },
  reservaConfirmada: async (usuarioId: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(usuarioId, '✅ ¡Reserva confirmada!', `Tu reserva en ${quinchoNombre} para el ${fecha} fue confirmada`, { tipo: 'reserva_confirmada' });
  },
  reservaRechazada: async (usuarioId: string, quinchoNombre: string) => {
    await notificarUsuario(usuarioId, '❌ Reserva rechazada', `Tu reserva en ${quinchoNombre} fue rechazada`, { tipo: 'reserva_rechazada' });
  },
  reservaCancelada: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(propietarioId, '🚫 Reserva cancelada', `${clienteNombre} canceló en ${quinchoNombre} del ${fecha}`, { tipo: 'reserva_cancelada' });
  },
  nuevaResena: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, calificacion: number) => {
    await notificarUsuario(propietarioId, '⭐ Nueva reseña', `${clienteNombre} valoró ${quinchoNombre}: ${'★'.repeat(calificacion)}`, { tipo: 'nueva_resena' });
  },
  respuestaResena: async (usuarioId: string, quinchoNombre: string) => {
    await notificarUsuario(usuarioId, '💬 Te respondieron', `El propietario de ${quinchoNombre} respondió tu reseña`, { tipo: 'respuesta_resena' });
  },
};
