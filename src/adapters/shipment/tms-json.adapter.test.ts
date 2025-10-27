import 'reflect-metadata';
import { readFile } from 'fs/promises';
import { isSuccess } from '../../types/result.types';
import { TMSJsonAdapter } from './tms-json.adapter';

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));


describe('TMSJsonAdapter', () => {
  const mockDataPath = '/fake/path/tms-data.json';
  let adapter: TMSJsonAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new TMSJsonAdapter(mockDataPath);
  });

  describe('getShipmentById', () => {
    // Test: Valid shipment data returns correct domain model
    it('should return shipment with correctly mapped domain fields', async () => {
      // Arrange: Mock JSON with TMS structure
      const mockTMSData = [{
        sgl: {
          header: { sglShipmentNo: 'TMS0001' },
          parties: {
            customer: { name: 'Alpha Co' },
            shipper: { name: 'Zeta Ltd' }
          },
          containers: [
            { containerNo: 'UACU5855346', containerType: '40HC' }
          ]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTMSData));

      // Act: Request shipment by ID
      const result = await adapter.getShipmentById('TMS0001');

      // Assert: Returns success with correct domain mapping
      expect(result.success).toBe(true);
      expect(isSuccess(result) && result.data).toEqual({
        shipmentId: 'TMS0001',
        customerName: 'Alpha Co',
        shipperName: 'Zeta Ltd',
        containers: [{ containerNumber: 'UACU5855346' }]
      });
      expect(result.message).toContain('TMS0001');
    });

    // Test: Multiple containers are all mapped
    it('should map all containers for a shipment', async () => {
      // Arrange: Shipment with multiple containers
      const mockTMSData = [{
        sgl: {
          header: { sglShipmentNo: 'TMS0002' },
          parties: {
            customer: { name: 'Beta Ltd' },
            shipper: { name: 'Sigma Ltd' }
          },
          containers: [
            { containerNo: 'CONT001', containerType: '20GP' },
            { containerNo: 'CONT002', containerType: '40HC' },
            { containerNo: 'CONT003', containerType: '40GP' }
          ]
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTMSData));

      // Act
      const result = await adapter.getShipmentById('TMS0002');

      // Assert: All containers present with only containerNumber
      expect(result.success).toBe(true);
      expect(isSuccess(result) && result.data?.containers).toHaveLength(3);
      expect(isSuccess(result) && result.data?.containers).toEqual([
        { containerNumber: 'CONT001' },
        { containerNumber: 'CONT002' },
        { containerNumber: 'CONT003' }
      ]);
    });

    // Test: Empty containers array
    it('should handle shipment with no containers', async () => {
      // Arrange: Shipment with empty containers array
      const mockTMSData = [{
        sgl: {
          header: { sglShipmentNo: 'TMS0003' },
          parties: {
            customer: { name: 'Gamma Corp' },
            shipper: { name: 'Nu Delta' }
          },
          containers: []
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTMSData));

      // Act
      const result = await adapter.getShipmentById('TMS0003');

      // Assert: Success with empty containers
      expect(result.success).toBe(true);
      expect(isSuccess(result) && result.data?.containers).toEqual([]);
    });

    // Test: Non-existent shipment returns success with no data
    it('should return success without data when shipment not found', async () => {
      // Arrange: JSON with different shipment ID
      const mockTMSData = [{
        sgl: {
          header: { sglShipmentNo: 'TMS0001' },
          parties: {
            customer: { name: 'Test' },
            shipper: { name: 'Test' }
          },
          containers: []
        }
      }];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTMSData));

      // Act: Request non-existent shipment
      const result = await adapter.getShipmentById('NONEXISTENT');

      // Assert: Success without data
      expect(result.success).toBe(true);
      expect(isSuccess(result)).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.message).toContain('NONEXISTENT');
    });

    // Test: Empty array returns success without data
    it('should handle empty shipment array', async () => {
      // Arrange: Empty JSON array
      (readFile as jest.Mock).mockResolvedValue('[]');

      // Act
      const result = await adapter.getShipmentById('TMS0001');

      // Assert: Success, not found
      expect(result.success).toBe(true);
      expect(isSuccess(result)).toBe(false);
      expect(result.message).toContain('not found');
    });

    // Test: Multiple shipments in array
    it('should correctly retrieve specific shipment from multiple entries', async () => {
      // Arrange: Multiple shipments
      const mockTMSData = [
        {
          sgl: {
            header: { sglShipmentNo: 'TMS0001' },
            parties: {
              customer: { name: 'Customer1' },
              shipper: { name: 'Shipper1' }
            },
            containers: [{ containerNo: 'CONT001', containerType: '20GP' }]
          }
        },
        {
          sgl: {
            header: { sglShipmentNo: 'TMS0002' },
            parties: {
              customer: { name: 'Customer2' },
              shipper: { name: 'Shipper2' }
            },
            containers: [{ containerNo: 'CONT002', containerType: '40HC' }]
          }
        },
        {
          sgl: {
            header: { sglShipmentNo: 'TMS0003' },
            parties: {
              customer: { name: 'Customer3' },
              shipper: { name: 'Shipper3' }
            },
            containers: [{ containerNo: 'CONT003', containerType: '40GP' }]
          }
        }
      ];
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTMSData));

      // Act: Get middle shipment
      const result = await adapter.getShipmentById('TMS0002');

      // Assert: Returns correct shipment
      expect(result.success).toBe(true);
      expect(isSuccess(result) && result.data?.shipmentId).toBe('TMS0002');
      expect(isSuccess(result) && result.data?.customerName).toBe('Customer2');
      expect(isSuccess(result) && result.data?.containers).toEqual([{ containerNumber: 'CONT002' }]);
    });

    // Test: File read error returns failure
    it('should return failure when file cannot be read', async () => {
      // Arrange: File system error
      (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file'));

      // Act
      const result = await adapter.getShipmentById('TMS0001');

      // Assert: Failure with error message
      expect(result.success).toBe(false);
      expect(isSuccess(result)).toBe(false);
      expect(result.message).toContain('Failed to load TMS data');
      expect(result.message).toContain('ENOENT');
    });

    // Test: Invalid JSON returns failure
    it('should return failure when JSON is malformed', async () => {
      // Arrange: Invalid JSON string
      (readFile as jest.Mock).mockResolvedValue('{ invalid json }');

      // Act
      const result = await adapter.getShipmentById('TMS0001');

      // Assert: Failure with parse error
      expect(result.success).toBe(false);
      expect(isSuccess(result)).toBe(false);
      expect(result.message).toContain('Failed to load TMS data');
    });
  });
});
