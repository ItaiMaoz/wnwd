// Result types for service responses

/**
 * Represents the outcome of an operation that may succeed or fail.
 * Discriminated union prevents invalid states.
 */
export type Result<T> =
  | { readonly success: true; readonly data: T; readonly message: string }        // Success with data
  | { readonly success: true; readonly message: string }                          // Success without data (not found)
  | { readonly success: false; readonly message: string };                        // Failure

export enum WeatherFetchStatus {
  SUCCESS = 'SUCCESS',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  FATAL_ERROR = 'FATAL_ERROR'
}

/**
 * Weather fetch result as discriminated union.
 * Each status has appropriate required/optional fields.
 */
export type WeatherResult =
  | {
      readonly status: WeatherFetchStatus.SUCCESS;
      readonly data: {
        temperature?: number;
        windSpeed?: number;
        windDirection?: number;
      };
    }
  | {
      readonly status: WeatherFetchStatus.NO_DATA_AVAILABLE;
      readonly error?: string;
    }
  | {
      readonly status: WeatherFetchStatus.RETRY_EXHAUSTED;
      readonly error: string;
    }
  | {
      readonly status: WeatherFetchStatus.FATAL_ERROR;
      readonly error: string;
    };

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

// ============================================================================
// Type Guards - Shared utility functions for type narrowing
// ============================================================================

/**
 * Type guard to check if Result has data (success with data case).
 * Narrows type to { readonly success: true; readonly data: T; readonly message: string }
 */
export function isSuccess<T>(result: Result<T>): result is { readonly success: true; readonly data: T; readonly message: string } {
  return result.success && 'data' in result;
}

/**
 * Type guard to check if Result is not found (success without data case).
 * Narrows type to { readonly success: true; readonly message: string }
 */
export function isNotFound<T>(result: Result<T>): result is { readonly success: true; readonly message: string } {
  return result.success && !('data' in result);
}

/**
 * Type guard to check if Result is a failure.
 * Narrows type to { readonly success: false; readonly message: string }
 */
export function isFailure<T>(result: Result<T>): result is { readonly success: false; readonly message: string } {
  return !result.success;
}

/**
 * Type guard to check if WeatherResult is successful.
 * Narrows type to { status: SUCCESS; data: {...} }
 */
export function isWeatherSuccess(result: WeatherResult): result is { readonly status: WeatherFetchStatus.SUCCESS; readonly data: { temperature?: number; windSpeed?: number; windDirection?: number } } {
  return result.status === WeatherFetchStatus.SUCCESS;
}

/**
 * Type guard to check if WeatherResult has an error.
 * Narrows type to { status: RETRY_EXHAUSTED | FATAL_ERROR; error: string }
 */
export function hasWeatherError(result: WeatherResult): result is { readonly status: WeatherFetchStatus.RETRY_EXHAUSTED | WeatherFetchStatus.FATAL_ERROR; readonly error: string } {
  return result.status === WeatherFetchStatus.RETRY_EXHAUSTED || result.status === WeatherFetchStatus.FATAL_ERROR;
}

/**
 * Type guard to check if WeatherResult is no data available.
 * Narrows type to { status: NO_DATA_AVAILABLE; error?: string }
 */
export function isWeatherNoData(result: WeatherResult): result is { readonly status: WeatherFetchStatus.NO_DATA_AVAILABLE; readonly error?: string } {
  return result.status === WeatherFetchStatus.NO_DATA_AVAILABLE;
}
