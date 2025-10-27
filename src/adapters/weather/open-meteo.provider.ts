import { inject, injectable } from 'tsyringe';
import { WeatherFetchStatus, WeatherResult } from '../../types/result.types';
import { AppConfig } from '../../config/app.config';
import { retryWithBackoff, RetryExhaustedError, isNetworkError } from '../../utils/retry.util';
import { IWeatherProvider } from './weather-provider.interface';

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units?: {
    time: string;
    temperature_2m: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
  };
  error?: boolean;
  reason?: string;
}

@injectable()
export class OpenMeteoWeatherProvider implements IWeatherProvider {
  private readonly baseUrl = 'https://archive-api.open-meteo.com/v1/archive';

  constructor(@inject('AppConfig') private config: AppConfig) {}

  async getWeather(
    latitude: number,
    longitude: number,
    date: Date
  ): Promise<WeatherResult> {
    // Validate date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate > today) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: `Archive API only supports historical data. Requested date ${date.toISOString().split('T')[0]} is in the future.`
      };
    }

    try {
      const response = await retryWithBackoff<OpenMeteoResponse>(
        () => this.fetchWeatherData(latitude, longitude, date),
        this.config.retry,
        (error) => this.isRetryableError(error)
      );

      return this.parseWeatherResponse(response, date);
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        return {
          status: WeatherFetchStatus.RETRY_EXHAUSTED,
          error: `Failed to fetch weather data after ${error.attempts} attempts: ${error.lastError.message}`
        };
      }

      return {
        status: WeatherFetchStatus.FATAL_ERROR,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async fetchWeatherData(
    latitude: number,
    longitude: number,
    date: Date
  ): Promise<OpenMeteoResponse> {
    const dateStr = date.toISOString().split('T')[0];
    const url = new URL(this.baseUrl);

    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('start_date', dateStr);
    url.searchParams.set('end_date', dateStr);
    url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,wind_direction_10m');
    url.searchParams.set('timezone', 'UTC');

    const response = await fetch(url.toString());

    // Check HTTP status first (for retryability)
    if (!response.ok) {
      const httpError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (httpError as any).statusCode = response.status;
      throw httpError;
    }

    const data = await response.json() as OpenMeteoResponse;

    // Check for API errors (should only happen on successful HTTP status)
    if (data.error === true) {
      throw new Error(`Open-Meteo API error: ${data.reason || 'Unknown error'}`);
    }

    return data;
  }

  private parseWeatherResponse(response: OpenMeteoResponse, targetDate: Date): WeatherResult {
    if (!response.hourly || !response.hourly.time || response.hourly.time.length === 0) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: 'No hourly data returned from API'
      };
    }

    // Find closest hour to target timestamp
    const targetHour = targetDate.getUTCHours();
    const hourlyData = response.hourly;
    const targetHourStr = targetHour.toString().padStart(2, '0');
    const index = hourlyData.time.findIndex(t => t.includes(`T${targetHourStr}:`));

    if (index < 0) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: `No data found for hour ${targetHourStr}:00 UTC`
      };
    }

    // Extract weather data
    const tempCelsius = hourlyData.temperature_2m[index];
    const windSpeedKmh = hourlyData.wind_speed_10m[index];
    const windDirection = hourlyData.wind_direction_10m[index];

    // Check for null values
    if (tempCelsius === null || tempCelsius === undefined) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: 'Temperature data is null'
      };
    }

    if (windSpeedKmh === null || windSpeedKmh === undefined) {
      return {
        status: WeatherFetchStatus.NO_DATA_AVAILABLE,
        error: 'Wind speed data is null'
      };
    }

    // Convert wind speed from km/h to m/s
    const windSpeedMs = windSpeedKmh / 3.6;

    return {
      status: WeatherFetchStatus.SUCCESS,
      data: {
        temperature: Math.round(tempCelsius * 10) / 10,
        windSpeed: Math.round(windSpeedMs * 10) / 10,
        windDirection: windDirection ?? undefined
      }
    };
  }

  private isRetryableError(error: Error): boolean {
    // Network errors are retryable
    if (isNetworkError(error)) {
      return true;
    }

    // HTTP 5xx and 429 are retryable
    const statusCode = (error as any).statusCode;
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
      return true;
    }

    // API errors (4xx) are not retryable
    if (error.message.includes('Open-Meteo API error')) {
      return false;
    }

    // Default: don't retry
    return false;
  }
}
