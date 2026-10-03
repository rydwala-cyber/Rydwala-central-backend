import { Router, Request, Response } from 'express';
import { rideService } from '../services/RideService.ts';
import { db } from '../db/db.ts';

const router = Router();

// Create new ride
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      rideOption,
      paymentMethod,
    } = req.body;

    if (!customerId || !pickup || !drop || pickupLat === undefined || dropLat === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (customerId, pickup, drop, pickupLat, dropLat).',
      });
    }

    const ride = await rideService.createRide({
      customerId,
      pickup,
      drop,
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      dropLat: Number(dropLat),
      dropLng: Number(dropLng),
      rideOption: rideOption || 'AUTO',
      paymentMethod: paymentMethod || 'CASH',
    });

    return res.status(201).json({ success: true, ride });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});


// Get all currently searchable rides for Driver App polling fallback.
// This endpoint intentionally reads the same central ride store used by the
// create/accept flow; it does not create a separate driver-side ride database.
router.get('/searching', (_req: Request, res: Response) => {
  try {
    const rides = Array.from(db.rides.values())
      .filter((ride) => ride.status === 'SEARCHING')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, rides });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message, rides: [] });
  }
});

// Get Ride by ID
router.get('/:rideId', (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const ride = rideService.getRideById(rideId);
    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(404).json({ success: false, message: (err as Error).message });
  }
});

// Driver Accepts Ride
router.post('/:rideId/accept', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ success: false, message: 'driverId is required.' });
    }
    const ride = await rideService.acceptRide(rideId, driverId);
    return res.json({ success: true, ride, message: 'Ride accepted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Driver Rejects / Skips Ride
router.post('/:rideId/reject', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId, reason } = req.body;
    return res.json({
      success: true,
      message: `Ride ${rideId} passed by driver ${driverId || 'unknown'}. Reason: ${reason || 'Busy'}`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Driver Arriving
router.post('/:rideId/arriving', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ success: false, message: 'driverId is required.' });
    }
    const ride = await rideService.markDriverArriving(rideId, driverId);
    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Driver Arrived
router.post('/:rideId/arrived', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ success: false, message: 'driverId is required.' });
    }
    const ride = await rideService.markDriverArrived(rideId, driverId);
    return res.json({ success: true, ride, message: 'Driver arrival broadcasted to customer.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Verify OTP (Driver inputs customer's 4-digit OTP)
router.post('/:rideId/verify-otp', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId, otp } = req.body;

    if (!driverId || !otp) {
      return res.status(400).json({ success: false, message: 'driverId and otp are required.' });
    }

    const result = await rideService.verifyOtp(rideId, driverId, otp);
    return res.json({
      success: true,
      ride: result.ride,
      message: 'OTP verified successfully! Ride has started.',
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Start Ride directly (if already OTP verified)
router.post('/:rideId/start', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId, otp } = req.body;

    if (otp) {
      const result = await rideService.verifyOtp(rideId, driverId, otp);
      return res.json({ success: true, ride: result.ride });
    }

    const ride = db.rides.get(rideId);
    if (!ride) throw new Error('Ride not found');
    if (!ride.otpVerified && !db.settings.demoMode) {
      throw new Error('OTP verification is required before starting ride.');
    }

    ride.status = 'RIDE_STARTED';
    ride.startedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();
    db.rides.set(rideId, ride);

    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Complete Ride
router.post('/:rideId/complete', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ success: false, message: 'driverId is required.' });
    }

    const ride = await rideService.completeRide(rideId, driverId);
    return res.json({ success: true, ride, message: 'Ride completed successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Cancel Ride
router.post('/:rideId/cancel', async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const { cancelledBy, reason } = req.body;

    const ride = await rideService.cancelRide(rideId, cancelledBy || 'CUSTOMER', reason);
    return res.json({ success: true, ride, message: 'Ride cancelled.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
