import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { errorHandler } from './utils/errors';

import authRoutes from './routes/auth.routes';
import quinchosRoutes from './routes/quinchos.routes';
import reservasRoutes from './routes/reservas.routes';
import resenasRoutes from './routes/resenas.routes';
import agendaRoutes from './routes/agenda.routes';
import dashboardRoutes from './routes/dashboard.routes';
import dispositivosRoutes from './routes/dispositivos.routes';
import uploadsRoutes from './routes/uploads.routes';
import serviciosRoutes from './routes/servicios.routes';

const app = express();

// Estamos detrás de Traefik: confiar en X-Forwarded-* para que
// req.protocol devuelva "https" y el rate limit vea la IP real
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Límite general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas peticiones. Esperá unos minutos.' },
});

// Límite estricto para login y registro (evita fuerza bruta)
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuenta los intentos fallidos
  message: {
    ok: false,
    error: 'Demasiados intentos fallidos. Esperá 15 minutos antes de volver a probar.',
  },
});

app.use('/api/', limiter);
app.use('/api/auth/login', limiterAuth);
app.use('/api/auth/registro', limiterAuth);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'QuinchosAPI corriendo 🔥', timestamp: new Date().toISOString() });
});

// ─── Rutas ───
app.use('/api/auth', authRoutes);
app.use('/api/quinchos', quinchosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/resenas', resenasRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dispositivos', dispositivosRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/quinchos', serviciosRoutes);

// Páginas legales (Apple exige la política de privacidad publicada)
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));
app.get('/privacidad', (_req, res) => res.sendFile(path.join(__dirname, '../public/privacidad.html')));
app.get('/terminos', (_req, res) => res.sendFile(path.join(__dirname, '../public/terminos.html')));

// Servir imágenes subidas
app.use('/uploads', express.static(process.env.UPLOAD_DIR || '/app/uploads', {
  maxAge: '30d',
  immutable: true,
}));

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
