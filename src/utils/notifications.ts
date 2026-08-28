import { prisma } from './prisma';
import https from 'https';
import http2 from 'http2';
import jwt from 'jsonwebtoken';

// ═══════════════════════════════
// APNs HTTP/2 Push Notifications
// ═══════════════════════════════

const APNS_KEY_ID = process.env.APNS_KEY_ID || '';
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || '';
const APNS_PRIVATE_KEY = process.env.APNS_PRIVATE_KEY || '';
const APNS_BUNDLE_ID = 'com.quinchos.app';
const APNS_HOST = process.env.NODE_ENV === 'production'
  ? 'api.push.apple.com'
  : 'api.sandbox.push.apple.com';

let apnsToken: string | null = null;
let apnsTokenExpiry = 0;

function getApnsToken(): string | null {
  if (!APNS_PRIVATE_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) return null;

  const now = Math.floor(Date.now() / 1000);
  if (apnsToken && now < apnsTokenExpiry) return apnsToken;

  try {
    apnsToken = jwt.sign({}, APNS_PRIVATE_KEY, {
      algorithm: 'ES256',
      keyid: APNS_KEY_ID,
      issuer: APNS_TEAM_ID,
      expiresIn: '1h',
    } as jwt.SignOptions);
    apnsTokenExpiry = now + 3500;
    return apnsToken;
  } catch (err) {
    console.error('❌ Error generando token APNs:', err);
    return null;
  }
}

async function sendApnsPush(deviceToken: string, title: string, body: string, data?: Record<string, string>) {
  const token = getApnsToken();
  if (!token) {
    console.warn('⚠️ APNs no configurado (faltan APNS_KEY_ID/TEAM_ID/PRIVATE_KEY)');
    return;
  }

  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: 'default', badge: 1 },
    ...data,
  });

  // TestFlight usa sandbox, App Store usa production.
  // Probamos production primero y si falla con BadDeviceToken, reintentamos en sandbox.
  const hosts = ['api.push.apple.com', 'api.sandbox.push.apple.com'];

  for (const host of hosts) {
    const resultado = await enviarAHost(host, deviceToken, token, payload);
    if (resultado === 'ok') return;
    if (resultado !== 'retry') return; // error definitivo, no reintentar
  }
}

function enviarAHost(
  host: string,
  deviceToken: string,
  authToken: string,
  payload: string
): Promise<'ok' | 'retry' | 'fail'> {
  return new Promise((resolve) => {
    try {
      const client = http2.connect(`https://${host}`);
      let cuerpo = '';

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${authToken}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      req.setTimeout(10000, () => { req.close(); client.close(); resolve('fail'); });
      req.on('data', (chunk) => { cuerpo += chunk; });

      req.on('response', (headers) => {
        const status = headers[':status'];
        req.on('end', () => {
          client.close();
          if (status === 200) {
            console.log(`📱 Push enviado (${host}) a ${deviceToken.substring(0, 8)}...`);
            resolve('ok');
          } else if (status === 400 && cuerpo.includes('BadDeviceToken')) {
            console.log(`↩️ Token de otro entorno, reintentando...`);
            resolve('retry');
          } else if (status === 410) {
            console.log(`🗑️ Token expirado, eliminando`);
            prisma.dispositivo.deleteMany({ where: { token: deviceToken } }).catch(() => {});
            resolve('fail');
          } else {
            console.warn(`⚠️ APNs ${status} (${host}): ${cuerpo}`);
            resolve('fail');
          }
        });
      });

      req.on('error', (err) => {
        console.warn(`⚠️ Error APNs (${host}): ${err.message}`);
        client.close();
        resolve('fail');
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve('fail');
    }
  });
}

// ─── Registrar / Eliminar dispositivo ───
export async function registrarDispositivo(usuarioId: string, token: string, plataforma: string = 'ios') {
  await prisma.dispositivo.upsert({ where: { token }, update: { usuarioId, plataforma }, create: { usuarioId, token, plataforma } });
}

export async function eliminarDispositivo(token: string) {
  await prisma.dispositivo.deleteMany({ where: { token } });
}

// ─── Notificar usuario ───
export async function notificarUsuario(usuarioId: string, titulo: string, cuerpo: string, datos?: Record<string, string>) {
  const dispositivos = await prisma.dispositivo.findMany({ where: { usuarioId }, select: { token: true } });
  if (dispositivos.length === 0) return;

  await Promise.allSettled(
    dispositivos.map((d: { token: string }) => sendApnsPush(d.token, titulo, cuerpo, datos))
  );
}

// ═══════════════════════════════
// NOTIFICACIONES PREDEFINIDAS
// ═══════════════════════════════

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
