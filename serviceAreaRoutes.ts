import { Router, Request, Response } from 'express';
import { serviceAreaService } from '../services/ServiceAreaService.ts';

const router = Router();

// Get all service areas
router.get('/', (req: Request, res: Response) => {
  try {
    const areas = serviceAreaService.getAllAreas();
    return res.json({ success: true, areas });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Create new service area
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, city, state, centerLat, centerLng, radiusKm, baseFare, perKmRate, isActive } = req.body;
    if (!name || !city || centerLat === undefined || centerLng === undefined) {
      return res.status(400).json({ success: false, message: 'name, city, centerLat, and centerLng are required.' });
    }
    const area = serviceAreaService.createArea({
      name,
      city,
      state: state || 'Maharashtra',
      centerLat: Number(centerLat),
      centerLng: Number(centerLng),
      radiusKm: Number(radiusKm || 25),
      baseFare: Number(baseFare || 40),
      perKmRate: Number(perKmRate || 14),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });
    return res.status(201).json({ success: true, area });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

// Update service area
router.patch('/:areaId', (req: Request, res: Response) => {
  try {
    const { areaId } = req.params;
    const updated = serviceAreaService.updateArea(areaId, req.body);
    return res.json({ success: true, area: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: (err as Error).message });
  }
});

export default router;
