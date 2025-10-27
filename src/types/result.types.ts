// Result types for service responses

/**
 * Represents the outcome of an operation that may succeed or fail.
 * Success with no data (e.g., not found) is indicated by success=true with no data.
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  message: string;
}

export enum WeatherFetchStatus {
  SUCCESS = 'SUCCESS',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  FATAL_ERROR = 'FATAL_ERROR'
}

export interface WeatherResult {
  status: WeatherFetchStatus;
  data?: {
    temperature?: number;
    windSpeed?: number;
    windDirection?: number;
  };
  error?: string;
}

export interface ShipmentAnalysisRecord {
  sglShipmentNo: string;
  customerName: string;
  shipperName: string;
  containerNumber: string;
  scac?: string;
  initialCarrierETA?: string;  // ISO 8601 string
  actualArrivalAt?: string;    // ISO 8601 string
  delayReasons?: string;       // Joined with '; '
  temperature?: number;
  windSpeed?: number;
  weatherFetchStatus?: WeatherFetchStatus;
  lastUpdated: string;         // ISO 8601 timestamp of analysis
  error?: string;              // Error message if fetch failed
}

export interface ShipmentAnalysisError {
  containerNumber: string;
  errorType: string;
  message: string;
}

export interface ReportGenerationResult {
  success: boolean;
  records: ShipmentAnalysisRecord[];
  errors: ShipmentAnalysisError[];
}
