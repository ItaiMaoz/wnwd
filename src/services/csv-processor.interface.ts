import { ShipmentAnalysisRecord } from '../types/result.types';

export interface ICsvProcessor {
  readShipmentIds(csvPath: string): Promise<string[]>;
  writeEnrichedCsv(outputPath: string, records: ShipmentAnalysisRecord[]): Promise<void>;
}
