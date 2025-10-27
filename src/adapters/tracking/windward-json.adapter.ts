import { readFile } from 'fs/promises';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
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

// Zod schema for validating Windward shipment data
const WindwardShipmentSchema = z.object({
  containerNumber: z.string().min(1, 'Container number cannot be empty'),
  scac: z.string().min(2).max(4, 'SCAC must be 2-4 characters'),
  initialCarrierETA: z.string().datetime('Invalid ISO 8601 date for initialCarrierETA'),
  status: z.object({
    actualArrivalAt: z.string().datetime('Invalid ISO 8601 date for actualArrivalAt').optional(),
    delay: z.object({
      reasons: z.array(z.object({
        delayReasonDescription: z.string()
      }))
    }).optional()
  }),
  destinationPort: z.object({
    lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
    lon: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
    name: z.string()
  }).optional()
});

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
      const validationErrors: string[] = [];

      for (const windwardShipment of windwardData) {
        for (const shipmentData of windwardShipment.trackedShipments.data) {
          try {
            const tracking = this.mapToTracking(shipmentData.shipment);
            this.trackingCache.set(tracking.containerNumber, tracking);
          } catch (error) {
            // Log but don't fail entire load - skip invalid record and continue
            const containerNo = shipmentData.shipment.containerNumber || 'UNKNOWN';
            const errorMsg = error instanceof Error ? error.message : String(error);
            validationErrors.push(`Container ${containerNo}: ${errorMsg}`);
            console.warn(`[Windward Adapter] Skipping invalid tracking record: ${errorMsg}`);
          }
        }
      }

      const message = validationErrors.length > 0
        ? `Windward tracking data loaded with ${validationErrors.length} invalid record(s) skipped`
        : 'Windward tracking data loaded successfully';

      return { success: true, message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to load Windward tracking data: ${errorMessage}`
      };
    }
  }

  private mapToTracking(windwardShipment: WindwardShipmentJSON['trackedShipments']['data'][0]['shipment']): Tracking {
    // Validate external data before mapping to domain
    const validationResult = WindwardShipmentSchema.safeParse(windwardShipment);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Windward data validation failed: ${errors}`);
    }

    const validated = validationResult.data;

    const delayReasons = validated.status.delay?.reasons.map(
      r => r.delayReasonDescription
    ) || [];

    const destinationPort: GeoLocation | undefined = validated.destinationPort
      ? {
          latitude: validated.destinationPort.lat,
          longitude: validated.destinationPort.lon,
          name: validated.destinationPort.name
        }
      : undefined;

    return {
      containerNumber: validated.containerNumber,
      scac: validated.scac,
      estimatedArrival: new Date(validated.initialCarrierETA),
      actualArrival: validated.status.actualArrivalAt
        ? new Date(validated.status.actualArrivalAt)
        : undefined,
      delayReasons,
      destinationPort
    };
  }
}
