import admin from 'firebase-admin';
import { prisma } from './prisma';

// ─── Inicializar Firebase ───
// El service account se configura via variable de entorno GOOGLE_APPLICATION_CREDENTIALS
// o pasando el JSON directamente

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;

    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
    });
    firebaseInitialized = true;
    console.log('✅ Firebase inicializado');
  } catch (err) {
    console.warn('⚠️  Firebase no configurado, notificaciones deshabilitadas');
  }
}

// ─── Registrar dispositivo ───
export async function registrarDispositivo(
  usuarioId: string,
  token: string,
  plataforma: string = 'ios'
) {
  // Upsert: si el token ya existe, actualizar el usuario
  await prisma.dispositivo.upsert({
    where: { token },
    update: { usuarioId, plataforma },
    create: { usuarioId, token, plataforma },
  });
}

// ─── Eliminar dispositivo ───
export async function eliminarDispositivo(token: string) {
  await prisma.dispositivo.deleteMany({ where: { token } });
}

// ─── Enviar notificación a un usuario ───
export async function notificarUsuario(
  usuarioId: string,
  titulo: string,
  cuerpo: string,
  datos?: Record<string, string>
) {
  initFirebase();
  if (!firebaseInitialized) return;

  const dispositivos = await prisma.dispositivo.findMany({
    where: { usuarioId },
    select: { token: true },
  });

  if (dispositivos.length === 0) return;

  const tokens = dispositivos.map((d) => d.token);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: cuerpo },
      data: datos || {},
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
      android: {
        priority: 'high' as const,
        notification: { sound: 'default' },
      },
    });

    // Limpiar tokens inválidos
    response.responses.forEach((resp, i) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        prisma.dispositivo.deleteMany({ where: { token: tokens[i] } }).catch(() => {});
      }
    });

    console.log(`📱 Notificación enviada a ${response.successCount}/${tokens.length} dispositivos`);
  } catch (err) {
    console.error('❌ Error enviando notificación:', err);
  }
}

// ═══════════════════════════════
// NOTIFICACIONES PREDEFINIDAS
// ═══════════════════════════════

export const Notificaciones = {
  // Para el PROPIETARIO cuando recibe una nueva reserva
  nuevaReserva: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(
      propietarioId,
      '📅 Nueva reserva recibida',
      `${clienteNombre} quiere reservar ${quinchoNombre} el ${fecha}`,
      { tipo: 'nueva_reserva' }
    );
  },

  // Para el USUARIO cuando le confirman la reserva
  reservaConfirmada: async (usuarioId: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(
      usuarioId,
      '✅ ¡Reserva confirmada!',
      `Tu reserva en ${quinchoNombre} para el ${fecha} fue confirmada`,
      { tipo: 'reserva_confirmada' }
    );
  },

  // Para el USUARIO cuando le rechazan la reserva
  reservaRechazada: async (usuarioId: string, quinchoNombre: string) => {
    await notificarUsuario(
      usuarioId,
      '❌ Reserva rechazada',
      `Tu reserva en ${quinchoNombre} fue rechazada por el propietario`,
      { tipo: 'reserva_rechazada' }
    );
  },

  // Para el PROPIETARIO cuando le cancelan una reserva
  reservaCancelada: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, fecha: string) => {
    await notificarUsuario(
      propietarioId,
      '🚫 Reserva cancelada',
      `${clienteNombre} canceló su reserva en ${quinchoNombre} del ${fecha}`,
      { tipo: 'reserva_cancelada' }
    );
  },

  // Para el PROPIETARIO cuando recibe una reseña
  nuevaResena: async (propietarioId: string, clienteNombre: string, quinchoNombre: string, calificacion: number) => {
    const estrellas = '★'.repeat(calificacion) + '☆'.repeat(5 - calificacion);
    await notificarUsuario(
      propietarioId,
      '⭐ Nueva reseña',
      `${clienteNombre} valoró ${quinchoNombre}: ${estrellas}`,
      { tipo: 'nueva_resena' }
    );
  },

  // Para el USUARIO cuando le responden una reseña
  respuestaResena: async (usuarioId: string, quinchoNombre: string) => {
    await notificarUsuario(
      usuarioId,
      '💬 Te respondieron',
      `El propietario de ${quinchoNombre} respondió tu reseña`,
      { tipo: 'respuesta_resena' }
    );
  },
};
