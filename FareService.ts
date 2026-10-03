import { RideOptionType } from '../types/index.ts';

export class FareService {
  /**
   * Calculate Haversine distance in Kilometers between two lat/lng points
   */
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.max(0.5, Math.round(distance * 10) / 10);
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Estimate fare based on vehicle type, distance, base fare & per km rates
   */
  public calculateFare(distanceKm: number, rideOption: RideOptionType, surgeMultiplier = 1.0): {
    fare: number;
    baseFare: number;
    perKmRate: number;
    distanceFare: number;
  } {
    let baseFare = 30;
    let perKmRate = 12;

    switch (rideOption) {
      case 'BIKE':
        baseFare = 20;
        perKmRate = 7;
        break;
      case 'AUTO':
        baseFare = 30;
        perKmRate = 11;
        break;
      case 'MINI':
        baseFare = 50;
        perKmRate = 14;
        break;
      case 'SEDAN':
        baseFare = 70;
        perKmRate = 18;
        break;
      case 'XL':
        baseFare = 100;
        perKmRate = 24;
        break;
    }

    const distanceFare = Math.round(distanceKm * perKmRate);
    const rawFare = (baseFare + distanceFare) * surgeMultiplier;
    const finalFare = Math.round(rawFare / 5) * 5; // round to nearest 5 rupees

    return {
      fare: Math.max(baseFare, finalFare),
      baseFare,
      perKmRate,
      distanceFare,
    };
  }
}

export const fareService = new FareService();
