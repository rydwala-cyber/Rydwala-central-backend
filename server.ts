import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import authRoutes from './server/routes/authRoutes.ts';
import customerRoutes from './server/routes/customerRoutes.ts';
import driverRoutes from './server/routes/driverRoutes.ts';
import rideRoutes from './server/routes/rideRoutes.ts';
import paymentRoutes from './server/routes/paymentRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import serviceAreaRoutes from './server/routes/serviceAreaRoutes.ts';
import systemRoutes from './server/routes/systemRoutes.ts';
import { socketManager } from './server/websocket/socketManager.ts';
import { db } from './server/db/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.set('trust proxy', 1);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'rydwala-central-backend', database: 'runtime' });
  });

  // Initialize Real-time WebSocket Gateway on the same HTTP server
  socketManager.initialize(server);

  // Mount API v1 Modular Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/drivers', driverRoutes);
  app.use('/api/v1/rides', rideRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/service-areas', serviceAreaRoutes);
  app.use('/api/v1/system', systemRoutes);

  // Vite Integration / Static Assets Handling
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await db.ready;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 RYDVALA CENTRAL BACKEND ACTIVE on port ${PORT}`);
    console.log(`📡 WebSocket Gateway: ws://localhost:${PORT}/ws`);
    console.log(`🌐 Base API: http://localhost:${PORT}/api/v1`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting Rydwala Central Backend:', err);
  process.exit(1);
});
