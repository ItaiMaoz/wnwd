import 'reflect-metadata';
import { OpenMeteoWeatherProvider } from './open-meteo.provider';
import { AppConfig } from '../../config/app.config';
import { WeatherFetchStatus } from '../../types/result.types';

// Mock global fetch
global.fetch = jest.fn();

describe('OpenMeteoWeatherProvider', () => {
  let provider: OpenMeteoWeatherProvider;
  let mockConfig: AppConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      data: {
        tmsPath: './context/tms-data.json',
        windwardPath: './context/windward-data.json'
      },
      retry: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        jitterFactor: 0.1
      },
      openai: {
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 150
      }
    };
    provider = new OpenMeteoWeatherProvider(mockConfig);
  });

  describe('getWeather - Successful responses', () => {
    // Test: Valid API response returns weather data
    it('should return weather data with SUCCESS status for valid response', async () => {
      // Arrange: Mock successful Open-Meteo response
      const mockResponse = {
        latitude: 53.532513,
        longitude: 9.980879,
        generationtime_ms: 0.355,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 3,
        hourly_units: {
          time: 'iso8601',
          temperature_2m: '°C',
          wind_speed_10m: 'km/h',
          wind_direction_10m: '°'
        },
        hourly: {
          time: ['2025-07-20T14:00', '2025-07-20T15:00'],
          temperature_2m: [24.6, 25.0],
          wind_speed_10m: [10.8, 11.5],
          wind_direction_10m: [240, 245]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:30:00Z');

      // Act: Request weather data
      const result = await provider.getWeather(53.5511, 9.9937, testDate);

      // Assert: Returns success with converted wind speed (km/h → m/s)
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data).toEqual({
        temperature: 24.6,
        windSpeed: 3.0, // 10.8 km/h / 3.6 = 3.0 m/s
        windDirection: 240
      });
      expect(result.error).toBeUndefined();
    });

    // Test: Wind speed conversion accuracy
    it('should correctly convert wind speed from km/h to m/s', async () => {
      // Arrange: Response with known wind speed
      const mockResponse = {
        latitude: 32.8167,
        longitude: 34.9896,
        generationtime_ms: 0.5,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 40,
        hourly: {
          time: ['2025-08-01T15:00'],
          temperature_2m: [28.9],
          wind_speed_10m: [14.4], // 14.4 km/h = 4.0 m/s
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-08-01T15:30:00Z');

      // Act: Request weather
      const result = await provider.getWeather(32.8167, 34.9896, testDate);

      // Assert: Wind speed accurately converted
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data?.windSpeed).toBe(4.0); // 14.4 / 3.6 = 4.0
    });

    // Test: Finds correct hour when multiple hours available
    it('should match the correct hour from hourly data array', async () => {
      // Arrange: Response with multiple hours
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: [
            '2025-07-20T12:00',
            '2025-07-20T13:00',
            '2025-07-20T14:00', // Target hour
            '2025-07-20T15:00'
          ],
          temperature_2m: [20.0, 21.0, 22.0, 23.0],
          wind_speed_10m: [10.0, 11.0, 12.0, 13.0],
          wind_direction_10m: [100, 110, 120, 130]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:30:00Z');

      // Act: Request weather for 14:30 UTC
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns data for 14:00 hour (closest)
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data?.temperature).toBe(22.0);
      expect(result.data?.windSpeed).toBe(3.3); // 12.0 km/h / 3.6
    });
  });

  describe('getWeather - Future date validation', () => {
    // Test: Rejects future dates before calling API
    it('should return NO_DATA_AVAILABLE for future dates without calling API', async () => {
      // Arrange: Future date (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Act: Request weather for future date
      const result = await provider.getWeather(50.0, 10.0, tomorrow);

      // Assert: Rejects without calling fetch
      expect(result.status).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);
      expect(result.error).toContain('future');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getWeather - Missing or null data', () => {
    // Test: No hourly data in response
    it('should return NO_DATA_AVAILABLE when hourly data is missing', async () => {
      // Arrange: Response without hourly data
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100
        // Missing hourly field
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns NO_DATA_AVAILABLE
      expect(result.status).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);
      expect(result.error).toContain('No hourly data');
    });

    // Test: Null temperature value
    it('should return NO_DATA_AVAILABLE when temperature is null', async () => {
      // Arrange: Response with null temperature
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [null], // Null temperature
          wind_speed_10m: [10.0],
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns NO_DATA_AVAILABLE with specific error
      expect(result.status).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);
      expect(result.error).toContain('Temperature data is null');
    });

    // Test: Null wind speed value
    it('should return NO_DATA_AVAILABLE when wind speed is null', async () => {
      // Arrange: Response with null wind speed
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [25.0],
          wind_speed_10m: [null], // Null wind speed
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns NO_DATA_AVAILABLE with specific error
      expect(result.status).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);
      expect(result.error).toContain('Wind speed data is null');
    });

    // Test: Requested hour not in response
    it('should return NO_DATA_AVAILABLE when requested hour is not in data', async () => {
      // Arrange: Response without target hour
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T10:00', '2025-07-20T11:00'], // Missing 14:00
          temperature_2m: [20.0, 21.0],
          wind_speed_10m: [10.0, 11.0],
          wind_direction_10m: [100, 110]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:30:00Z');

      // Act: Request weather for 14:30 (hour 14 not in data)
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns NO_DATA_AVAILABLE
      expect(result.status).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);
      expect(result.error).toContain('No data found for hour 14:00');
    });
  });

  describe('getWeather - API errors', () => {
    // Test: HTTP 400 errors are non-retryable
    it('should return FATAL_ERROR for HTTP 400 errors without retry', async () => {
      // Arrange: HTTP 400 response (parameter validation error)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns FATAL_ERROR (non-retryable)
      expect(result.status).toBe(WeatherFetchStatus.FATAL_ERROR);
      expect(result.error).toContain('HTTP 400');
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    // Test: HTTP 404 errors are non-retryable
    it('should return FATAL_ERROR for HTTP 404 errors without retry', async () => {
      // Arrange: HTTP 404 response (endpoint not found)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns FATAL_ERROR
      expect(result.status).toBe(WeatherFetchStatus.FATAL_ERROR);
      expect(result.error).toContain('HTTP 404');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWeather - HTTP errors and retry logic', () => {
    // Test: HTTP 500 triggers retry then succeeds
    it('should retry on HTTP 500 and succeed on second attempt', async () => {
      // Arrange: First call fails with 500, second succeeds
      const mockSuccessResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [25.0],
          wind_speed_10m: [10.8],
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse
        });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Eventually succeeds after retry
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data?.temperature).toBe(25.0);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Test: HTTP 429 (rate limit) is retryable
    it('should retry on HTTP 429 rate limit error', async () => {
      // Arrange: Rate limit then success
      const mockSuccessResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [25.0],
          wind_speed_10m: [10.8],
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse
        });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Retries and succeeds
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Test: Exhausts retries and returns RETRY_EXHAUSTED
    it('should return RETRY_EXHAUSTED after max retry attempts', async () => {
      // Arrange: All attempts fail with 500
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns RETRY_EXHAUSTED after all attempts
      expect(result.status).toBe(WeatherFetchStatus.RETRY_EXHAUSTED);
      expect(result.error).toContain('Failed to fetch weather data after');
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('getWeather - Network errors', () => {
    // Test: Network timeout is retryable
    it('should retry on network timeout errors', async () => {
      // Arrange: Timeout then success
      const mockSuccessResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [25.0],
          wind_speed_10m: [10.8],
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse
        });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Retries and succeeds
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getWeather - Edge cases', () => {
    // Test: Wind direction can be null (optional field)
    it('should handle null wind direction gracefully', async () => {
      // Arrange: Response with null wind direction
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [25.0],
          wind_speed_10m: [10.8],
          wind_direction_10m: [null] // Wind direction is optional
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Returns success with undefined wind direction
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data?.temperature).toBe(25.0);
      expect(result.data?.windSpeed).toBe(3.0);
      expect(result.data?.windDirection).toBeUndefined();
    });

    // Test: Decimal precision maintained
    it('should round temperature and wind speed to 1 decimal place', async () => {
      // Arrange: Response with high precision values
      const mockResponse = {
        latitude: 50.0,
        longitude: 10.0,
        generationtime_ms: 1.0,
        utc_offset_seconds: 0,
        timezone: 'GMT',
        timezone_abbreviation: 'GMT',
        elevation: 100,
        hourly: {
          time: ['2025-07-20T14:00'],
          temperature_2m: [24.567],
          wind_speed_10m: [10.789],
          wind_direction_10m: [180]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const testDate = new Date('2025-07-20T14:00:00Z');

      // Act: Request weather
      const result = await provider.getWeather(50.0, 10.0, testDate);

      // Assert: Values rounded to 1 decimal place
      expect(result.status).toBe(WeatherFetchStatus.SUCCESS);
      expect(result.data?.temperature).toBe(24.6); // 24.567 rounded
      expect(result.data?.windSpeed).toBe(3.0); // 10.789 / 3.6 = 2.997... rounded to 3.0
    });
  });
});
