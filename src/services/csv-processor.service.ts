import * as fs from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { injectable } from 'tsyringe';
import { ShipmentAnalysisRecord } from '../types/result.types';
import { ICsvProcessor } from './csv-processor.interface';

@injectable()
export class CsvProcessorService implements ICsvProcessor {
  async readShipmentIds(csvPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const shipmentIds: string[] = [];

      fs.createReadStream(csvPath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', (row: { shipmentId: string }) => {
          if (row.shipmentId) {
            shipmentIds.push(row.shipmentId);
          }
        })
        .on('end', () => resolve(shipmentIds))
        .on('error', (error) => reject(error));
    });
  }

  async writeEnrichedCsv(
    outputPath: string,
    records: ShipmentAnalysisRecord[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const columns = [
        'sglShipmentNo',
        'customerName',
        'shipperName',
        'containerNumber',
        'scac',
        'initialCarrierETA',
        'actualArrivalAt',
        'delayReasons',
        'temperature',
        'windSpeed',
        'weatherFetchStatus',
        'lastUpdated',
        'error'
      ];

      stringify(records, { header: true, columns }, (err, output) => {
        if (err) {
          reject(err);
          return;
        }

        fs.writeFile(outputPath, output, (writeErr) => {
          if (writeErr) {
            reject(writeErr);
            return;
          }
          resolve();
        });
      });
    });
  }
}
