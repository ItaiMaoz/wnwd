import { readFile } from 'fs/promises';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { Container, Shipment } from '../../types/domain.types';
import { Result } from '../../types/result.types';
import { IShipmentDataAdapter } from './shipment-adapter.interface';

// TMS-specific JSON structure (internal to adapter)
interface TMSShipmentJSON {
  sgl: {
    header: {
      sglShipmentNo: string;
    };
    parties: {
      customer: {
        name: string;
      };
      shipper: {
        name: string;
      };
    };
    containers: Array<{
      containerNo: string;
      containerType: string;
    }>;
  };
}

// Zod schema for validating TMS shipment data
const TMSShipmentSchema = z.object({
  sgl: z.object({
    header: z.object({
      sglShipmentNo: z.string().min(1, 'Shipment number cannot be empty')
    }),
    parties: z.object({
      customer: z.object({
        name: z.string().min(1, 'Customer name cannot be empty')
      }),
      shipper: z.object({
        name: z.string().min(1, 'Shipper name cannot be empty')
      })
    }),
    containers: z.array(z.object({
      containerNo: z.string().min(1, 'Container number cannot be empty'),
      containerType: z.string()
    }))
  })
});

@injectable()
export class TMSJsonAdapter implements IShipmentDataAdapter {
  private shipmentsCache: Map<string, Shipment> | null = null;

  constructor(@inject('TMSDataPath') private readonly dataPath: string) {}

  async getShipmentById(shipmentId: string): Promise<Result<Shipment>> {
    const loadResult = await this.ensureCacheLoaded();
    if (!loadResult.success) {
      return {
        success: false,
        message: loadResult.message
      };
    }

    const shipment = this.shipmentsCache?.get(shipmentId);
    if (shipment) {
      return {
        success: true,
        data: shipment,
        message: `Shipment ${shipmentId} retrieved successfully`
      };
    }

    return {
      success: true,
      message: `Shipment ${shipmentId} not found in TMS system`
    };
  }

  private async ensureCacheLoaded(): Promise<Result<void>> {
    if (this.shipmentsCache !== null) {
      return { success: true, message: 'Cache already loaded' };
    }

    try {
      const fileContent = await readFile(this.dataPath, 'utf-8');
      const tmsData: TMSShipmentJSON[] = JSON.parse(fileContent);

      this.shipmentsCache = new Map();
      const validationErrors: string[] = [];

      for (const tmsShipment of tmsData) {
        try {
          const shipment = this.mapToShipment(tmsShipment);
          this.shipmentsCache.set(shipment.shipmentId, shipment);
        } catch (error) {
          // Log but don't fail entire load - skip invalid record and continue
          const shipmentId = tmsShipment.sgl?.header?.sglShipmentNo || 'UNKNOWN';
          const errorMsg = error instanceof Error ? error.message : String(error);
          validationErrors.push(`Shipment ${shipmentId}: ${errorMsg}`);
          console.warn(`[TMS Adapter] Skipping invalid shipment record: ${errorMsg}`);
        }
      }

      const message = validationErrors.length > 0
        ? `TMS data loaded with ${validationErrors.length} invalid record(s) skipped`
        : 'TMS data loaded successfully';

      return { success: true, message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to load TMS data: ${errorMessage}`
      };
    }
  }

  private mapToShipment(tmsShipment: TMSShipmentJSON): Shipment {
    // Validate external data before mapping to domain
    const validationResult = TMSShipmentSchema.safeParse(tmsShipment);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`TMS data validation failed: ${errors}`);
    }

    const validated = validationResult.data;

    const containers: Container[] = validated.sgl.containers.map(c => ({
      containerNumber: c.containerNo
    }));

    return {
      shipmentId: validated.sgl.header.sglShipmentNo,
      customerName: validated.sgl.parties.customer.name,
      shipperName: validated.sgl.parties.shipper.name,
      containers
    };
  }
}
