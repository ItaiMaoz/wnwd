import { Shipment } from '../../types/domain.types';
import { Result } from '../../types/result.types';

/**
 * Adapter for retrieving shipment data from customer TMS systems.
 */
export interface IShipmentDataAdapter {
  /**
   * Retrieves a shipment by its ID.
   * @returns Result with success=true and data if found, success=true without data if not found, success=false on error
   */
  getShipmentById(shipmentId: string): Promise<Result<Shipment>>;
}
