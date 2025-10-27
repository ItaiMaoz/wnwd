import { inject, injectable } from 'tsyringe';
import { IShipmentDataAdapter } from '../adapters/shipment/shipment-adapter.interface';
import { ITrackingDataAdapter } from '../adapters/tracking/tracking-adapter.interface';
import { IWeatherProvider } from '../adapters/weather/weather-provider.interface';
import { Tracking } from '../types/domain.types';
import { isFailure, isNotFound, isSuccess, isWeatherSuccess, ShipmentAnalysisError, ShipmentAnalysisRecord, WeatherFetchStatus } from '../types/result.types';
import { IDelayAnalyzer } from './delay-analyzer.interface';
import { IShipmentAnalyzer, ShipmentAnalysisResult } from './shipment-analyzer.interface';

@injectable()
export class ShipmentAnalyzerService implements IShipmentAnalyzer {
  private static readonly CONFIDENCE_THRESHOLD = 0.8;
  private static readonly MAX_CONFIDENCE_RETRIES = 1;

  constructor(
    @inject('IShipmentDataAdapter') private shipmentAdapter: IShipmentDataAdapter,
    @inject('ITrackingDataAdapter') private trackingAdapter: ITrackingDataAdapter,
    @inject('IWeatherProvider') private weatherProvider: IWeatherProvider,
    @inject('IDelayAnalyzer') private delayAnalyzer: IDelayAnalyzer
  ) {}

  async analyzeShipments(shipmentIds: string[]): Promise<ShipmentAnalysisResult> {
    const records: ShipmentAnalysisRecord[] = [];
    const errors: ShipmentAnalysisError[] = [];

    for (const shipmentId of shipmentIds) {
      const shipmentResult = await this.shipmentAdapter.getShipmentById(shipmentId);

      if (!isSuccess(shipmentResult)) {
        const errorType = isFailure(shipmentResult) ? 'SHIPMENT_FETCH_ERROR' : 'SHIPMENT_NOT_FOUND';
        errors.push({
          containerNumber: shipmentId,
          errorType,
          message: shipmentResult.message
        });
        records.push(this.buildErrorRecord(shipmentId));
        continue;
      }

      // TypeScript knows: shipmentResult has data
      const shipment = shipmentResult.data;

      for (const container of shipment.containers) {
        const trackingResult = await this.trackingAdapter.getTrackingByContainer(
          container.containerNumber
        );

        let tracking: Tracking | undefined;
        if (isFailure(trackingResult)) {
          errors.push({
            containerNumber: container.containerNumber,
            errorType: 'TRACKING_FETCH_ERROR',
            message: trackingResult.message
          });
        } else if (isSuccess(trackingResult)) {
          tracking = trackingResult.data;
        }

        const record = this.buildBaseRecord(
          shipment,
          container.containerNumber,
          tracking
        );

        // Weather enrichment if weather-related delay
        if (tracking && await this.hasWeatherRelatedDelay(tracking, container.containerNumber, errors)) {
          const weatherResult = await this.fetchWeatherSafely(
            tracking,
            container.containerNumber,
            errors
          );

          if (isWeatherSuccess(weatherResult)) {
            record.temperature = weatherResult.data.temperature;
            record.windSpeed = weatherResult.data.windSpeed;
          }

          record.weatherFetchStatus = weatherResult.status;
        }

        records.push(record);
      }
    }

    return { records, errors };
  }

  private buildErrorRecord(shipmentId: string): ShipmentAnalysisRecord {
    return {
      sglShipmentNo: shipmentId,
      customerName: '',
      shipperName: '',
      containerNumber: '',
      lastUpdated: new Date().toISOString()
    };
  }

  private buildBaseRecord(
    shipment: { shipmentId: string; customerName: string; shipperName: string },
    containerNumber: string,
    tracking?: Tracking
  ): ShipmentAnalysisRecord {
    return {
      sglShipmentNo: shipment.shipmentId,
      customerName: shipment.customerName,
      shipperName: shipment.shipperName,
      containerNumber,
      scac: tracking?.scac,
      initialCarrierETA: tracking?.estimatedArrival?.toISOString(),
      actualArrivalAt: tracking?.actualArrival?.toISOString(),
      delayReasons: tracking?.delayReasons?.join('; '),
      lastUpdated: new Date().toISOString()
    };
  }

  private async hasWeatherRelatedDelay(
    tracking: Tracking,
    containerNumber: string,
    errors: ShipmentAnalysisError[]
  ): Promise<boolean> {
    for (const reason of tracking.delayReasons) {
      const analysis = await this.analyzeDelayWithConfidenceCheck(
        reason,
        containerNumber,
        errors
      );

      if (analysis === null) {
        // Analysis failed due to low confidence even after retry
        continue;
      }

      if (analysis.isWeatherRelated) {
        return true;
      }
    }
    return false;
  }

  private async analyzeDelayWithConfidenceCheck(
    delayReason: string,
    containerNumber: string,
    errors: ShipmentAnalysisError[]
  ) {
    // First attempt
    let analysis = await this.delayAnalyzer.analyzeDelay(delayReason);

    if (analysis.confidence >= ShipmentAnalyzerService.CONFIDENCE_THRESHOLD) {
      return analysis;
    }

    // Low confidence - retry once
    console.log(
      `[Low Confidence] Container ${containerNumber}: Confidence ${analysis.confidence} < ${ShipmentAnalyzerService.CONFIDENCE_THRESHOLD}, retrying...`
    );

    analysis = await this.delayAnalyzer.analyzeDelay(delayReason);

    if (analysis.confidence >= ShipmentAnalyzerService.CONFIDENCE_THRESHOLD) {
      console.log(`[Retry Success] Container ${containerNumber}: Confidence improved to ${analysis.confidence}`);
      return analysis;
    }

    // Still low confidence after retry - fail the analysis
    const errorMessage = `Delay analysis confidence too low (${analysis.confidence}) even after retry for delay: "${delayReason}"`;
    console.error(`[Analysis Failed] Container ${containerNumber}: ${errorMessage}`);

    errors.push({
      containerNumber,
      errorType: 'DELAY_ANALYSIS_LOW_CONFIDENCE',
      message: errorMessage
    });

    return null;
  }

  private async fetchWeatherSafely(
    tracking: Tracking,
    containerNumber: string,
    errors: ShipmentAnalysisError[]
  ): Promise<import('../types/result.types').WeatherResult> {
    if (!tracking.destinationPort || !tracking.actualArrival) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: 'Missing port location or arrival date'
      } as const;
    }

    try {
      return await this.weatherProvider.getWeather(
        tracking.destinationPort.latitude,
        tracking.destinationPort.longitude,
        tracking.actualArrival
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      errors.push({
        containerNumber,
        errorType: 'WEATHER_FETCH_ERROR',
        message: errorMessage
      });

      return {
        status: WeatherFetchStatus.FATAL_ERROR,
        error: errorMessage
      } as const;
    }
  }
}
