import 'reflect-metadata';
import { IShipmentDataAdapter } from '../adapters/shipment/shipment-adapter.interface';
import { ITrackingDataAdapter } from '../adapters/tracking/tracking-adapter.interface';
import { IWeatherProvider } from '../adapters/weather/weather-provider.interface';
import { Shipment, Tracking } from '../types/domain.types';
import { WeatherFetchStatus, WeatherResult } from '../types/result.types';
import { IDelayAnalyzer } from './delay-analyzer.interface';
import { ShipmentAnalyzerService } from './shipment-analyzer.service';

describe('ShipmentAnalyzerService - Integration Tests', () => {
  let analyzer: ShipmentAnalyzerService;
  let mockShipmentAdapter: jest.Mocked<IShipmentDataAdapter>;
  let mockTrackingAdapter: jest.Mocked<ITrackingDataAdapter>;
  let mockWeatherProvider: jest.Mocked<IWeatherProvider>;
  let mockDelayAnalyzer: jest.Mocked<IDelayAnalyzer>;

  beforeEach(() => {
    mockShipmentAdapter = {
      getShipmentById: jest.fn()
    };

    mockTrackingAdapter = {
      getTrackingByContainer: jest.fn()
    };

    mockWeatherProvider = {
      getWeather: jest.fn()
    };

    mockDelayAnalyzer = {
      analyzeDelay: jest.fn()
    };

    analyzer = new ShipmentAnalyzerService(
      mockShipmentAdapter,
      mockTrackingAdapter,
      mockWeatherProvider,
      mockDelayAnalyzer,
      5 // Default batch size
    );
  });

  describe('Positive Scenarios - Valid Results', () => {
    // Test: Successful analysis with complete data and weather enrichment
    it('should successfully analyze shipment with weather-related delay and fetch weather data', async () => {
      // Arrange: Shipment with containers, tracking with weather delay
      const shipment: Shipment = {
        shipmentId: 'SGL001',
        customerName: 'Acme Corp',
        shipperName: 'Global Logistics',
        containers: [
          { containerNumber: 'UACU5855346' }
        ]
      };

      const tracking: Tracking = {
        containerNumber: 'UACU5855346',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Heavy fog conditions', 'Port congestion'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'HAMBURG'
        }
      };

      const weatherResult: WeatherResult = {
        status: WeatherFetchStatus.SUCCESS,
        data: {
          temperature: 18.5,
          windSpeed: 12.3,
          windDirection: 270
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: true,
        reasoning: 'Heavy fog is a weather condition',
        confidence: 0.95
      });
      mockWeatherProvider.getWeather.mockResolvedValue(weatherResult);

      // Act: Analyze shipments
      const result = await analyzer.analyzeShipments(['SGL001']);

      // Assert: Complete record with weather data
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const record = result.records[0];
      expect(record.sglShipmentNo).toBe('SGL001');
      expect(record.customerName).toBe('Acme Corp');
      expect(record.shipperName).toBe('Global Logistics');
      expect(record.containerNumber).toBe('UACU5855346');
      expect(record.scac).toBe('MAEU');
      expect(record.initialCarrierETA).toBe('2025-07-16T03:00:00.000Z');
      expect(record.actualArrivalAt).toBe('2025-07-20T14:30:00.000Z');
      expect(record.delayReasons).toBe('Heavy fog conditions; Port congestion');
      expect(record.temperature).toBe(18.5);
      expect(record.windSpeed).toBe(12.3);
      expect(record.weatherFetchStatus).toBe(WeatherFetchStatus.SUCCESS);

      expect(mockWeatherProvider.getWeather).toHaveBeenCalledWith(53.5511, 9.9937, tracking.actualArrival);
    });

    // Test: Multiple containers in single shipment with mixed weather delays
    it('should analyze shipment with multiple containers, some with weather delays', async () => {
      // Arrange: Shipment with 2 containers, only one has weather delay
      const shipment: Shipment = {
        shipmentId: 'SGL002',
        customerName: 'Tech Solutions',
        shipperName: 'Express Shipping',
        containers: [
          { containerNumber: 'CONT001' },
          { containerNumber: 'CONT002' }
        ]
      };

      const tracking1: Tracking = {
        containerNumber: 'CONT001',
        scac: 'MSCU',
        estimatedArrival: new Date('2025-08-01T12:00:00Z'),
        actualArrival: new Date('2025-08-01T15:00:00Z'),
        delayReasons: ['Storm conditions'],
        destinationPort: {
          latitude: 32.8167,
          longitude: 34.9896,
          name: 'HAIFA'
        }
      };

      const tracking2: Tracking = {
        containerNumber: 'CONT002',
        scac: 'MSCU',
        estimatedArrival: new Date('2025-08-01T12:00:00Z'),
        actualArrival: new Date('2025-08-01T12:30:00Z'),
        delayReasons: ['Customs inspection'],
        destinationPort: {
          latitude: 32.8167,
          longitude: 34.9896,
          name: 'HAIFA'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer
        .mockResolvedValueOnce({
          success: true,
          data: tracking1,
          message: 'Tracking found'
        })
        .mockResolvedValueOnce({
          success: true,
          data: tracking2,
          message: 'Tracking found'
        });

      mockDelayAnalyzer.analyzeDelay
        .mockResolvedValueOnce({
          isWeatherRelated: true,
          reasoning: 'Storm is a weather condition',
          confidence: 0.95
        })
        .mockResolvedValueOnce({
          isWeatherRelated: false,
          reasoning: 'Customs is not weather-related',
          confidence: 0.9
        });

      mockWeatherProvider.getWeather.mockResolvedValue({
        status: WeatherFetchStatus.SUCCESS,
        data: { temperature: 28.0, windSpeed: 18.5 }
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL002']);

      // Assert: Two records, only first has weather data
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.records[0].containerNumber).toBe('CONT001');
      expect(result.records[0].temperature).toBe(28.0);
      expect(result.records[0].windSpeed).toBe(18.5);
      expect(result.records[0].weatherFetchStatus).toBe(WeatherFetchStatus.SUCCESS);

      expect(result.records[1].containerNumber).toBe('CONT002');
      expect(result.records[1].temperature).toBeUndefined();
      expect(result.records[1].windSpeed).toBeUndefined();
      expect(result.records[1].weatherFetchStatus).toBeUndefined();

      expect(mockWeatherProvider.getWeather).toHaveBeenCalledTimes(1);
    });

    // Test: Successful analysis without weather delay
    it('should successfully analyze shipment with non-weather delay without fetching weather', async () => {
      // Arrange: Shipment with non-weather delay
      const shipment: Shipment = {
        shipmentId: 'SGL003',
        customerName: 'Retail Inc',
        shipperName: 'Standard Freight',
        containers: [
          { containerNumber: 'TEMU1234567' }
        ]
      };

      const tracking: Tracking = {
        containerNumber: 'TEMU1234567',
        scac: 'HLCU',
        estimatedArrival: new Date('2025-07-02T10:30:00Z'),
        actualArrival: new Date('2025-07-02T13:00:00Z'),
        delayReasons: ['Port congestion', 'Customs inspection'],
        destinationPort: {
          latitude: 51.9225,
          longitude: 4.47917,
          name: 'ROTTERDAM'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: false,
        reasoning: 'Port congestion is not weather-related',
        confidence: 0.9
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL003']);

      // Assert: Record without weather data
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const record = result.records[0];
      expect(record.containerNumber).toBe('TEMU1234567');
      expect(record.delayReasons).toBe('Port congestion; Customs inspection');
      expect(record.temperature).toBeUndefined();
      expect(record.windSpeed).toBeUndefined();
      expect(record.weatherFetchStatus).toBeUndefined();

      expect(mockWeatherProvider.getWeather).not.toHaveBeenCalled();
    });

    // Test: Successful analysis with multiple shipment IDs
    it('should analyze multiple shipments successfully', async () => {
      // Arrange: Two different shipments
      const shipment1: Shipment = {
        shipmentId: 'SGL004',
        customerName: 'Customer A',
        shipperName: 'Shipper A',
        containers: [{ containerNumber: 'CONT_A' }]
      };

      const shipment2: Shipment = {
        shipmentId: 'SGL005',
        customerName: 'Customer B',
        shipperName: 'Shipper B',
        containers: [{ containerNumber: 'CONT_B' }]
      };

      const tracking1: Tracking = {
        containerNumber: 'CONT_A',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-15T10:00:00Z'),
        delayReasons: []
      };

      const tracking2: Tracking = {
        containerNumber: 'CONT_B',
        scac: 'MSCU',
        estimatedArrival: new Date('2025-07-20T12:00:00Z'),
        delayReasons: []
      };

      mockShipmentAdapter.getShipmentById
        .mockResolvedValueOnce({
          success: true,
          data: shipment1,
          message: 'Shipment found'
        })
        .mockResolvedValueOnce({
          success: true,
          data: shipment2,
          message: 'Shipment found'
        });

      mockTrackingAdapter.getTrackingByContainer
        .mockResolvedValueOnce({
          success: true,
          data: tracking1,
          message: 'Tracking found'
        })
        .mockResolvedValueOnce({
          success: true,
          data: tracking2,
          message: 'Tracking found'
        });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: false,
        reasoning: 'Port congestion is not weather-related',
        confidence: 0.9
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL004', 'SGL005']);

      // Assert: Two records from two shipments
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.records[0].sglShipmentNo).toBe('SGL004');
      expect(result.records[0].containerNumber).toBe('CONT_A');
      expect(result.records[1].sglShipmentNo).toBe('SGL005');
      expect(result.records[1].containerNumber).toBe('CONT_B');
    });
  });

  describe('Negative Scenarios - Partial Failures', () => {
    // Test: Tracking not found, shipment data still returned
    it('should record tracking error but still return shipment data', async () => {
      // Arrange: Shipment exists but tracking not found
      const shipment: Shipment = {
        shipmentId: 'SGL006',
        customerName: 'Test Corp',
        shipperName: 'Test Shipper',
        containers: [{ containerNumber: 'MISSING_TRACKING' }]
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        message: 'Tracking not found for MISSING_TRACKING'
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL006']);

      // Assert: Record created without tracking data, no error
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const record = result.records[0];
      expect(record.sglShipmentNo).toBe('SGL006');
      expect(record.containerNumber).toBe('MISSING_TRACKING');
      expect(record.scac).toBeUndefined();
      expect(record.initialCarrierETA).toBeUndefined();
      expect(record.delayReasons).toBeUndefined();
    });

    // Test: Tracking fetch fails (adapter error)
    it('should log tracking error and create partial record', async () => {
      // Arrange: Tracking adapter fails
      const shipment: Shipment = {
        shipmentId: 'SGL007',
        customerName: 'Error Test',
        shipperName: 'Error Shipper',
        containers: [{ containerNumber: 'FAILED_TRACKING' }]
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: false,
        message: 'Error: Failed to load Windward tracking data: ENOENT'
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL007']);

      // Assert: Record created without tracking, error logged
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(1);

      expect(result.records[0].containerNumber).toBe('FAILED_TRACKING');
      expect(result.records[0].scac).toBeUndefined();

      expect(result.errors[0]).toEqual({
        containerNumber: 'FAILED_TRACKING',
        errorType: 'TRACKING_FETCH_ERROR',
        message: 'Error: Failed to load Windward tracking data: ENOENT'
      });
    });

    // Test: Weather fetch fails but analysis continues
    it('should log weather error but continue analysis with NO_DATA_AVAILABLE status', async () => {
      // Arrange: Weather fetch fails due to missing port data
      const shipment: Shipment = {
        shipmentId: 'SGL008',
        customerName: 'Weather Test',
        shipperName: 'Weather Shipper',
        containers: [{ containerNumber: 'NO_PORT_DATA' }]
      };

      const tracking: Tracking = {
        containerNumber: 'NO_PORT_DATA',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Heavy fog'],
        destinationPort: undefined // Missing port
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: true,
        reasoning: 'Heavy fog is a weather condition',
        confidence: 0.95
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL008']);

      // Assert: Record created without weather data, weather status set
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const record = result.records[0];
      expect(record.containerNumber).toBe('NO_PORT_DATA');
      expect(record.temperature).toBeUndefined();
      expect(record.weatherFetchStatus).toBe(WeatherFetchStatus.NO_DATA_AVAILABLE);

      expect(mockWeatherProvider.getWeather).not.toHaveBeenCalled();
    });

    // Test: Weather provider throws exception
    it('should log weather error when weather provider throws exception', async () => {
      // Arrange: Weather provider throws
      const shipment: Shipment = {
        shipmentId: 'SGL009',
        customerName: 'Exception Test',
        shipperName: 'Exception Shipper',
        containers: [{ containerNumber: 'WEATHER_THROWS' }]
      };

      const tracking: Tracking = {
        containerNumber: 'WEATHER_THROWS',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Storm'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'HAMBURG'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: true,
        reasoning: 'Heavy fog is a weather condition',
        confidence: 0.95
      });
      mockWeatherProvider.getWeather.mockRejectedValue(new Error('Network timeout'));

      // Act
      const result = await analyzer.analyzeShipments(['SGL009']);

      // Assert: Record created, error logged, status FATAL_ERROR
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(1);

      expect(result.records[0].weatherFetchStatus).toBe(WeatherFetchStatus.FATAL_ERROR);

      expect(result.errors[0]).toEqual({
        containerNumber: 'WEATHER_THROWS',
        errorType: 'WEATHER_FETCH_ERROR',
        message: 'Network timeout'
      });
    });

    // Test: Multiple containers with mixed success
    it('should handle mixed success across multiple containers', async () => {
      // Arrange: Shipment with 3 containers, various states
      const shipment: Shipment = {
        shipmentId: 'SGL010',
        customerName: 'Mixed Test',
        shipperName: 'Mixed Shipper',
        containers: [
          { containerNumber: 'SUCCESS' },
          { containerNumber: 'TRACKING_FAIL' },
          { containerNumber: 'WEATHER_FAIL' }
        ]
      };

      const successTracking: Tracking = {
        containerNumber: 'SUCCESS',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        delayReasons: []
      };

      const weatherFailTracking: Tracking = {
        containerNumber: 'WEATHER_FAIL',
        scac: 'MSCU',
        estimatedArrival: new Date('2025-07-18T03:00:00Z'),
        actualArrival: new Date('2025-07-18T10:00:00Z'),
        delayReasons: ['Fog'],
        destinationPort: {
          latitude: 51.0,
          longitude: 5.0,
          name: 'TEST'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer
        .mockResolvedValueOnce({
          success: true,
          data: successTracking,
          message: 'Tracking found'
        })
        .mockResolvedValueOnce({
          success: false,
          message: 'Error: Tracking service unavailable'
        })
        .mockResolvedValueOnce({
          success: true,
          data: weatherFailTracking,
          message: 'Tracking found'
        });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: true,
        reasoning: 'Heavy fog is a weather condition',
        confidence: 0.95
      });
      mockWeatherProvider.getWeather.mockRejectedValue(new Error('Weather API down'));

      // Act
      const result = await analyzer.analyzeShipments(['SGL010']);

      // Assert: 3 records, 2 errors (tracking + weather)
      expect(result.records).toHaveLength(3);
      expect(result.errors).toHaveLength(2);

      expect(result.records[0].containerNumber).toBe('SUCCESS');
      expect(result.records[1].containerNumber).toBe('TRACKING_FAIL');
      expect(result.records[2].containerNumber).toBe('WEATHER_FAIL');

      expect(result.errors).toEqual([
        {
          containerNumber: 'TRACKING_FAIL',
          errorType: 'TRACKING_FETCH_ERROR',
          message: 'Error: Tracking service unavailable'
        },
        {
          containerNumber: 'WEATHER_FAIL',
          errorType: 'WEATHER_FETCH_ERROR',
          message: 'Weather API down'
        }
      ]);
    });
  });

  describe('Complete Failures', () => {
    // Test: Shipment not found
    it('should log shipment not found error and skip processing', async () => {
      // Arrange: Shipment doesn't exist
      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        message: 'Shipment not found for ID: NONEXISTENT'
      });

      // Act
      const result = await analyzer.analyzeShipments(['NONEXISTENT']);

      // Assert: Placeholder record created, shipment error logged
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        sglShipmentNo: 'NONEXISTENT',
        customerName: '',
        shipperName: '',
        containerNumber: '',
        lastUpdated: expect.any(String)
      });
      expect(result.errors).toHaveLength(1);

      expect(result.errors[0]).toEqual({
        containerNumber: 'NONEXISTENT',
        errorType: 'SHIPMENT_NOT_FOUND',
        message: 'Shipment not found for ID: NONEXISTENT'
      });

      expect(mockTrackingAdapter.getTrackingByContainer).not.toHaveBeenCalled();
    });

    // Test: Shipment fetch fails
    it('should log shipment fetch error and skip processing', async () => {
      // Arrange: Shipment adapter fails
      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: false,
        message: 'Error: Failed to load TMS data: EACCES'
      });

      // Act
      const result = await analyzer.analyzeShipments(['FAIL001']);

      // Assert: Placeholder record created, shipment error logged
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        sglShipmentNo: 'FAIL001',
        customerName: '',
        shipperName: '',
        containerNumber: '',
        lastUpdated: expect.any(String)
      });
      expect(result.errors).toHaveLength(1);

      expect(result.errors[0]).toEqual({
        containerNumber: 'FAIL001',
        errorType: 'SHIPMENT_FETCH_ERROR',
        message: 'Error: Failed to load TMS data: EACCES'
      });
    });

    // Test: Empty shipment IDs array
    it('should return empty result for empty shipment IDs', async () => {
      // Arrange: Empty array
      // Act
      const result = await analyzer.analyzeShipments([]);

      // Assert: Empty result
      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      expect(mockShipmentAdapter.getShipmentById).not.toHaveBeenCalled();
    });

    // Test: Multiple shipment failures
    it('should log errors for multiple failed shipments', async () => {
      // Arrange: Multiple shipments all fail
      mockShipmentAdapter.getShipmentById
        .mockResolvedValueOnce({
          success: false,
          message: 'Error: Database connection failed'
        })
        .mockResolvedValueOnce({
          success: true,
          message: 'Shipment not found for ID: MISSING002'
        });

      // Act
      const result = await analyzer.analyzeShipments(['FAIL001', 'MISSING002']);

      // Assert: 2 placeholder records, 2 errors
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toEqual({
        sglShipmentNo: 'FAIL001',
        customerName: '',
        shipperName: '',
        containerNumber: '',
        lastUpdated: expect.any(String)
      });
      expect(result.records[1]).toEqual({
        sglShipmentNo: 'MISSING002',
        customerName: '',
        shipperName: '',
        containerNumber: '',
        lastUpdated: expect.any(String)
      });
      expect(result.errors).toHaveLength(2);

      expect(result.errors[0].errorType).toBe('SHIPMENT_FETCH_ERROR');
      expect(result.errors[1].errorType).toBe('SHIPMENT_NOT_FOUND');
    });

    // Test: Shipment with no containers
    it('should handle shipment with empty containers array', async () => {
      // Arrange: Shipment with no containers
      const emptyShipment: Shipment = {
        shipmentId: 'SGL_EMPTY',
        customerName: 'Empty Test',
        shipperName: 'Empty Shipper',
        containers: []
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: emptyShipment,
        message: 'Shipment found'
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL_EMPTY']);

      // Assert: No records, no errors
      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockTrackingAdapter.getTrackingByContainer).not.toHaveBeenCalled();
    });
  });

  describe('Confidence Validation and Retry', () => {
    // Test: Low confidence on first attempt, high confidence on retry
    it('should retry delay analysis when confidence is below threshold and succeed on retry', async () => {
      // Arrange
      const shipment: Shipment = {
        shipmentId: 'SGL_CONF1',
        customerName: 'Confidence Test Corp',
        shipperName: 'Test Shipper',
        containers: [{ containerNumber: 'CONF0001' }]
      };

      const tracking: Tracking = {
        containerNumber: 'CONF0001',
        scac: 'TEST',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Unclear weather conditions'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'TEST PORT'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      // First call: low confidence, second call: high confidence
      mockDelayAnalyzer.analyzeDelay
        .mockResolvedValueOnce({
          isWeatherRelated: true,
          reasoning: 'Unclear pattern',
          confidence: 0.65  // Below 0.8 threshold
        })
        .mockResolvedValueOnce({
          isWeatherRelated: true,
          reasoning: 'Weather-related after retry',
          confidence: 0.95  // Above 0.8 threshold
        });

      mockWeatherProvider.getWeather.mockResolvedValue({
        status: WeatherFetchStatus.SUCCESS,
        data: { temperature: 18.5, windSpeed: 12.3 }
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL_CONF1']);

      // Assert
      expect(mockDelayAnalyzer.analyzeDelay).toHaveBeenCalledTimes(2); // Retry happened
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0); // No error because retry succeeded
      expect(result.records[0].temperature).toBe(18.5); // Weather was fetched
    });

    // Test: Low confidence on both attempts, analysis fails
    it('should add error when confidence remains below threshold after retry', async () => {
      // Arrange
      const shipment: Shipment = {
        shipmentId: 'SGL_CONF2',
        customerName: 'Confidence Test Corp',
        shipperName: 'Test Shipper',
        containers: [{ containerNumber: 'CONF0002' }]
      };

      const tracking: Tracking = {
        containerNumber: 'CONF0002',
        scac: 'TEST',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Very ambiguous delay reason'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'TEST PORT'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      // Both calls: low confidence
      mockDelayAnalyzer.analyzeDelay
        .mockResolvedValueOnce({
          isWeatherRelated: true,
          reasoning: 'Unclear pattern',
          confidence: 0.65  // Below 0.8 threshold
        })
        .mockResolvedValueOnce({
          isWeatherRelated: true,
          reasoning: 'Still unclear',
          confidence: 0.70  // Still below 0.8 threshold
        });

      // Act
      const result = await analyzer.analyzeShipments(['SGL_CONF2']);

      // Assert
      expect(mockDelayAnalyzer.analyzeDelay).toHaveBeenCalledTimes(2); // Retry happened
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(1); // Error added
      expect(result.errors[0]).toEqual({
        containerNumber: 'CONF0002',
        errorType: 'DELAY_ANALYSIS_LOW_CONFIDENCE',
        message: expect.stringContaining('confidence too low (0.7)')
      });
      expect(result.records[0].temperature).toBeUndefined(); // No weather fetched
      expect(mockWeatherProvider.getWeather).not.toHaveBeenCalled();
    });

    // Test: High confidence on first attempt, no retry needed
    it('should not retry when confidence is above threshold on first attempt', async () => {
      // Arrange
      const shipment: Shipment = {
        shipmentId: 'SGL_CONF3',
        customerName: 'Confidence Test Corp',
        shipperName: 'Test Shipper',
        containers: [{ containerNumber: 'CONF0003' }]
      };

      const tracking: Tracking = {
        containerNumber: 'CONF0003',
        scac: 'TEST',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Clear weather delay'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'TEST PORT'
        }
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      mockTrackingAdapter.getTrackingByContainer.mockResolvedValue({
        success: true,
        data: tracking,
        message: 'Tracking found'
      });

      mockDelayAnalyzer.analyzeDelay.mockResolvedValue({
        isWeatherRelated: true,
        reasoning: 'Clear weather pattern',
        confidence: 0.95  // Above 0.8 threshold
      });

      mockWeatherProvider.getWeather.mockResolvedValue({
        status: WeatherFetchStatus.SUCCESS,
        data: { temperature: 18.5, windSpeed: 12.3 }
      });

      // Act
      const result = await analyzer.analyzeShipments(['SGL_CONF3']);

      // Assert
      expect(mockDelayAnalyzer.analyzeDelay).toHaveBeenCalledTimes(1); // No retry
      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.records[0].temperature).toBe(18.5); // Weather was fetched
    });
  });

  describe('Parallel Batch Processing', () => {
    // Test: Process large number of shipments in batches
    it('should process multiple shipments in parallel batches', async () => {
      // Arrange: Create 12 shipments (batch size is 5, so 3 batches)
      const shipmentIds = Array.from({ length: 12 }, (_, i) => `SGL_BATCH_${i + 1}`);

      // Mock all shipments to return successfully
      for (let i = 0; i < 12; i++) {
        const shipment: Shipment = {
          shipmentId: shipmentIds[i],
          customerName: `Customer ${i + 1}`,
          shipperName: `Shipper ${i + 1}`,
          containers: [{ containerNumber: `CONT_${i + 1}` }]
        };

        const tracking: Tracking = {
          containerNumber: `CONT_${i + 1}`,
          scac: 'TEST',
          estimatedArrival: new Date('2025-07-16T03:00:00Z'),
          delayReasons: []
        };

        mockShipmentAdapter.getShipmentById.mockResolvedValueOnce({
          success: true,
          data: shipment,
          message: 'Shipment found'
        });

        mockTrackingAdapter.getTrackingByContainer.mockResolvedValueOnce({
          success: true,
          data: tracking,
          message: 'Tracking found'
        });
      }

      // Act
      const result = await analyzer.analyzeShipments(shipmentIds);

      // Assert: All 12 shipments processed
      expect(result.records).toHaveLength(12);
      expect(result.errors).toHaveLength(0);

      // Verify all shipments were fetched
      expect(mockShipmentAdapter.getShipmentById).toHaveBeenCalledTimes(12);
      expect(mockTrackingAdapter.getTrackingByContainer).toHaveBeenCalledTimes(12);

      // Verify each record
      for (let i = 0; i < 12; i++) {
        expect(result.records[i].sglShipmentNo).toBe(`SGL_BATCH_${i + 1}`);
        expect(result.records[i].customerName).toBe(`Customer ${i + 1}`);
        expect(result.records[i].containerNumber).toBe(`CONT_${i + 1}`);
      }
    });

    // Test: Batch processing with mixed success/failure
    it('should handle failures in parallel batches gracefully', async () => {
      // Arrange: 7 shipments (batch size 5 = 2 batches), some fail
      const shipmentIds = ['SUCCESS1', 'FAIL1', 'SUCCESS2', 'FAIL2', 'SUCCESS3', 'SUCCESS4', 'SUCCESS5'];

      // Setup mocks in the order they'll be called (batch 1: first 5 in parallel, batch 2: last 2 in parallel)
      // Batch 1: SUCCESS1, FAIL1, SUCCESS2, FAIL2, SUCCESS3 (parallel, order may vary)
      // Batch 2: SUCCESS4, SUCCESS5 (parallel, order may vary)

      // We need to set up mocks for all IDs regardless of parallel execution order
      // SUCCESS1
      mockShipmentAdapter.getShipmentById.mockImplementation((id: string) => {
        if (id === 'SUCCESS1' || id === 'SUCCESS2' || id === 'SUCCESS3' || id === 'SUCCESS4' || id === 'SUCCESS5') {
          return Promise.resolve({
            success: true,
            data: {
              shipmentId: id,
              customerName: 'Test Corp',
              shipperName: 'Test Shipper',
              containers: [{ containerNumber: `${id}_CONT` }]
            },
            message: 'Shipment found'
          });
        } else if (id === 'FAIL1') {
          return Promise.resolve({
            success: false,
            message: 'Error: Database connection failed'
          });
        } else if (id === 'FAIL2') {
          return Promise.resolve({
            success: true,
            message: 'Shipment not found'
          });
        }
        return Promise.resolve({ success: false, message: 'Unknown ID' });
      });

      mockTrackingAdapter.getTrackingByContainer.mockImplementation((containerNumber: string) => {
        return Promise.resolve({
          success: true,
          data: {
            containerNumber,
            scac: 'TEST',
            estimatedArrival: new Date('2025-07-16T03:00:00Z'),
            delayReasons: []
          },
          message: 'Tracking found'
        });
      });

      // Act
      const result = await analyzer.analyzeShipments(shipmentIds);

      // Assert: 7 records (5 success + 2 error placeholders), 2 errors
      expect(result.records).toHaveLength(7);
      expect(result.errors).toHaveLength(2);

      // Verify error records exist (order may vary due to parallel processing)
      const errorRecords = result.records.filter(r => r.sglShipmentNo === 'FAIL1' || r.sglShipmentNo === 'FAIL2');
      expect(errorRecords).toHaveLength(2);
      expect(errorRecords.every(r => r.customerName === '')).toBe(true);

      // Verify error entries exist
      const fail1Error = result.errors.find(e => e.containerNumber === 'FAIL1');
      const fail2Error = result.errors.find(e => e.containerNumber === 'FAIL2');

      expect(fail1Error).toBeDefined();
      expect(fail1Error?.errorType).toBe('SHIPMENT_FETCH_ERROR');
      expect(fail2Error).toBeDefined();
      expect(fail2Error?.errorType).toBe('SHIPMENT_NOT_FOUND');
    });

    // Test: Verify batch size is respected
    it('should process shipments with custom batch size', async () => {
      // Arrange: Create analyzer with batch size 2
      const customAnalyzer = new ShipmentAnalyzerService(
        mockShipmentAdapter,
        mockTrackingAdapter,
        mockWeatherProvider,
        mockDelayAnalyzer,
        2 // Custom batch size
      );

      const shipmentIds = ['SGL1', 'SGL2', 'SGL3'];

      for (const id of shipmentIds) {
        mockShipmentAdapter.getShipmentById.mockResolvedValueOnce({
          success: true,
          data: {
            shipmentId: id,
            customerName: 'Test Corp',
            shipperName: 'Test Shipper',
            containers: [{ containerNumber: `${id}_CONT` }]
          },
          message: 'Shipment found'
        });

        mockTrackingAdapter.getTrackingByContainer.mockResolvedValueOnce({
          success: true,
          data: {
            containerNumber: `${id}_CONT`,
            scac: 'TEST',
            estimatedArrival: new Date('2025-07-16T03:00:00Z'),
            delayReasons: []
          },
          message: 'Tracking found'
        });
      }

      // Act
      const result = await customAnalyzer.analyzeShipments(shipmentIds);

      // Assert: All 3 processed successfully
      expect(result.records).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.records[0].sglShipmentNo).toBe('SGL1');
      expect(result.records[1].sglShipmentNo).toBe('SGL2');
      expect(result.records[2].sglShipmentNo).toBe('SGL3');
    });

    // Test: Parallel container processing within shipments
    it('should process multiple containers within a shipment in parallel', async () => {
      // Arrange: One shipment with 3 containers
      const shipment: Shipment = {
        shipmentId: 'SGL_MULTI',
        customerName: 'Multi Container Corp',
        shipperName: 'Multi Shipper',
        containers: [
          { containerNumber: 'CONT_A' },
          { containerNumber: 'CONT_B' },
          { containerNumber: 'CONT_C' }
        ]
      };

      mockShipmentAdapter.getShipmentById.mockResolvedValue({
        success: true,
        data: shipment,
        message: 'Shipment found'
      });

      // All containers have tracking
      for (const container of shipment.containers) {
        mockTrackingAdapter.getTrackingByContainer.mockResolvedValueOnce({
          success: true,
          data: {
            containerNumber: container.containerNumber,
            scac: 'TEST',
            estimatedArrival: new Date('2025-07-16T03:00:00Z'),
            delayReasons: []
          },
          message: 'Tracking found'
        });
      }

      // Act
      const result = await analyzer.analyzeShipments(['SGL_MULTI']);

      // Assert: 3 records for 3 containers
      expect(result.records).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      expect(result.records[0].containerNumber).toBe('CONT_A');
      expect(result.records[1].containerNumber).toBe('CONT_B');
      expect(result.records[2].containerNumber).toBe('CONT_C');

      // All should have same shipment info
      result.records.forEach(record => {
        expect(record.sglShipmentNo).toBe('SGL_MULTI');
        expect(record.customerName).toBe('Multi Container Corp');
        expect(record.shipperName).toBe('Multi Shipper');
      });
    });
  });
});
