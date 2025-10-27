import { Tracking } from '../../types/domain.types';
import { Result } from '../../types/result.types';

/**
 * Adapter for retrieving tracking data from external tracking providers.
 */
export interface ITrackingDataAdapter {
  /**
   * Retrieves tracking information by container number.
   * @returns Result with success=true and data if found, success=true without data if not found, success=false on error
   */
  getTrackingByContainer(containerNumber: string): Promise<Result<Tracking>>;
}
