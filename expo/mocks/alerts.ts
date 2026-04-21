import { Alert } from '@/types';

export const alerts: Alert[] = [
  {
    id: '1',
    type: 'danger',
    title: 'Soil moisture below threshold',
    message: 'Soil moisture at Creek Bend South has dropped below 20%. Advisory — review the irrigation recommendation before acting.',
    vineyardName: 'Creek Bend South',
    timestamp: '2026-04-02T06:30:00Z',
    isRead: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Probe Battery Low',
    message: 'Probe Delta-1 battery at 12%. Schedule replacement or recharge.',
    vineyardName: 'Creek Bend South',
    timestamp: '2026-04-02T05:00:00Z',
    isRead: false,
  },
  {
    id: '3',
    type: 'warning',
    title: 'NDMI trending down',
    message: 'NDMI values trending downward at Valley Floor East over the past 2 weeks. Advisory — recommended inspection for canopy water stress.',
    vineyardName: 'Valley Floor East',
    timestamp: '2026-04-01T18:00:00Z',
    isRead: true,
  },
  {
    id: '4',
    type: 'info',
    title: 'New Satellite Pass Available',
    message: 'Sentinel-2 L2A data updated for all fields. Latest imagery from April 1, 2026.',
    vineyardName: 'All Fields',
    timestamp: '2026-04-01T15:00:00Z',
    isRead: true,
  },
  {
    id: '5',
    type: 'warning',
    title: 'Soil pH out of range',
    message: 'Soil pH at Valley Floor East reading 5.8, below the optimal 6.0-7.0 range for Chardonnay. Advisory — verify with a second measurement before amending.',
    vineyardName: 'Valley Floor East',
    timestamp: '2026-04-01T12:00:00Z',
    isRead: false,
  },
];
