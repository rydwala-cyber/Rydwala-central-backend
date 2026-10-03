import { Router, Request, Response } from 'express';
import { db } from '../db/db.ts';
import { socketManager } from '../websocket/socketManager.ts';

const router = Router();

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'healthy',
    service: 'Rydwala Central Backend',
    version: '1.0.0-production',
    time: new Date().toISOString(),
    database: db.isPostgresConnected ? 'PostgreSQL (Active)' : 'Relational Engine (In-Memory Postgres Emulation)',
    wsClients: socketManager.getConnectedClientsCount(),
    settings: {
      demoMode: db.settings.demoMode,
      allowDemoOtp: db.settings.allowDemoOtp,
      autoAssignDrivers: db.settings.autoAssignDrivers,
    },
  });
});

// Toggle Demo Mode
router.post('/toggle-demo', (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (enabled !== undefined) {
    db.settings.demoMode = Boolean(enabled);
    db.settings.allowDemoOtp = Boolean(enabled);
  } else {
    db.settings.demoMode = !db.settings.demoMode;
    db.settings.allowDemoOtp = db.settings.demoMode;
  }
  return res.json({
    success: true,
    demoMode: db.settings.demoMode,
    allowDemoOtp: db.settings.allowDemoOtp,
    message: db.settings.demoMode
      ? 'Demo mode enabled. Demo OTP 1234 accepted.'
      : 'Production mode active. Strict server-side generated OTP required.',
  });
});

// Reset / Re-seed Demo Data
router.post('/reset-demo', async (_req: Request, res: Response) => {
  db.rides.clear();
  db.payments.clear();
  db.transactions.clear();
  await db.seedInitialData();
  return res.json({
    success: true,
    message: 'Backend store reset and re-seeded with clean mock drivers and initial test state.',
  });
});

export default router;
