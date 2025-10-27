import { readFile } from 'fs/promises';
import { inject, injectable } from 'tsyringe';
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
      for (const tmsShipment of tmsData) {
        const shipment = this.mapToShipment(tmsShipment);
        this.shipmentsCache.set(shipment.shipmentId, shipment);
      }

      return { success: true, message: 'TMS data loaded successfully' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to load TMS data: ${errorMessage}`
      };
    }
  }

  private mapToShipment(tmsShipment: TMSShipmentJSON): Shipment {
    const containers: Container[] = tmsShipment.sgl.containers.map(c => ({
      containerNumber: c.containerNo
    }));

    return {
      shipmentId: tmsShipment.sgl.header.sglShipmentNo,
      customerName: tmsShipment.sgl.parties.customer.name,
      shipperName: tmsShipment.sgl.parties.shipper.name,
      containers
    };
  }
}
