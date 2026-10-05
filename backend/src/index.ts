import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/database';
import adminRoutes from './routes/admin';
import mobileRoutes from './routes/mobile';

dotenv.config();

async function bootstrap() {
  // Initialize database before accepting requests
  await initializeDatabase();

  const app = express();
  const PORT = Number(process.env.PORT) || 3001;
  const LAN_IP = process.env.LAN_IP || '192.168.1.66';
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:5173,http://localhost:19000,http://${LAN_IP}:5173,http://${LAN_IP}:19000`).split(',');

  // Middleware
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static uploads
  app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'Thufu Deploy API', version: '1.0.0' });
  });

  // Routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/mobile', mobileRoutes);

  // 404 handler
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Thufu Deploy API running on http://0.0.0.0:${PORT}`);
    console.log(`   LAN:  http://${LAN_IP}:${PORT}`);
    console.log(`📋 Admin dashboard:  http://${LAN_IP}:${PORT}/api/admin`);
    console.log(`📱 Mobile API:       http://${LAN_IP}:${PORT}/api/mobile`);
    console.log(`❤️  Health check:    http://${LAN_IP}:${PORT}/api/health\n`);
  });

  return app;
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export {};
