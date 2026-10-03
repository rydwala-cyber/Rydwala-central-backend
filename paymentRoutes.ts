import { Router, Request, Response } from 'express';
import { paymentService } from '../services/PaymentService.ts';
import { db } from '../db/db.ts';

const router = Router();

// Driver confirms Cash payment received
router.post('/cash', async (req: Request, res: Response) => {
  try {
    const { rideId, driverId, amount } = req.body;
    if (!rideId || !driverId) {
      return res.status(400).json({ success: false, message: 'rideId and driverId are required.' });
    }
    const payment = await paymentService.collectCashPayment({
      rideId,
      driverId,
      amount: amount ? Number(amount) : undefined,
    });
    return res.json({ success: true, payment, message: 'Cash payment confirmed successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Generate UPI Payment Intent and QR payload
router.post('/upi/intent', (req: Request, res: Response) => {
  try {
    const { rideId } = req.body;
    if (!rideId) {
      return res.status(400).json({ success: false, message: 'rideId is required.' });
    }
    const intent = paymentService.createUpiPaymentIntent(rideId);
    return res.json({ success: true, intent });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// UPI Gateway Webhook (handles payment success webhook callback from Razorpay/Paytm/Setu/NPCI)
router.post('/upi/webhook', async (req: Request, res: Response) => {
  try {
    const { rideId, transactionRef, amount, status, signature } = req.body;
    if (!rideId || !transactionRef || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload: rideId, transactionRef, and amount are mandatory.',
      });
    }

    const payment = await paymentService.handleUpiWebhook({
      rideId,
      transactionRef,
      amount: Number(amount),
      status: status || 'SUCCESS',
      signature,
    });

    return res.json({
      success: true,
      payment,
      message: 'UPI payment verified and settled.',
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Get Payment Details for a Ride
router.get('/:rideId', (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const payment = Array.from(db.payments.values()).find(p => p.rideId === rideId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this ride.' });
    }
    return res.json({ success: true, payment });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
