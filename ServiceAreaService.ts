import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db.ts';
import { ServiceArea } from '../types/index.ts';

export class ServiceAreaService {
  public getAllAreas(): ServiceArea[] {
    return Array.from(db.serviceAreas.values());
  }

  public getActiveAreas(): ServiceArea[] {
    return Array.from(db.serviceAreas.values()).filter(a => a.isActive);
  }

  public createArea(data: Omit<ServiceArea, 'areaId' | 'createdAt'>): ServiceArea {
    const areaId = `AREA-${uuidv4().substring(0, 6).toUpperCase()}`;
    const newArea: ServiceArea = {
      ...data,
      areaId,
      createdAt: new Date().toISOString(),
    };
    db.serviceAreas.set(areaId, newArea);
    return newArea;
  }

  public updateArea(areaId: string, data: Partial<ServiceArea>): ServiceArea {
    const area = db.serviceAreas.get(areaId);
    if (!area) throw new Error(`Service Area ${areaId} not found.`);

    Object.assign(area, data);
    db.serviceAreas.set(areaId, area);
    return area;
  }
}

export const serviceAreaService = new ServiceAreaService();
