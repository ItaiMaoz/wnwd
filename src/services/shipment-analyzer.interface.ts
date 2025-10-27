import { ShipmentAnalysisError, ShipmentAnalysisRecord } from '../types/result.types';

export interface ShipmentAnalysisResult {
  records: ShipmentAnalysisRecord[];
  errors: ShipmentAnalysisError[];
}

export interface IShipmentAnalyzer {
  analyzeShipments(shipmentIds: string[]): Promise<ShipmentAnalysisResult>;
}
