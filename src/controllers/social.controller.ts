import { Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { generateToken } from '../middleware/auth';

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.quinchos.app';
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Claves públicas de Apple, se cachean solas
const applePublicKeys = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys')
);

// ═══════════════════════════════════════
// SIGN IN WITH APPLE
// ═══════════════════════════════════════

interface AppleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

export const loginApple = async (req: Request, res: Response) => {
  const { identityToken, nombre } = req.body;

  if (!identityToken) {
    throw new AppError(400, 'Falta el token de Apple');
  }

  // Verificar la firma contra las claves públicas de Apple
  let claims: AppleClaims;
  try {
    const { payload } = await jwtVerify(identityToken, applePublicKeys, {
      issuer: 'https://appleid.apple.com',
      audience: BUNDLE_ID,
    });
    claims = payload as unknown as AppleClaims;
  } catch (err) {
    console.error('❌ Token de Apple inválido:', err);
    throw new AppError(401, 'No pudimos verificar tu cuenta de Apple');
  }

  const appleId = claims.sub;
  // Apple solo manda el email la primera vez que el usuario autoriza
  const email = claims.email?.toLowerCase() ?? null;

  const usuario = await buscarOCrearUsuario({
    proveedorId: appleId,
    campoProveedor: 'appleId',
    proveedor: 'APPLE',
    email,
    nombre: nombre?.trim() || null,
  });

  const token = generateToken({ userId: usuario.id, rol: usuario.rol });
  res.json({ ok: true, token, usuario: limpiarUsuario(usuario) });
};

// ═══════════════════════════════════════
// SIGN IN WITH GOOGLE
// ═══════════════════════════════════════

interface GoogleTokenInfo {
  sub: string;
  aud: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp: string | number;
}

export const loginGoogle = async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new AppError(400, 'Falta el token de Google');
  }

  // Google valida el token en su endpoint, no hace falta librería
  let info: GoogleTokenInfo;
  try {
    const respuesta = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status}`);
    info = (await respuesta.json()) as GoogleTokenInfo;
  } catch (err) {
    console.error('❌ Token de Google inválido:', err);
    throw new AppError(401, 'No pudimos verificar tu cuenta de Google');
  }

  // Verificar que el token sea para nuestra app
  if (GOOGLE_CLIENT_IDS.length > 0 && !GOOGLE_CLIENT_IDS.includes(info.aud)) {
    throw new AppError(401, 'El token no corresponde a esta aplicación');
  }

  // Verificar que no esté vencido
  const vence = Number(info.exp) * 1000;
  if (Number.isFinite(vence) && vence < Date.now()) {
    throw new AppError(401, 'El token de Google expiró, probá de nuevo');
  }

  const usuario = await buscarOCrearUsuario({
    proveedorId: info.sub,
    campoProveedor: 'googleId',
    proveedor: 'GOOGLE',
    email: info.email?.toLowerCase() ?? null,
    nombre: info.name ?? null,
    avatar: info.picture ?? null,
  });

  const token = generateToken({ userId: usuario.id, rol: usuario.rol });
  res.json({ ok: true, token, usuario: limpiarUsuario(usuario) });
};

// ═══════════════════════════════════════
// LÓGICA COMPARTIDA
// ═══════════════════════════════════════

async function buscarOCrearUsuario(datos: {
  proveedorId: string;
  campoProveedor: 'googleId' | 'appleId';
  proveedor: 'GOOGLE' | 'APPLE';
  email: string | null;
  nombre: string | null;
  avatar?: string | null;
}) {
  const { proveedorId, campoProveedor, proveedor, email, nombre, avatar } = datos;

  // 1. ¿Ya entró antes con este proveedor?
  const existente = await prisma.usuario.findFirst({
    where: { [campoProveedor]: proveedorId } as any,
  });

  if (existente) {
    // Completar el avatar si no tenía
    if (avatar && !existente.avatar) {
      return prisma.usuario.update({
        where: { id: existente.id },
        data: { avatar },
      });
    }
    return existente;
  }

  // 2. ¿Tiene cuenta con ese mismo email? La vinculamos
  if (email) {
    const porEmail = await prisma.usuario.findUnique({ where: { email } });
    if (porEmail) {
      return prisma.usuario.update({
        where: { id: porEmail.id },
        data: {
          [campoProveedor]: proveedorId,
          ...(avatar && !porEmail.avatar ? { avatar } : {}),
        } as any,
      });
    }
  }

  // 3. Usuario nuevo
  if (!email) {
    throw new AppError(
      400,
      'No pudimos obtener tu email. Probá registrándote con email y contraseña.'
    );
  }

  return prisma.usuario.create({
    data: {
      email,
      nombre: nombre || email.split('@')[0],
      passwordHash: null,
      proveedor: proveedor as any,
      verificado: true, // el proveedor ya validó el email
      avatar: avatar ?? null,
      [campoProveedor]: proveedorId,
    } as any,
  });
}

function limpiarUsuario(u: any) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    telefono: u.telefono,
    avatar: u.avatar,
    rol: u.rol,
    verificado: u.verificado,
    proveedor: u.proveedor,
    tienePassword: u.passwordHash !== null,
    createdAt: u.createdAt,
  };
}

// ═══════════════════════════════════════
// DEFINIR CONTRASEÑA (para cuentas sociales)
// ═══════════════════════════════════════

export const definirPassword = async (req: Request, res: Response) => {
  const bcrypt = await import('bcryptjs');
  const { password } = req.body;

  if (!password || password.length < 6) {
    throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres');
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.userId },
  });
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');

  if (usuario.passwordHash) {
    throw new AppError(400, 'Ya tenés una contraseña. Usá la opción de cambiarla.');
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await bcrypt.default.hash(password, 10) },
  });

  res.json({ ok: true, message: 'Contraseña creada. Ya podés entrar también con tu email.' });
};
