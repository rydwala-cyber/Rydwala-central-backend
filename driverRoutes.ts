import { Router, Request, Response } from 'express';
import { driverService } from '../services/DriverService.ts';
import { locationService } from '../services/LocationService.ts';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// Get Driver Profile
router.get('/:driverId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const driver = driverService.getDriverById(driverId);
    const { passwordHash: _, ...safeDriver } = driver;
    return res.json({ success: true, driver: safeDriver });
  } catch (err) {
    return res.status(404).json({ success: false, message: (err as Error).message });
  }
});

// Toggle Driver Online/Offline
router.post('/:driverId/online', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { isOnline } = req.body;

    if (req.user && req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot change status of another driver.' });
    }

    const driver = driverService.setOnlineStatus(driverId, Boolean(isOnline));
    const { passwordHash: _, ...safeDriver } = driver;
    return res.json({ success: true, driver: safeDriver });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Update Driver GPS Location
router.post('/:driverId/location', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    const { lat, lng, address, heading, speed } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'lat and lng coordinates are required.' });
    }

    if (req.user && req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot update location for another driver.' });
    }

    const driver = locationService.updateDriverLocation(driverId, {
      lat: Number(lat),
      lng: Number(lng),
      address,
      heading: heading !== undefined ? Number(heading) : undefined,
      speed: speed !== undefined ? Number(speed) : undefined,
    });

    return res.json({
      success: true,
      currentLocation: driver.currentLocation,
      message: 'Location broadcasted successfully.',
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Get Driver Rides
router.get('/:driverId/rides', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    if (req.user && req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    const rides = driverService.getDriverRides(driverId);
    return res.json({ success: true, rides });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Find Nearby Available Drivers
router.get('/search/nearby', (req: Request, res: Response) => {
  try {
    const { lat, lng, vehicleType, radiusKm } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng query params are required.' });
    }
    const drivers = locationService.findNearbyDrivers(
      Number(lat),
      Number(lng),
      vehicleType as any,
      radiusKm ? Number(radiusKm) : 15
    );
    return res.json({
      success: true,
      count: drivers.length,
      drivers: drivers.map(d => {
        const { passwordHash: _, ...safe } = d;
        return safe;
      }),
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
