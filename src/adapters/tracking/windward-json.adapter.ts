import { readFile } from 'fs/promises';
import { inject, injectable } from 'tsyringe';
import { GeoLocation, Tracking } from '../../types/domain.types';
import { Result } from '../../types/result.types';
import { ITrackingDataAdapter } from './tracking-adapter.interface';

// Windward-specific JSON structure (internal to adapter)
interface WindwardShipmentJSON {
  trackedShipments: {
    count: number;
    data: Array<{
      shipment: {
        containerNumber: string;
        scac: string;
        carrierBookingReference: string | null;
        initialCarrierETA: string;
        initialCarrierETD: string;
        status: {
          actualArrivalAt?: string;
          actualDepartureAt?: string;
          delay?: {
            reasons: Array<{
              delayReasonDescription: string;
            }>;
          };
        };
        destinationPort?: {
          name: string;
          lon: number;
          lat: number;
        };
      };
    }>;
  };
}

@injectable()
export class WindwardJsonAdapter implements ITrackingDataAdapter {
  private trackingCache: Map<string, Tracking> | null = null;

  constructor(@inject('WindwardDataPath') private readonly dataPath: string) {}

  async getTrackingByContainer(containerNumber: string): Promise<Result<Tracking>> {
    const loadResult = await this.ensureCacheLoaded();
    if (!loadResult.success) {
      return {
        success: false,
        message: loadResult.message
      };
    }

    const tracking = this.trackingCache?.get(containerNumber);
    if (tracking) {
      return {
        success: true,
        data: tracking,
        message: `Tracking for container ${containerNumber} retrieved successfully`
      };
    }

    return {
      success: true,
      message: `Tracking for container ${containerNumber} not found in Windward system`
    };
  }

  private async ensureCacheLoaded(): Promise<Result<void>> {
    if (this.trackingCache !== null) {
      return { success: true, message: 'Cache already loaded' };
    }

    try {
      const fileContent = await readFile(this.dataPath, 'utf-8');
      const windwardData: WindwardShipmentJSON[] = JSON.parse(fileContent);

      this.trackingCache = new Map();

      for (const windwardShipment of windwardData) {
        for (const shipmentData of windwardShipment.trackedShipments.data) {
          const tracking = this.mapToTracking(shipmentData.shipment);
          this.trackingCache.set(tracking.containerNumber, tracking);
        }
      }

      return { success: true, message: 'Windward tracking data loaded successfully' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to load Windward tracking data: ${errorMessage}`
      };
    }
  }

  private mapToTracking(windwardShipment: WindwardShipmentJSON['trackedShipments']['data'][0]['shipment']): Tracking {
    const delayReasons = windwardShipment.status.delay?.reasons.map(
      r => r.delayReasonDescription
    ) || [];

    const destinationPort: GeoLocation | undefined = windwardShipment.destinationPort
      ? {
          latitude: windwardShipment.destinationPort.lat,
          longitude: windwardShipment.destinationPort.lon,
          name: windwardShipment.destinationPort.name
        }
      : undefined;

    return {
      containerNumber: windwardShipment.containerNumber,
      scac: windwardShipment.scac,
      estimatedArrival: new Date(windwardShipment.initialCarrierETA),
      actualArrival: windwardShipment.status.actualArrivalAt
        ? new Date(windwardShipment.status.actualArrivalAt)
        : undefined,
      delayReasons,
      destinationPort
    };
  }
}
