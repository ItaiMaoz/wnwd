// Domain types - clean models isolated from external system formats

export interface Shipment {
  shipmentId: string;
  customerName: string;
  shipperName: string;
  containers: Container[];
}

export interface Container {
  containerNumber: string;
}

export interface Tracking {
  containerNumber: string;
  scac: string;
  estimatedArrival: Date;
  actualArrival?: Date;
  delayReasons: string[];
  destinationPort?: GeoLocation;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface Weather {
  temperature?: number;    // Celsius
  windSpeed?: number;      // m/s
  windDirection?: number;  // degrees
}
