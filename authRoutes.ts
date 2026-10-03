import { Router, Request, Response } from 'express';
import { authService } from '../services/AuthService.ts';

const router = Router();

// Customer Register
router.post('/customer/register', async (req: Request, res: Response) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and Phone number are required.' });
    }
    const result = await authService.registerCustomer({ name, phone, email, password });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Customer Login
router.post('/customer/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, otp } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    const result = await authService.loginCustomer({ phone, password, otp });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Driver Register
router.post('/driver/register', async (req: Request, res: Response) => {
  try {
    const { name, phone, email, password, vehicleType, vehicleModel, vehicleNumber, licenseNumber } = req.body;
    if (!name || !phone || !vehicleType || !vehicleModel || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, vehicleType, vehicleModel, and vehicleNumber are required.',
      });
    }
    const result = await authService.registerDriver({
      name,
      phone,
      email,
      password,
      vehicleType,
      vehicleModel,
      vehicleNumber,
      licenseNumber,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Driver Login
router.post('/driver/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, otp, driverId } = req.body;
    if (!phone && !driverId) {
      return res.status(400).json({ success: false, message: 'Phone number or Driver ID is required.' });
    }
    const result = await authService.loginDriver({ phone, password, otp, driverId });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Admin Login
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    const result = await authService.loginAdmin({ username, password });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
