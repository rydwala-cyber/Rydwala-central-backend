import { Router, Response } from 'express';
import { customerService } from '../services/CustomerService.ts';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// Get customer profile
router.get('/:customerId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    // Authorization check: customer can only access their own profile unless admin
    if (req.user && req.user.role === 'CUSTOMER' && req.user.userId !== customerId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot access other customer profile.' });
    }
    const customer = customerService.getCustomerById(customerId);
    return res.json({ success: true, customer });
  } catch (err) {
    return res.status(404).json({ success: false, message: (err as Error).message });
  }
});

// Update customer profile
router.patch('/:customerId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    if (req.user && req.user.role === 'CUSTOMER' && req.user.userId !== customerId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify other customer profile.' });
    }
    const customer = customerService.updateProfile(customerId, req.body);
    return res.json({ success: true, customer });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Get customer ride history
router.get('/:customerId/rides', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    if (req.user && req.user.role === 'CUSTOMER' && req.user.userId !== customerId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    const rides = customerService.getCustomerRides(customerId);
    return res.json({ success: true, rides });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
