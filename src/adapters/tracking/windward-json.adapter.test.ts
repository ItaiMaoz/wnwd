import 'reflect-metadata';
import { readFile } from 'fs/promises';
import { WindwardJsonAdapter } from './windward-json.adapter';

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

describe('WindwardJsonAdapter', () => {
  const mockDataPath = '/fake/path/windward-data.json';
  let adapter: WindwardJsonAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new WindwardJsonAdapter(mockDataPath);
  });

  describe('getTrackingByContainer', () => {
    // Test: Valid tracking data returns correct domain model
    it('should return tracking with correctly mapped domain fields', async () => {
      // Arrange: Mock JSON with Windward structure
      const mockWindwardData = [{
        trackedShipments: {
          count: 1,
          data: [{
            shipment: {
              containerNumber: 'UACU5855346',
              scac: 'MAEU',
              carrierBookingReference: 'MAE9876546',
              initialCarrierETA: '2025-07-16T03:00:00Z',
              initialCarrierETD: '2025-07-01T10:00:00Z',
              status: {
                actualArrivalAt: '2025-07-20T14:30:00Z',
                actualDepartureAt: '2025-07-01T12:15:00Z',
                delay: {
                  reasons: [
                    { delayReasonDescription: 'Heavy fog conditions' },
                    { delayReasonDescription: 'Customs inspection delay' }
                  ]
                }
              },
              destinationPort: {
                name: 'HAMBURG',
                lon: 9.9937,
                lat: 53.5511
              }
            }
          }]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act: Request tracking by container
      const result = await adapter.getTrackingByContainer('UACU5855346');

      // Assert: Returns success with correct domain mapping
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        containerNumber: 'UACU5855346',
        scac: 'MAEU',
        estimatedArrival: new Date('2025-07-16T03:00:00Z'),
        actualArrival: new Date('2025-07-20T14:30:00Z'),
        delayReasons: ['Heavy fog conditions', 'Customs inspection delay'],
        destinationPort: {
          latitude: 53.5511,
          longitude: 9.9937,
          name: 'HAMBURG'
        }
      });
      expect(result.message).toContain('UACU5855346');
    });

    // Test: No delay reasons returns empty array
    it('should return empty delay reasons when no delays exist', async () => {
      // Arrange: Tracking without delay field
      const mockWindwardData = [{
        trackedShipments: {
          count: 1,
          data: [{
            shipment: {
              containerNumber: 'TEMU1234567',
              scac: 'HLCU',
              carrierBookingReference: 'HLC445566',
              initialCarrierETA: '2025-07-02T10:30:00Z',
              initialCarrierETD: '2025-06-28T12:00:00Z',
              status: {
                actualArrivalAt: '2025-07-02T10:30:00Z',
                actualDepartureAt: '2025-06-28T12:00:00Z'
              },
              destinationPort: {
                name: 'ROTTERDAM',
                lon: 4.47917,
                lat: 51.9225
              }
            }
          }]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act
      const result = await adapter.getTrackingByContainer('TEMU1234567');

      // Assert: Empty delay reasons
      expect(result.success).toBe(true);
      expect(result.data?.delayReasons).toEqual([]);
    });

    // Test: No actual arrival returns undefined
    it('should return undefined actualArrival when not present', async () => {
      // Arrange: Tracking without actualArrivalAt
      const mockWindwardData = [{
        trackedShipments: {
          count: 1,
          data: [{
            shipment: {
              containerNumber: 'FFAU2384633',
              scac: 'MSCU',
              carrierBookingReference: null,
              initialCarrierETA: '2025-08-01T12:00:00Z',
              initialCarrierETD: '2025-07-13T11:00:00Z',
              status: {
                actualDepartureAt: '2025-07-13T14:00:00Z'
              },
              destinationPort: {
                name: 'HAIFA',
                lon: 34.9896,
                lat: 32.8167
              }
            }
          }]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act
      const result = await adapter.getTrackingByContainer('FFAU2384633');

      // Assert: actualArrival is undefined
      expect(result.success).toBe(true);
      expect(result.data?.actualArrival).toBeUndefined();
      expect(result.data?.estimatedArrival).toEqual(new Date('2025-08-01T12:00:00Z'));
    });

    // Test: No destination port returns undefined
    it('should return undefined destinationPort when not present', async () => {
      // Arrange: Tracking without destinationPort
      const mockWindwardData = [{
        trackedShipments: {
          count: 1,
          data: [{
            shipment: {
              containerNumber: 'NYKU7778881',
              scac: 'ONEU',
              carrierBookingReference: 'ONE111222',
              initialCarrierETA: '2025-07-25T14:30:00Z',
              initialCarrierETD: '2025-07-02T10:00:00Z',
              status: {
                actualArrivalAt: '2025-07-25T17:45:00Z'
              }
            }
          }]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act
      const result = await adapter.getTrackingByContainer('NYKU7778881');

      // Assert: destinationPort is undefined
      expect(result.success).toBe(true);
      expect(result.data?.destinationPort).toBeUndefined();
    });

    // Test: Non-existent container returns success with no data
    it('should return success without data when container not found', async () => {
      // Arrange: JSON with different container
      const mockWindwardData = [{
        trackedShipments: {
          count: 1,
          data: [{
            shipment: {
              containerNumber: 'UACU5855346',
              scac: 'MAEU',
              carrierBookingReference: null,
              initialCarrierETA: '2025-07-16T03:00:00Z',
              initialCarrierETD: '2025-07-01T10:00:00Z',
              status: {}
            }
          }]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act: Request non-existent container
      const result = await adapter.getTrackingByContainer('NONEXISTENT');

      // Assert: Success without data
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.message).toContain('not found');
      expect(result.message).toContain('NONEXISTENT');
    });

    // Test: Empty array returns success without data
    it('should handle empty tracking array', async () => {
      // Arrange: Empty JSON array
      (readFile as jest.Mock).mockResolvedValue('[]');

      // Act
      const result = await adapter.getTrackingByContainer('CONT001');

      // Assert: Success, not found
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.message).toContain('not found');
    });

    // Test: Multiple containers in different shipments
    it('should correctly retrieve specific container from multiple entries', async () => {
      // Arrange: Multiple tracking entries
      const mockWindwardData = [
        {
          trackedShipments: {
            count: 1,
            data: [{
              shipment: {
                containerNumber: 'CONT001',
                scac: 'MAEU',
                carrierBookingReference: null,
                initialCarrierETA: '2025-07-16T03:00:00Z',
                initialCarrierETD: '2025-07-01T10:00:00Z',
                status: {},
                destinationPort: {
                  name: 'HAMBURG',
                  lon: 9.9937,
                  lat: 53.5511
                }
              }
            }]
          }
        },
        {
          trackedShipments: {
            count: 1,
            data: [{
              shipment: {
                containerNumber: 'CONT002',
                scac: 'MSCU',
                carrierBookingReference: null,
                initialCarrierETA: '2025-08-01T12:00:00Z',
                initialCarrierETD: '2025-07-13T11:00:00Z',
                status: {},
                destinationPort: {
                  name: 'HAIFA',
                  lon: 34.9896,
                  lat: 32.8167
                }
              }
            }]
          }
        }
      ];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act: Get second container
      const result = await adapter.getTrackingByContainer('CONT002');

      // Assert: Returns correct tracking
      expect(result.success).toBe(true);
      expect(result.data?.containerNumber).toBe('CONT002');
      expect(result.data?.scac).toBe('MSCU');
      expect(result.data?.destinationPort?.name).toBe('HAIFA');
    });

    // Test: Multiple containers within single trackedShipments entry
    it('should handle multiple containers in single tracked shipment entry', async () => {
      // Arrange: Single entry with multiple containers
      const mockWindwardData = [{
        trackedShipments: {
          count: 2,
          data: [
            {
              shipment: {
                containerNumber: 'CONT001',
                scac: 'MAEU',
                carrierBookingReference: null,
                initialCarrierETA: '2025-07-16T03:00:00Z',
                initialCarrierETD: '2025-07-01T10:00:00Z',
                status: {}
              }
            },
            {
              shipment: {
                containerNumber: 'CONT002',
                scac: 'MAEU',
                carrierBookingReference: null,
                initialCarrierETA: '2025-07-18T03:00:00Z',
                initialCarrierETD: '2025-07-03T10:00:00Z',
                status: {}
              }
            }
          ]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWindwardData));

      // Act: Get second container
      const result = await adapter.getTrackingByContainer('CONT002');

      // Assert: Returns correct tracking
      expect(result.success).toBe(true);
      expect(result.data?.containerNumber).toBe('CONT002');
      expect(result.data?.estimatedArrival).toEqual(new Date('2025-07-18T03:00:00Z'));
    });

    // Test: File read error returns failure
    it('should return failure when file cannot be read', async () => {
      // Arrange: File system error
      (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file'));

      // Act
      const result = await adapter.getTrackingByContainer('CONT001');

      // Assert: Failure with error message
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.message).toContain('Failed to load Windward tracking data');
      expect(result.message).toContain('ENOENT');
    });

    // Test: Invalid JSON returns failure
    it('should return failure when JSON is malformed', async () => {
      // Arrange: Invalid JSON string
      (readFile as jest.Mock).mockResolvedValue('{ invalid json }');

      // Act
      const result = await adapter.getTrackingByContainer('CONT001');

      // Assert: Failure with parse error
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.message).toContain('Failed to load Windward tracking data');
    });
  });
});
