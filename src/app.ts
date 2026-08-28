import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './utils/errors';

import authRoutes from './routes/auth.routes';
import quinchosRoutes from './routes/quinchos.routes';
import reservasRoutes from './routes/reservas.routes';
import resenasRoutes from './routes/resenas.routes';
import agendaRoutes from './routes/agenda.routes';
import dashboardRoutes from './routes/dashboard.routes';
import dispositivosRoutes from './routes/dispositivos.routes';
import uploadsRoutes from './routes/uploads.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas peticiones' },
});
app.use('/api/', limiter);

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
