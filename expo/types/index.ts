export interface Vineyard {
  id: string;
  name: string;
  variety: string;
  area: number;
  areaUnit: 'ha' | 'acres';
  location: {
    latitude: number;
    longitude: number;
  };
  plantingDate: string;
  healthScore: number;
  lastScan: string;
  alerts: number;
  imageUrl?: string;
}

export interface IndexRange {
  label: string;
  min: number;
  max: number;
  color: string;
  meaning: string;
}

export interface SatelliteIndex {
  id: string;
  name: string;
  abbreviation: 'NDMI' | 'NDRE' | 'RECI' | 'MSAVI' | 'S2L2A';
  description: string;
  plainEnglish: string;
  whatItMeasures: string;
  whyItMatters: string;
  howToRead: string;
  actionGuidance: string;
  interpretationRanges: IndexRange[];
  value: number;
  min: number;
  max: number;
  unit: string;
  status: 'healthy' | 'moderate' | 'stressed' | 'critical';
  lastUpdated: string;
  trend: number[];
  color: string;
}

export interface SoilProbe {
  id: string;
  name: string;
  vineyardId: string;
  vineyardName: string;
  batteryLevel: number;
  lastReading: string;
  isOnline: boolean;
  depth: number;
  readings: SoilReading;
}

export interface SoilReading {
  moisture: number;
  temperature: number;
  pH: number;
  ec: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  vineyardName: string;
  timestamp: string;
  isRead: boolean;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  forecast: string;
}
