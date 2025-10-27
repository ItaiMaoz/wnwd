import 'reflect-metadata';
import { container } from 'tsyringe';
import { IShipmentDataAdapter } from '../adapters/shipment/shipment-adapter.interface';
import { TMSJsonAdapter } from '../adapters/shipment/tms-json.adapter';
import { ITrackingDataAdapter } from '../adapters/tracking/tracking-adapter.interface';
import { WindwardJsonAdapter } from '../adapters/tracking/windward-json.adapter';
import { IWeatherProvider } from '../adapters/weather/weather-provider.interface';
import { OpenMeteoWeatherProvider } from '../adapters/weather/open-meteo.provider';
import { CsvProcessorService } from '../services/csv-processor.service';
import { ICsvProcessor } from '../services/csv-processor.interface';
import { IDelayAnalyzer } from '../services/delay-analyzer.interface';
import { OpenAIDelayAnalyzerService } from '../services/openai-delay-analyzer.service';
import { IShipmentAnalyzer } from '../services/shipment-analyzer.interface';
import { ShipmentAnalyzerService } from '../services/shipment-analyzer.service';
import { AppConfig } from './app.config';

export function setupDI(config: AppConfig): void {
  // Register configuration values
  container.register('TMSDataPath', { useValue: config.data.tmsPath });
  container.register('WindwardDataPath', { useValue: config.data.windwardPath });
  container.register('AppConfig', { useValue: config });

  // Register adapters
  container.register<IShipmentDataAdapter>('IShipmentDataAdapter', {
    useClass: TMSJsonAdapter
  });

  container.register<ITrackingDataAdapter>('ITrackingDataAdapter', {
    useClass: WindwardJsonAdapter
  });

  container.register<IWeatherProvider>('IWeatherProvider', {
    useClass: OpenMeteoWeatherProvider
  });

  // Register services
  container.register<ICsvProcessor>('ICsvProcessor', {
    useClass: CsvProcessorService
  });

  container.register<IDelayAnalyzer>('IDelayAnalyzer', {
    useClass: OpenAIDelayAnalyzerService
  });

  container.register<IShipmentAnalyzer>('IShipmentAnalyzer', {
    useClass: ShipmentAnalyzerService
  });
}
