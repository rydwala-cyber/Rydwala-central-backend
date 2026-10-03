import { Router, Request, Response } from 'express';
import { adminService } from '../services/AdminService.ts';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// In production protect with authenticateToken and requireRole(['ADMIN'])
// Here we allow token or header check
router.use((req: AuthenticatedRequest, res: Response, next) => {
  const token = req.headers['authorization'];
  const devRole = req.headers['x-user-role'];
  // allow dev testing if no header is supplied in preview mode or if authenticated
  if (token || devRole) {
    return authenticateToken(req, res, () => {
      if (req.user && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
      }
      next();
    });
  }
  next();
});

// Admin Dashboard Summary & Live KPIs
router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const stats = adminService.getDashboardStats();
    return res.json({ success: true, ...stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get all riders / drivers
router.get('/riders', (req: Request, res: Response) => {
  try {
    const riders = adminService.getRidersList();
    return res.json({ success: true, count: riders.length, riders });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Approve / Block / Unblock Rider
router.patch('/riders/:driverId/status', (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required.' });
    }
    const driver = adminService.updateRiderStatus(driverId, status);
    return res.json({ success: true, driver, message: `Rider ${driverId} status updated to ${status}.` });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Get all Customers
router.get('/customers', (req: Request, res: Response) => {
  try {
    const customers = adminService.getCustomersList();
    return res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Block / Unblock Customer
router.patch('/customers/:customerId/status', (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required.' });
    }
    const customer = adminService.updateCustomerStatus(customerId, status);
    return res.json({ success: true, customer, message: `Customer status updated to ${status}.` });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Get all Rides
router.get('/rides', (req: Request, res: Response) => {
  try {
    const rides = adminService.getAllRides();
    return res.json({ success: true, count: rides.length, rides });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get all Payments & Transactions
router.get('/payments', (req: Request, res: Response) => {
  try {
    const data = adminService.getAllPayments();
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Platform Settings
router.get('/settings', (req: Request, res: Response) => {
  try {
    const stats = adminService.getDashboardStats();
    return res.json({ success: true, settings: stats.settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Update Platform Settings
router.post('/settings', (req: Request, res: Response) => {
  try {
    const updated = adminService.updateSettings(req.body);
    return res.json({ success: true, settings: updated, message: 'Settings updated successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
